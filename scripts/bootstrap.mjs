#!/usr/bin/env node
/**
 * First-run setup, safe to repeat: creates .env with fresh secrets, builds the shared packages,
 * starts the database if needed, applies migrations and seeds the development demo data.
 *
 * Named `bootstrap` because `pnpm setup` is a built-in pnpm command that would never reach us.
 */
import { spawnSync } from 'node:child_process';
import { clearWebDataCache, ensureDatabase, ensureEnv, readEnv, root, run } from './lib.mjs';

if (ensureEnv()) console.log('[faith] Created .env with freshly generated secrets.');
const env = readEnv();

run('pnpm run build:packages');
const db = await ensureDatabase(env);
try {
  run('pnpm --filter @faith/database exec prisma migrate deploy', { env: { ...process.env, ...env } });
  run('pnpm --filter @faith/api seed', { env: { ...process.env, ...env } });
  clearWebDataCache();
} finally {
  if (db) {
    if (process.platform === 'win32') spawnSync(`taskkill /pid ${db.pid} /T /F`, { shell: true, stdio: 'ignore', cwd: root });
    else db.kill('SIGTERM');
  }
}
console.log('\n[faith] Ready. Start everything with: pnpm dev');
process.exit(0);
