'use client';

import { toast, useErrorMessage } from '@/components/ui/client';
import { Button, Card, fieldClass } from '@/components/ui/primitives';
import { useRouter } from '@/i18n/navigation';
import { clientApi, newKey } from '@/lib/client';
import { money } from '@/lib/format';
import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

export function CheckoutSummary({ totals }: { totals: { currency: string; subtotalMinor: string }[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  // One key per page view: a double click or a retry cannot create a second order.
  const key = useRef(newKey());

  async function checkout() {
    setBusy(true);
    try {
      let affiliateCode: string | undefined;
      try { affiliateCode = sessionStorage.getItem('faith-ref') ?? undefined; } catch { /* storage may be unavailable */ }
      const r = await clientApi<{ orderId: string; payment: { redirectUrl: string | null } | null }>('/checkout', {
        body: { idempotencyKey: key.current, discountCode: code || undefined, affiliateCode },
      });
      if (r.payment?.redirectUrl) return router.push(r.payment.redirectUrl);
      router.push(`/app/orders/${r.orderId}`);
      router.refresh();
    } catch (e) {
      key.current = newKey();
      toast.error(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Card className="p-5 lg:sticky lg:top-20">
      <h2 className="font-semibold">{t('cart.summary')}</h2>
      {totals.map((x) => (
        <dl key={x.currency} className="mt-3 flex justify-between text-sm"><dt className="text-muted">{t('cart.subtotal')}</dt><dd data-testid="cart-subtotal" className="font-semibold tabular-nums">{money(x.subtotalMinor, x.currency, locale)}</dd></dl>
      ))}
      <div className="mt-4">
        <label htmlFor="discount" className={fieldClass.label}>{t('cart.discountCode')}</label>
        <input id="discount" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={32} className={fieldClass.input} />
      </div>
      <Button size="lg" className="mt-4 w-full" disabled={busy} data-testid="checkout" onClick={checkout}>
        {busy && <Loader2 size={15} className="animate-spin" />}{t('cart.checkout')}
      </Button>
      <p className="mt-3 text-xs text-subtle">{t('cart.note')}</p>
    </Card>
  );
}
