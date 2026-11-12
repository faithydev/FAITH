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

export interface ObjectStore {
  readonly driver: string;
  put(key: string, body: Buffer, mime: string): Promise<void>;
  /** A short-lived URL. Local storage signs an API route; S3 presigns. */
  signedUrl(key: string, opts: { ttlSeconds: number; filename?: string }): Promise<string>;
  open(key: string): Promise<Readable>;
}

class LocalStore implements ObjectStore {
  readonly driver = 'local';
  private readonly root = resolve(env.STORAGE_DIR);

  private path(key: string) {
    const full = normalize(join(this.root, key));
    if (!full.startsWith(this.root + sep)) throw new Error('invalid storage key');
    return full;
  }
  async put(key: string, body: Buffer) {
    const path = this.path(key);
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(path, body);
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

  async put(key: string, body: Buffer, mime: string) {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    await (await this.client).send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: mime }));
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
      logger.info({ to: m.to, template: m.template }, 'email recorded by dev adapter, not sent');
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
