import { ActionButton } from '@/components/ui/client';
import { Badge, Card, PageHeader, SectionTitle, SimulatedNotice, StatusBadge } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';

type Plan = { key: string; name: string; monthlyMinor: string | null; yearlyMinor: string | null; currency: string; features: { featureKey: string; limit: number | null }[] };
type State = {
  plan: Plan | null;
  subscription: { status: string; interval: string; currentPeriodEnd: string; cancelAtPeriodEnd: boolean } | null;
  history: { id: string; status: string; interval: string; priceMinor: string; currency: string; createdAt: string; plan: { name: string } }[];
  payments: { active: string; providers: { name: string; live: boolean; label: string }[] };
};

export default async function BillingPage() {
  const { t, m, d, status } = await pageContext();
  const [state, plans] = await Promise.all([api<State>('/billing/state'), api<Plan[]>('/billing/plans')]);
  const pro = plans.find((p) => p.key === 'pro');
  const sub = state.subscription;
  const simulated = !state.payments.providers.some((p) => p.name === state.payments.active && p.live);
  return (
    <>
      <PageHeader title={t('nav.billing')} description={t('app.billing.body')} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title={t('app.billing.current')} />
          <p className="font-display text-2xl font-semibold" data-testid="current-plan">{t(`app.plans.${state.plan?.key ?? 'free'}`)}</p>
          {sub && (
            <p className="mt-2 text-sm text-muted">
              {sub.cancelAtPeriodEnd ? t('app.billing.endsOn', { date: d(sub.currentPeriodEnd) }) : t('app.billing.renewsOn', { date: d(sub.currentPeriodEnd) })}
            </p>
          )}
          {sub && (
            <div className="mt-4">
              {sub.cancelAtPeriodEnd
                ? <ActionButton endpoint="/billing/resume" label={t('app.billing.resume')} />
                : <ActionButton endpoint="/billing/cancel" label={t('app.billing.cancel')} confirm={{ title: t('app.billing.cancelConfirm'), body: t('app.billing.cancelBody', { date: d(sub.currentPeriodEnd) }), danger: true }} />}
            </div>
          )}
        </Card>
        {pro && !sub && (
          <Card className="p-5">
            <SectionTitle title={t('app.billing.upgrade')} />
            <ul className="mb-4 grid gap-1 text-sm text-muted sm:grid-cols-2">
              {pro.features.filter((f) => !f.featureKey.startsWith('limit.')).map((f) => <li key={f.featureKey}>{t(`app.features.${f.featureKey.replace('.', '_')}`)}</li>)}
            </ul>
            {pro.monthlyMinor || pro.yearlyMinor ? (
              <div className="flex flex-wrap gap-2">
                {pro.monthlyMinor && <ActionButton endpoint="/billing/upgrade" body={{ interval: 'MONTHLY' }} idempotent followPayment variant="primary" size="md" label={t('app.billing.monthly', { price: m(pro.monthlyMinor, pro.currency) })} />}
                {pro.yearlyMinor && <ActionButton endpoint="/billing/upgrade" body={{ interval: 'YEARLY' }} idempotent followPayment size="md" label={t('app.billing.yearly', { price: m(pro.yearlyMinor, pro.currency) })} />}
              </div>
            ) : <p className="text-sm text-muted">{t('app.billing.priceNotSet')}</p>}
            {simulated && <div className="mt-4"><SimulatedNotice>{t('app.billing.simulated')}</SimulatedNotice></div>}
          </Card>
        )}
      </div>
      <section className="mt-8">
        <SectionTitle title={t('app.billing.history')} />
        {state.history.length === 0 ? <p className="text-sm text-muted">{t('app.billing.noHistory')}</p> : (
          <ul className="card divide-y divide-line">
            {state.history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 p-3.5 text-sm">
                <span>{h.plan.name} <Badge>{t(`app.billing.intervals.${h.interval}`)}</Badge></span>
                <span className="flex items-center gap-3"><span className="text-xs text-muted">{d(h.createdAt)}</span><StatusBadge status={h.status} label={status(h.status)} /><span className="tabular-nums">{m(h.priceMinor, h.currency)}</span></span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
