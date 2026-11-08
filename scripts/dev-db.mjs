#!/usr/bin/env node
/**
 * Starts a real PostgreSQL server for local development without Docker.
 * Uses the `embedded-postgres` binaries. Data lives in .dev/postgres (git-ignored).
 *
 * If you already run Postgres (Docker Compose or a native install), you do not
 * need this script: point DATABASE_URL at that server instead.
 */
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const port = Number(process.env.FAITH_PG_PORT ?? 54329);
const dataDir = process.env.FAITH_PG_DIR ?? join(root, '.dev', 'postgres');
const databases = (process.env.FAITH_PG_DATABASES ?? 'faith_dev,faith_test').split(',');
const firstRun = !existsSync(join(dataDir, 'PG_VERSION'));

mkdirSync(dataDir, { recursive: true });

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'faith',
  password: 'faith_dev_only',
  port,
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: () => {},
  onError: (m) => console.error('[postgres]', m),
});

if (firstRun) await pg.initialise();
await pg.start();
for (const db of databases) {
  await pg.createDatabase(db).catch((e) => {
    if (!/already exists/i.test(String(e?.message))) throw e;
  });
}
console.log(`[faith] PostgreSQL ready on 127.0.0.1:${port} (databases: ${databases.join(', ')})`);

const stop = async () => {
  await pg.stop().catch(() => {});
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
