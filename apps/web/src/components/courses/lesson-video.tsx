'use client';

import { Modal, toast, useErrorMessage } from '@/components/ui/client';
import { useRouter } from '@/i18n/navigation';
import { clientApi, uploadFile } from '@/lib/client';
import { uploadDrmVideo } from '@/lib/drm-upload';
import { Globe, Loader2, ShieldCheck, Video } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';

type Access = 'paid' | 'free';

/**
 * Upload or replace a lesson's video. Before uploading, the creator says what it is: paid video
 * is protected (only buyers, watermark, capture warnings, one device; under DRM when it is
 * switched on, sent straight to the DRM provider); free video plays for anyone.
 */
export function LessonVideoUpload({ lessonId, hasVideo, isPreview, drm }: { lessonId: string; hasVideo: boolean; isPreview: boolean; drm: boolean }) {
  const t = useTranslations();
  const id = useId();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);

  async function upload(access: Access) {
    const chosen = file;
    setFile(null);
    if (!chosen) return;
    setBusy(true);
    try {
      if (access === 'paid' && drm) {
        const videoId = await uploadDrmVideo(chosen, (f) => setProgress(Math.round(f * 100)));
        await clientApi(`/creator/lessons/${lessonId}/drm-video`, { method: 'PUT', body: { videoId } });
        toast.success(t('app.creator.drmReady'));
      } else {
        const uploaded = await uploadFile(chosen, 'lesson');
        await clientApi(`/creator/lessons/${lessonId}/video`, { method: 'PUT', body: { uploadId: uploaded.id, access } });
        toast.success(access === 'paid' ? t('app.creator.videoReadyPaid') : t('app.creator.videoReadyFree'));
      }
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const choice = (access: Access, icon: React.ReactNode, title: string, body: string, current: boolean) => (
    <button
      type="button" onClick={() => upload(access)} data-testid={`video-access-${access}`}
      className="flex w-full items-start gap-3 rounded-2xl border border-line p-4 text-start transition-colors hover:border-accent focus-visible:border-accent"
    >
      <span className="mt-0.5 text-neon">{icon}</span>
      <span>
        <span className="block font-medium">{title}{current && <span className="ms-2 text-xs text-subtle">({t('app.creator.current')})</span>}</span>
        <span className="mt-0.5 block text-sm text-muted">{body}</span>
      </span>
    </button>
  );

  return (
    <>
      <label htmlFor={id} className="fx-btn fx-ghost fx-sm cursor-pointer" data-testid={`lesson-video-${lessonId}`}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />}
        {busy
          ? progress !== null ? t('app.creator.drmUploading', { percent: progress }) : t('app.creator.videoUploading')
          : hasVideo ? t('app.creator.videoReplace') : t('app.creator.videoUpload')}
      </label>
      <input
        id={id} type="file" accept="video/mp4,.mp4" disabled={busy} className="sr-only"
        onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ''; }}
      />
      <Modal open={!!file} onOpenChange={(v) => { if (!v) setFile(null); }} title={t('app.creator.accessQuestion')} description={file?.name}>
        <div className="space-y-2.5">
          {choice('paid', <ShieldCheck size={20} />, drm ? t('app.creator.accessPaidDrm') : t('app.creator.accessPaid'), drm ? t('app.creator.accessPaidDrmBody') : t('app.creator.accessPaidBody'), hasVideo && !isPreview)}
          {choice('free', <Globe size={20} />, t('app.creator.accessFree'), t('app.creator.accessFreeBody'), hasVideo && isPreview)}
        </div>
      </Modal>
    </>
  );
}
