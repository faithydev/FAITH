import { Injectable, OnModuleInit } from '@nestjs/common';
import { SETTING_KEYS } from '@faith/config';
import type { BrandCampaign, CampaignSubmission, FraudKind, FraudSeverity, Payment, RewardMetric } from '@faith/database';
import { Prisma } from '@faith/database';
import { rewardFor } from '@faith/money';
import type { appealBody, campaignBody, campaignQuery, metricBody, submissionBody, submissionDecisionBody } from '@faith/validators';
import type { z } from 'zod';
import { uniqueSlug } from '../core/crypto';
import { badRequest, conflict, forbidden, notFound } from '../core/errors';
import { AuditService, EventsService, SettingsService } from '../core/platform.services';
import { PrismaService, Tx } from '../core/prisma.service';
import { paged, skipTake } from '../core/zod';
import { Accounts, LedgerService } from '../finance/ledger.service';
import { IdentityService } from '../identity/identity.service';
import { PaymentsService } from '../payments/payments.service';
import { adapterFor, normalizeContentUrl, verificationAdapters } from './verification';

const REVIEWABLE: CampaignSubmission['status'][] = ['SUBMITTED', 'APPEALED'];

@Injectable()
export class RewardsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityService,
    private readonly payments: PaymentsService,
    private readonly ledger: LedgerService,
    private readonly events: EventsService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    this.payments.register('CAMPAIGN_FUNDING', { succeeded: (tx, p) => this.fund(tx, p) });
  }

  // --- Public discovery ----------------------------------------------------

  async discover(q: z.infer<typeof campaignQuery>) {
    const where: Prisma.BrandCampaignWhereInput = {
      status: 'ACTIVE',
      submissionDeadline: { gt: new Date() },
      ...(q.type ? { type: q.type } : {}),
      ...(q.platform ? { platforms: { has: q.platform } } : {}),
      ...(q.country ? { OR: [{ countries: { has: q.country } }, { countries: { isEmpty: true } }] } : {}),
      ...(q.q ? { title: { contains: q.q, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.db.brandCampaign.findMany({
        where, orderBy: { createdAt: 'desc' }, ...skipTake(q),
        select: {
          id: true, slug: true, title: true, summary: true, type: true, currency: true, budgetMinor: true, fundedMinor: true,
          accruedMinor: true, platforms: true, countries: true, submissionDeadline: true, requiresApplication: true,
          org: { select: { name: true, slug: true, verifiedAt: true } },
          rules: { select: { metric: true, unitSize: true, rateMinor: true, capMinor: true, minQualified: true } },
          _count: { select: { submissions: true } },
        },
      }),
      this.prisma.db.brandCampaign.count({ where }),
    ]);
    return paged(items, total, q);
  }

  async detail(slug: string, userId?: string) {
    const c = await this.prisma.db.brandCampaign.findUnique({
      where: { slug },
      include: {
        org: { select: { name: true, slug: true, verifiedAt: true } },
        rules: true,
        requirements: { orderBy: { position: 'asc' } },
        assets: { select: { id: true, filename: true, mime: true, sizeBytes: true } },
        _count: { select: { submissions: true } },
      },
    });
    if (!c) throw notFound('CAMPAIGN_NOT_FOUND');
    if (c.status !== 'ACTIVE' && !(userId && await this.isOrgMember(c.orgId, userId))) throw notFound('CAMPAIGN_NOT_FOUND');
    const application = userId
      ? await this.prisma.db.campaignApplication.findUnique({ where: { campaignId_creatorId: { campaignId: c.id, creatorId: userId } } })
      : null;
    return {
      ...c,
      application,
      verification: c.platforms.map((p) => ({ platform: p, availability: adapterFor(p).availability(), note: adapterFor(p).note() })),
    };
  }

  private async isOrgMember(orgId: string, userId: string) {
    return !!(await this.prisma.db.organizationMember.findUnique({ where: { orgId_userId: { orgId, userId } } }));
  }

  verificationStatus() {
    return Object.values(verificationAdapters).map((a) => ({ platform: a.platform, availability: a.availability(), note: a.note() }));
  }

  // --- Brand side ----------------------------------------------------------

  private async ownedCampaign(id: string, userId: string) {
    const c = await this.prisma.db.brandCampaign.findUnique({ where: { id } });
    if (!c) throw notFound('CAMPAIGN_NOT_FOUND');
    const member = await this.prisma.db.organizationMember.findUnique({ where: { orgId_userId: { orgId: c.orgId, userId } } });
    if (!member || member.role === 'MEMBER') throw notFound('CAMPAIGN_NOT_FOUND');
    return c;
  }

  async create(userId: string, body: z.infer<typeof campaignBody>) {
    await this.identity.assertOrgRole(body.orgId, userId, ['OWNER', 'ADMIN', 'MANAGER']);
    if (body.submissionDeadline <= new Date()) throw badRequest('DEADLINE_IN_PAST');
    const { requirements, rules, budgetMinor, ...rest } = body;
    return this.prisma.db.brandCampaign.create({
      data: {
        ...rest,
        slug: uniqueSlug(body.title),
        createdById: userId,
        budgetMinor: BigInt(budgetMinor),
        requirements: { create: requirements.map((r, position) => ({ ...r, position })) },
        rules: {
          create: rules.map((r) => ({
            metric: r.metric, unitSize: BigInt(r.unitSize), rateMinor: BigInt(r.rateMinor), minQualified: BigInt(r.minQualified),
            capMinor: r.capMinor ? BigInt(r.capMinor) : null,
          })),
        },
      },
      include: { rules: true, requirements: true },
    });
  }

  async mine(userId: string) {
    const orgs = await this.prisma.db.organizationMember.findMany({ where: { userId }, select: { orgId: true } });
    return this.prisma.db.brandCampaign.findMany({
      where: { orgId: { in: orgs.map((o) => o.orgId) } },
      orderBy: { createdAt: 'desc' },
      include: {
        org: { select: { name: true } },
        _count: { select: { submissions: true, applications: true } },
      },
    });
  }

  /** Campaign money is paid in first, then accrued against. Budget is never promised unfunded. */
  async startFunding(id: string, userId: string, idempotencyKey: string) {
    const c = await this.ownedCampaign(id, userId);
    const due = c.budgetMinor - c.fundedMinor;
    if (due <= 0n) throw conflict('CAMPAIGN_ALREADY_FUNDED');
    return this.payments.start({
      purpose: 'CAMPAIGN_FUNDING', payerId: userId, amountMinor: due, currency: c.currency,
      idempotencyKey: `campaign:${id}:${idempotencyKey}`, description: `Campaign budget: ${c.title}`, campaignId: id,
    });
  }

  private async fund(tx: Tx, payment: Payment) {
    const c = await tx.brandCampaign.update({
      where: { id: payment.campaignId! },
      data: { fundedMinor: { increment: payment.amountMinor } },
    });
    await this.ledger.post(tx, {
      idempotencyKey: `campaign:${payment.id}:funded`, kind: 'campaign_funded', currency: c.currency,
      refType: 'BrandCampaign', refId: c.id,
      debit: [{ account: Accounts.clearing(c.currency), amountMinor: payment.amountMinor }],
      credit: [{ account: Accounts.campaignBudget(c.id, c.currency), amountMinor: payment.amountMinor }],
    });
  }

  async submitForReview(id: string, userId: string) {
    const c = await this.ownedCampaign(id, userId);
    if (!['DRAFT', 'REJECTED'].includes(c.status)) throw conflict('CAMPAIGN_NOT_SUBMITTABLE');
    if (c.fundedMinor <= 0n) throw badRequest('CAMPAIGN_NOT_FUNDED');
    return this.prisma.db.brandCampaign.update({ where: { id }, data: { status: 'PENDING_REVIEW' } });
  }

  async setPaused(id: string, userId: string, paused: boolean) {
    const c = await this.ownedCampaign(id, userId);
    if (c.status !== (paused ? 'ACTIVE' : 'PAUSED')) throw conflict('CAMPAIGN_STATE');
    return this.prisma.db.brandCampaign.update({ where: { id }, data: { status: paused ? 'PAUSED' : 'ACTIVE' } });
  }

  async review(id: string, userId: string) {
    const campaign = await this.ownedCampaign(id, userId);
    const [applications, submissions, signals, accrued] = await Promise.all([
      this.prisma.db.campaignApplication.findMany({
        where: { campaignId: id },
        orderBy: { createdAt: 'desc' },
        include: { creator: { select: { id: true, profile: { select: { displayName: true, username: true } } } } },
      }),
      this.prisma.db.campaignSubmission.findMany({
        where: { campaignId: id },
        orderBy: { createdAt: 'desc' },
        include: {
          creator: { select: { id: true, profile: { select: { displayName: true, username: true } } } },
          metrics: { orderBy: { capturedAt: 'desc' } },
          signals: { where: { status: 'OPEN' } },
          accruals: { where: { status: { not: 'REVERSED' } }, select: { amountMinor: true } },
        },
      }),
      this.prisma.db.fraudSignal.findMany({ where: { campaignId: id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.db.rewardAccrual.aggregate({ where: { campaignId: id, status: { not: 'REVERSED' } }, _sum: { amountMinor: true } }),
    ]);
    return { campaign, applications, submissions, signals, accruedMinor: accrued._sum.amountMinor ?? 0n };
  }

  async decideApplication(applicationId: string, userId: string, approve: boolean) {
    const app = await this.prisma.db.campaignApplication.findUnique({ where: { id: applicationId } });
    if (!app) throw notFound('APPLICATION_NOT_FOUND');
    await this.ownedCampaign(app.campaignId, userId);
    return this.prisma.db.campaignApplication.update({
      where: { id: applicationId },
      data: { status: approve ? 'APPROVED' : 'REJECTED', decidedById: userId, decidedAt: new Date() },
    });
  }

  async report(id: string, userId: string) {
    const { campaign, submissions, accruedMinor } = await this.review(id, userId);
    const qualified: Record<string, bigint> = {};
    for (const s of submissions) {
      for (const [metric, value] of latestMetrics(s.metrics)) qualified[metric] = (qualified[metric] ?? 0n) + value;
    }
    const approved = submissions.filter((s) => s.status === 'APPROVED').length;
    return {
      currency: campaign.currency,
      budgetMinor: campaign.budgetMinor,
      fundedMinor: campaign.fundedMinor,
      spentMinor: accruedMinor,
      remainingMinor: campaign.fundedMinor - campaign.accruedMinor,
      submissions: submissions.length,
      approved,
      rejected: submissions.filter((s) => s.status === 'REJECTED').length,
      qualified,
      costPerApprovedMinor: approved ? accruedMinor / BigInt(approved) : 0n,
      rows: submissions.map((s) => ({
        id: s.id, creator: s.creator.profile?.displayName ?? '—', platform: s.platform, url: s.url, status: s.status,
        earnedMinor: s.accruals.reduce((a, r) => a + r.amountMinor, 0n),
      })),
    };
  }

  // --- Creator side --------------------------------------------------------

  async apply(slug: string, userId: string, pitch: string) {
    const c = await this.prisma.db.brandCampaign.findUnique({ where: { slug } });
    if (!c || c.status !== 'ACTIVE') throw notFound('CAMPAIGN_NOT_FOUND');
    return this.prisma.db.campaignApplication.create({ data: { campaignId: c.id, creatorId: userId, pitch } });
  }

  /**
   * Accepts content for review. Risk signals are recorded for a human, not used to auto-reject:
   * simple rules are a triage aid, and a false positive should not cost a creator their work.
   */
  async submit(slug: string, userId: string, body: z.infer<typeof submissionBody>) {
    const c = await this.prisma.db.brandCampaign.findUnique({ where: { slug } });
    if (!c || c.status !== 'ACTIVE') throw notFound('CAMPAIGN_NOT_FOUND');
    if (c.submissionDeadline <= new Date()) throw badRequest('DEADLINE_PASSED');
    if (!c.platforms.includes(body.platform)) throw badRequest('PLATFORM_NOT_ELIGIBLE');

    if (c.requiresApplication) {
      const app = await this.prisma.db.campaignApplication.findUnique({ where: { campaignId_creatorId: { campaignId: c.id, creatorId: userId } } });
      if (app?.status !== 'APPROVED') {
        await this.signal(this.prisma.db, c.id, userId, 'INVALID_PARTICIPATION', 'LOW', { reason: 'submission without approved application' });
        throw forbidden('APPLICATION_REQUIRED');
      }
    }

    const normalizedUrl = normalizeContentUrl(body.url);
    const sameCampaign = await this.prisma.db.campaignSubmission.findUnique({
      where: { campaignId_normalizedUrl: { campaignId: c.id, normalizedUrl } },
    });
    if (sameCampaign) {
      await this.signal(this.prisma.db, c.id, userId, 'DUPLICATE_URL', sameCampaign.creatorId === userId ? 'LOW' : 'HIGH', { normalizedUrl, firstSubmissionId: sameCampaign.id });
      throw conflict('DUPLICATE_SUBMISSION');
    }

    return this.prisma.tx(async (tx) => {
      const submission = await tx.campaignSubmission.create({
        data: {
          campaignId: c.id, creatorId: userId, platform: body.platform, url: body.url, normalizedUrl, note: body.note,
          evidenceKeys: body.evidenceKeys, verification: adapterFor(body.platform).availability(),
        },
      });
      await this.assessRisk(tx, submission, c);
      return submission;
    });
  }

  private signal(db: Tx | PrismaService['db'], campaignId: string, creatorId: string, kind: FraudKind, severity: FraudSeverity, detail: Record<string, unknown>, submissionId?: string) {
    return db.fraudSignal.create({ data: { campaignId, creatorId, kind, severity, detail: detail as Prisma.InputJsonValue, submissionId } });
  }

  private async assessRisk(tx: Tx, s: CampaignSubmission, c: BrandCampaign) {
    // Same content entered into a different campaign, by anyone.
    const elsewhere = await tx.campaignSubmission.findFirst({
      where: { normalizedUrl: s.normalizedUrl, campaignId: { not: c.id } },
      select: { id: true, creatorId: true, campaignId: true },
    });
    if (elsewhere) {
      const other = elsewhere.creatorId !== s.creatorId;
      await this.signal(tx, c.id, s.creatorId, other ? 'UNAUTHORIZED_REUSE' : 'DUPLICATE_SUBMISSION', other ? 'HIGH' : 'MEDIUM', { otherSubmissionId: elsewhere.id }, s.id);
    }
    const lastHour = await tx.campaignSubmission.count({
      where: { creatorId: s.creatorId, createdAt: { gt: new Date(Date.now() - 3_600_000) } },
    });
    if (lastHour > 10) await this.signal(tx, c.id, s.creatorId, 'SUSPICIOUS_FREQUENCY', 'MEDIUM', { submissionsLastHour: lastHour }, s.id);

    if (s.evidenceKeys.length) {
      const reused = await tx.campaignSubmission.findFirst({
        where: { id: { not: s.id }, evidenceKeys: { hasSome: s.evidenceKeys } },
        select: { id: true },
      });
      if (reused) await this.signal(tx, c.id, s.creatorId, 'REPEATED_EVIDENCE', 'MEDIUM', { otherSubmissionId: reused.id }, s.id);
    }
    const banned = c.prohibitedContent.toLowerCase().split(/[,;\n]+/).map((w) => w.trim()).filter((w) => w.length > 3);
    const note = (s.note ?? '').toLowerCase();
    const hit = banned.find((w) => note.includes(w));
    if (hit) await this.signal(tx, c.id, s.creatorId, 'DISALLOWED_CONTENT', 'MEDIUM', { term: hit }, s.id);
  }

  async mySubmissions(userId: string) {
    return this.prisma.db.campaignSubmission.findMany({
      where: { creatorId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        campaign: { select: { slug: true, title: true, currency: true, rules: true } },
        metrics: { orderBy: { capturedAt: 'desc' } },
        accruals: { select: { amountMinor: true, status: true } },
        appeals: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  /** Estimated is what the numbers would earn; approved is what is actually owed. */
  async earnings(userId: string) {
    const submissions = await this.mySubmissions(userId);
    const estimate = new Map<string, bigint>();
    for (const s of submissions) {
      if (s.status === 'REJECTED') continue;
      const est = s.campaign.rules.reduce((a, r) => a + this.ruleTarget(r, latestMetrics(s.metrics)), 0n);
      const c = s.campaign.currency;
      estimate.set(c, (estimate.get(c) ?? 0n) + est);
    }
    const accruals = await this.prisma.db.rewardAccrual.groupBy({
      by: ['currency', 'status'],
      where: { creatorId: userId },
      _sum: { amountMinor: true },
    });
    const balances = await this.ledger.balancesFor('user', [userId]);
    const payouts = await this.prisma.db.payoutRequest.findMany({ where: { requestedById: userId, ownerType: 'user' }, orderBy: { createdAt: 'desc' } });
    return {
      estimated: [...estimate].map(([currency, amountMinor]) => ({ currency, amountMinor })),
      accruals: accruals.map((a) => ({ currency: a.currency, status: a.status, amountMinor: a._sum.amountMinor ?? 0n })),
      balances,
      payouts,
    };
  }

  // --- Review and reward calculation ---------------------------------------

  private ruleTarget(rule: { metric: RewardMetric; unitSize: bigint; rateMinor: bigint; minQualified: bigint; capMinor: bigint | null }, metrics: Map<string, bigint>) {
    if (rule.metric === 'APPROVED_SUBMISSION') return rule.capMinor != null && rule.rateMinor > rule.capMinor ? rule.capMinor : rule.rateMinor;
    return rewardFor({
      qualified: metrics.get(rule.metric) ?? 0n, unitSize: rule.unitSize, rateMinor: rule.rateMinor,
      minQualified: rule.minQualified, capMinor: rule.capMinor,
    });
  }

  private async assertReviewer(campaignId: string, userId: string, isStaff: boolean) {
    if (!isStaff) await this.ownedCampaign(campaignId, userId);
  }

  /**
   * The conditional status update is the guard against duplicate approval: however many
   * requests race, one flips the row and the rest see zero rows and stop before any money moves.
   */
  async decide(submissionId: string, reviewerId: string, body: z.infer<typeof submissionDecisionBody>, isStaff = false) {
    const s = await this.prisma.db.campaignSubmission.findUnique({ where: { id: submissionId } });
    if (!s) throw notFound('SUBMISSION_NOT_FOUND');
    await this.assertReviewer(s.campaignId, reviewerId, isStaff);
    if (s.creatorId === reviewerId) throw forbidden('CANNOT_REVIEW_OWN_SUBMISSION');

    return this.prisma.tx(async (tx) => {
      const approve = body.decision === 'approve';
      const flipped = await tx.campaignSubmission.updateMany({
        where: { id: submissionId, status: { in: REVIEWABLE } },
        data: {
          status: approve ? 'APPROVED' : 'REJECTED',
          reviewedById: reviewerId, reviewedAt: new Date(),
          rejectionReason: approve ? null : body.reason,
        },
      });
      if (flipped.count !== 1) throw conflict('SUBMISSION_ALREADY_REVIEWED');
      await tx.rewardReview.create({
        data: { submissionId, reviewerId, decision: approve ? 'APPROVED' : 'REJECTED', reason: body.reason },
      });
      await this.audit.record({ actor: { id: reviewerId }, action: `submission.${body.decision}`, resourceType: 'CampaignSubmission', resourceId: submissionId }, tx);
      if (approve) await this.accrue(tx, submissionId);
      return tx.campaignSubmission.findUniqueOrThrow({ where: { id: submissionId } });
    });
  }

  /**
   * Brings approved rewards up to what the latest metrics earn, posting only the increase.
   * Safe to call repeatedly: with no change it writes nothing. The campaign row is locked,
   * and the funded budget is a hard ceiling, so the campaign can never owe more than it holds.
   */
  private async accrue(tx: Tx, submissionId: string) {
    const s = await tx.campaignSubmission.findUniqueOrThrow({
      where: { id: submissionId },
      include: { metrics: { orderBy: { capturedAt: 'desc' } } },
    });
    if (s.status !== 'APPROVED') return;
    await tx.$queryRaw`SELECT "id" FROM "BrandCampaign" WHERE "id" = ${s.campaignId} FOR UPDATE`;
    const campaign = await tx.brandCampaign.findUniqueOrThrow({ where: { id: s.campaignId }, include: { rules: true } });
    const metrics = latestMetrics(s.metrics);
    const holdDays = await this.settings.get<number>(SETTING_KEYS.rewardHoldDays, 0, tx);

    for (const rule of campaign.rules) {
      const prior = await tx.rewardAccrual.findMany({ where: { submissionId, ruleId: rule.id, status: { not: 'REVERSED' } } });
      const paidSoFar = prior.reduce((a, r) => a + r.amountMinor, 0n);
      const target = this.ruleTarget(rule, metrics);
      if (target <= paidSoFar) continue;

      const fresh = await tx.brandCampaign.findUniqueOrThrow({ where: { id: campaign.id } });
      const remaining = fresh.fundedMinor - fresh.accruedMinor;
      const delta = min(target - paidSoFar, remaining);
      if (delta <= 0n) {
        await tx.brandCampaign.updateMany({ where: { id: campaign.id, status: 'ACTIVE' }, data: { status: 'COMPLETED' } });
        continue;
      }
      const sequence = await tx.rewardAccrual.count({ where: { submissionId, ruleId: rule.id } });
      const accrual = await tx.rewardAccrual.create({
        data: {
          campaignId: campaign.id, submissionId, ruleId: rule.id, creatorId: s.creatorId, sequence, amountMinor: delta,
          currency: campaign.currency, qualified: metrics.get(rule.metric) ?? 1n,
          availableAt: new Date(Date.now() + holdDays * 86_400_000),
        },
      });
      await tx.brandCampaign.update({ where: { id: campaign.id }, data: { accruedMinor: { increment: delta } } });
      await this.ledger.post(tx, {
        idempotencyKey: `accrual:${accrual.id}`, kind: 'reward_accrued', currency: campaign.currency,
        refType: 'RewardAccrual', refId: accrual.id,
        debit: [{ account: Accounts.campaignBudget(campaign.id, campaign.currency), amountMinor: delta }],
        credit: [{ account: Accounts.userEarnings(s.creatorId, campaign.currency), amountMinor: delta }],
      });
      await this.events.emit(tx, 'reward.approved', {
        accrualId: accrual.id, creatorId: s.creatorId, campaignId: campaign.id, title: campaign.title,
        amountMinor: delta.toString(), currency: campaign.currency,
      });
    }
    await this.events.emit(tx, 'submission.approved', { submissionId, creatorId: s.creatorId, campaignId: campaign.id });
  }

  /** Records a metric snapshot. Sources are explicit: nothing here came from a platform API. */
  async recordMetric(submissionId: string, userId: string, body: z.infer<typeof metricBody>, isStaff = false, source: 'MANUAL' | 'SIMULATED' = 'MANUAL') {
    const s = await this.prisma.db.campaignSubmission.findUnique({
      where: { id: submissionId },
      include: { metrics: { where: { metric: body.metric }, orderBy: { capturedAt: 'desc' }, take: 1 } },
    });
    if (!s) throw notFound('SUBMISSION_NOT_FOUND');
    await this.assertReviewer(s.campaignId, userId, isStaff);
    const value = BigInt(body.value);
    return this.prisma.tx(async (tx) => {
      const metric = await tx.campaignMetric.create({
        data: { submissionId, metric: body.metric, value, source, recordedById: userId },
      });
      const last = s.metrics[0];
      if (last && value < last.value) {
        await this.signal(tx, s.campaignId, s.creatorId, 'INCONSISTENT_METRICS', 'MEDIUM', { metric: body.metric, previous: last.value.toString(), current: value.toString() }, s.id);
      }
      await this.accrue(tx, submissionId);
      return metric;
    });
  }

  /** Takes back rewards after a confirmed violation, through a reversing ledger entry. */
  async reverse(submissionId: string, actorId: string, reason: string) {
    return this.prisma.tx(async (tx) => {
      const accruals = await tx.rewardAccrual.findMany({ where: { submissionId, status: 'APPROVED' } });
      if (accruals.length === 0) throw badRequest('NOTHING_TO_REVERSE');
      for (const a of accruals) {
        await tx.rewardAccrual.update({ where: { id: a.id }, data: { status: 'REVERSED' } });
        await tx.brandCampaign.update({ where: { id: a.campaignId }, data: { accruedMinor: { decrement: a.amountMinor } } });
        await this.ledger.post(tx, {
          idempotencyKey: `accrual:${a.id}:reversed`, kind: 'reward_reversed', currency: a.currency, refType: 'RewardAccrual', refId: a.id,
          memo: reason,
          debit: [{ account: Accounts.userEarnings(a.creatorId, a.currency), amountMinor: a.amountMinor }],
          credit: [{ account: Accounts.campaignBudget(a.campaignId, a.currency), amountMinor: a.amountMinor }],
        });
      }
      await tx.campaignSubmission.update({ where: { id: submissionId }, data: { status: 'REJECTED', rejectionReason: reason } });
      await this.audit.record({ actor: { id: actorId }, action: 'reward.reversed', resourceType: 'CampaignSubmission', resourceId: submissionId, metadata: { reason } }, tx);
      return { status: 'reversed', count: accruals.length };
    });
  }

  // --- Appeals -------------------------------------------------------------

  async appeal(submissionId: string, userId: string, body: z.infer<typeof appealBody>) {
    const s = await this.prisma.db.campaignSubmission.findUnique({ where: { id: submissionId }, include: { appeals: true } });
    if (!s || s.creatorId !== userId) throw notFound('SUBMISSION_NOT_FOUND');
    if (s.status !== 'REJECTED') throw conflict('ONLY_REJECTED_CAN_APPEAL');
    if (s.appeals.length > 0) throw conflict('ALREADY_APPEALED');
    return this.prisma.tx(async (tx) => {
      await tx.campaignSubmission.update({ where: { id: submissionId }, data: { status: 'APPEALED' } });
      return tx.rewardAppeal.create({ data: { submissionId, creatorId: userId, reason: body.reason } });
    });
  }

  listAppeals() {
    return this.prisma.db.rewardAppeal.findMany({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'asc' },
      include: { submission: { include: { campaign: { select: { title: true } } } } },
    });
  }

  /** Staff only. Upholding returns the submission to review, which then approves it normally. */
  async resolveAppeal(appealId: string, actorId: string, uphold: boolean, resolution: string) {
    const appeal = await this.prisma.db.rewardAppeal.findUnique({ where: { id: appealId } });
    if (!appeal || appeal.status !== 'OPEN') throw notFound('APPEAL_NOT_FOUND');
    await this.prisma.db.rewardAppeal.update({
      where: { id: appealId },
      data: { status: uphold ? 'UPHELD' : 'DENIED', resolvedById: actorId, resolution, resolvedAt: new Date() },
    });
    if (uphold) return this.decide(appeal.submissionId, actorId, { decision: 'approve' }, true);
    await this.prisma.db.campaignSubmission.update({ where: { id: appeal.submissionId }, data: { status: 'REJECTED' } });
    return { status: 'denied' };
  }

  async decideSignal(id: string, userId: string, status: 'DISMISSED' | 'CONFIRMED', isStaff = false) {
    const signal = await this.prisma.db.fraudSignal.findUnique({ where: { id } });
    if (!signal) throw notFound();
    await this.assertReviewer(signal.campaignId, userId, isStaff);
    return this.prisma.db.fraudSignal.update({ where: { id }, data: { status, reviewedById: userId } });
  }
}

function latestMetrics(rows: { metric: string; value: bigint; capturedAt: Date }[]): Map<string, bigint> {
  const out = new Map<string, bigint>();
  const sorted = [...rows].sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime());
  for (const r of sorted) if (!out.has(r.metric)) out.set(r.metric, r.value);
  return out;
}

const min = (a: bigint, b: bigint) => (a < b ? a : b);
