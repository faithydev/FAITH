'use client';

import { Modal, toast, useErrorMessage } from '@/components/ui/client';
import { useRouter } from '@/i18n/navigation';
import { clientApi, uploadFile } from '@/lib/client';
import { Globe, Loader2, ShieldCheck, Video } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';

type Access = 'paid' | 'free';

/**
 * Upload or replace a lesson's MP4. Before uploading, the creator says what it is: paid video is
 * protected (only buyers, watermark, capture warnings, one device); free video plays for anyone.
 */
export function LessonVideoUpload({ lessonId, hasVideo, isPreview }: { lessonId: string; hasVideo: boolean; isPreview: boolean }) {
  const t = useTranslations();
  const id = useId();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  async function upload(access: Access) {
    const chosen = file;
    setFile(null);
    if (!chosen) return;
    setBusy(true);
    try {
      const uploaded = await uploadFile(chosen, 'lesson');
      await clientApi(`/creator/lessons/${lessonId}/video`, { method: 'PUT', body: { uploadId: uploaded.id, access } });
      toast.success(access === 'paid' ? t('app.creator.videoReadyPaid') : t('app.creator.videoReadyFree'));
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
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
        {busy ? t('app.creator.videoUploading') : hasVideo ? t('app.creator.videoReplace') : t('app.creator.videoUpload')}
      </label>
      <input
        id={id} type="file" accept="video/mp4,.mp4" disabled={busy} className="sr-only"
        onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ''; }}
      />
      <Modal open={!!file} onOpenChange={(v) => { if (!v) setFile(null); }} title={t('app.creator.accessQuestion')} description={file?.name}>
        <div className="space-y-2.5">
          {choice('paid', <ShieldCheck size={20} />, t('app.creator.accessPaid'), t('app.creator.accessPaidBody'), hasVideo && !isPreview)}
          {choice('free', <Globe size={20} />, t('app.creator.accessFree'), t('app.creator.accessFreeBody'), hasVideo && isPreview)}
        </div>
      </Modal>
    </>
  );
}
