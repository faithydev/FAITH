import { Injectable, OnModuleInit } from '@nestjs/common';
import type { Payment } from '@faith/database';
import { adBody } from '@faith/validators';
import type { z } from 'zod';
import { randomToken } from '../core/crypto';
import { badRequest, conflict, forbidden, notFound } from '../core/errors';
import { PrismaService, Tx } from '../core/prisma.service';
import { Accounts, LedgerService } from '../finance/ledger.service';
import { PaymentsService } from '../payments/payments.service';

const person = { select: { id: true, profile: { select: { displayName: true, username: true } } } } as const;

/** Conversations, notifications, global search. */
@Injectable()
export class CommunicationService {
  constructor(private readonly prisma: PrismaService) {}

  async conversations(userId: string) {
    const rows = await this.prisma.db.conversation.findMany({
      where: { participants: { some: { userId } } },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        participants: { include: { user: person } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, createdAt: true, senderId: true } },
      },
    });
    return rows.map((c) => {
      const me = c.participants.find((p) => p.userId === userId);
      const last = c.messages[0];
      return {
        id: c.id, subject: c.subject, updatedAt: c.updatedAt, last,
        others: c.participants.filter((p) => p.userId !== userId).map((p) => p.user),
        unread: !!last && last.senderId !== userId && (!me?.lastReadAt || last.createdAt > me.lastReadAt),
      };
    });
  }

  async start(userId: string, body: { recipientId: string; subject: string; body: string; refType?: string; refId?: string }) {
    if (body.recipientId === userId) throw badRequest('CANNOT_MESSAGE_SELF');
    const recipient = await this.prisma.db.user.findUnique({ where: { id: body.recipientId } });
    if (!recipient || recipient.status !== 'ACTIVE') throw notFound('USER_NOT_FOUND');
    return this.prisma.db.conversation.create({
      data: {
        subject: body.subject, refType: body.refType, refId: body.refId,
        participants: { create: [{ userId, lastReadAt: new Date() }, { userId: body.recipientId }] },
        messages: { create: { senderId: userId, body: body.body } },
      },
    });
  }

  async thread(id: string, userId: string) {
    const conv = await this.prisma.db.conversation.findUnique({
      where: { id },
      include: {
        participants: { include: { user: person } },
        messages: { orderBy: { createdAt: 'asc' }, take: 200, include: { sender: person } },
      },
    });
    if (!conv || !conv.participants.some((p) => p.userId === userId)) throw notFound('CONVERSATION_NOT_FOUND');
    await this.prisma.db.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: id, userId } },
      data: { lastReadAt: new Date() },
    });
    return conv;
  }

  async send(id: string, userId: string, body: string) {
    const member = await this.prisma.db.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId: id, userId } } });
    if (!member) throw notFound('CONVERSATION_NOT_FOUND');
    const message = await this.prisma.db.message.create({ data: { conversationId: id, senderId: userId, body } });
    await this.prisma.db.conversation.update({ where: { id }, data: { updatedAt: new Date() } });
    return message;
  }

  notifications(userId: string) {
    return this.prisma.db.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  async markRead(userId: string, id?: string) {
    await this.prisma.db.notification.updateMany({
      where: { userId, readAt: null, ...(id ? { id } : {}) },
      data: { readAt: new Date() },
    });
    return { status: 'ok' };
  }

  /** The shared search behind the command palette. Only public, published records. */
  async search(q: string) {
    const term = q.trim();
    if (term.length < 2) return { products: [], jobs: [], services: [], campaigns: [], apps: [] };
    const contains = { contains: term, mode: 'insensitive' as const };
    const [products, jobs, services, campaigns, apps] = await Promise.all([
      this.prisma.db.product.findMany({ where: { status: 'PUBLISHED', title: contains }, take: 5, select: { slug: true, title: true } }),
      this.prisma.db.job.findMany({ where: { status: 'OPEN', title: contains }, take: 5, select: { slug: true, title: true } }),
      this.prisma.db.serviceListing.findMany({ where: { status: 'PUBLISHED', title: contains }, take: 5, select: { slug: true, title: true } }),
      this.prisma.db.brandCampaign.findMany({ where: { status: 'ACTIVE', title: contains }, take: 5, select: { slug: true, title: true } }),
      this.prisma.db.appListing.findMany({ where: { status: 'PUBLISHED', name: contains }, take: 5, select: { slug: true, name: true } }),
    ]);
    return { products, jobs, services, campaigns, apps };
  }
}

/** Advertising and affiliates. Paid placement never enters the organic ranking query. */
@Injectable()
export class GrowthService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly ledger: LedgerService,
  ) {}

  onModuleInit() {
    this.payments.register('ADVERTISING', { succeeded: (tx, p) => this.adFunded(tx, p) });
  }

  private async adFunded(tx: Tx, payment: Payment) {
    await tx.advertisement.update({ where: { id: payment.adId! }, data: { status: 'PENDING_REVIEW' } });
    await this.ledger.post(tx, {
      idempotencyKey: `ad:${payment.id}:funded`, kind: 'advertising', currency: payment.currency, refType: 'Advertisement', refId: payment.adId!,
      debit: [{ account: Accounts.clearing(payment.currency), amountMinor: payment.amountMinor }],
      credit: [{ account: Accounts.advertising(payment.currency), amountMinor: payment.amountMinor }],
    });
  }

  myAds(userId: string) {
    return this.prisma.db.advertisement.findMany({
      where: { createdById: userId },
      orderBy: { createdAt: 'desc' },
      include: { product: { select: { title: true, slug: true } } },
    });
  }

  async createAd(userId: string, body: z.infer<typeof adBody>) {
    if (body.productId) {
      const p = await this.prisma.db.product.findUnique({ where: { id: body.productId }, include: { store: true } });
      if (!p || p.store.ownerId !== userId) throw notFound('PRODUCT_NOT_FOUND');
    }
    return this.prisma.db.advertisement.create({ data: { ...body, budgetMinor: BigInt(body.budgetMinor), createdById: userId } });
  }

  async fundAd(id: string, userId: string, idempotencyKey: string) {
    const ad = await this.prisma.db.advertisement.findUnique({ where: { id } });
    if (!ad || ad.createdById !== userId) throw notFound('AD_NOT_FOUND');
    if (ad.status !== 'DRAFT') throw conflict('AD_STATE');
    return this.payments.start({
      purpose: 'ADVERTISING', payerId: userId, amountMinor: ad.budgetMinor, currency: ad.currency,
      idempotencyKey: `ad:${id}:${idempotencyKey}`, description: `FAITH advertising: ${ad.title}`, adId: id,
    });
  }

  async adClick(id: string) {
    await this.prisma.db.advertisement.updateMany({ where: { id, status: 'ACTIVE' }, data: { clicks: { increment: 1 } } });
    return { status: 'ok' };
  }

  async createAffiliateLink(userId: string, productId: string) {
    const product = await this.prisma.db.product.findUnique({ where: { id: productId }, include: { store: true } });
    if (!product || product.status !== 'PUBLISHED') throw notFound('PRODUCT_NOT_FOUND');
    if (product.store.ownerId === userId) throw badRequest('CANNOT_AFFILIATE_OWN_PRODUCT');
    if (!product.affiliateBps) throw forbidden('AFFILIATE_PROGRAM_DISABLED');
    return this.prisma.db.affiliateLink.upsert({
      where: { ownerId_productId: { ownerId: userId, productId } },
      update: {},
      create: { ownerId: userId, productId, code: randomToken(8), commissionBps: product.affiliateBps },
    });
  }

  myAffiliateLinks(userId: string) {
    return this.prisma.db.affiliateLink.findMany({
      where: { ownerId: userId },
      include: { product: { select: { title: true, slug: true } }, _count: { select: { conversions: true } } },
    });
  }

  async affiliateClick(code: string) {
    await this.prisma.db.affiliateLink.updateMany({ where: { code, active: true }, data: { clicks: { increment: 1 } } });
    return { status: 'ok' };
  }
}

/** Opportunity Engine and Trust Engine. Both show their reasoning rather than a black-box score. */
@Injectable()
export class InsightService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Rule-based matching on data the person gave us. With recommendations consent off it returns
   * nothing. Each item carries the reason it appeared, in terms the person can check.
   */
  async opportunities(userId: string) {
    const profile = await this.prisma.db.userProfile.findUnique({ where: { userId } });
    if (!profile?.recommendationsConsent) return { consent: false, items: [] };

    const [candidate, freelancer, creator, onboarding] = await Promise.all([
      this.prisma.db.candidateProfile.findUnique({ where: { userId } }),
      this.prisma.db.freelancerProfile.findUnique({ where: { userId } }),
      this.prisma.db.creatorProfile.findUnique({ where: { userId } }),
      this.prisma.db.onboardingResponse.findMany({ where: { userId } }),
    ]);
    const skills = new Set([...(candidate?.skills ?? []), ...(freelancer?.skills ?? [])]);
    const answer = (persona: string, q: string) => onboarding.find((o) => o.persona === persona && o.question === q)?.answer;
    const platforms = new Set(((answer('create', 'platforms') as string[] | undefined) ?? []));
    const items: { kind: string; title: string; href: string; reason: string; matched: string[] }[] = [];

    if (skills.size) {
      const jobs = await this.prisma.db.job.findMany({
        where: { status: 'OPEN', skills: { hasSome: [...skills] } },
        take: 5,
        orderBy: { publishedAt: 'desc' },
        select: { slug: true, title: true, skills: true },
      });
      for (const j of jobs) {
        items.push({ kind: 'job', title: j.title, href: `/jobs/${j.slug}`, reason: 'skills_match', matched: j.skills.filter((s) => skills.has(s)) });
      }
    }
    if (platforms.size || creator) {
      const campaigns = await this.prisma.db.brandCampaign.findMany({
        where: { status: 'ACTIVE', submissionDeadline: { gt: new Date() }, ...(platforms.size ? { platforms: { hasSome: [...platforms] } } : {}) },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { slug: true, title: true, platforms: true },
      });
      for (const c of campaigns) {
        items.push({ kind: 'campaign', title: c.title, href: `/rewards/${c.slug}`, reason: 'platform_match', matched: c.platforms.filter((p) => platforms.has(p)) });
      }
    }
    return { consent: true, items };
  }

  /** Facts about a person's record, each one checkable, with no composite score. */
  async trust(username: string) {
    const p = await this.prisma.db.userProfile.findUnique({ where: { username } });
    if (!p) throw notFound('USER_NOT_FOUND');
    const id = p.userId;
    const [verifications, sales, purchases, reviewsGiven, reviewsReceived, disputes, violations] = await Promise.all([
      this.prisma.db.verificationRequest.findMany({ where: { userId: id, status: 'APPROVED' }, select: { kind: true, decidedAt: true } }),
      this.prisma.db.sellerOrder.count({ where: { store: { ownerId: id }, status: { in: ['PAID', 'PARTIALLY_REFUNDED'] } } }),
      this.prisma.db.order.count({ where: { buyerId: id, status: 'PAID' } }),
      this.prisma.db.customerReview.count({ where: { userId: id, status: 'VISIBLE' } }),
      this.prisma.db.customerReview.aggregate({ where: { product: { store: { ownerId: id } }, status: 'VISIBLE' }, _count: true, _avg: { rating: true } }),
      this.prisma.db.dispute.groupBy({ by: ['status'], where: { OR: [{ raisedById: id }, { project: { freelancerId: id } }] }, _count: true }),
      this.prisma.db.fraudSignal.count({ where: { creatorId: id, status: 'CONFIRMED' } }),
    ]);
    return {
      username, displayName: p.displayName, verifications, verifiedSales: sales, verifiedPurchases: purchases, reviewsGiven,
      reviewsReceived: reviewsReceived._count, averageRating: reviewsReceived._avg.rating,
      disputes: Object.fromEntries(disputes.map((d) => [d.status, d._count])),
      confirmedViolations: violations,
    };
  }

  async ticket(userId: string, subject: string, body: string) {
    return this.prisma.db.supportTicket.create({ data: { userId, subject, body } });
  }

  myTickets(userId: string) {
    return this.prisma.db.supportTicket.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }
}
