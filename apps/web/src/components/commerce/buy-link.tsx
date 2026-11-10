'use client';

import { toast, useErrorMessage } from '@/components/ui/client';
import { Button } from '@/components/ui/primitives';
import { useRouter } from '@/i18n/navigation';
import { clientApi } from '@/lib/client';
import { Check, Copy, Loader2 } from 'lucide-react';
import { useState } from 'react';

/** Puts the linked plan in the cart and goes straight to it. */
export function BuyNow({ variantId, label }: { variantId: string; label: string }) {
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  async function buy() {
    setBusy(true);
    try {
      await clientApi('/cart/items', { body: { variantId, quantity: 1 } });
      router.push('/cart');
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  }
  return (
    <Button variant="primary" size="lg" arrow onClick={buy} disabled={busy} className="w-full" data-testid="buy-now">
      {busy && <Loader2 size={16} className="animate-spin" />}{label}
    </Button>
  );
}

/** Copies a link's full address, built from where the page is actually being served. */
export function CopyLink({ path, label, copied }: { path: string; label: string; copied: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setDone(true);
      toast.success(copied);
      setTimeout(() => setDone(false), 1800);
    } catch {
      toast.error(path);
    }
  }
  return (
    <button type="button" onClick={copy} aria-label={label} title={label} className="fx-btn fx-ghost fx-sm">
      {done ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}
