import { IntlScope } from '@/components/auth/scope';
import { ReceiptCheckout, type DirectPayment } from '@/components/commerce/receipt-checkout';
import { FaithLogo } from '@/components/ui/logo';
import { Card } from '@/components/ui/primitives';
import { redirect } from '@/i18n/navigation';
import { api, getMe } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { money } from '@/lib/format';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('directPay.title') };
}

/** Paying a seller directly: their own card or company account, then the receipt. */
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, t, locale, me] = await Promise.all([params, getTranslations(), getLocale(), getMe()]);
  if (!me) return redirect({ href: `/login?next=/checkout/receipt/${id}`, locale });
  const p = await api<DirectPayment>(`/payments/${id}/direct`).catch((e: unknown) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  return (
    <main id="main" className="grid min-h-svh place-items-center p-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><FaithLogo /></div>
        <Card className="p-6">
          <h1 className="text-xl font-semibold">{t('directPay.title')}</h1>
          <p className="mt-1 text-sm text-muted">{p.order.titles.join(', ')}</p>
          <dl className="mt-5 flex items-baseline justify-between border-t border-line pt-4">
            <dt className="text-sm text-muted">{t('directPay.toPay', { number: p.order.number })}</dt>
            <dd className="font-display text-2xl font-semibold tabular-nums" data-testid="receipt-amount">{money(p.amountMinor, p.currency, locale)}</dd>
          </dl>
          <IntlScope ns={['directPay']}><ReceiptCheckout initial={p} amount={money(p.amountMinor, p.currency, locale)} /></IntlScope>
        </Card>
      </div>
    </main>
  );
}
