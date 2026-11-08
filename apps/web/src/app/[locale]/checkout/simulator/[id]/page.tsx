import { IntlScope } from '@/components/auth/scope';
import { PaymentSimulator } from '@/components/commerce/simulator';
import { FaithLogo } from '@/components/ui/logo';
import { Card } from '@/components/ui/primitives';
import { redirect } from '@/i18n/navigation';
import { api, getMe } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { money } from '@/lib/format';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

type Payment = { paymentId: string; status: string; amountMinor: string; currency: string; purpose: string; provider: string };

export default async function SimulatorPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, t, locale, me] = await Promise.all([params, getTranslations(), getLocale(), getMe()]);
  if (!me) return redirect({ href: '/login', locale });
  const p = await api<Payment>(`/payments/${id}`).catch((e: unknown) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  return (
    <main id="main" className="grid min-h-svh place-items-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><FaithLogo /></div>
        <Card className="p-6">
          <p className="rounded-sm bg-[color-mix(in_srgb,var(--warning)_15%,transparent)] px-2.5 py-1.5 text-center text-xs font-semibold text-warning">{t('checkout.simulatedBanner')}</p>
          <h1 className="mt-4 text-xl font-semibold">{t('checkout.title')}</h1>
          <p className="mt-1 text-sm text-muted">{t('checkout.body')}</p>
          <dl className="mt-5 flex items-baseline justify-between border-t border-line pt-4">
            <dt className="text-sm text-muted">{t(`checkout.purpose.${p.purpose}`)}</dt>
            <dd className="font-display text-2xl font-semibold tabular-nums">{money(p.amountMinor, p.currency, locale)}</dd>
          </dl>
          <IntlScope ns={['checkout']}><PaymentSimulator paymentId={p.paymentId} status={p.status} purpose={p.purpose} /></IntlScope>
        </Card>
      </div>
    </main>
  );
}
