import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { deliverWebhooks, drainOutbox, expireSubscriptions, refreshRates, settleBadges } from '@faith/automation';
import { BadgesService } from './identity/badges';
import { AppModule } from './app.module';
import { configureApp, setupOpenApi } from './configure';
import { env } from './core/env';
import { logger } from './core/logger';
import { PrismaService } from './core/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true, logger: ['error', 'warn'] });
  configureApp(app);
  setupOpenApi(app);
  await app.listen(env.API_PORT);
  await app.get(BadgesService).boot().catch((err: unknown) => logger.error({ err }, 'badge start-up failed'));
  logger.info({ port: env.API_PORT }, 'FAITH API listening');
  if (env.RUN_WORKER) startWorker(app.get(PrismaService));
}

/** The worker's loop, in this process: for hosts that offer one web service and no worker. */
function startWorker(prisma: PrismaService) {
  const opts = { encryptionKey: env.APP_ENCRYPTION_KEY, allowPrivateTargets: false };
  let busy = false;
  setInterval(async () => {
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
  }, 4000);
  setInterval(() => { expireSubscriptions(prisma.db).catch((err) => logger.error({ err }, 'expiry failed')); }, 3_600_000);
  setInterval(() => { settleBadges(prisma.db).catch((err) => logger.error({ err }, 'badges failed')); }, 300_000);
  // Official exchange rates: once at start, then every six hours. A failed fetch keeps the old rates.
  const rates = () => { refreshRates(prisma.db).then((r) => logger.info(r, 'exchange rates refreshed')).catch((err: unknown) => logger.warn({ err: (err as Error).message }, 'exchange rates not refreshed')); };
  rates();
  setInterval(rates, 6 * 3_600_000);
  logger.info('worker running inside the API');
}

void bootstrap();
