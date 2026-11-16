import { Injectable } from '@nestjs/common';
import { Prisma } from '@faith/database';
import { createCipheriv, randomBytes, scryptSync } from 'node:crypto';
import { createWriteStream, promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { StorageService } from './adapters';
import { env } from './env';
import { logger } from './logger';
import { PrismaService } from './prisma.service';

/**
 * Backup file layout, read by scripts/restore-backup.mjs:
 *   "FAITHBK1" | salt (16 bytes) | iv (12 bytes) | AES-256-GCM( gzip( JSON lines ) ) | tag (16 bytes)
 * The key is scrypt(passphrase, salt). The JSON lines are a header line, then for each table a
 * `{"table":"Name"}` line followed by one `row_to_json` line per row.
 */
export const BACKUP_MAGIC = Buffer.from('FAITHBK1');
export const BACKUP_PREFIX = 'backups/app/';
export const BACKUP_NAME = /^faith-(\d{8})T(\d{6})Z\.faithbk$/;
const LOCK_ID = 7_274_291;
const BATCH = 500;
const DAY = 86_400_000;

export const backupKey = (passphrase: string, salt: Buffer) =>
  scryptSync(passphrase, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;

function createdAt(name: string, fallback: Date) {
  const m = BACKUP_NAME.exec(name);
  if (!m) return fallback;
  const [d, t] = [m[1]!, m[2]!];
  return new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8), +t.slice(0, 2), +t.slice(2, 4), +t.slice(4, 6)));
}

export type BackupInfo = { name: string; size: number; createdAt: Date };

/**
 * Tables ordered so every table comes after the tables it references. A restore then loads
 * ledger transactions before their entries, and the ledger's own checks (currency, balance)
 * run on the restored rows exactly as they did on the originals. Self-references and any cycle
 * fall back to name order; the restore re-adds foreign keys at the end, which checks them all.
 */
export function parentsFirst(names: string[], edges: { child: string; parent: string }[]) {
  const known = new Set(names);
  const needs = new Map(names.map((n) => [n, new Set<string>()]));
  for (const e of edges) if (e.child !== e.parent && known.has(e.child) && known.has(e.parent)) needs.get(e.child)!.add(e.parent);
  const out: string[] = [];
  const placed = new Set<string>();
  while (out.length < names.length) {
    const ready = names.filter((n) => !placed.has(n) && [...needs.get(n)!].every((p) => placed.has(p)));
    const next = ready.length ? ready : names.filter((n) => !placed.has(n)).slice(0, 1);
    for (const n of next) {
      placed.add(n);
      out.push(n);
    }
  }
  return out;
}

/**
 * Nightly, encrypted copy of the whole database in object storage (R2), made by the API itself,
 * so it needs nothing outside the app: no GitHub Actions, no pg_dump. One consistent snapshot
 * (REPEATABLE READ), streamed table by table through a cursor, gzip and AES-256-GCM to a
 * temporary file, then uploaded. The key comes from BACKUP_PASSPHRASE, or APP_ENCRYPTION_KEY
 * when none is set (a restore needs that key anyway, to read the secrets stored in the data).
 */
@Injectable()
export class BackupService {
  private running = false;

  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {}

  private passphrase() {
    return env.BACKUP_PASSPHRASE ?? env.APP_ENCRYPTION_KEY;
  }

  async list(): Promise<BackupInfo[]> {
    const items = await this.storage.store.list(BACKUP_PREFIX);
    return items
      .map((o) => ({ name: o.key.slice(BACKUP_PREFIX.length), size: o.size, modifiedAt: o.modifiedAt }))
      .filter((o) => BACKUP_NAME.test(o.name))
      .map((o) => ({ name: o.name, size: o.size, createdAt: createdAt(o.name, o.modifiedAt) }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private lastMadeAt = 0;

  /**
   * Makes a backup when the newest is older than 20 hours, then applies retention. If storage
   * cannot list (a key without list rights), the time of this process's last backup decides,
   * so backups still happen, once a day.
   */
  async runIfDue(now = new Date()) {
    let newest = this.lastMadeAt;
    try {
      newest = Math.max(newest, (await this.list())[0]?.createdAt.getTime() ?? 0);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'backup list failed; using this process\'s last backup time');
    }
    if (now.getTime() - newest < 20 * 3_600_000) return null;
    const made = await this.run();
    if (made) {
      this.lastMadeAt = now.getTime();
      await this.prune(now).catch((err: unknown) => logger.warn({ err: (err as Error).message }, 'backup retention skipped'));
    }
    return made;
  }

  /** Removes backups past BACKUP_KEEP_DAYS; the three newest always stay, whatever their age. */
  async prune(now = new Date()) {
    const cutoff = now.getTime() - env.BACKUP_KEEP_DAYS * DAY;
    const removed: string[] = [];
    for (const b of (await this.list()).slice(3)) {
      if (b.createdAt.getTime() < cutoff) {
        await this.storage.store.remove(BACKUP_PREFIX + b.name);
        removed.push(b.name);
      }
    }
    return removed;
  }

  async open(name: string) {
    if (!BACKUP_NAME.test(name)) return null;
    const key = BACKUP_PREFIX + name;
    const size = await this.storage.store.size(key);
    return size === null ? null : { size, stream: await this.storage.store.open(key) };
  }

  /** One backup now. Returns null when another one is already running. */
  async run(): Promise<{ name: string; size: number; tables: number; rows: number } | null> {
    if (this.running) return null;
    this.running = true;
    const dir = await fs.mkdtemp(join(tmpdir(), 'faith-backup-'));
    const file = join(dir, 'backup.faithbk');
    try {
      const salt = randomBytes(16);
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', backupKey(this.passphrase(), salt), iv);
      await fs.writeFile(file, Buffer.concat([BACKUP_MAGIC, salt, iv]));
      const stats = { tables: 0, rows: 0 };

      const done = await this.prisma.db.$transaction(async (tx) => {
        // One backup across all servers at a time.
        const [lock] = await tx.$queryRaw<{ ok: boolean }[]>`SELECT pg_try_advisory_xact_lock(${LOCK_ID}) AS ok`;
        if (!lock?.ok) return false;
        const names = (await tx.$queryRaw<{ name: string }[]>`
          SELECT table_name AS name FROM information_schema.tables
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'
          ORDER BY table_name`).map((r) => r.name);
        const edges = await tx.$queryRaw<{ child: string; parent: string }[]>`
          SELECT cl.relname AS child, pl.relname AS parent FROM pg_constraint c
          JOIN pg_class cl ON cl.oid = c.conrelid JOIN pg_class pl ON pl.oid = c.confrelid
          WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace`;
        const tables = parentsFirst(names, edges);
        const migrations = (await tx.$queryRaw<{ name: string }[]>`
          SELECT migration_name AS name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY migration_name`).map((r) => r.name);

        async function* lines() {
          yield `${JSON.stringify({ faithBackup: 1, createdAt: new Date().toISOString(), migrations, tables })}\n`;
          for (const table of tables) {
            stats.tables += 1;
            yield `${JSON.stringify({ table })}\n`;
            await tx.$executeRawUnsafe(`DECLARE faith_backup NO SCROLL CURSOR FOR SELECT row_to_json(t)::text AS j FROM ${quote(table)} t`);
            for (;;) {
              const batch = await tx.$queryRawUnsafe<{ j: string }[]>(`FETCH ${BATCH} FROM faith_backup`);
              if (batch.length === 0) break;
              stats.rows += batch.length;
              yield `${batch.map((r) => r.j).join('\n')}\n`;
            }
            await tx.$executeRawUnsafe('CLOSE faith_backup');
          }
        }

        await pipeline(lines(), createGzip(), cipher, createWriteStream(file, { flags: 'a' }));
        return true;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 10_000, timeout: 15 * 60_000 });
      if (!done) return null;

      await fs.appendFile(file, cipher.getAuthTag());
      const size = (await fs.stat(file)).size;
      const name = `faith-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z.faithbk`;
      await this.storage.store.put(BACKUP_PREFIX + name, { path: file, size }, 'application/octet-stream');
      logger.info({ name, size, ...stats }, 'database backup stored');
      return { name, size, ...stats };
    } finally {
      this.running = false;
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
