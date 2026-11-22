'use client';

import { toast } from '@/components/ui/client';
import { buttonClass } from '@/components/ui/primitives';
import { clientApi } from '@/lib/client';
import { Download, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

/** Downloads that need a fresh sign-in check first, so an old session gets a clear message, not an error file. */
export function FreshDownload({ href, label, minutes = 30 }: { href: string; label: string; minutes?: number }) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const { signedInAt } = await clientApi<{ signedInAt: string }>('/auth/session');
      // A minute of margin, so the server does not refuse a download the button just allowed.
      if (Date.now() - new Date(signedInAt).getTime() > (minutes - 1) * 60_000) {
        toast.error(t('errors.REAUTH_REQUIRED'));
        return;
      }
      window.location.assign(href);
    } catch {
      toast.error(t('errors.INTERNAL'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <button type="button" onClick={go} disabled={busy} className={buttonClass('secondary', 'sm')}>
      {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Download aria-hidden className="size-4" />}{label}
    </button>
  );
}
