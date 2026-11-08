'use client';

import { toast, useErrorMessage } from '@/components/ui/client';
import { Button } from '@/components/ui/primitives';
import { clientApi } from '@/lib/client';
import { Download, Loader2 } from 'lucide-react';
import { useState } from 'react';

/** Asks the API for a fresh signed link each time, so access is re-checked per download. */
export function DownloadButton({ entitlementId, assetId, label }: { entitlementId: string; assetId: string; label: string }) {
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const { url } = await clientApi<{ url: string }>(`/library/${entitlementId}/assets/${assetId}/download`, { body: {} });
      window.location.assign(url);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button size="sm" variant="secondary" disabled={busy} onClick={run} data-testid="download">
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}{label}
    </Button>
  );
}
