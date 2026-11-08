#!/usr/bin/env node
/**
 * Runs the compiled build locally: API, web and worker. Run `pnpm build` first.
 * This is a way to check a production build on one machine, not a deployment. See DEPLOYMENT.md.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ensureDatabase, readEnv, root, service, stopOnExit, waitForPort } from './lib.mjs';

for (const path of ['apps/api/dist/main.js', 'apps/web/.next/BUILD_ID', 'apps/worker/dist/main.js']) {
  if (!existsSync(resolve(root, path))) {
    console.error(`[faith] ${path} is missing. Run \`pnpm build\` first.`);
    process.exit(1);
  }
}

const env = readEnv();
const db = await ensureDatabase(env);
const api = service('api', 'node apps/api/dist/main.js', env);
await waitForPort(Number(env.API_PORT ?? 4000), 'API', 60);
const web = service('web', 'pnpm --filter @faith/web start', { ...env, NODE_ENV: 'production' });
const worker = service('worker', 'node apps/worker/dist/main.js', env);
stopOnExit([db, api, web, worker]);
