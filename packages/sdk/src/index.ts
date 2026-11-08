import { createHmac, timingSafeEqual } from 'node:crypto';

export type FaithClientOptions = {
  apiKey: string;
  /** Defaults to the local development API. */
  baseUrl?: string;
  fetch?: typeof fetch;
};

export class FaithApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, public readonly requestId?: string) {
    super(`FAITH API error ${status}: ${code}`);
  }
}

export type Product = { id: string; slug: string; title: string; status: string; currency: string; priceFromMinor: string; salesCount?: number };
export type Order = { id: string; number: string; status: string; currency: string; netMinor: string; commissionMinor: string; sellerNetMinor?: string; refundedMinor?: string; paidAt?: string };
export type Campaign = { id: string; slug: string; title: string; status: string; currency: string; budgetMinor: string; accruedMinor: string };
export type List<T> = { sandbox: boolean; items: T[] };

export class FaithClient {
  private readonly baseUrl: string;
  private readonly send: typeof fetch;

  constructor(private readonly options: FaithClientOptions) {
    this.baseUrl = (options.baseUrl ?? 'http://localhost:4000').replace(/\/$/, '');
    this.send = options.fetch ?? fetch;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await this.send(`${this.baseUrl}/v1/public${path}`, { headers: { 'x-api-key': this.options.apiKey } });
    const body = (await res.json()) as T & { error?: { code: string; requestId?: string } };
    if (!res.ok) throw new FaithApiError(res.status, body.error?.code ?? 'UNKNOWN', body.error?.requestId);
    return body;
  }

  me() {
    return this.get<{ displayName: string; username: string; env: 'LIVE' | 'SANDBOX'; scopes: string[] }>('/me');
  }
  products() {
    return this.get<List<Product>>('/products');
  }
  orders() {
    return this.get<List<Order>>('/orders');
  }
  campaigns() {
    return this.get<List<Campaign>>('/campaigns');
  }
}

export type WebhookEvent<T = Record<string, unknown>> = { id: string; type: string; createdAt: string; data: T };

export type VerifyInput = {
  body: string;
  signature: string | undefined;
  timestamp: string | undefined;
  secret: string;
  /** Oldest accepted signature age, which limits replay. Defaults to five minutes. */
  toleranceSeconds?: number;
};

/** Verifies a webhook and returns the parsed event. Throws if it is forged, stale or malformed. */
export function verifyWebhook<T = Record<string, unknown>>(input: VerifyInput): WebhookEvent<T> {
  const { body, signature, timestamp, secret, toleranceSeconds = 300 } = input;
  if (!signature || !timestamp) throw new Error('Missing signature headers');
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) throw new Error('Signature timestamp out of range');
  const expected = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('Invalid webhook signature');
  return JSON.parse(body) as WebhookEvent<T>;
}
