'use client';

import { toast, useErrorMessage } from '@/components/ui/client';
import { Button, fieldClass } from '@/components/ui/primitives';
import { useRouter } from '@/i18n/navigation';
import { clientApi } from '@/lib/client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

export function TwoFactorPanel({ enabled }: { enabled: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState('');
  const [backup, setBackup] = useState<string[] | null>(null);
  const [disabling, setDisabling] = useState(false);

  const start = () => clientApi<{ secret: string; uri: string }>('/auth/2fa/setup', { body: {} }).then(setSetup).catch((e: unknown) => toast.error(errorMessage(e)));
  const enable = () => clientApi<{ backupCodes: string[] }>('/auth/2fa/enable', { body: { code } }).then((r) => { setBackup(r.backupCodes); setSetup(null); setCode(''); }).catch((e: unknown) => toast.error(errorMessage(e)));
  const disable = () => clientApi('/auth/2fa/disable', { body: { code } }).then(() => { setDisabling(false); setCode(''); router.refresh(); }).catch((e: unknown) => toast.error(errorMessage(e)));

  if (backup) {
    return (
      <div>
        <p className="text-sm font-medium">{t('app.settings.backupTitle')}</p>
        <p className="mt-1 text-sm text-muted">{t('app.settings.backupBody')}</p>
        <ul className="mt-3 grid grid-cols-2 gap-1 font-mono text-xs">{backup.map((c) => <li key={c}>{c}</li>)}</ul>
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => { setBackup(null); router.refresh(); }}>{t('common.done')}</Button>
      </div>
    );
  }
  const codeInput = (
    <div className="mt-3">
      <label htmlFor="totp-code" className={fieldClass.label}>{t('auth.totp')}</label>
      <input id="totp-code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" className={fieldClass.input} />
    </div>
  );
  if (setup) {
    return (
      <div>
        <p className="text-sm text-muted">{t('app.settings.totpSetup')}</p>
        <code className="mt-2 block rounded-sm bg-surface-2 p-2 font-mono text-xs break-all">{setup.secret}</code>
        {codeInput}
        <Button size="sm" className="mt-3" onClick={enable}>{t('app.settings.totpEnable')}</Button>
      </div>
    );
  }
  if (enabled) {
    return disabling ? (
      <div>{codeInput}<Button size="sm" variant="secondary" className="mt-3" onClick={disable}>{t('app.settings.totpDisable')}</Button></div>
    ) : (
      <div className="flex items-center justify-between gap-3 text-sm"><span>{t('app.settings.totpOn')}</span><Button size="sm" variant="secondary" onClick={() => setDisabling(true)}>{t('app.settings.totpDisable')}</Button></div>
    );
  }
  return <div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted">{t('app.settings.totpOff')}</span><Button size="sm" variant="secondary" onClick={start}>{t('app.settings.totpEnable')}</Button></div>;
}
