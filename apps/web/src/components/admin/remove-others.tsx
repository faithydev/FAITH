'use client';

import { toast, useErrorMessage } from '@/components/ui/client';
import { Button, fieldClass } from '@/components/ui/primitives';
import { useRouter } from '@/i18n/navigation';
import { clientApi } from '@/lib/client';
import { Loader2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';

type Preview = { keep: { email: string; name: string | null }[]; remove: number; missing: string[] };
type Labels = {
  body: string; keepLabel: string; keepHint: string; preview: string; willKeep: string; willRemove: string; missing: string;
  typeToConfirm: string; run: string; done: string; nothing: string;
};

/**
 * Removes every account except the signed-in owner and the listed emails. Two steps on purpose:
 * a preview that names who stays and counts who goes, then a typed confirmation.
 */
export function RemoveOthers({ labels, defaultKeep }: { labels: Labels; defaultKeep: string }) {
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [keep, setKeep] = useState(defaultKeep);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);

  const emails = () => keep.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);

  async function call<T>(path: string, body: object): Promise<T | null> {
    setBusy(true);
    try {
      return await clientApi<T>(path, { body });
    } catch (err) {
      toast.error(errorMessage(err));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function onPreview() {
    setWord('');
    setPreview(await call<Preview>('/admin/users/removal/preview', { keepEmails: emails() }));
  }

  async function onRun() {
    const res = await call<{ removed: number }>('/admin/users/removal', { keepEmails: emails(), confirm: 'REMOVE' });
    if (!res) return;
    toast.success(labels.done.replace('{count}', String(res.removed)));
    setPreview(null);
    setWord('');
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-[color-mix(in_srgb,var(--negative)_35%,transparent)] bg-[color-mix(in_srgb,var(--negative)_5%,transparent)] p-5" data-testid="remove-others">
      <p className="flex items-start gap-2 text-sm text-muted"><TriangleAlert size={16} className="mt-0.5 shrink-0 text-negative" />{labels.body}</p>
      <label className="mt-4 block text-xs font-medium text-muted" htmlFor="keep-emails">{labels.keepLabel}</label>
      <textarea
        id="keep-emails" rows={3} value={keep} onChange={(e) => { setKeep(e.target.value); setPreview(null); }}
        className={`${fieldClass.input} mt-1.5 font-mono text-xs`} spellCheck={false}
      />
      <p className="mt-1 text-xs text-subtle">{labels.keepHint}</p>
      <div className="mt-3">
        <Button variant="secondary" size="sm" onClick={onPreview} disabled={busy}>{busy && !preview && <Loader2 size={14} className="animate-spin" />}{labels.preview}</Button>
      </div>

      {preview && (
        <div className="mt-4 space-y-3 border-t border-line pt-4 text-sm" data-testid="removal-preview">
          <div>
            <p className="font-medium">{labels.willKeep.replace('{count}', String(preview.keep.length))}</p>
            <ul className="mt-1 space-y-0.5 text-xs text-muted">{preview.keep.map((k) => <li key={k.email}>{k.name ? `${k.name} · ` : ''}{k.email}</li>)}</ul>
          </div>
          {preview.missing.length > 0 && <p className="text-negative">{labels.missing.replace('{emails}', preview.missing.join(', '))}</p>}
          {preview.remove === 0 ? <p className="text-muted">{labels.nothing}</p> : preview.missing.length === 0 && (
            <>
              <p className="font-medium text-negative" data-testid="removal-count">{labels.willRemove.replace('{count}', String(preview.remove))}</p>
              <label className="block text-xs text-muted" htmlFor="confirm-word">{labels.typeToConfirm}</label>
              <div className="flex flex-wrap items-center gap-2">
                <input id="confirm-word" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" className={`${fieldClass.input} max-w-40 font-mono`} />
                <Button variant="danger" size="sm" disabled={busy || word !== 'REMOVE'} onClick={onRun}>{busy && <Loader2 size={14} className="animate-spin" />}{labels.run}</Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
