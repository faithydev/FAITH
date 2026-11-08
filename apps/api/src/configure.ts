import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { env } from './core/env';

/** JSON has no bigint. Money leaves the API as digit strings. */
(BigInt.prototype as unknown as { toJSON(): string }).toJSON = function toJSON(this: bigint) {
  return this.toString();
};

/** Shared by the server and the integration tests, so tests run the real middleware stack. */
export function configureApp(app: INestApplication) {
  const express = app as NestExpressApplication;
  express.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cookieParser());
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  app.setGlobalPrefix('v1');
  app.enableShutdownHooks();
}

export function setupOpenApi(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('FAITH API')
    .setDescription('REST API for the FAITH platform. Money is expressed in minor units as digit strings.')
    .setVersion('0.1.0')
    .addCookieAuth('faith_session')
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'api-key')
    .build();
  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, config), { jsonDocumentUrl: 'docs/openapi.json' });
}
