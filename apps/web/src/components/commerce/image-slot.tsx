'use client';

import { toast, useErrorMessage } from '@/components/ui/client';
import { cx } from '@/components/ui/primitives';
import { useRouter } from '@/i18n/navigation';
import { clientApi, uploadFile } from '@/lib/client';
import { fileUrl } from '@/lib/format';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useId, useState } from 'react';

/**
 * One image slot (a store logo or banner): shows the current picture, uploads a replacement,
 * removes it. `endpoint` receives PUT { uploadId } or { uploadId: null }.
 */
export function ImageSlot({ endpoint, current, label, upload, remove, shape = 'square' }: {
  endpoint: string; current: string | null; label: string; upload: string; remove: string; shape?: 'square' | 'wide';
}) {
  const id = useId();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);

  async function send(uploadId: string | null) {
    setBusy(true);
    try {
      await clientApi(endpoint, { method: 'PUT', body: { uploadId } });
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const uploaded = await uploadFile(file, 'image');
      await send(uploaded.id);
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted">{label}</p>
      <div className={cx('relative overflow-hidden rounded-xl border border-line bg-surface-2', shape === 'wide' ? 'aspect-[3/1]' : 'aspect-square w-28')}>
        {current
          ? <Image src={fileUrl(current)} alt={label} fill unoptimized className="object-cover" />
          : <span className="grid h-full place-items-center text-subtle"><ImagePlus size={20} /></span>}
        {busy && <span className="absolute inset-0 grid place-items-center bg-black/40"><Loader2 size={18} className="animate-spin text-white" /></span>}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <label htmlFor={id} className="fx-btn fx-secondary fx-sm cursor-pointer">{upload}</label>
        <input id={id} type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy} onChange={onChange} className="sr-only" data-testid={`slot-${label}`} />
        {current && (
          <button type="button" onClick={() => send(null)} disabled={busy} aria-label={remove} className="fx-btn fx-ghost fx-sm"><Trash2 size={14} /></button>
        )}
      </div>
    </div>
  );
}
