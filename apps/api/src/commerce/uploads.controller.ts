import {
  CallHandler, Controller, ExecutionContext, Get, Injectable, NestInterceptor, OnModuleInit, Param, Post, Query, Req, Res, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdirSync, promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { finalize, type Observable } from 'rxjs';
import { Auth, AuthContext, Public } from '../auth/context';
import { asciiFilename, StorageService, verifyFileUrl } from '../core/adapters';
import { AppError, badRequest, forbidden, notFound, tooMany } from '../core/errors';
import { PrismaService } from '../core/prisma.service';
import { RateLimit } from '../core/rate-limit';

const MB = 1024 * 1024;
/**
 * Uploads land in a temporary file and stream on to storage, so a 300 MB lesson video never
 * sits in the server's memory (the free plan has 512 MB in total).
 */
const UPLOAD_DIR = join(tmpdir(), 'faith-uploads', String(process.pid));
const MAX_SIZE = 300 * MB;
/** Per kind of file: images stay small, lesson videos may be large, everything else in between. */
const LIMITS = { image: 10 * MB, video: MAX_SIZE, file: 100 * MB };
/** Uploads handled at once by one server; more wait a moment and try again. */
const MAX_PARALLEL = 3;
let inFlight = 0;

@Injectable()
class UploadSlots implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (inFlight >= MAX_PARALLEL) throw tooMany('UPLOADS_BUSY');
    inFlight += 1;
    return next.handle().pipe(finalize(() => { inFlight -= 1; }));
  }
}

/** The first bytes of a file on disk, for sniffing its real type. */
async function head(path: string) {
  const fh = await fs.open(path, 'r');
  try {
    const b = Buffer.alloc(16);
    await fh.read(b, 0, 16, 0);
    return b;
  } finally {
    await fh.close();
  }
}

type Kind = { mime: string; ext: string[]; public: boolean };

/** Content types come from magic bytes. The client's declared type and name are not trusted. */
function sniff(b: Buffer): Kind | null {
  const hex = b.subarray(0, 12).toString('hex');
  if (hex.startsWith('89504e470d0a1a0a')) return { mime: 'image/png', ext: ['.png'], public: true };
  if (hex.startsWith('ffd8ff')) return { mime: 'image/jpeg', ext: ['.jpg', '.jpeg'], public: true };
  if (hex.startsWith('47494638')) return { mime: 'image/gif', ext: ['.gif'], public: true };
  if (hex.startsWith('52494646') && hex.slice(16, 24) === '57454250') return { mime: 'image/webp', ext: ['.webp'], public: true };
  if (hex.startsWith('25504446')) return { mime: 'application/pdf', ext: ['.pdf'], public: false };
  // PK is a normal archive, PK an empty one.
  if (hex.startsWith('504b0304') || hex.startsWith('504b0506')) return { mime: 'application/zip', ext: ['.zip', '.fig', '.sketch', '.docx', '.xlsx', '.pptx'], public: false };
  if (hex.slice(8, 16) === '66747970') return { mime: 'video/mp4', ext: ['.mp4', '.mov'], public: false };
  return null;
}

/** `evidence` and `receipt` images are private: they can carry personal and bank details. */
const PURPOSES = new Set(['product', 'image', 'evidence', 'campaign', 'lesson', 'app', 'receipt', 'post']);
const PRIVATE_PURPOSES = new Set(['evidence', 'receipt']);

@ApiTags('files')
@Controller()
export class UploadsController implements OnModuleInit {
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {}

  /** This process's own folder; a restarted server starts with an empty one. */
  async onModuleInit() {
    await fs.rm(UPLOAD_DIR, { recursive: true, force: true }).catch(() => {});
    mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  @Post('uploads') @RateLimit(60, 60)
  @UseInterceptors(UploadSlots, FileInterceptor('file', { dest: UPLOAD_DIR, limits: { fileSize: MAX_SIZE, files: 1, fields: 5 } }))
  async upload(@Auth() a: AuthContext, @UploadedFile() file: Express.Multer.File | undefined, @Query('purpose') purpose: unknown) {
    try {
      const use = purpose === undefined ? 'product' : purpose;
      if (typeof use !== 'string' || !PURPOSES.has(use)) throw badRequest('INVALID_PURPOSE');
      if (!file) throw badRequest('FILE_REQUIRED');
      const kind = sniff(await head(file.path));
      const ext = extname(file.originalname).toLowerCase();
      if (!kind || !kind.ext.includes(ext)) throw badRequest('UNSUPPORTED_FILE_TYPE');
      const limit = kind.public ? LIMITS.image : kind.mime === 'video/mp4' ? LIMITS.video : LIMITS.file;
      if (file.size > limit) throw new AppError(413, 'FILE_TOO_LARGE', { maxBytes: limit });

      const isPublicImage = kind.public && !PRIVATE_PURPOSES.has(use);
      const storageKey = `${isPublicImage ? 'public' : 'private'}/${a.user.id}/${randomUUID()}${ext}`;
      await this.storage.store.put(storageKey, { path: file.path, size: file.size }, kind.mime);
      return await this.prisma.db.upload.create({
        data: {
          ownerId: a.user.id, storageKey, filename: asciiFilename(file.originalname).slice(0, 200),
          mime: kind.mime, sizeBytes: file.size, purpose: use,
        },
      });
    } finally {
      if (file?.path) await fs.rm(file.path, { force: true }).catch(() => {});
    }
  }

  /** Public images only. Everything under `private/` needs a signed URL. */
  @Public() @Get('files/public/*path')
  async publicFile(@Param('path') path: string | string[], @Res() res: Response) {
    const key = `public/${Array.isArray(path) ? path.join('/') : path}`;
    const row = await this.prisma.db.upload.findUnique({ where: { storageKey: key } });
    if (!row) throw notFound();
    // A record whose file is gone (for example one written before storage moved) is a 404, not a 500.
    let stream: NodeJS.ReadableStream;
    try {
      stream = await this.storage.store.open(key);
    } catch {
      throw notFound();
    }
    res.setHeader('Content-Type', row.mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Keys are random per upload, so a day at the browser and at Vercel's edge (s-maxage) is safe;
    // the image then never makes the trip to the API again that day.
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
    stream.pipe(res);
  }

  @Public() @Get('files/signed')
  async signed(
    @Query('key') key: string, @Query('exp') exp: string, @Query('sig') sig: string,
    @Query('filename') filename: string | undefined, @Req() _req: Request, @Res() res: Response,
  ) {
    if (!key || !sig || !verifyFileUrl(key, Number(exp), filename, sig)) throw forbidden('INVALID_SIGNATURE');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="${asciiFilename(filename ?? 'download')}"`);
    (await this.storage.store.open(key)).pipe(res);
  }
}
