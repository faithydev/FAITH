'use client';

import { Modal, toast, useErrorMessage } from '@/components/ui/client';
import { Button, fieldClass } from '@/components/ui/primitives';
import { useRouter } from '@/i18n/navigation';
import { clientApi, uploadFile } from '@/lib/client';
import { uploadDrmVideo } from '@/lib/drm-upload';
import { Loader2, Plus, Video } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';

/**
 * A new community post. The owner and moderators of a VIP community may attach an MP4: it is
 * then streamed only to members, in the protected player, with no Telegram channel needed.
 */
export function PostComposer({ slug, canVideo, drm }: { slug: string; canVideo: boolean; drm: boolean }) {
  const t = useTranslations();
  const id = useId();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<'upload' | 'post' | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      let videoUploadId: string | undefined;
      let drmVideoId: string | undefined;
      if (file) {
        setBusy('upload');
        // In a VIP community the video goes under DRM, straight to the provider.
        if (drm) drmVideoId = await uploadDrmVideo(file, (f) => setProgress(Math.round(f * 100)));
        else videoUploadId = (await uploadFile(file, 'post')).id;
      }
      setBusy('post');
      await clientApi(`/communities/${slug}/posts`, { body: { title, body, videoUploadId, drmVideoId } });
      toast.success(t('communities.posted'));
      setOpen(false);
      setTitle('');
      setBody('');
      setFile(null);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} data-testid="new-post"><Plus size={14} />{t('communities.newPost')}</Button>
      <Modal open={open} onOpenChange={setOpen} title={t('communities.newPost')}>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor={`${id}-title`} className={fieldClass.label}>{t('communities.postTitle')}</label>
            <input id={`${id}-title`} required maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass.input} />
          </div>
          <div>
            <label htmlFor={`${id}-body`} className={fieldClass.label}>{t('communities.postBody')}</label>
            <textarea id={`${id}-body`} required rows={5} maxLength={20000} value={body} onChange={(e) => setBody(e.target.value)} className={fieldClass.input} />
          </div>
          {canVideo && (
            <div>
              <label htmlFor={`${id}-video`} className="fx-btn fx-ghost fx-sm cursor-pointer"><Video size={14} />{file ? file.name : t('communities.addVideo')}</label>
              <input id={`${id}-video`} type="file" accept="video/mp4,.mp4" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <p className="mt-1.5 text-xs text-subtle">{t('communities.videoHint')}</p>
            </div>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={!!busy}>
              {busy && <Loader2 size={15} className="animate-spin" />}
              {busy === 'upload' ? (progress !== null ? t('communities.uploadingPercent', { percent: progress }) : t('communities.uploading')) : t('communities.publish')}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
