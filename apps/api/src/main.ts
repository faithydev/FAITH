import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp, setupOpenApi } from './configure';
import { env } from './core/env';
import { logger } from './core/logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true, logger: ['error', 'warn'] });
  configureApp(app);
  setupOpenApi(app);
  await app.listen(env.API_PORT);
  logger.info({ port: env.API_PORT }, 'FAITH API listening');
}

void bootstrap();
