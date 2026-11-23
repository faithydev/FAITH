import { randomUUID } from 'node:crypto';
import { env } from './env';
import { AppError } from './errors';
import { logger } from './logger';

/** Where the browser sends the file: straight to the provider's storage, never through FAITH. */
export type DrmUpload = { videoId: string; uploadUrl: string; fields: Record<string, string> };
export type DrmState = 'uploading' | 'processing' | 'ready' | 'failed';
export type DrmStatus = { status: DrmState; durationSec: number | null };
/** A one-time, short-lived address of the provider's player for one viewer. */
export type DrmPlayback = { playerUrl: string };

/**
 * DRM for paid video. The provider encrypts the video (Widevine for Chrome, Edge, Firefox and
 * Android; FairPlay for Safari and iPhone) and plays it in its own player; the decryption key
 * stays inside the browser's protected module, so developer tools and download managers only
 * ever see encrypted pieces. Each playback needs a fresh token that FAITH issues per viewer.
 */
export interface DrmProvider {
  readonly name: string;
  createUpload(title: string): Promise<DrmUpload>;
  status(videoId: string): Promise<DrmStatus>;
  /** `watermark` is drawn by the provider's player over the protected picture. */
  playback(videoId: string, watermark: string): Promise<DrmPlayback>;
  remove(videoIds: string[]): Promise<void>;
}

const drmError = () => new AppError(502, 'DRM_PROVIDER_ERROR');

/** VdoCipher: https://www.vdocipher.com/docs/server/ */
export class VdoCipherProvider implements DrmProvider {
  readonly name = 'vdocipher';
  private readonly base = 'https://dev.vdocipher.com/api/videos';

  constructor(private readonly secret: string) {}

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.base}${path}`, {
        method,
        headers: {
          Authorization: `Apisecret ${this.secret}`,
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      logger.warn({ err: (err as Error).message, method, path: path.split('?')[0] }, 'drm provider unreachable');
      throw drmError();
    }
    const text = await res.text();
    if (!res.ok) {
      // The body can echo request details; only the status and the start of the message are kept.
      logger.warn({ status: res.status, method, path: path.split('?')[0], body: text.slice(0, 200) }, 'drm provider refused');
      throw drmError();
    }
    return (text ? JSON.parse(text) : null) as T;
  }

  async createUpload(title: string): Promise<DrmUpload> {
    type Credentials = {
      videoId: string;
      clientPayload: {
        policy: string; key: string; uploadLink: string;
        'x-amz-signature': string; 'x-amz-algorithm': string; 'x-amz-date': string; 'x-amz-credential': string;
      };
    };
    const r = await this.call<Credentials>('PUT', `?${new URLSearchParams({ title: title.slice(0, 200), folderId: 'root' })}`);
    const p = r.clientPayload;
    return {
      videoId: r.videoId,
      uploadUrl: p.uploadLink,
      // The order matters to S3: every field before the file, which the browser appends last.
      fields: {
        key: p.key,
        policy: p.policy,
        'x-amz-signature': p['x-amz-signature'],
        'x-amz-algorithm': p['x-amz-algorithm'],
        'x-amz-date': p['x-amz-date'],
        'x-amz-credential': p['x-amz-credential'],
        success_action_status: '201',
        success_action_redirect: '',
      },
    };
  }

  async status(videoId: string): Promise<DrmStatus> {
    const r = await this.call<{ status: string; length?: number }>('GET', `/${encodeURIComponent(videoId)}`);
    const s = r.status.toLowerCase();
    const status: DrmState = s === 'ready' ? 'ready' : s === 'pre-upload' ? 'uploading' : /error|fail/.test(s) ? 'failed' : 'processing';
    return { status, durationSec: typeof r.length === 'number' && r.length > 0 ? Math.round(r.length) : null };
  }

  async playback(videoId: string, watermark: string): Promise<DrmPlayback> {
    // The watermark moves across the frame every few seconds, inside the protected player.
    const annotate = JSON.stringify([
      { type: 'rtext', text: watermark, alpha: '0.55', color: '0xFFFFFF', size: '13', interval: '5000' },
    ]);
    const r = await this.call<{ otp: string; playbackInfo: string }>('POST', `/${encodeURIComponent(videoId)}/otp`, { ttl: 300, annotate });
    const q = new URLSearchParams({ otp: r.otp, playbackInfo: r.playbackInfo });
    return { playerUrl: `https://player.vdocipher.com/v2/?${q}` };
  }

  async remove(videoIds: string[]) {
    if (videoIds.length === 0) return;
    await this.call('DELETE', `?videos=${videoIds.map(encodeURIComponent).join(',')}`);
  }
}

/** For tests and local development only: no video moves anywhere. Refused in production. */
export class FakeDrmProvider implements DrmProvider {
  readonly name = 'fake';
  readonly removed: string[] = [];

  async createUpload(): Promise<DrmUpload> {
    return { videoId: `fake_${randomUUID().replace(/-/g, '')}`, uploadUrl: 'https://upload.invalid/', fields: { key: 'fake' } };
  }
  async status(): Promise<DrmStatus> {
    return { status: 'ready', durationSec: 60 };
  }
  async playback(videoId: string, watermark: string): Promise<DrmPlayback> {
    return { playerUrl: `about:blank#fake-drm=${encodeURIComponent(videoId)}&wm=${encodeURIComponent(watermark)}` };
  }
  async remove(videoIds: string[]) {
    this.removed.push(...videoIds);
  }
}

export function buildDrm(): DrmProvider | null {
  if (env.DRM_PROVIDER === 'vdocipher') return new VdoCipherProvider(env.VDOCIPHER_API_SECRET!);
  if (env.DRM_PROVIDER === 'fake') return new FakeDrmProvider();
  return null;
}
