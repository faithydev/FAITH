/**
 * FAITH background worker. Drains the transactional outbox, delivers webhooks and expires
 * subscriptions.
 *
 * With REDIS_URL set, BullMQ schedules these ticks, which adds cluster-wide de-duplication and
 * job visibility. Without Redis the same ticks run on a timer. Either way the source of truth
 * is the Postgres outbox, so nothing is lost if Redis is absent or restarts.
 */
import { deliverWebhooks, drainOutbox, expireSubscriptions, purgeExpired } from '@faith/automation';
import { createPrismaClient } from '@faith/database';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import pino from 'pino';

config({ path: resolve(__dirname, '../../../.env'), quiet: true });
const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });

const databaseUrl = process.env.DATABASE_URL;
const encryptionKey = process.env.APP_ENCRYPTION_KEY;
if (!databaseUrl || !encryptionKey) throw new Error('DATABASE_URL and APP_ENCRYPTION_KEY are required');

const db = createPrismaClient(databaseUrl);
const webhookOptions = { encryptionKey, allowPrivateTargets: process.env.NODE_ENV !== 'production' };

async function fastTick() {
  const events = await drainOutbox(db);
  const hooks = await deliverWebhooks(db, webhookOptions);
  if (events.processed || events.failed || hooks.delivered || hooks.failed) log.info({ events, hooks }, 'tick');
}

async function slowTick() {
  const expired = await expireSubscriptions(db);
  await purgeExpired(db);
  if (expired) log.info({ expired }, 'subscriptions expired');
}

async function withBullMq(url: string) {
  const { Queue, Worker } = await import('bullmq');
  const { Redis } = await import('ioredis');
  const connection = new Redis(url, { maxRetriesPerRequest: null });
  const queue = new Queue('faith-maintenance', { connection });
  await queue.upsertJobScheduler('fast', { every: 2000 }, { name: 'fast' });
  await queue.upsertJobScheduler('slow', { every: 300_000 }, { name: 'slow' });
  const worker = new Worker('faith-maintenance', async (job) => (job.name === 'fast' ? fastTick() : slowTick()), { connection });
  worker.on('failed', (job, err) => log.error({ job: job?.name, err }, 'job failed'));
  log.info('worker scheduling through BullMQ');
  return async () => {
    await worker.close();
    await queue.close();
    connection.disconnect();
  };
}

function withTimers() {
  let stopped = false;
  const loop = async () => {
    while (!stopped) {
      await fastTick().catch((err: unknown) => log.error({ err }, 'tick failed'));
      await new Promise((r) => setTimeout(r, 2000));
    }
  };
  void loop();
  const slow = setInterval(() => void slowTick().catch((err: unknown) => log.error({ err }, 'slow tick failed')), 300_000);
  log.info('worker polling Postgres (no REDIS_URL)');
  return async () => {
    stopped = true;
    clearInterval(slow);
  };
}

async function main() {
  const stop = process.env.REDIS_URL ? await withBullMq(process.env.REDIS_URL) : withTimers();
  const shutdown = async () => {
    await stop();
    await db.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

void main();
