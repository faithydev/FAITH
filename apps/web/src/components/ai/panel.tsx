'use client';

import { toast, useErrorMessage } from '@/components/ui/client';
import { Button, Card, fieldClass } from '@/components/ui/primitives';
import { clientApi } from '@/lib/client';
import { Loader2, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';

export function AICommandPanel({ capabilities, locale }: { capabilities: { key: string; label: string; locked: boolean }[]; locale: string }) {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const [capability, setCapability] = useState(capabilities.find((c) => !c.locked)?.key ?? '');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ text: string; live: boolean } | null>(null);

  async function run(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      setResult(await clientApi<{ text: string; live: boolean }>('/ai/run', { body: { capability, prompt, locale } }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <form onSubmit={run} className="space-y-4">
        <div>
          <label htmlFor="ai-capability" className={fieldClass.label}>{t('app.ai.capability')}</label>
          <select id="ai-capability" value={capability} onChange={(e) => setCapability(e.target.value)} className={fieldClass.input}>
            {capabilities.map((c) => <option key={c.key} value={c.key} disabled={c.locked}>{c.label}{c.locked ? ` (${t('app.plans.pro')})` : ''}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ai-prompt" className={fieldClass.label}>{t('app.ai.prompt')}</label>
          <textarea id="ai-prompt" rows={4} required minLength={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} className={fieldClass.input} />
        </div>
        <Button type="submit" disabled={busy || !capability}>{busy && <Loader2 size={15} className="animate-spin" />}{t('app.ai.generate')}</Button>
      </form>
      {result && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="eyebrow mb-2">{result.live ? t('app.ai.draftLabel') : t('app.ai.demoLabel')}</p>
          <p data-testid="ai-result" className="text-sm whitespace-pre-wrap">{result.text}</p>
        </div>
      )}
      {capabilities.some((c) => c.locked) && <p className="mt-4 flex items-center gap-1.5 text-xs text-subtle"><Lock size={12} />{t('app.ai.proHint')}</p>}
    </Card>
  );
}
