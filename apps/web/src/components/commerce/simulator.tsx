'use client';

import { toast, useErrorMessage } from '@/components/ui/client';
import { Button, LinkButton } from '@/components/ui/primitives';
import { useRouter } from '@/i18n/navigation';
import { clientApi } from '@/lib/client';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

const NEXT: Record<string, string> = {
  ORDER: '/app/orders', SUBSCRIPTION: '/app/billing', CAMPAIGN_FUNDING: '/app/brand/campaigns', ADVERTISING: '/app/seller/growth', APP_PURCHASE: '/app/explore',
};

export function PaymentSimulator({ paymentId, status: initial, purpose }: { paymentId: string; status: string; purpose: string }) {
  const t = useTranslations();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [status, setStatus] = useState(initial);
  const [busy, setBusy] = useState<'success' | 'failure' | null>(null);
  const href = NEXT[purpose] ?? '/app';

  async function simulate(outcome: 'success' | 'failure') {
    setBusy(outcome);
    try {
      const r = await clientApi<{ status: string }>(`/payments/${paymentId}/simulate`, { body: { outcome } });
      setStatus(r.status);
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  if (status === 'SUCCEEDED') {
    return (
      <div role="status" className="mt-5">
        <p className="flex items-center gap-2 text-sm font-medium text-positive"><CheckCircle2 size={18} />{t('checkout.success')}</p>
        <LinkButton href={href} size="lg" className="mt-4 w-full" data-testid="payment-continue">{t('common.continue')}</LinkButton>
      </div>
    );
  }
  if (status === 'FAILED') {
    return (
      <div role="status" className="mt-5">
        <p className="flex items-center gap-2 text-sm font-medium text-negative"><XCircle size={18} />{t('checkout.failed')}</p>
        <LinkButton href={purpose === 'ORDER' ? '/cart' : href} variant="secondary" size="lg" className="mt-4 w-full">{t('checkout.backToCart')}</LinkButton>
      </div>
    );
  }
  return (
    <div className="mt-5 grid gap-2">
      <Button size="lg" data-testid="simulate-success" disabled={!!busy} onClick={() => simulate('success')}>{busy === 'success' && <Loader2 size={15} className="animate-spin" />}{t('checkout.simulateSuccess')}</Button>
      <Button size="lg" variant="secondary" data-testid="simulate-failure" disabled={!!busy} onClick={() => simulate('failure')}>{busy === 'failure' && <Loader2 size={15} className="animate-spin" />}{t('checkout.simulateFailure')}</Button>
    </div>
  );
}
