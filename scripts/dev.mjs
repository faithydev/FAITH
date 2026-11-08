#!/usr/bin/env node
/** Runs the database, API, web app and worker together. Ctrl+C stops all of them. */
import { ensureDatabase, ensureEnv, readEnv, run, service, stopOnExit, waitForPort } from './lib.mjs';

if (ensureEnv()) console.log('[faith] Created .env with freshly generated secrets. Run `pnpm bootstrap` to seed.');
const env = readEnv();

run('pnpm run build:packages');
const db = await ensureDatabase(env);
const api = service('api', 'pnpm --filter @faith/api dev', env);
await waitForPort(Number(env.API_PORT ?? 4000), 'API', 120);
const web = service('web', 'pnpm --filter @faith/web dev', env);
const worker = service('worker', 'pnpm --filter @faith/worker dev', env);
stopOnExit([db, api, web, worker]);
console.log(`\n[faith] Web ${env.WEB_ORIGIN}  API ${env.API_ORIGIN}/v1  Docs ${env.API_ORIGIN}/docs\n`);
