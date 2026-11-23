import { Injectable } from '@nestjs/common';
import type { DrmVideo } from '@faith/database';
import { buildDrm, DrmProvider } from './drm';
import { forbidden, notFound } from './errors';
import { PrismaService } from './prisma.service';

/**
 * FAITH's side of DRM: which videos live with the provider, who uploaded them, and whether the
 * provider has finished encrypting them. Status is checked with the provider only while a video
 * is not ready yet, so a ready video costs no extra call.
 */
@Injectable()
export class DrmService {
  private readonly provider: DrmProvider | null = buildDrm();

  constructor(private readonly prisma: PrismaService) {}

  get enabled() {
    return this.provider !== null;
  }

  private require(): DrmProvider {
    if (!this.provider) throw forbidden('DRM_NOT_CONFIGURED');
    return this.provider;
  }

  /** Step one of an upload: the provider hands out a one-time address for the browser to send the file to. */
  async createUpload(ownerId: string, title: string) {
    const p = this.require();
    const upload = await p.createUpload(title);
    await this.prisma.db.drmVideo.create({ data: { id: upload.videoId, provider: p.name, ownerId, title } });
    return { id: upload.videoId, uploadUrl: upload.uploadUrl, fields: upload.fields };
  }

  async owned(videoId: string, userId: string) {
    const v = await this.prisma.db.drmVideo.findUnique({ where: { id: videoId } });
    if (!v || v.ownerId !== userId) throw notFound('VIDEO_NOT_FOUND');
    return v;
  }

  /** Asks the provider how far encryption got, and remembers the answer. */
  async refresh(v: DrmVideo) {
    if (v.status === 'ready' || v.status === 'failed') return v;
    const s = await this.require().status(v.id);
    if (s.status === v.status && s.durationSec === v.durationSec) return v;
    return this.prisma.db.drmVideo.update({ where: { id: v.id }, data: { status: s.status, durationSec: s.durationSec } });
  }

  /** A fresh, five-minute player address for one viewer, or the reason there is none yet. */
  async player(videoId: string, watermark: string) {
    const v = await this.prisma.db.drmVideo.findUnique({ where: { id: videoId } });
    if (!v) throw notFound('VIDEO_NOT_FOUND');
    const fresh = await this.refresh(v);
    if (fresh.status !== 'ready') return { status: fresh.status, playerUrl: null };
    const { playerUrl } = await this.require().playback(v.id, watermark);
    return { status: 'ready' as const, playerUrl };
  }
}
