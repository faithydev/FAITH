'use client';

import { toast, useErrorMessage } from '@/components/ui/client';
import { useRouter } from '@/i18n/navigation';
import { clientApi, uploadFile } from '@/lib/client';
import { Loader2, Upload } from 'lucide-react';
import { useId, useState } from 'react';

export function FileUploader({ productId, label, hint }: { productId: string; label: string; hint: string }) {
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
      const uploaded = await uploadFile(file, 'product');
      await clientApi(`/seller/products/${productId}/assets`, { body: { uploadId: uploaded.id, kind: file.type.startsWith('image/') ? 'IMAGE' : 'FILE' } });
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-line-strong px-3 py-4 text-sm text-muted hover:text-ink">
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}{label}
      </label>
      <input id={id} data-testid="file-input" type="file" disabled={busy} onChange={onChange} className="sr-only" />
      <p className="mt-1.5 text-xs text-subtle">{hint}</p>
    </div>
  );
}
