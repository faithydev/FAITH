import { Injectable } from '@nestjs/common';
import { SETTING_KEYS, STAFF_ROLES, RoleKey } from '@faith/config';
import { Prisma } from '@faith/database';
import { createHash } from 'node:crypto';
import { OrdersService } from '../commerce/orders.service';
import { badRequest, conflict, forbidden, notFound } from '../core/errors';
import { AuditService, SettingsService } from '../core/platform.services';
import { PrismaService } from '../core/prisma.service';
import { Accounts, LedgerService } from '../finance/ledger.service';

const person = { select: { id: true, email: true, profile: { select: { displayName: true, username: true } } } } as const;
const RESTRICTED_SETTINGS = new Set<string>([SETTING_KEYS.commissionBps, SETTING_KEYS.appCommissionBps]);

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
    private readonly settings: SettingsService,
    private readonly orders: OrdersService,
  ) {}

  // --- Overview ------------------------------------------------------------

  /** Every figure comes from persisted records. Money is reported per currency, never summed across. */
  async overview() {
    const db = this.prisma.db;
    const monthAgo = new Date(Date.now() - 30 * 86_400_000);
    const [gmv, users, activeUsers, sellers, campaigns, failures, refunds, currencies] = await Promise.all([
      db.order.groupBy({ by: ['currency'], where: { status: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] } }, _sum: { totalMinor: true }, _count: true }),
      db.user.count({ where: { status: { not: 'DELETED' } } }),
      db.session.groupBy({ by: ['userId'], where: { lastSeenAt: { gt: monthAgo } } }),
      db.sellerOrder.groupBy({ by: ['storeId'], where: { status: { in: ['PAID', 'PARTIALLY_REFUNDED'] }, order: { paidAt: { gt: monthAgo } } } }),
      db.brandCampaign.count({ where: { status: 'ACTIVE' } }),
      db.payment.count({ where: { status: 'FAILED', createdAt: { gt: monthAgo } } }),
      db.refund.groupBy({ by: ['currency'], where: { status: 'PROCESSED' }, _sum: { amountMinor: true }, _count: true }),
      db.ledgerAccount.findMany({ where: { ownerType: 'platform', type: 'REVENUE' }, select: { key: true, currency: true } }),
    ]);
    const revenue = await Promise.all(currencies.map(async (a) => ({
      stream: a.key.split(':')[1]!, currency: a.currency, amountMinor: await this.ledger.balance(a.key),
    })));
    const refundTrend = await db.$queryRaw<{ day: Date; currency: string; amount: bigint; count: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, "currency", SUM("amountMinor")::bigint AS amount, COUNT(*)::bigint AS count
      FROM "Refund" WHERE "status" = 'PROCESSED' AND "createdAt" > now() - interval '30 days'
      GROUP BY day, "currency" ORDER BY day`;
    const gmvTrend = await db.$queryRaw<{ day: Date; currency: string; amount: bigint }[]>`
      SELECT date_trunc('day', "paidAt") AS day, "currency", SUM("totalMinor")::bigint AS amount
      FROM "Order" WHERE "paidAt" > now() - interval '30 days'
      GROUP BY day, "currency" ORDER BY day`;
    return {
      gmv: gmv.map((g) => ({ currency: g.currency, amountMinor: g._sum.totalMinor ?? 0n, orders: g._count })),
      revenue, users, activeUsers: activeUsers.length, activeSellers: sellers.length, activeCampaigns: campaigns,
      paymentFailures: failures,
      refunds: refunds.map((r) => ({ currency: r.currency, amountMinor: r._sum.amountMinor ?? 0n, count: r._count })),
      refundTrend, gmvTrend,
      trialBalance: await this.ledger.trialBalance(),
    };
  }

  // --- Users ---------------------------------------------------------------

  async users(q: string | undefined, page: { page: number; pageSize: number }) {
    // Removed accounts stay in the database only as anonymous rows for the ledger.
    const where: Prisma.UserWhereInput = {
      status: { not: 'DELETED' },
      ...(q ? { OR: [{ email: { contains: q, mode: 'insensitive' } }, { profile: { displayName: { contains: q, mode: 'insensitive' } } }] } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.db.user.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (page.page - 1) * page.pageSize, take: page.pageSize,
        select: {
          id: true, email: true, status: true, emailVerifiedAt: true, createdAt: true,
          profile: { select: { displayName: true, username: true } },
          roles: { select: { role: { select: { key: true } } } },
        },
      }),
      this.prisma.db.user.count({ where }),
    ]);
    return { items, total, page: page.page, pageSize: page.pageSize, pages: Math.max(1, Math.ceil(total / page.pageSize)) };
  }

  async setUserStatus(actorId: string, id: string, status: 'ACTIVE' | 'SUSPENDED', reason: string) {
    if (id === actorId) throw badRequest('CANNOT_MODERATE_SELF');
    await this.prisma.tx(async (tx) => {
      await tx.user.update({ where: { id }, data: { status } });
      if (status === 'SUSPENDED') await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.record({ actor: { id: actorId }, action: `user.${status.toLowerCase()}`, resourceType: 'User', resourceId: id, metadata: { reason } }, tx);
    });
    return { status };
  }

  /** Only a super administrator can reach this, and nobody can change their own roles. */
  async setRole(actorId: string, userId: string, roleKey: string, grant: boolean) {
    if (userId === actorId) throw forbidden('CANNOT_CHANGE_OWN_ROLES');
    if (!STAFF_ROLES.includes(roleKey as RoleKey)) throw badRequest('NOT_A_STAFF_ROLE');
    const role = await this.prisma.db.role.findUnique({ where: { key: roleKey } });
    if (!role) throw notFound('ROLE_NOT_FOUND');
    await this.prisma.tx(async (tx) => {
      if (grant) {
        await tx.userRole.upsert({
          where: { userId_roleId: { userId, roleId: role.id } },
          update: {},
          create: { userId, roleId: role.id, grantedById: actorId },
        });
      } else {
        await tx.userRole.deleteMany({ where: { userId, roleId: role.id } });
      }
      await this.audit.record({ actor: { id: actorId }, action: grant ? 'role.granted' : 'role.revoked', resourceType: 'User', resourceId: userId, metadata: { role: roleKey } }, tx);
    });
    return { status: 'ok' };
  }

  roles() {
    return this.prisma.db.role.findMany({ orderBy: { key: 'asc' }, include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } } });
  }

  organizations() {
    return this.prisma.db.organization.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { _count: { select: { members: true, campaigns: true, jobs: true } } } });
  }

  // --- Verification --------------------------------------------------------

  verifications() {
    return this.prisma.db.verificationRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: { user: person, org: { select: { name: true } } },
    });
  }

  async decideVerification(actorId: string, id: string, approve: boolean, note?: string) {
    const v = await this.prisma.db.verificationRequest.findUnique({ where: { id } });
    if (!v || v.status !== 'PENDING') throw notFound();
    return this.prisma.tx(async (tx) => {
      const row = await tx.verificationRequest.update({
        where: { id },
        data: { status: approve ? 'APPROVED' : 'REJECTED', reviewerId: actorId, decisionNote: note, decidedAt: new Date() },
      });
      if (approve && v.orgId) await tx.organization.update({ where: { id: v.orgId }, data: { verifiedAt: new Date() } });
      if (approve && v.kind === 'DEVELOPER') await tx.developerProfile.updateMany({ where: { userId: v.userId }, data: { verifiedAt: new Date() } });
      await this.audit.record({ actor: { id: actorId }, action: `verification.${approve ? 'approved' : 'rejected'}`, resourceType: 'VerificationRequest', resourceId: id }, tx);
      return row;
    });
  }

  // --- Moderation ----------------------------------------------------------

  async products(status?: string) {
    return this.prisma.db.product.findMany({
      where: status ? { status: status as 'PUBLISHED' } : {},
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: { id: true, slug: true, title: true, status: true, type: true, currency: true, priceFromMinor: true, salesCount: true, store: { select: { name: true, slug: true } } },
    });
  }

  async moderateProduct(actorId: string, id: string, approve: boolean, note?: string) {
    const p = await this.prisma.db.product.update({ where: { id }, data: { status: approve ? 'PUBLISHED' : 'REJECTED', moderationNote: note } });
    await this.audit.record({ actor: { id: actorId }, action: `product.${approve ? 'restored' : 'rejected'}`, resourceType: 'Product', resourceId: id, metadata: { note } });
    return p;
  }

  async setStoreStatus(actorId: string, id: string, status: 'ACTIVE' | 'SUSPENDED') {
    const s = await this.prisma.db.store.update({ where: { id }, data: { status } });
    await this.audit.record({ actor: { id: actorId }, action: `store.${status.toLowerCase()}`, resourceType: 'Store', resourceId: id });
    return s;
  }

  campaigns() {
    return this.prisma.db.brandCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, slug: true, title: true, status: true, type: true, currency: true, budgetMinor: true, fundedMinor: true, accruedMinor: true, createdAt: true,
        org: { select: { name: true } }, _count: { select: { submissions: true, fraudSignals: true } },
      },
    });
  }

  async moderateCampaign(actorId: string, id: string, approve: boolean, note?: string) {
    const c = await this.prisma.db.brandCampaign.findUnique({ where: { id } });
    if (!c || c.status !== 'PENDING_REVIEW') throw conflict('CAMPAIGN_NOT_IN_REVIEW');
    const row = await this.prisma.db.brandCampaign.update({ where: { id }, data: { status: approve ? 'ACTIVE' : 'REJECTED', moderationNote: note } });
    await this.audit.record({ actor: { id: actorId }, action: `campaign.${approve ? 'approved' : 'rejected'}`, resourceType: 'BrandCampaign', resourceId: id, metadata: { note } });
    return row;
  }

  submissions() {
    return this.prisma.db.campaignSubmission.findMany({
      where: { status: { in: ['SUBMITTED', 'APPEALED'] } },
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: {
        campaign: { select: { title: true, slug: true } },
        creator: { select: { profile: { select: { displayName: true } } } },
        signals: { where: { status: 'OPEN' } },
      },
    });
  }

  fraudSignals() {
    return this.prisma.db.fraudSignal.findMany({ where: { status: 'OPEN' }, orderBy: { createdAt: 'desc' }, take: 100, include: { campaign: { select: { title: true } } } });
  }

  jobs() {
    return this.prisma.db.job.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, slug: true, title: true, status: true, createdAt: true, org: { select: { name: true } } },
    });
  }

  async moderateJob(actorId: string, id: string, approve: boolean, note?: string) {
    const j = await this.prisma.db.job.update({
      where: { id },
      data: { status: approve ? 'OPEN' : 'REJECTED', moderationNote: note, publishedAt: approve ? new Date() : undefined },
    });
    await this.audit.record({ actor: { id: actorId }, action: `job.${approve ? 'approved' : 'rejected'}`, resourceType: 'Job', resourceId: id });
    return j;
  }

  ads() {
    return this.prisma.db.advertisement.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { createdBy: person, product: { select: { title: true } } } });
  }

  async moderateAd(actorId: string, id: string, approve: boolean) {
    const ad = await this.prisma.db.advertisement.findUnique({ where: { id } });
    if (!ad || ad.status !== 'PENDING_REVIEW') throw conflict('AD_STATE');
    const row = await this.prisma.db.advertisement.update({ where: { id }, data: { status: approve ? 'ACTIVE' : 'REJECTED' } });
    await this.audit.record({ actor: { id: actorId }, action: `ad.${approve ? 'approved' : 'rejected'}`, resourceType: 'Advertisement', resourceId: id });
    return row;
  }

  async content() {
    const [posts, reviews] = await Promise.all([
      this.prisma.db.post.findMany({ orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, title: true, status: true, createdAt: true, community: { select: { name: true } }, author: { select: { profile: { select: { displayName: true } } } } } }),
      this.prisma.db.customerReview.findMany({ orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, rating: true, body: true, status: true, createdAt: true, product: { select: { title: true } } } }),
    ]);
    return { posts, reviews };
  }

  async moderatePost(actorId: string, id: string, status: 'VISIBLE' | 'HIDDEN' | 'REMOVED') {
    await this.prisma.db.post.update({ where: { id }, data: { status } });
    await this.audit.record({ actor: { id: actorId }, action: `post.${status.toLowerCase()}`, resourceType: 'Post', resourceId: id });
    return { status };
  }

  async moderateReview(actorId: string, id: string, status: 'VISIBLE' | 'HIDDEN') {
    await this.prisma.db.customerReview.update({ where: { id }, data: { status } });
    await this.audit.record({ actor: { id: actorId }, action: `review.${status.toLowerCase()}`, resourceType: 'CustomerReview', resourceId: id });
    return { status };
  }

  // --- Finance -------------------------------------------------------------

  async transactions(page: { page: number; pageSize: number }) {
    const [items, total] = await Promise.all([
      this.prisma.db.ledgerTransaction.findMany({
        orderBy: { createdAt: 'desc' }, skip: (page.page - 1) * page.pageSize, take: page.pageSize,
        include: { entries: { include: { account: { select: { key: true } } } } },
      }),
      this.prisma.db.ledgerTransaction.count(),
    ]);
    return { items, total, page: page.page, pageSize: page.pageSize, pages: Math.max(1, Math.ceil(total / page.pageSize)) };
  }

  /** Compares what providers captured with what the ledger says is in clearing. */
  async reconciliation() {
    const captured = await this.prisma.db.payment.groupBy({ by: ['currency'], where: { status: 'SUCCEEDED' }, _sum: { amountMinor: true } });
    const rows = await Promise.all(captured.map(async (c) => {
      const clearing = await this.ledger.balance(Accounts.clearing(c.currency).key);
      const refunded = await this.prisma.db.refund.aggregate({ where: { currency: c.currency, status: 'PROCESSED' }, _sum: { amountMinor: true } });
      const paidOut = await this.prisma.db.payoutRequest.aggregate({ where: { currency: c.currency, status: 'PAID' }, _sum: { amountMinor: true } });
      const expected = (c._sum.amountMinor ?? 0n) - (refunded._sum.amountMinor ?? 0n) - (paidOut._sum.amountMinor ?? 0n);
      return { currency: c.currency, capturedMinor: c._sum.amountMinor ?? 0n, refundedMinor: refunded._sum.amountMinor ?? 0n, paidOutMinor: paidOut._sum.amountMinor ?? 0n, expectedMinor: expected, clearingMinor: clearing, matches: expected === clearing };
    }));
    return { rows, trialBalance: await this.ledger.trialBalance() };
  }

  refunds() {
    return this.prisma.db.refund.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { order: { select: { number: true } }, requestedBy: { select: { profile: { select: { displayName: true } } } } },
    });
  }

  decideRefund(actorId: string, id: string, approve: boolean, note?: string) {
    return this.orders.decideRefund(id, actorId, approve, note, { staff: true });
  }

  disputes() {
    return this.prisma.db.dispute.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { raisedBy: person, project: { select: { title: true } }, order: { select: { number: true } } },
    });
  }

  async resolveDispute(actorId: string, id: string, status: 'RESOLVED' | 'REJECTED', resolution: string) {
    const d = await this.prisma.db.dispute.update({ where: { id }, data: { status, resolution, resolvedById: actorId, resolvedAt: new Date() } });
    if (d.projectId) await this.prisma.db.project.updateMany({ where: { id: d.projectId, status: 'DISPUTED' }, data: { status: 'ACTIVE' } });
    await this.audit.record({ actor: { id: actorId }, action: `dispute.${status.toLowerCase()}`, resourceType: 'Dispute', resourceId: id });
    return d;
  }

  // --- Plans, settings, flags ----------------------------------------------

  plans() {
    return this.prisma.db.subscriptionPlan.findMany({ include: { features: true, _count: { select: { subscriptions: true } } }, orderBy: { createdAt: 'asc' } });
  }

  async setPlanPrice(actorId: string, key: string, body: { monthlyMinor: string | null; yearlyMinor: string | null; currency: string }) {
    const plan = await this.prisma.db.subscriptionPlan.update({
      where: { key },
      data: {
        monthlyMinor: body.monthlyMinor ? BigInt(body.monthlyMinor) : null,
        yearlyMinor: body.yearlyMinor ? BigInt(body.yearlyMinor) : null,
        currency: body.currency,
      },
    });
    await this.audit.record({ actor: { id: actorId }, action: 'plan.price_changed', resourceType: 'SubscriptionPlan', resourceId: plan.id, metadata: body });
    return plan;
  }

  async allSettings() {
    return this.prisma.db.platformSetting.findMany({ orderBy: { key: 'asc' } });
  }

  /** The 3.5% commission is a fixed business rule, so changing it needs finance authority too. */
  async setSetting(actor: { id: string; permissions: Set<string> }, key: string, value: unknown) {
    if (!Object.values(SETTING_KEYS).includes(key as never)) throw badRequest('UNKNOWN_SETTING');
    if (RESTRICTED_SETTINGS.has(key)) {
      if (!actor.permissions.has('admin.finance.write')) throw forbidden('MISSING_PERMISSION');
      if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 10_000) throw badRequest('INVALID_BPS');
    }
    const before = await this.prisma.db.platformSetting.findUnique({ where: { key } });
    const row = await this.settings.set(key, value, actor.id);
    await this.audit.record({ actor, action: 'setting.changed', resourceType: 'PlatformSetting', resourceId: key, metadata: { before: before?.value, after: value } });
    return row;
  }

  flagsList() {
    return this.prisma.db.featureFlag.findMany({ orderBy: { key: 'asc' }, include: { experiments: { select: { key: true, status: true } } } });
  }

  async setFlag(actorId: string, key: string, body: { enabled?: boolean; rolloutPct?: number; allowUsers?: string[] }) {
    const f = await this.prisma.db.featureFlag.update({ where: { key }, data: body });
    await this.audit.record({ actor: { id: actorId }, action: 'flag.changed', resourceType: 'FeatureFlag', resourceId: key, metadata: body });
    return f;
  }

  // --- Future Lab ----------------------------------------------------------

  experiments() {
    return this.prisma.db.experiment.findMany({
      orderBy: { createdAt: 'desc' },
      include: { flag: { select: { key: true, enabled: true, rolloutPct: true } }, _count: { select: { exposures: true, feedback: true } }, feedback: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
  }

  async createExperiment(actorId: string, body: { key: string; name: string; hypothesis: string; variants: string[]; flagKey?: string }) {
    const flag = body.flagKey ? await this.prisma.db.featureFlag.findUnique({ where: { key: body.flagKey } }) : null;
    if (body.flagKey && !flag) throw notFound('FLAG_NOT_FOUND');
    const row = await this.prisma.db.experiment.create({
      data: { key: body.key, name: body.name, hypothesis: body.hypothesis, variants: body.variants, flagId: flag?.id },
    });
    await this.audit.record({ actor: { id: actorId }, action: 'experiment.created', resourceType: 'Experiment', resourceId: row.id });
    return row;
  }

  /** Rolling back also turns the flag off, so the change takes effect immediately. */
  async setExperimentStatus(actorId: string, key: string, status: 'RUNNING' | 'PAUSED' | 'ROLLED_BACK' | 'SHIPPED') {
    const e = await this.prisma.db.experiment.update({ where: { key }, data: { status } });
    if (e.flagId) {
      if (status === 'ROLLED_BACK') await this.prisma.db.featureFlag.update({ where: { id: e.flagId }, data: { enabled: false, rolloutPct: 0 } });
      if (status === 'SHIPPED') await this.prisma.db.featureFlag.update({ where: { id: e.flagId }, data: { enabled: true, rolloutPct: 100 } });
    }
    await this.audit.record({ actor: { id: actorId }, action: `experiment.${status.toLowerCase()}`, resourceType: 'Experiment', resourceId: key });
    return e;
  }

  /** Deterministic per person, and exposure is recorded the first time it is read. */
  async assignment(key: string, userId: string) {
    const e = await this.prisma.db.experiment.findUnique({ where: { key } });
    if (!e || e.status !== 'RUNNING') return { key, variant: null };
    const variants = e.variants as string[];
    const n = createHash('sha256').update(`${key}:${userId}`).digest().readUInt32BE(0);
    const variant = variants[n % variants.length]!;
    await this.prisma.db.experimentExposure.upsert({
      where: { experimentId_userId: { experimentId: e.id, userId } },
      update: {},
      create: { experimentId: e.id, userId, variant },
    });
    return { key, variant };
  }

  async feedback(key: string, userId: string, rating: number, comment?: string) {
    const e = await this.prisma.db.experiment.findUnique({ where: { key } });
    if (!e) throw notFound();
    return this.prisma.db.experimentFeedback.create({ data: { experimentId: e.id, userId, rating, comment } });
  }

  // --- Logs, support -------------------------------------------------------

  auditLogs(page: { page: number; pageSize: number }) {
    return this.prisma.db.auditLog.findMany({
      orderBy: { createdAt: 'desc' }, skip: (page.page - 1) * page.pageSize, take: page.pageSize,
      include: { actor: { select: { email: true } } },
    });
  }

  securityEvents() {
    return this.prisma.db.securityEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  }

  tickets() {
    return this.prisma.db.supportTicket.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { user: person } });
  }

  async setTicketStatus(actorId: string, id: string, status: 'OPEN' | 'PENDING' | 'CLOSED') {
    return this.prisma.db.supportTicket.update({ where: { id }, data: { status, assigneeId: actorId } });
  }

  outbox() {
    return this.prisma.db.outboxEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, type: true, attempts: true, lastError: true, processedAt: true, createdAt: true } });
  }

}
