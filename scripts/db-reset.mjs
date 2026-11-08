#!/usr/bin/env node
/** Drops the development database, re-applies migrations and reseeds. Development only. */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const envFile = resolve(root, '.env');
const env = { ...process.env };
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2];
  }
}
if (env.NODE_ENV === 'production') {
  console.error('Refusing to reset a production database.');
  process.exit(1);
}
const url = env.DATABASE_URL ?? '';
if (!/127\.0\.0\.1|localhost/.test(url)) {
  console.error(`Refusing to reset a non-local database: ${url.replace(/:[^:@/]+@/, ':***@')}`);
  process.exit(1);
}

const run = (cmd) => {
  const r = spawnSync(cmd, { cwd: root, env, stdio: 'inherit', shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

run('pnpm --filter @faith/database exec prisma migrate reset --force');
run('pnpm run build:packages');
run('pnpm --filter @faith/api seed');
// Cached public answers point at the old rows; drop them with the old data (build and dev caches).
for (const dir of ['apps/web/.next/cache/fetch-cache', 'apps/web/.next/dev/cache/fetch-cache']) {
  rmSync(resolve(root, dir), { recursive: true, force: true });
}
