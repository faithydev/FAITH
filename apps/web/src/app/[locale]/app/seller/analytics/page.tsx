import { CreateStore, NoRole } from '@/components/seller/shared';
import type { Analytics } from '@/components/seller/shared';
import { AreaChart, BarList } from '@/components/ui/chart';
import { Card, LinkButton, PageHeader, SectionTitle, StatCard } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { date, number, percent } from '@/lib/format';
import { activeStore, pageContext } from '@/lib/page';

export default async function AnalyticsPage() {
  const { t, m, me, locale } = await pageContext();
  if (!me.permissions.includes('order.sell.read')) return <NoRole persona="sell" />;
  const { store } = await activeStore();
  if (!store) return <CreateStore />;
  const a = await api<Analytics>(`/seller/stores/${store.id}/analytics`);
  const advanced = me.features.includes('analytics.advanced');
  const series = a.series.map((s) => ({ label: date(s.day, locale, { day: 'numeric', month: 'short' }), value: Number(s.revenue), display: m(s.revenue, a.currency) }));
  return (
    <>
      <PageHeader title={t('nav.items.analytics')} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('app.seller.revenue')} value={m(a.grossMinor, a.currency)} />
        <StatCard label={t('app.seller.netEarnings')} value={m(a.netEarningsMinor, a.currency)} />
        <StatCard label={t('app.seller.conversion')} value={percent(a.conversionBps, locale)} hint={t('app.seller.viewsHint', { views: number(a.views, locale) })} />
        <StatCard label={t('app.seller.repeat')} value={`${number(a.repeatCustomers, locale)} / ${number(a.customers, locale)}`} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <SectionTitle title={t('app.seller.last30')} />
          {series.length > 1 ? <AreaChart data={series} title={t('app.seller.last30')} valueHeader={t('app.seller.revenue')} dateHeader={t('app.orders.date')} /> : <p className="py-10 text-center text-sm text-muted">{t('app.seller.notEnoughData')}</p>}
        </Card>
        <Card className="p-5">
          <SectionTitle title={t('app.seller.topProducts')} />
          <BarList rows={a.products.map((p) => ({ label: p.title, value: p.salesCount, display: number(p.salesCount, locale) }))} />
        </Card>
      </div>
      {!advanced && (
        <Card className="mt-6 flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="max-w-lg text-sm text-muted">{t('app.seller.advancedPitch')}</p>
          <LinkButton href="/app/billing" variant="secondary" size="sm">{t('app.billing.upgrade')}</LinkButton>
        </Card>
      )}
    </>
  );
}
