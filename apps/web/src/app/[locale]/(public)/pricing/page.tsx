import { Card, LinkButton } from '@/components/ui/primitives';
import { tryPublicApi } from '@/lib/api';
import { money, percent } from '@/lib/format';
import { DEFAULT_COMMISSION_BPS, FEATURES } from '@/lib/plan-features';
import { Check } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

type Plan = { key: string; monthlyMinor: string | null; yearlyMinor: string | null; currency: string };

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('pricing.title') };
}

export default async function PricingPage() {
  const [t, locale, plans] = await Promise.all([getTranslations(), getLocale(), tryPublicApi<Plan[]>('/billing/plans', 60)]);
  const pro = plans?.find((p) => p.key === 'pro');
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <header className="max-w-2xl">
        <h1 className="tracking-display text-[length:var(--text-title)] font-semibold">{t('pricing.title')}</h1>
        <p className="mt-3 text-lg text-muted">{t('pricing.body', { rate: percent(DEFAULT_COMMISSION_BPS, locale) })}</p>
      </header>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col p-6">
          <h2 className="font-display text-xl font-semibold">{t('app.plans.free')}</h2>
          <p className="mt-1 text-sm text-muted">{t('pricing.freeBody')}</p>
          <p className="mt-5 font-display text-4xl font-semibold">{money('0', 'USD', locale)}</p>
          <ul className="mt-5 mb-6 space-y-2 text-sm">
            {(['marketplace', 'rewards', 'store', 'courses'] as const).map((k) => <li key={k} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-accent" />{t(`pricing.free.${k}`)}</li>)}
          </ul>
          <LinkButton href="/register" variant="secondary" className="mt-auto">{t('nav.register')}</LinkButton>
        </Card>
        <Card className="flex flex-col border-primary p-6">
          <h2 className="font-display text-xl font-semibold">{t('app.plans.pro')}</h2>
          <p className="mt-1 text-sm text-muted">{t('pricing.proBody')}</p>
          <p className="mt-5 font-display text-4xl font-semibold">{pro?.monthlyMinor ? money(pro.monthlyMinor, pro.currency, locale) : t('pricing.tbd')}</p>
          {pro?.monthlyMinor && <p className="text-sm text-muted">{t('pricing.perMonth')}</p>}
          <ul className="mt-5 mb-6 grid gap-2 text-sm">
            {FEATURES.map((f) => <li key={f} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-accent" />{t(`app.features.${f.replace('.', '_')}`)}</li>)}
          </ul>
          <LinkButton href="/app/billing" className="mt-auto">{t('pricing.upgrade')}</LinkButton>
        </Card>
      </div>
      <p className="mt-8 text-sm text-muted">{t('pricing.note', { rate: percent(DEFAULT_COMMISSION_BPS, locale) })}</p>
    </div>
  );
}
