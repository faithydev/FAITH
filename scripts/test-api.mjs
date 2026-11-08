#!/usr/bin/env node
/**
 * Runs API integration tests against a real PostgreSQL database.
 * Uses TEST_DATABASE_URL if set; otherwise it boots a throwaway embedded server,
 * so `pnpm test:api` needs neither Docker nor a local Postgres install.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

const root = resolve(import.meta.dirname, '..');
const secret = () => randomBytes(32).toString('base64');

let databaseUrl = process.env.TEST_DATABASE_URL;
let pg;
let dir;

if (!databaseUrl) {
  dir = mkdtempSync(join(tmpdir(), 'faith-pg-'));
  const port = 54400 + Math.floor(Math.random() * 400);
  pg = new EmbeddedPostgres({
    databaseDir: dir, user: 'faith', password: 'test', port, persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'], onLog: () => {}, onError: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('faith_test');
  databaseUrl = `postgresql://faith:test@127.0.0.1:${port}/faith_test`;
}

const env = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl,
  WEB_ORIGIN: 'http://localhost:3000',
  API_ORIGIN: 'http://localhost:4000',
  APP_ENCRYPTION_KEY: secret(),
  DOWNLOAD_SIGNING_SECRET: secret(),
  MOCK_PAYMENT_WEBHOOK_SECRET: secret(),
  PAYMENT_PROVIDER: 'mock',
  ALLOW_MOCK_PAYMENTS: 'true',
  STORAGE_DRIVER: 'local',
  STORAGE_DIR: join(dir ?? tmpdir(), 'storage'),
  EMAIL_DRIVER: 'dev',
  ANTHROPIC_API_KEY: '',
  REDIS_URL: '',
};

let status = 1;
try {
  const migrate = spawnSync('pnpm --filter @faith/database exec prisma migrate deploy', {
    cwd: root, env, stdio: 'pipe', shell: true, encoding: 'utf8',
  });
  if (migrate.status !== 0) {
    console.error(migrate.stdout, migrate.stderr);
    throw new Error('migration failed');
  }
  const args = process.argv.slice(2);
  const run = spawnSync(['pnpm', '--filter', '@faith/api', 'exec', 'vitest', 'run', ...args].join(' '), {
    cwd: root, env: { ...env, VITE_CONFIG_NATIVE_IGNORE_WARNING: 'true' }, stdio: 'inherit', shell: true,
  });
  status = run.status ?? 1;
} finally {
  if (pg) await pg.stop().catch(() => {});
  if (dir) rmSync(dir, { recursive: true, force: true });
}
process.exit(status);
