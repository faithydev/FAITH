/**
 * Verified badges and the founder account.
 *
 * Founders are named by email in FOUNDER_EMAILS and are recognised only once that email has
 * been proven by Google or Apple, so typing someone's address into a sign-up form gives nothing.
 */
import { Injectable } from '@nestjs/common';
import { BADGE_KINDS, STAFF_ROLES } from '@faith/config';
import type { PrismaClient } from '@faith/database';
import { env } from '../core/env';
import { notFound } from '../core/errors';
import { logger } from '../core/logger';
import { AuditService } from '../core/platform.services';
import { PrismaService } from '../core/prisma.service';

/** The badge a sample account shows: its most visible role first. */
const PRIORITY: readonly (typeof BADGE_KINDS)[number][] = ['seller', 'creator', 'brand', 'developer', 'freelancer', 'job_seeker', 'customer'];

const founderEmails = () => (env.FOUNDER_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

/** Makes a provider-verified founder a super admin with the gold badge. Safe to call often. */
export async function applyFounder(db: PrismaClient, userId: string): Promise<boolean> {
  const emails = founderEmails();
  if (!emails.length) return false;
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, _count: { select: { accounts: true } } } });
  if (!user || !emails.includes(user.email.toLowerCase()) || user._count.accounts === 0) return false;
  const role = await db.role.findUniqueOrThrow({ where: { key: 'super_admin' } });
  await db.userRole.upsert({ where: { userId_roleId: { userId, roleId: role.id } }, update: {}, create: { userId, roleId: role.id } });
  const now = new Date();
  await db.verifiedBadge.upsert({
    where: { userId },
    update: { kind: 'founder', status: 'VERIFIED', verifiedAt: now, grantAt: now },
    create: { userId, kind: 'founder', status: 'VERIFIED', verifiedAt: now, grantAt: now },
  });
  return true;
}

@Injectable()
export class BadgesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  list(status?: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'REVOKED') {
    return this.prisma.db.verifiedBadge.findMany({
      where: status ? { status } : { status: { in: ['PENDING', 'VERIFIED'] } },
      orderBy: [{ status: 'asc' }, { grantAt: 'asc' }],
      take: 200,
      select: {
        userId: true, kind: true, status: true, requestedAt: true, grantAt: true, verifiedAt: true,
        user: { select: { email: true, profile: { select: { displayName: true, username: true } } } },
      },
    });
  }

  async decide(userId: string, approve: boolean, actorId: string, note?: string) {
    const badge = await this.prisma.db.verifiedBadge.findUnique({ where: { userId } });
    if (!badge || badge.kind === 'founder') throw notFound();
    const now = new Date();
    await this.prisma.db.$transaction(async (tx) => {
      await tx.verifiedBadge.update({
        where: { userId },
        data: approve ? { status: 'VERIFIED', verifiedAt: now, decidedById: actorId, note: note ?? null } : { status: 'REJECTED', decidedById: actorId, note: note ?? null },
      });
      if (approve) await tx.notification.create({ data: { userId, kind: 'badge.verified', params: { badge: badge.kind }, href: '/app/settings' } });
      await this.audit.record({ actor: { id: actorId }, action: approve ? 'badge.verified' : 'badge.rejected', resourceType: 'User', resourceId: userId, metadata: { kind: badge.kind, note } }, tx);
    });
    return { status: 'ok' };
  }

  /**
   * Runs at start-up. Founders get their rights; on the public demo, the seeded sample accounts,
   * whose password is published in the README, lose every staff role (real people's data must
   * not be one published password away) and keep a complimentary Pro so every feature can be tried.
   */
  async boot() {
    const db = this.prisma.db;
    const emails = founderEmails();
    if (emails.length) {
      const founders = await db.user.findMany({ where: { email: { in: emails, mode: 'insensitive' } }, select: { id: true } });
      for (const f of founders) await applyFounder(db, f.id);
    }
    if (!env.PUBLIC_DEMO) return;
    const sample = { email: { endsWith: '@faith.dev' } };
    const { count } = await db.userRole.deleteMany({ where: { user: sample, role: { key: { in: [...STAFF_ROLES] } } } });
    if (count) logger.warn({ count }, 'removed staff roles from public sample accounts');
    await compSampleAccounts(db);
  }
}

/** Gives the seeded sample accounts a complimentary Pro year, so the demo shows every feature. */
export async function compSampleAccounts(db: PrismaClient) {
  const plan = await db.subscriptionPlan.findUnique({ where: { key: 'pro' } });
  if (!plan) return;
  const now = new Date();
  const users = await db.user.findMany({
    where: { email: { endsWith: '@faith.dev' }, subscriptions: { none: { status: 'ACTIVE', currentPeriodEnd: { gt: now } } } },
    select: { id: true },
  });
  const end = new Date(now.getTime() + 365 * 86_400_000);
  for (const u of users) {
    await db.subscription.create({
      data: {
        userId: u.id, planId: plan.id, status: 'ACTIVE', interval: 'YEARLY', priceMinor: 0n, currency: plan.currency,
        provider: 'complimentary', currentPeriodStart: now, currentPeriodEnd: end,
      },
    });
  }
  // Each sample account shows the badge of its main role.
  const unbadged = await db.user.findMany({
    where: { email: { endsWith: '@faith.dev' }, badge: null },
    select: { id: true, roles: { select: { role: { select: { key: true } } } } },
  });
  for (const u of unbadged) {
    const held = new Set(u.roles.map((r) => r.role.key));
    const kind = PRIORITY.find((k) => held.has(k)) ?? 'customer';
    await db.verifiedBadge.create({ data: { userId: u.id, kind, status: 'VERIFIED', verifiedAt: now, grantAt: now } });
  }
}
