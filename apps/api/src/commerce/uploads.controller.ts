import { Controller, Get, Param, Post, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { Auth, AuthContext, Public } from '../auth/context';
import { asciiFilename, StorageService, verifyFileUrl } from '../core/adapters';
import { badRequest, forbidden, notFound } from '../core/errors';
import { PrismaService } from '../core/prisma.service';
import { RateLimit } from '../core/rate-limit';

const MB = 1024 * 1024;
const MAX_SIZE = 100 * MB;
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

const PURPOSES = new Set(['product', 'image', 'evidence', 'campaign', 'lesson', 'app']);

@ApiTags('files')
@Controller()
export class UploadsController {
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {}

  @Post('uploads') @RateLimit(60, 60)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_SIZE, files: 1 } }))
  async upload(@Auth() a: AuthContext, @UploadedFile() file: Express.Multer.File | undefined, @Query('purpose') purpose = 'product') {
    if (!PURPOSES.has(purpose)) throw badRequest('INVALID_PURPOSE');
    if (!file) throw badRequest('FILE_REQUIRED');
    const kind = sniff(file.buffer);
    const ext = extname(file.originalname).toLowerCase();
    if (!kind || !kind.ext.includes(ext)) throw badRequest('UNSUPPORTED_FILE_TYPE');

    const isPublicImage = kind.public && purpose !== 'evidence';
    const storageKey = `${isPublicImage ? 'public' : 'private'}/${a.user.id}/${randomUUID()}${ext}`;
    await this.storage.store.put(storageKey, file.buffer, kind.mime);
    return this.prisma.db.upload.create({
      data: {
        ownerId: a.user.id, storageKey, filename: asciiFilename(file.originalname).slice(0, 200),
        mime: kind.mime, sizeBytes: file.size, purpose,
      },
    });
  }

  /** Public images only. Everything under `private/` needs a signed URL. */
  @Public() @Get('files/public/*path')
  async publicFile(@Param('path') path: string | string[], @Res() res: Response) {
    const key = `public/${Array.isArray(path) ? path.join('/') : path}`;
    const row = await this.prisma.db.upload.findUnique({ where: { storageKey: key } });
    if (!row) throw notFound();
    res.setHeader('Content-Type', row.mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    (await this.storage.store.open(key)).pipe(res);
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
