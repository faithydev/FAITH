#!/usr/bin/env node
/**
 * Restores a FAITH backup (.faithbk, made by the API's BackupService) into an EMPTY database.
 *
 *   node scripts/restore-backup.mjs <file.faithbk> --check
 *       Decrypts and reads the whole file and prints the rows per table. Touches no database.
 *
 *   TARGET_DATABASE_URL=postgres://... node scripts/restore-backup.mjs <file.faithbk>
 *       Loads it into the target, which must already have the migrations applied
 *       (DATABASE_URL=<target> pnpm db:migrate) and hold no rows at all.
 *
 * The key is BACKUP_PASSPHRASE, or APP_ENCRYPTION_KEY when the backups were made without one.
 * Everything runs in one transaction: a restore either completes or leaves the target empty.
 * Foreign keys are dropped for the load and added back at the end, which checks every reference.
 */
import { createDecipheriv, scryptSync } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { createGunzip } from 'node:zlib';

// Must match apps/api/src/core/backup.service.ts.
const MAGIC = Buffer.from('FAITHBK1');
const HEAD = MAGIC.length + 16 + 12;
const TAG = 16;
const BATCH = 500;

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const checkOnly = args.includes('--check');
const passphrase = process.env.BACKUP_PASSPHRASE || process.env.APP_ENCRYPTION_KEY;
const fail = (message) => {
  console.error(`[restore] ${message}`);
  process.exit(1);
};

if (!file) fail('Usage: node scripts/restore-backup.mjs <file.faithbk> [--check]');
if (!passphrase) fail('Set BACKUP_PASSPHRASE (or APP_ENCRYPTION_KEY) to the key the backups were made with.');

/** Yields the backup's JSON lines, decrypting and unzipping as it streams. */
async function* readLines(path) {
  const size = (await fs.stat(path)).size;
  if (size < HEAD + TAG) fail('This file is too small to be a FAITH backup.');
  const fh = await fs.open(path, 'r');
  const head = Buffer.alloc(HEAD);
  const tag = Buffer.alloc(TAG);
  await fh.read(head, 0, HEAD, 0);
  await fh.read(tag, 0, TAG, size - TAG);
  await fh.close();
  if (!head.subarray(0, MAGIC.length).equals(MAGIC)) fail('This is not a FAITH backup (unknown header).');
  const salt = head.subarray(MAGIC.length, MAGIC.length + 16);
  const iv = head.subarray(MAGIC.length + 16, HEAD);
  const key = scryptSync(passphrase, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const source = createReadStream(path, { start: HEAD, end: size - TAG - 1 });
  const body = createGunzip();
  body.setEncoding('utf8');
  // Any failure along the way ends the read with a clear reason instead of a silent stop.
  const bad = new Error('Wrong key, or the file was changed or cut short.');
  source.on('error', (e) => body.destroy(e));
  decipher.on('error', () => body.destroy(bad));
  source.pipe(decipher).pipe(body);
  let rest = '';
  try {
    for await (const chunk of body) {
      rest += chunk;
      let at;
      while ((at = rest.indexOf('\n')) >= 0) {
        yield rest.slice(0, at);
        rest = rest.slice(at + 1);
      }
    }
  } catch (err) {
    throw err === bad || err?.code?.startsWith?.('Z_') ? bad : err;
  }
  if (rest) yield rest;
}

const quote = (name) => `"${name.replace(/"/g, '""')}"`;

async function check(path) {
  let header;
  const counts = new Map();
  let table = null;
  for await (const line of readLines(path)) {
    if (!line) continue;
    if (!header) { header = JSON.parse(line); continue; }
    if (line.startsWith('{"table":')) { table = JSON.parse(line).table; counts.set(table, 0); continue; }
    counts.set(table, counts.get(table) + 1);
  }
  return { header, counts };
}

async function restore(path, url) {
  const root = resolve(import.meta.dirname, '..');
  const { Client } = createRequire(join(root, 'packages/database/package.json'))('pg');
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    const migrated = await db.query(`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`).catch(() => null);
    if (!migrated) throw new Error('The target has no migrations. Run: DATABASE_URL=<target> pnpm db:migrate');
    const applied = new Set(migrated.rows.map((r) => r.migration_name));
    const tables = (await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'`)).rows.map((r) => r.table_name);
    const busy = [];
    for (const t of tables) if ((await db.query(`SELECT EXISTS (SELECT 1 FROM ${quote(t)}) AS has`)).rows[0].has) busy.push(t);
    if (busy.length) throw new Error(`The target is not empty (${busy.slice(0, 8).join(', ')}${busy.length > 8 ? ', ...' : ''}). Restore only into a fresh database, before the API starts on it.`);
    const columns = new Map();
    for (const r of (await db.query(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`)).rows) {
      if (!columns.has(r.table_name)) columns.set(r.table_name, new Set());
      columns.get(r.table_name).add(r.column_name);
    }

    await db.query('BEGIN');
    const fks = (await db.query(`
      SELECT c.conrelid::regclass::text AS tbl, c.conname, pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace`)).rows;
    for (const fk of fks) await db.query(`ALTER TABLE ${fk.tbl} DROP CONSTRAINT ${quote(fk.conname)}`);

    let header;
    let table = null;
    let cols = null;
    let batch = [];
    const counts = new Map();
    const flush = async () => {
      if (!batch.length) return;
      const list = cols.map(quote).join(', ');
      await db.query(`INSERT INTO ${quote(table)} (${list}) SELECT ${list} FROM json_populate_recordset(NULL::${quote(table)}, $1::json)`, [`[${batch.join(',')}]`]);
      counts.set(table, (counts.get(table) ?? 0) + batch.length);
      batch = [];
    };
    for await (const line of readLines(path)) {
      if (!line) continue;
      if (!header) {
        header = JSON.parse(line);
        if (header.faithBackup !== 1) throw new Error('Unknown backup format.');
        const missing = header.migrations.filter((m) => !applied.has(m));
        if (missing.length) throw new Error(`The target lacks migrations the backup was made with: ${missing.join(', ')}. Migrate it first.`);
        continue;
      }
      if (line.startsWith('{"table":')) {
        await flush();
        table = JSON.parse(line).table;
        if (!columns.has(table)) throw new Error(`The target has no table ${table}.`);
        counts.set(table, 0);
        cols = null;
        continue;
      }
      if (!cols) {
        // Only columns both sides know; a column added by a newer migration takes its default.
        const known = columns.get(table);
        cols = Object.keys(JSON.parse(line)).filter((c) => known.has(c));
      }
      batch.push(line);
      if (batch.length >= BATCH) await flush();
    }
    await flush();

    // The ledger's deferred balance check runs now, on every restored transaction, before the
    // foreign keys come back (Postgres cannot alter a table with checks still pending).
    await db.query('SET CONSTRAINTS ALL IMMEDIATE');
    for (const fk of fks) await db.query(`ALTER TABLE ${fk.tbl} ADD CONSTRAINT ${quote(fk.conname)} ${fk.def}`);
    // Counters behind serial columns continue after the restored rows.
    const serials = (await db.query(`
      SELECT table_name, column_name, pg_get_serial_sequence(format('%I', table_name), column_name) AS seq
      FROM information_schema.columns WHERE table_schema = 'public' AND column_default LIKE 'nextval(%'`)).rows;
    for (const s of serials) {
      if (!s.seq) continue;
      await db.query(`SELECT setval($1, (SELECT COALESCE(MAX(${quote(s.column_name)}), 0) + 1 FROM ${quote(s.table_name)}), false)`, [s.seq]);
    }
    await db.query('COMMIT');
    return { header, counts };
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await db.end();
  }
}

try {
  const url = process.env.TARGET_DATABASE_URL;
  if (!checkOnly && !url) fail('Set TARGET_DATABASE_URL to the empty database, or pass --check.');
  const { header, counts } = checkOnly ? await check(file) : await restore(file, url);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  console.log(`[restore] backup made ${header.createdAt}, ${counts.size} tables, ${total} rows ${checkOnly ? 'read (check only)' : 'restored'}`);
  for (const [t, n] of [...counts].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${t}: ${n}`);
  console.log(JSON.stringify({ ok: true, tables: counts.size, rows: total, counts: Object.fromEntries(counts) }));
} catch (err) {
  fail(err.message);
}
