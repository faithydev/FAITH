import { Injectable } from '@nestjs/common';
import type { Payment, PaymentPurpose } from '@faith/database';
import { Prisma } from '@faith/database';
import { randomUUID } from 'node:crypto';
import { env } from '../core/env';
import { badRequest, conflict, forbidden, notFound } from '../core/errors';
import { logger } from '../core/logger';
import { PrismaService, Tx } from '../core/prisma.service';
import { buildProviders, MockPaymentProvider, NormalizedEvent, PaymentProvider } from './provider';

export type PaymentHandler = {
  succeeded(tx: Tx, payment: Payment): Promise<void>;
  failed?(tx: Tx, payment: Payment): Promise<void>;
};

export type StartPayment = {
  purpose: PaymentPurpose;
  payerId: string;
  amountMinor: bigint;
  currency: string;
  idempotencyKey: string;
  description: string;
  orderId?: string;
  subscriptionId?: string;
  campaignId?: string;
  adId?: string;
  installationId?: string;
};

/**
 * Owns the payment lifecycle. Domain modules register a handler per purpose, so this module
 * knows nothing about orders or campaigns and they know nothing about providers.
 */
@Injectable()
export class PaymentsService {
  private readonly providers = buildProviders();
  private readonly handlers = new Map<PaymentPurpose, PaymentHandler>();

  constructor(private readonly prisma: PrismaService) {}

  register(purpose: PaymentPurpose, handler: PaymentHandler) {
    this.handlers.set(purpose, handler);
  }

  active(): PaymentProvider {
    const p = this.providers.get(env.PAYMENT_PROVIDER);
    if (!p) throw conflict('PAYMENT_PROVIDER_UNAVAILABLE');
    return p;
  }

  status() {
    return {
      active: env.PAYMENT_PROVIDER,
      providers: [...this.providers.values()].map((p) => ({ name: p.name, ...p.capabilities() })),
    };
  }

  /** Same idempotency key returns the same payment: a retry cannot charge twice. */
  async start(input: StartPayment) {
    const existing = await this.prisma.db.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return this.describe(existing);

    const provider = this.active();
    const id = randomUUID();
    const created = await provider.createPayment({
      paymentId: id, amountMinor: input.amountMinor, currency: input.currency, description: input.description,
    });
    const payment = await this.prisma.db.payment.create({
      data: {
        id, purpose: input.purpose, provider: provider.name, providerRef: created.providerRef,
        amountMinor: input.amountMinor, currency: input.currency, idempotencyKey: input.idempotencyKey,
        payerId: input.payerId, orderId: input.orderId, subscriptionId: input.subscriptionId,
        campaignId: input.campaignId, adId: input.adId, installationId: input.installationId,
      },
    });
    return this.describe(payment);
  }

  private describe(p: Payment) {
    return {
      paymentId: p.id, status: p.status, amountMinor: p.amountMinor, currency: p.currency, purpose: p.purpose,
      provider: p.provider, simulated: !this.providers.get(p.provider)?.capabilities().live,
      redirectUrl: p.status === 'PENDING' && p.provider === 'mock' ? `/checkout/simulator/${p.id}` : null,
    };
  }

  async get(paymentId: string, userId: string) {
    const p = await this.prisma.db.payment.findUnique({ where: { id: paymentId } });
    if (!p || p.payerId !== userId) throw notFound('PAYMENT_NOT_FOUND');
    return this.describe(p);
  }

  /**
   * Entry point for every provider webhook. Order of checks: signature, replay, row lock,
   * amount. Everything after the signature runs in one transaction, so a crash leaves the
   * event unprocessed and the provider's retry finishes the work.
   */
  async handleWebhook(providerName: string, rawBody: Buffer, headers: Record<string, string | string[] | undefined>) {
    const provider = this.providers.get(providerName);
    if (!provider) throw notFound();
    let event: NormalizedEvent;
    try {
      event = provider.parseWebhook(rawBody, headers);
    } catch (err) {
      logger.warn({ provider: providerName, err: (err as Error).message }, 'rejected webhook');
      throw forbidden('INVALID_SIGNATURE');
    }
    return this.prisma.tx(async (tx) => {
      const prior = await tx.paymentEvent.findUnique({ where: { provider_eventId: { provider: providerName, eventId: event.eventId } } });
      if (prior?.processedAt) return { status: 'duplicate' };
      const row = prior ?? await tx.paymentEvent.create({
        data: {
          provider: providerName, eventId: event.eventId, type: event.type,
          payload: JSON.parse(rawBody.toString('utf8')) as Prisma.InputJsonValue,
        },
      });

      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Payment" WHERE "provider" = ${providerName} AND "providerRef" = ${event.providerRef} FOR UPDATE`;
      const id = locked[0]?.id;
      if (!id) throw notFound('PAYMENT_NOT_FOUND');
      const payment = await tx.payment.findUniqueOrThrow({ where: { id } });

      if (payment.amountMinor !== event.amountMinor || payment.currency !== event.currency) {
        logger.error({ paymentId: payment.id }, 'webhook amount does not match payment');
        throw badRequest('PAYMENT_AMOUNT_MISMATCH');
      }
      if (payment.status === 'PENDING') await this.apply(tx, payment, event);
      await tx.paymentEvent.update({ where: { id: row.id }, data: { processedAt: new Date() } });
      return { status: 'processed' };
    });
  }

  private async apply(tx: Tx, payment: Payment, event: NormalizedEvent) {
    const handler = this.handlers.get(payment.purpose);
    if (!handler) throw new Error(`no handler for ${payment.purpose}`);
    if (event.type === 'payment.succeeded') {
      const updated = await tx.payment.update({ where: { id: payment.id }, data: { status: 'SUCCEEDED', capturedAt: new Date() } });
      await handler.succeeded(tx, updated);
    } else {
      const updated = await tx.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', failureCode: event.failureCode ?? 'declined' } });
      await handler.failed?.(tx, updated);
    }
  }

  /** The buyer's click on the labelled simulator page, delivered as a real signed webhook. */
  async simulate(paymentId: string, userId: string, outcome: 'success' | 'failure') {
    if (!(env.PAYMENT_PROVIDER === 'mock' && env.ALLOW_MOCK_PAYMENTS)) throw notFound();
    const p = await this.prisma.db.payment.findUnique({ where: { id: paymentId } });
    if (!p || p.payerId !== userId || p.provider !== 'mock') throw notFound('PAYMENT_NOT_FOUND');
    const rawBody = JSON.stringify({
      eventId: `evt_${randomUUID()}`,
      type: outcome === 'success' ? 'payment.succeeded' : 'payment.failed',
      providerRef: p.providerRef,
      amountMinor: p.amountMinor.toString(),
      currency: p.currency,
      failureCode: outcome === 'failure' ? 'simulated_decline' : undefined,
    });
    await this.handleWebhook('mock', Buffer.from(rawBody), { 'x-faith-mock-signature': MockPaymentProvider.sign(rawBody) });
    return this.get(paymentId, userId);
  }

  async refund(payment: Payment, amountMinor: bigint, refundId: string) {
    const provider = this.providers.get(payment.provider);
    if (!provider) throw conflict('PAYMENT_PROVIDER_UNAVAILABLE');
    const result = await provider.refund({ providerRef: payment.providerRef, amountMinor, currency: payment.currency, refundId });
    if (result.status !== 'succeeded') throw conflict('REFUND_FAILED');
  }
}
