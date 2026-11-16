'use client';

import { toast, useErrorMessage } from '@/components/ui/client';
import { useRouter } from '@/i18n/navigation';
import { clientApi, uploadFile } from '@/lib/client';
import { Loader2, Video } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';

/** Upload or replace a lesson's MP4. Paid students then watch it in the protected player. */
export function LessonVideoUpload({ lessonId, hasVideo }: { lessonId: string; hasVideo: boolean }) {
  const t = useTranslations();
  const id = useId();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const uploaded = await uploadFile(file, 'lesson');
      await clientApi(`/creator/lessons/${lessonId}/video`, { method: 'PUT', body: { uploadId: uploaded.id } });
      toast.success(t('app.creator.videoReady'));
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <label htmlFor={id} className="fx-btn fx-ghost fx-sm cursor-pointer" data-testid={`lesson-video-${lessonId}`}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />}
        {busy ? t('app.creator.videoUploading') : hasVideo ? t('app.creator.videoReplace') : t('app.creator.videoUpload')}
      </label>
      <input id={id} type="file" accept="video/mp4,.mp4" disabled={busy} onChange={onChange} className="sr-only" />
    </>
  );
}
