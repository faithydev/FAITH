#!/usr/bin/env node
/**
 * Start command for the public demo on Render (see render.yaml).
 *
 * 1. Applies database migrations, before anything serves traffic.
 * 2. Starts the API, which also runs the worker loop (RUN_WORKER=true).
 * 3. In the background, fills the demo world if it is missing: the main seed, the showcase
 *    account, then covers and placeholder files. All three skip work that is already done, so a
 *    restart costs seconds; the first boot takes a few minutes while the API is already up.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const prisma = createRequire(join(root, 'packages/database/package.json')).resolve('prisma/build/index.js');

if (!process.env.DATABASE_URL) {
  console.error('[faith] DATABASE_URL is not set. Add the Neon connection string in the service Environment tab, then deploy again.');
  process.exit(1);
}

const migrate = spawnSync(process.execPath, [prisma, 'migrate', 'deploy'], { cwd: join(root, 'packages/database'), stdio: 'inherit' });
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

const api = spawn(process.execPath, ['apps/api/dist/main.js'], { cwd: root, stdio: 'inherit' });
api.on('exit', (code) => process.exit(code ?? 1));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => api.kill(signal));

const steps = [['apps/api/dist/seed.js'], ['apps/api/dist/seed-showcase.js'], ['scripts/covers.mjs']];
for (const args of steps) {
  const result = await new Promise((done) => {
    const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit' });
    child.on('exit', done);
  });
  if (result !== 0) {
    console.error(`[faith] ${args[0]} failed with ${result}; the API keeps running.`);
    break;
  }
}
