/**
 * The FAITH automation engine. Runs in the worker, and in tests, against any Prisma client.
 *
 * Domain code writes OutboxEvent rows in the same transaction as the change they describe, so
 * an event exists if and only if the change committed. This module drains those rows and turns
 * them into notifications, automation runs and signed webhook deliveries.
 */
import { createHmac } from 'node:crypto';
import { createDecipheriv, createHash } from 'node:crypto';
import type { OutboxEvent, Prisma, PrismaClient } from '@faith/database';

export type Condition = { field: string; op: 'eq' | 'neq' | 'gte' | 'lte' | 'contains'; value: string | number };
export type Action =
  | { type: 'notify'; target: 'actor' | 'owner' | 'recipient' | 'staff'; kind: string }
  | { type: 'grant_community'; communityId?: string; byPlan?: boolean };

const MAX_EVENT_ATTEMPTS = 5;
const WEBHOOK_MAX_ATTEMPTS = 6;
const backoffSeconds = (attempt: number) => Math.min(3600, 30 * 2 ** attempt);

type Payload = Record<string, unknown>;

/** Who each event concerns. User-owned rules only fire for events about their owner. */
const PARTIES: Record<string, (p: Payload) => { actor?: string; owners: string[]; recipient?: string }> = {
  'user.registered': (p) => ({ actor: p.userId as string, owners: [], recipient: p.userId as string }),
  'order.paid': (p) => ({ actor: p.buyerId as string, owners: ((p.sellers ?? []) as { ownerId: string }[]).map((s) => s.ownerId), recipient: p.buyerId as string }),
  'order.refunded': (p) => ({ actor: p.buyerId as string, owners: [], recipient: p.buyerId as string }),
  'subscription.activated': (p) => ({ actor: p.userId as string, owners: [p.userId as string], recipient: p.userId as string }),
  'reward.approved': (p) => ({ actor: p.creatorId as string, owners: [p.creatorId as string], recipient: p.creatorId as string }),
  'course.enrolled': (p) => ({ actor: p.userId as string, owners: [], recipient: p.userId as string }),
  'job.application.submitted': (p) => ({ actor: p.applicantId as string, owners: [p.employerId as string], recipient: p.employerId as string }),
  'app.installed': (p) => ({ actor: p.userId as string, owners: [p.developerId as string], recipient: p.developerId as string }),
  'product.published': (p) => ({ actor: p.ownerId as string, owners: [p.ownerId as string] }),
  'submission.approved': (p) => ({ actor: p.creatorId as string, owners: [p.creatorId as string] }),
};

const resolveField = (payload: Payload, field: string): unknown =>
  field.split('.').reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Payload)[k] : undefined), payload);

export function matches(payload: Payload, conditions: Condition[]): boolean {
  return conditions.every((c) => {
    const actual = resolveField(payload, c.field);
    switch (c.op) {
      case 'eq': return String(actual) === String(c.value);
      case 'neq': return String(actual) !== String(c.value);
      case 'gte': return Number(actual) >= Number(c.value);
      case 'lte': return Number(actual) <= Number(c.value);
      case 'contains': return String(actual ?? '').includes(String(c.value));
      default: return false;
    }
  });
}

async function runAction(db: PrismaClient, action: Action, event: OutboxEvent): Promise<string> {
  const payload = event.payload as Payload;
  const parties = PARTIES[event.type]?.(payload) ?? { owners: [] };

  if (action.type === 'notify') {
    const targets = action.target === 'staff' ? await platformOwners(db)
      : action.target === 'owner' ? parties.owners
      : action.target === 'actor' ? [parties.actor].filter(Boolean) as string[]
      : [parties.recipient].filter(Boolean) as string[];
    const href = action.target === 'staff' ? staffHref(event.type) : notificationHref(event.type, payload);
    if (targets.length) {
      await db.notification.createMany({
        data: targets.map((userId) => ({ userId, kind: action.kind, params: payload as Prisma.InputJsonValue, href })),
      });
    }
    return `notified ${targets.length}`;
  }

  if (action.type === 'grant_community') {
    const userId = parties.recipient;
    if (!userId) return 'no recipient';
    const communities = action.byPlan
      ? await db.community.findMany({ where: { grantPlanKey: String(payload.planKey) }, select: { id: true } })
      : action.communityId ? [{ id: action.communityId }] : [];
    for (const c of communities) {
      await db.communityMember.upsert({
        where: { communityId_userId: { communityId: c.id, userId } },
        update: {},
        create: { communityId: c.id, userId },
      });
    }
    return `granted ${communities.length} communities`;
  }
  throw new Error(`unknown action ${(action as { type: string }).type}`);
}

/** The people who run the platform: every active admin and super admin. */
async function platformOwners(db: PrismaClient): Promise<string[]> {
  const rows = await db.user.findMany({
    where: { status: 'ACTIVE', roles: { some: { role: { key: { in: ['admin', 'super_admin'] } } } } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Where a staff notification leads inside the admin console. */
function staffHref(type: string): string {
  switch (type) {
    case 'user.registered': return '/admin/users';
    case 'order.paid': case 'order.refunded': return '/admin/finance';
    case 'product.published': return '/admin/marketplace';
    case 'app.installed': return '/admin/apps';
    default: return '/admin/audit';
  }
}

function notificationHref(type: string, p: Payload): string | null {
  switch (type) {
    case 'order.paid': return '/app/seller/orders';
    case 'order.refunded': return `/app/orders`;
    case 'reward.approved': return '/app/creator/earnings';
    case 'job.application.submitted': return '/app/brand/hiring';
    case 'course.enrolled': return '/app/explore';
    case 'subscription.activated': return '/app/billing';
    case 'app.installed': return '/app/developer/analytics';
    default: return p.href ? String(p.href) : null;
  }
}

async function runRule(db: PrismaClient, rule: { id: string; ownerId: string | null; conditions: unknown; actions: unknown; maxAttempts: number }, event: OutboxEvent) {
  const payload = event.payload as Payload;
  const parties = PARTIES[event.type]?.(payload);
  if (rule.ownerId && parties && !parties.owners.includes(rule.ownerId) && parties.actor !== rule.ownerId) return;

  const prior = await db.automationRun.findUnique({ where: { ruleId_eventId: { ruleId: rule.id, eventId: event.id } } });
  if (prior && prior.status !== 'FAILED') return;
  if (prior && prior.attempts >= rule.maxAttempts) return;

  if (!matches(payload, rule.conditions as Condition[])) {
    await db.automationRun.upsert({
      where: { ruleId_eventId: { ruleId: rule.id, eventId: event.id } },
      update: {},
      create: { ruleId: rule.id, eventId: event.id, status: 'SKIPPED', finishedAt: new Date() },
    });
    return;
  }

  const run = await db.automationRun.upsert({
    where: { ruleId_eventId: { ruleId: rule.id, eventId: event.id } },
    update: { status: 'RUNNING', attempts: { increment: 1 }, error: null },
    create: { ruleId: rule.id, eventId: event.id },
  });
  const log: string[] = [];
  try {
    for (const action of rule.actions as Action[]) log.push(await runAction(db, action, event));
    await db.automationRun.update({ where: { id: run.id }, data: { status: 'SUCCEEDED', log, finishedAt: new Date() } });
  } catch (err) {
    await db.automationRun.update({ where: { id: run.id }, data: { status: 'FAILED', log, error: (err as Error).message, finishedAt: new Date() } });
    throw err;
  }
}

async function fanOutWebhooks(db: PrismaClient, event: OutboxEvent) {
  const payload = event.payload as Payload;
  const parties = PARTIES[event.type]?.(payload);
  const owners = parties?.owners ?? [];
  if (owners.length === 0) return;
  const endpoints = await db.webhookEndpoint.findMany({
    where: { active: true, ownerId: { in: owners }, events: { has: event.type } },
  });
  for (const endpoint of endpoints) {
    await db.webhookDelivery.upsert({
      where: { endpointId_eventId: { endpointId: endpoint.id, eventId: event.id } },
      update: {},
      create: { endpointId: endpoint.id, eventId: event.id, eventType: event.type, payload: { id: event.id, type: event.type, createdAt: event.createdAt, data: payload } as Prisma.InputJsonValue },
    });
  }
}

/**
 * Claims a batch with SKIP LOCKED, so several workers can run without processing an event
 * twice. A failed event is retried with backoff and left visible after its last attempt.
 */
export async function drainOutbox(db: PrismaClient, opts: { batch?: number } = {}): Promise<{ processed: number; failed: number }> {
  const batch = opts.batch ?? 50;
  let processed = 0;
  let failed = 0;
  const claimed = await db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "OutboxEvent"
      WHERE "processedAt" IS NULL AND "availableAt" <= now() AND "attempts" < ${MAX_EVENT_ATTEMPTS}
      ORDER BY "createdAt" LIMIT ${batch} FOR UPDATE SKIP LOCKED`;
    const ids = rows.map((r) => r.id);
    if (ids.length) {
      await tx.outboxEvent.updateMany({
        where: { id: { in: ids } },
        data: { attempts: { increment: 1 }, availableAt: new Date(Date.now() + 60_000) },
      });
    }
    return tx.outboxEvent.findMany({ where: { id: { in: ids } }, orderBy: { createdAt: 'asc' } });
  });

  for (const event of claimed) {
    try {
      const rules = await db.automationRule.findMany({ where: { trigger: event.type, active: true } });
      for (const rule of rules) await runRule(db, rule, event);
      await fanOutWebhooks(db, event);
      await db.outboxEvent.update({ where: { id: event.id }, data: { processedAt: new Date(), lastError: null } });
      processed += 1;
    } catch (err) {
      failed += 1;
      await db.outboxEvent.update({
        where: { id: event.id },
        data: { lastError: (err as Error).message, availableAt: new Date(Date.now() + backoffSeconds(event.attempts) * 1000) },
      });
    }
  }
  return { processed, failed };
}

// --- Webhooks ---------------------------------------------------------------

function decryptSecret(payload: string, encryptionKey: string): string {
  const key = createHash('sha256').update(encryptionKey).digest();
  const [iv, tag, data] = payload.split('.').map((p) => Buffer.from(p, 'base64url'));
  const d = createDecipheriv('aes-256-gcm', key, iv!);
  d.setAuthTag(tag!);
  return Buffer.concat([d.update(data!), d.final()]).toString('utf8');
}

export function signWebhook(secret: string, timestamp: number, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

const isPrivateHost = (host: string) =>
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?|.*\.local$|.*\.internal$)/i.test(host);

export type WebhookOptions = {
  encryptionKey: string;
  fetchImpl?: typeof fetch;
  /** Only local development may post to private addresses. */
  allowPrivateTargets?: boolean;
};

/** Delivers due webhooks with a timestamped HMAC signature and exponential backoff. */
export async function deliverWebhooks(db: PrismaClient, opts: WebhookOptions): Promise<{ delivered: number; failed: number }> {
  const send = opts.fetchImpl ?? fetch;
  const due = await db.webhookDelivery.findMany({
    where: { status: 'PENDING', nextAttemptAt: { lte: new Date() } },
    include: { endpoint: true },
    take: 50,
  });
  let delivered = 0;
  let failed = 0;
  for (const d of due) {
    const body = JSON.stringify(d.payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const attempts = d.attempts + 1;
    try {
      const url = new URL(d.endpoint.url);
      if (!opts.allowPrivateTargets && isPrivateHost(url.hostname)) throw new Error('refusing to call a private address');
      const res = await send(d.endpoint.url, {
        method: 'POST',
        redirect: 'manual',
        signal: AbortSignal.timeout(8000),
        headers: {
          'content-type': 'application/json',
          'x-faith-event': d.eventType,
          'x-faith-delivery': d.id,
          'x-faith-timestamp': String(timestamp),
          'x-faith-signature': signWebhook(decryptSecret(d.endpoint.secret, opts.encryptionKey), timestamp, body),
        },
        body,
      });
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
      await db.webhookDelivery.update({ where: { id: d.id }, data: { status: 'DELIVERED', attempts, responseStatus: res.status, deliveredAt: new Date(), lastError: null } });
      delivered += 1;
    } catch (err) {
      failed += 1;
      const dead = attempts >= WEBHOOK_MAX_ATTEMPTS;
      await db.webhookDelivery.update({
        where: { id: d.id },
        data: {
          attempts, status: dead ? 'FAILED' : 'PENDING', lastError: (err as Error).message.slice(0, 500),
          responseStatus: (err as { status?: number }).status,
          nextAttemptAt: new Date(Date.now() + backoffSeconds(attempts) * 1000),
        },
      });
    }
  }
  return { delivered, failed };
}

/** Ends subscriptions whose paid period is over and that will not renew. */
export async function expireSubscriptions(db: PrismaClient): Promise<number> {
  const { count } = await db.subscription.updateMany({
    where: { status: 'ACTIVE', currentPeriodEnd: { lte: new Date() } },
    data: { status: 'EXPIRED' },
  });
  return count;
}

/**
 * Verified badges. A pending badge is granted once its 24-hour window passes while the person
 * still has Pro; any role badge goes away when Pro ends. Founder badges are never touched.
 */
export async function settleBadges(db: PrismaClient): Promise<{ granted: number; revoked: number }> {
  const now = new Date();
  const activePro = { some: { status: 'ACTIVE' as const, currentPeriodEnd: { gt: now } } };
  const due = await db.verifiedBadge.findMany({
    where: { status: 'PENDING', grantAt: { lte: now }, kind: { not: 'founder' }, user: { subscriptions: activePro } },
    select: { userId: true, kind: true },
  });
  if (due.length) {
    await db.verifiedBadge.updateMany({ where: { userId: { in: due.map((b) => b.userId) }, status: 'PENDING' }, data: { status: 'VERIFIED', verifiedAt: now } });
    await db.notification.createMany({ data: due.map((b) => ({ userId: b.userId, kind: 'badge.verified', params: { badge: b.kind }, href: '/app/settings' })) });
  }
  const { count: revoked } = await db.verifiedBadge.updateMany({
    where: { status: { in: ['PENDING', 'VERIFIED'] }, kind: { not: 'founder' }, user: { subscriptions: { none: { status: 'ACTIVE', currentPeriodEnd: { gt: now } } } } },
    data: { status: 'REVOKED' },
  });
  return { granted: due.length, revoked };
}

/** Removes sessions and single-use tokens that can never be used again. */
export async function purgeExpired(db: PrismaClient): Promise<void> {
  const cutoff = new Date(Date.now() - 7 * 86_400_000);
  await db.session.deleteMany({ where: { expiresAt: { lt: cutoff } } });
  await db.authToken.deleteMany({ where: { expiresAt: { lt: cutoff } } });
}

/** The platform automations seeded at install. Each one does real work through the engine. */
export const SYSTEM_RULES: { key: string; name: string; trigger: string; actions: Action[] }[] = [
  { key: 'notify-seller-on-order', name: 'New order: notify seller', trigger: 'order.paid', actions: [{ type: 'notify', target: 'owner', kind: 'order.sold' }] },
  { key: 'notify-buyer-on-order', name: 'New purchase: confirm to buyer', trigger: 'order.paid', actions: [{ type: 'notify', target: 'recipient', kind: 'order.purchased' }] },
  { key: 'notify-buyer-on-refund', name: 'Refund processed: notify buyer', trigger: 'order.refunded', actions: [{ type: 'notify', target: 'recipient', kind: 'order.refunded' }] },
  { key: 'welcome-course-student', name: 'Course enrolled: welcome student', trigger: 'course.enrolled', actions: [{ type: 'notify', target: 'recipient', kind: 'course.welcome' }] },
  { key: 'notify-creator-reward', name: 'Reward approved: notify creator', trigger: 'reward.approved', actions: [{ type: 'notify', target: 'recipient', kind: 'reward.approved' }] },
  { key: 'notify-employer-application', name: 'Application submitted: notify employer', trigger: 'job.application.submitted', actions: [{ type: 'notify', target: 'recipient', kind: 'job.application' }] },
  { key: 'grant-plan-communities', name: 'Subscription active: grant community access', trigger: 'subscription.activated', actions: [{ type: 'grant_community', byPlan: true }, { type: 'notify', target: 'recipient', kind: 'subscription.activated' }] },
  // The platform owners hear about everything people do, as it happens.
  { key: 'staff-user-registered', name: 'New account: notify platform owners', trigger: 'user.registered', actions: [{ type: 'notify', target: 'staff', kind: 'staff.user_registered' }] },
  { key: 'staff-order-paid', name: 'New order: notify platform owners', trigger: 'order.paid', actions: [{ type: 'notify', target: 'staff', kind: 'staff.order_paid' }] },
  { key: 'staff-order-refunded', name: 'Refund: notify platform owners', trigger: 'order.refunded', actions: [{ type: 'notify', target: 'staff', kind: 'staff.order_refunded' }] },
  { key: 'staff-subscription', name: 'New Pro subscriber: notify platform owners', trigger: 'subscription.activated', actions: [{ type: 'notify', target: 'staff', kind: 'staff.subscription' }] },
  { key: 'staff-product-published', name: 'Product published: notify platform owners', trigger: 'product.published', actions: [{ type: 'notify', target: 'staff', kind: 'staff.product_published' }] },
  { key: 'staff-job-application', name: 'Job application: notify platform owners', trigger: 'job.application.submitted', actions: [{ type: 'notify', target: 'staff', kind: 'staff.job_application' }] },
  { key: 'staff-app-installed', name: 'App installed: notify platform owners', trigger: 'app.installed', actions: [{ type: 'notify', target: 'staff', kind: 'staff.app_installed' }] },
  { key: 'notify-developer-install', name: 'App installed: notify developer', trigger: 'app.installed', actions: [{ type: 'notify', target: 'recipient', kind: 'app.installed' }] },
];
