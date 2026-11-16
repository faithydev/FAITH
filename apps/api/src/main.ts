import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { deliverWebhooks, drainOutbox, expireSubscriptions, purgeExpired, refreshRates, settleBadges } from '@faith/automation';
import { BadgesService } from './identity/badges';
import { AppModule } from './app.module';
import { configureApp, setupOpenApi } from './configure';
import { env } from './core/env';
import { logger } from './core/logger';
import { PrismaService } from './core/prisma.service';

// A stray rejected promise is logged, not fatal; an uncaught exception leaves the process in an
// unknown state, so it is logged and the host (Render) starts a fresh one.
process.on('unhandledRejection', (reason) => logger.error({ err: reason }, 'unhandled promise rejection'));
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaught exception, exiting');
  process.exit(1);
});

/** Timers started next to the API; cleared on shutdown so no tick runs against a closed database. */
const timers: NodeJS.Timeout[] = [];
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => timers.forEach(clearInterval));

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true, logger: ['error', 'warn'] });
  configureApp(app);
  setupOpenApi(app);
  await app.listen(env.API_PORT);
  await app.get(BadgesService).boot().catch((err: unknown) => logger.error({ err }, 'badge start-up failed'));
  logger.info({ port: env.API_PORT }, 'FAITH API listening');
  if (env.RUN_WORKER) startWorker(app.get(PrismaService));
  keepAwake();
}

/**
 * Render's free plan stops a web service after 15 minutes without inbound traffic; the next
 * visitor then waits for a cold start (a minute or more, longer on a busy host). A request to
 * the service's own public address goes through Render's edge and counts as inbound traffic.
 * One service awake all month stays within the free plan's monthly instance hours.
 */
function keepAwake() {
  const self = process.env.RENDER_EXTERNAL_URL;
  if (!self || !env.KEEP_AWAKE) return;
  const ping = () => {
    fetch(`${self}/v1/health`, { signal: AbortSignal.timeout(30_000) })
      .catch((err: unknown) => logger.warn({ err: (err as Error).message }, 'keep-awake ping failed'));
  };
  timers.push(setInterval(ping, 10 * 60_000));
  logger.info('keep-awake ping every 10 minutes');
}

/** The worker's loop, in this process: for hosts that offer one web service and no worker. */
function startWorker(prisma: PrismaService) {
  const opts = { encryptionKey: env.APP_ENCRYPTION_KEY, allowPrivateTargets: false };
  let busy = false;
  timers.push(setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      await drainOutbox(prisma.db);
      await deliverWebhooks(prisma.db, opts);
    } catch (err) {
      logger.error({ err }, 'worker tick failed');
    } finally {
      busy = false;
    }
  }, 4000));
  const purge = () => {
    purgeExpired(prisma.db)
      .then((r) => { if (Object.values(r).some(Boolean)) logger.info(r, 'old rows purged'); })
      .catch((err: unknown) => logger.error({ err }, 'purge failed'));
  };
  timers.push(
    setInterval(() => { expireSubscriptions(prisma.db).catch((err) => logger.error({ err }, 'expiry failed')); }, 3_600_000),
    setInterval(() => { settleBadges(prisma.db).catch((err) => logger.error({ err }, 'badges failed')); }, 300_000),
    setInterval(purge, 6 * 3_600_000),
    setTimeout(purge, 60_000),
  );
  // Official exchange rates: once at start, then every six hours. A failed fetch keeps the old rates.
  const rates = () => { refreshRates(prisma.db).then((r) => logger.info(r, 'exchange rates refreshed')).catch((err: unknown) => logger.warn({ err: (err as Error).message }, 'exchange rates not refreshed')); };
  rates();
  timers.push(setInterval(rates, 6 * 3_600_000));
  logger.info('worker running inside the API');
}

void bootstrap();
