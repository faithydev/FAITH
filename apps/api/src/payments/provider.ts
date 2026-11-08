import { randomUUID } from 'node:crypto';
import { hmacHex, safeEqual } from '../core/crypto';
import { env } from '../core/env';

export type CreatePaymentInput = {
  paymentId: string;
  amountMinor: bigint;
  currency: string;
  description: string;
};

export type CreatedPayment = { providerRef: string; redirectUrl: string };

export type NormalizedEvent = {
  eventId: string;
  type: 'payment.succeeded' | 'payment.failed';
  providerRef: string;
  amountMinor: bigint;
  currency: string;
  failureCode?: string;
};

export type ProviderCapabilities = {
  /** Whether this adapter can move real money right now. */
  live: boolean;
  label: string;
  splitPayments: boolean;
  refunds: boolean;
  payouts: boolean;
};

/**
 * Every payment partner sits behind this contract. Nothing here assumes a provider can split
 * marketplace funds or pay out across borders; capabilities are declared per adapter.
 */
export interface PaymentProvider {
  readonly name: string;
  capabilities(): ProviderCapabilities;
  createPayment(input: CreatePaymentInput): Promise<CreatedPayment>;
  /** Verifies the signature over the raw body and normalises the event. Throws if invalid. */
  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): NormalizedEvent;
  refund(input: { providerRef: string; amountMinor: bigint; currency: string; refundId: string }): Promise<{ status: 'succeeded' | 'failed' }>;
}

/** Development simulator. It moves no money and is refused at boot in production. */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  capabilities(): ProviderCapabilities {
    return { live: false, label: 'Development simulator', splitPayments: false, refunds: true, payouts: false };
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatedPayment> {
    return { providerRef: `mock_${randomUUID()}`, redirectUrl: `/checkout/simulator/${input.paymentId}` };
  }

  static sign(rawBody: string): string {
    return hmacHex(env.MOCK_PAYMENT_WEBHOOK_SECRET, rawBody);
  }

  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): NormalizedEvent {
    const given = headers['x-faith-mock-signature'];
    if (typeof given !== 'string' || !safeEqual(given, hmacHex(env.MOCK_PAYMENT_WEBHOOK_SECRET, rawBody))) {
      throw new Error('invalid signature');
    }
    const e = JSON.parse(rawBody.toString('utf8')) as Omit<NormalizedEvent, 'amountMinor'> & { amountMinor: string };
    return { ...e, amountMinor: BigInt(e.amountMinor) };
  }

  async refund() {
    return { status: 'succeeded' as const };
  }
}

/**
 * Placeholder for a partner FAITH has no verified integration with. It declares itself not
 * live and refuses every operation, so a misconfiguration can never look like a real charge.
 */
export class DisabledProvider implements PaymentProvider {
  constructor(readonly name: string, private readonly configured: boolean) {}

  capabilities(): ProviderCapabilities {
    return {
      live: false,
      label: this.configured
        ? 'Credentials present; adapter not yet verified with the provider'
        : 'Not configured',
      splitPayments: false, refunds: false, payouts: false,
    };
  }
  createPayment(): Promise<CreatedPayment> {
    throw new Error(`${this.name} is disabled until its adapter is implemented and verified`);
  }
  parseWebhook(): NormalizedEvent {
    throw new Error(`${this.name} is disabled`);
  }
  refund(): Promise<{ status: 'failed' }> {
    throw new Error(`${this.name} is disabled`);
  }
}

export function buildProviders(): Map<string, PaymentProvider> {
  const providers: PaymentProvider[] = [
    new DisabledProvider('click', !!(env.CLICK_MERCHANT_ID && env.CLICK_SECRET_KEY)),
    new DisabledProvider('payme', !!(env.PAYME_MERCHANT_ID && env.PAYME_SECRET_KEY)),
    new DisabledProvider('stripe', !!env.STRIPE_SECRET_KEY),
  ];
  if (env.PAYMENT_PROVIDER === 'mock' && env.ALLOW_MOCK_PAYMENTS) providers.push(new MockPaymentProvider());
  return new Map(providers.map((p) => [p.name, p]));
}
