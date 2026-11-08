import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';

loadDotenv({ path: resolve(__dirname, '../../../../.env'), quiet: true });

const bool = z.enum(['true', 'false']).default('false').transform((v) => v === 'true');
const secret = z.string().min(32, 'must be at least 32 characters; see .env.example');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional(),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  // On Render the service's public address arrives as RENDER_EXTERNAL_URL.
  API_ORIGIN: z.string().url().default(process.env.RENDER_EXTERNAL_URL || 'http://localhost:4000'),
  API_PORT: z.coerce.number().default(4000),
  /**
   * A public demonstration on real hosting: payments stay simulated and email is recorded, not
   * sent, while everything else runs in production mode. The development mailbox stays closed.
   */
  PUBLIC_DEMO: bool.default(false),
  /** Runs the outbox and webhook loop inside the API process, for hosts without a worker. */
  RUN_WORKER: bool.default(false),
  /** Proxy hops in front of the API: 1 for a load balancer, 2 behind the web app's rewrite too. */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
  APP_ENCRYPTION_KEY: secret,
  DOWNLOAD_SIGNING_SECRET: secret,
  MOCK_PAYMENT_WEBHOOK_SECRET: secret,
  PAYMENT_PROVIDER: z.enum(['mock', 'click', 'payme', 'stripe']).default('mock'),
  ALLOW_MOCK_PAYMENTS: bool,
  CLICK_MERCHANT_ID: z.string().optional(),
  CLICK_SECRET_KEY: z.string().optional(),
  PAYME_MERCHANT_ID: z.string().optional(),
  PAYME_SECRET_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_DIR: z.string().default(resolve(__dirname, '../../../../.dev/storage')),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  EMAIL_DRIVER: z.enum(['dev', 'smtp']).default('dev'),
  SMTP_URL: z.string().optional(),
  EMAIL_FROM: z.string().default('FAITH <no-reply@faith.local>'),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('claude-opus-5-5'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const clean = Object.fromEntries(
    Object.entries(process.env).filter(([, v]) => v !== ''),
  );
  const parsed = schema.safeParse(clean);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment:\n${lines.join('\n')}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production' && !env.PUBLIC_DEMO) {
    if (env.PAYMENT_PROVIDER === 'mock' || env.ALLOW_MOCK_PAYMENTS) {
      throw new Error('The mock payment provider cannot run with NODE_ENV=production.');
    }
    if (env.EMAIL_DRIVER === 'dev') throw new Error('EMAIL_DRIVER=dev cannot run in production.');
  }
  return env;
}

export const env = load();
export const isProd = env.NODE_ENV === 'production';
