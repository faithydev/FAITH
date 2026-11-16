import { Injectable } from '@nestjs/common';
import { createReadStream, promises as fs } from 'node:fs';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import type { Readable } from 'node:stream';
import { hmacHex, safeEqual } from './crypto';
import { env } from './env';
import { logger } from './logger';
import { PrismaService } from './prisma.service';

// ---------------------------------------------------------------------------
// Object storage
// ---------------------------------------------------------------------------

/** Bytes in memory, or a file on disk streamed in (large uploads never sit in memory). */
export type ObjectBody = Buffer | { path: string; size: number };

export interface ObjectStore {
  readonly driver: string;
  put(key: string, body: ObjectBody, mime: string): Promise<void>;
  /** A short-lived URL. Local storage signs an API route; S3 presigns. */
  signedUrl(key: string, opts: { ttlSeconds: number; filename?: string }): Promise<string>;
  open(key: string): Promise<Readable>;
  /** Size in bytes, or null when there is no such object. */
  size(key: string): Promise<number | null>;
  /** Bytes `start` to `end`, both inclusive: for video players that seek. */
  openRange(key: string, start: number, end: number): Promise<Readable>;
  /** Objects whose key starts with `prefix`, for maintenance such as backups. */
  list(prefix: string): Promise<StoredObject[]>;
  remove(key: string): Promise<void>;
}

export type StoredObject = { key: string; size: number; modifiedAt: Date };

class LocalStore implements ObjectStore {
  readonly driver = 'local';
  private readonly root = resolve(env.STORAGE_DIR);

  private path(key: string) {
    const full = normalize(join(this.root, key));
    if (!full.startsWith(this.root + sep)) throw new Error('invalid storage key');
    return full;
  }
  async put(key: string, body: ObjectBody) {
    const path = this.path(key);
    await fs.mkdir(dirname(path), { recursive: true });
    if (Buffer.isBuffer(body)) await fs.writeFile(path, body);
    else await fs.copyFile(body.path, path);
  }
  async signedUrl(key: string, opts: { ttlSeconds: number; filename?: string }) {
    const exp = Math.floor(Date.now() / 1000) + opts.ttlSeconds;
    const sig = signFileUrl(key, exp, opts.filename);
    const q = new URLSearchParams({ key, exp: String(exp), sig });
    if (opts.filename) q.set('filename', opts.filename);
    return `/api/v1/files/signed?${q}`;
  }
  async open(key: string) {
    const path = this.path(key);
    await fs.access(path);
    return createReadStream(path);
  }
  async size(key: string) {
    try {
      return (await fs.stat(this.path(key))).size;
    } catch {
      return null;
    }
  }
  async openRange(key: string, start: number, end: number) {
    return createReadStream(this.path(key), { start, end });
  }
  async list(prefix: string) {
    const dir = dirname(this.path(`${prefix}x`));
    const names = await fs.readdir(dir).catch(() => [] as string[]);
    const out: StoredObject[] = [];
    for (const name of names) {
      const key = `${prefix}${name}`;
      const st = await fs.stat(this.path(key)).catch(() => null);
      if (st?.isFile()) out.push({ key, size: st.size, modifiedAt: st.mtime });
    }
    return out;
  }
  async remove(key: string) {
    await fs.rm(this.path(key), { force: true });
  }
}

class S3Store implements ObjectStore {
  readonly driver = 's3';
  private client = (async () => {
    const { S3Client } = await import('@aws-sdk/client-s3');
    return new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: true,
      credentials: { accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY! },
      // Cloudflare R2 and other S3-compatible stores: send checksums only when an operation needs them.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  })();

  async put(key: string, body: ObjectBody, mime: string) {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const fromDisk = !Buffer.isBuffer(body);
    await (await this.client).send(new PutObjectCommand({
      Bucket: env.S3_BUCKET, Key: key, ContentType: mime,
      Body: fromDisk ? createReadStream(body.path) : body,
      ContentLength: fromDisk ? body.size : body.length,
    }));
  }
  async signedUrl(key: string, opts: { ttlSeconds: number; filename?: string }) {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    return getSignedUrl(
      await this.client,
      new GetObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        ResponseContentDisposition: opts.filename ? `attachment; filename="${asciiFilename(opts.filename)}"` : undefined,
      }),
      { expiresIn: opts.ttlSeconds },
    );
  }
  async open(key: string) {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const out = await (await this.client).send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    return out.Body as Readable;
  }
  async size(key: string) {
    const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
    try {
      const out = await (await this.client).send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
      return out.ContentLength ?? null;
    } catch {
      return null;
    }
  }
  async openRange(key: string, start: number, end: number) {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const out = await (await this.client).send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Range: `bytes=${start}-${end}` }));
    return out.Body as Readable;
  }
  async list(prefix: string) {
    const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
    const out: StoredObject[] = [];
    let token: string | undefined;
    do {
      const page = await (await this.client).send(new ListObjectsV2Command({ Bucket: env.S3_BUCKET, Prefix: prefix, ContinuationToken: token }));
      for (const o of page.Contents ?? []) if (o.Key) out.push({ key: o.Key, size: o.Size ?? 0, modifiedAt: o.LastModified ?? new Date(0) });
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return out;
  }
  async remove(key: string) {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    await (await this.client).send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  }
}

export const asciiFilename = (name: string) => name.replace(/[^\w.\- ]+/g, '_');

export function signFileUrl(key: string, exp: number, filename?: string) {
  return hmacHex(env.DOWNLOAD_SIGNING_SECRET, `${key}\n${exp}\n${filename ?? ''}`);
}
export function verifyFileUrl(key: string, exp: number, filename: string | undefined, sig: string) {
  return exp > Date.now() / 1000 && safeEqual(sig, signFileUrl(key, exp, filename));
}

@Injectable()
export class StorageService {
  readonly store: ObjectStore = env.STORAGE_DRIVER === 's3' ? new S3Store() : new LocalStore();
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

export type EmailMessage = { to: string; template: string; subject: string; text: string };

@Injectable()
export class EmailService {
  private transport = env.EMAIL_DRIVER === 'smtp'
    ? import('nodemailer').then((n) => n.createTransport(env.SMTP_URL))
    : null;

  constructor(private readonly prisma: PrismaService) {}

  async send(m: EmailMessage) {
    const row = await this.prisma.db.emailOutbox.create({ data: { ...m, adapter: env.EMAIL_DRIVER } });
    if (!this.transport) {
      // The address is masked: logs are not a place for people's email addresses.
      logger.info({ to: m.to.replace(/^(.).*(@.*)$/, '$1***$2'), template: m.template }, 'email recorded by dev adapter, not sent');
      return;
    }
    try {
      await (await this.transport).sendMail({ from: env.EMAIL_FROM, to: m.to, subject: m.subject, text: m.text });
      await this.prisma.db.emailOutbox.update({ where: { id: row.id }, data: { sentAt: new Date() } });
    } catch (err) {
      logger.error({ err, emailId: row.id }, 'email send failed');
    }
  }
}
