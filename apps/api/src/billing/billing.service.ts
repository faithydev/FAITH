import { Injectable, OnModuleInit } from '@nestjs/common';
import type { Payment } from '@faith/database';
import { EntitlementsService } from '../auth/entitlements.service';
import { badRequest, conflict, notFound } from '../core/errors';
import { EventsService } from '../core/platform.services';
import { PrismaService, Tx } from '../core/prisma.service';
import { Accounts, LedgerService } from '../finance/ledger.service';
import { PaymentsService } from '../payments/payments.service';

const periodEnd = (from: Date, interval: 'MONTHLY' | 'YEARLY') => {
  const d = new Date(from);
  if (interval === 'MONTHLY') d.setUTCMonth(d.getUTCMonth() + 1);
  else d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d;
};

@Injectable()
export class BillingService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly ledger: LedgerService,
    private readonly events: EventsService,
    private readonly entitlements: EntitlementsService,
  ) {}

  onModuleInit() {
    this.payments.register('SUBSCRIPTION', {
      succeeded: (tx, p) => this.activate(tx, p),
      failed: async (tx, p) => {
        await tx.subscription.updateMany({ where: { id: p.subscriptionId!, status: 'PENDING' }, data: { status: 'CANCELED', canceledAt: new Date() } });
      },
    });
  }

  plans() {
    return this.prisma.db.subscriptionPlan.findMany({
      where: { active: true },
      include: { features: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async state(userId: string) {
    const { plan, subscription } = await this.entitlements.activePlan(userId);
    const history = await this.prisma.db.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 12,
      include: { plan: { select: { key: true, name: true } } },
    });
    return { plan, subscription, history, payments: this.payments.status() };
  }

  /** Prices are admin-configured. With no price set, upgrades stay closed rather than free. */
  async upgrade(userId: string, interval: 'MONTHLY' | 'YEARLY', key: string) {
    const plan = await this.prisma.db.subscriptionPlan.findUnique({ where: { key: 'pro' } });
    if (!plan || !plan.active) throw notFound('PLAN_NOT_FOUND');
    const price = interval === 'MONTHLY' ? plan.monthlyMinor : plan.yearlyMinor;
    if (!price || price <= 0n) throw conflict('PLAN_PRICE_NOT_SET');
    const current = await this.entitlements.activePlan(userId);
    if (current.subscription?.plan.key === 'pro') throw conflict('ALREADY_SUBSCRIBED');

    const idempotencyKey = `subscription:${userId}:${key}`;
    const prior = await this.prisma.db.payment.findUnique({ where: { idempotencyKey } });
    if (prior) return this.payments.get(prior.id, userId);

    const sub = await this.prisma.db.subscription.create({
      data: { userId, planId: plan.id, interval, priceMinor: price, currency: plan.currency, provider: this.payments.active().name },
    });
    return this.payments.start({
      purpose: 'SUBSCRIPTION', payerId: userId, amountMinor: price, currency: plan.currency, idempotencyKey,
      description: `FAITH ${plan.name} (${interval.toLowerCase()})`, subscriptionId: sub.id,
    });
  }

  private async activate(tx: Tx, payment: Payment) {
    const sub = await tx.subscription.findUniqueOrThrow({ where: { id: payment.subscriptionId! } });
    const start = new Date();
    await tx.subscription.update({
      where: { id: sub.id },
      data: { status: 'ACTIVE', currentPeriodStart: start, currentPeriodEnd: periodEnd(start, sub.interval), cancelAtPeriodEnd: false },
    });
    await this.ledger.post(tx, {
      idempotencyKey: `subscription:${payment.id}:paid`, kind: 'subscription', currency: payment.currency,
      refType: 'Subscription', refId: sub.id,
      debit: [{ account: Accounts.clearing(payment.currency), amountMinor: payment.amountMinor }],
      credit: [{ account: Accounts.subscriptions(payment.currency), amountMinor: payment.amountMinor }],
    });
    const plan = await tx.subscriptionPlan.findUniqueOrThrow({ where: { id: sub.planId } });
    await this.events.emit(tx, 'subscription.activated', { subscriptionId: sub.id, userId: sub.userId, planKey: plan.key });
  }

  /** Access continues to the end of the paid period, then the worker expires it. */
  async cancel(userId: string) {
    const { count } = await this.prisma.db.subscription.updateMany({
      where: { userId, status: 'ACTIVE', cancelAtPeriodEnd: false },
      data: { cancelAtPeriodEnd: true, canceledAt: new Date() },
    });
    if (count === 0) throw badRequest('NO_ACTIVE_SUBSCRIPTION');
    return { status: 'cancel_at_period_end' };
  }

  async resume(userId: string) {
    const { count } = await this.prisma.db.subscription.updateMany({
      where: { userId, status: 'ACTIVE', cancelAtPeriodEnd: true },
      data: { cancelAtPeriodEnd: false, canceledAt: null },
    });
    if (count === 0) throw badRequest('NO_ACTIVE_SUBSCRIPTION');
    return { status: 'active' };
  }
}
