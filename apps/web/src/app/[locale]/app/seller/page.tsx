import { CreateStore, NoRole, StoreTabs } from '@/components/seller/shared';
import { AreaChart } from '@/components/ui/chart';
import { Card, LinkButton, PageHeader, SectionTitle, StatCard } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { date, number, percent } from '@/lib/format';
import { activeStore, pageContext } from '@/lib/page';
import type { Analytics } from '@/components/seller/shared';
import { CircleDollarSign, Receipt, RotateCcw, Wallet } from 'lucide-react';

export default async function SellerPage({ searchParams }: { searchParams: Promise<{ store?: string }> }) {
  const [{ store: storeId }, { t, m, me, locale }] = await Promise.all([searchParams, pageContext()]);
  if (!me.permissions.includes('store.manage')) return <NoRole persona="sell" />;
  const { store, stores } = await activeStore(storeId);
  if (!store) return <CreateStore />;
  const a = await api<Analytics>(`/seller/stores/${store.id}/analytics`);
  const series = a.series.map((s) => ({
    label: date(s.day, locale, { day: 'numeric', month: 'short' }), value: Number(s.revenue), display: m(s.revenue, a.currency),
  }));
  return (
    <>
      <PageHeader title={store.name} description={t('app.seller.overviewBody')} actions={<LinkButton href="/app/seller/products/new" size="sm">{t('app.seller.newProduct')}</LinkButton>} />
      <StoreTabs stores={stores} active={store.id} path="/app/seller" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<CircleDollarSign size={17} strokeWidth={1.7} />} label={t('app.seller.revenue')} value={m(a.grossMinor, a.currency)} />
        <StatCard icon={<Wallet size={17} strokeWidth={1.7} />} label={t('app.seller.netEarnings')} value={m(a.netEarningsMinor, a.currency)} hint={t('app.seller.afterCommission', { amount: m(a.commissionMinor, a.currency) })} />
        <StatCard icon={<Receipt size={17} strokeWidth={1.7} />} label={t('app.seller.orders')} value={number(a.orders, locale)} />
        <StatCard icon={<RotateCcw size={17} strokeWidth={1.7} />} label={t('app.seller.refundRate')} value={percent(a.refundRateBps, locale)} />
      </div>
      <Card className="lift mt-6 p-5">
        <SectionTitle title={t('app.seller.last30')} />
        {series.length > 1 ? <AreaChart data={series} title={t('app.seller.last30')} valueHeader={t('app.seller.revenue')} dateHeader={t('app.orders.date')} /> : <p className="py-10 text-center text-sm text-muted">{t('app.seller.notEnoughData')}</p>}
      </Card>
    </>
  );
}
