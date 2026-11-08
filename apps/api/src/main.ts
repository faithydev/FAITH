import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { deliverWebhooks, drainOutbox, expireSubscriptions } from '@faith/automation';
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
  logger.info('worker running inside the API');
}

void bootstrap();
