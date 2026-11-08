import { AreaChart, BarList } from '@/components/ui/chart';
import { Badge, Card, PageHeader, SectionTitle, StatCard } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { date, number } from '@/lib/format';
import { pageContext } from '@/lib/page';

type Overview = {
  gmv: { currency: string; amountMinor: string; orders: number }[];
  revenue: { stream: string; currency: string; amountMinor: string }[];
  users: number; activeUsers: number; activeSellers: number; activeCampaigns: number; paymentFailures: number;
  refunds: { currency: string; amountMinor: string; count: number }[];
  gmvTrend: { day: string; currency: string; amount: string }[];
  trialBalance: { currency: string; debit: string; credit: string; balanced: boolean }[];
};

export default async function AdminOverview() {
  const { t, m, me, locale } = await pageContext();
  if (!me.permissions.includes('admin.finance.read')) {
    return <PageHeader title={t('admin.console')} description={t('admin.limited')} />;
  }
  const o = await api<Overview>('/admin/overview');
  const gmv = o.gmv[0];
  const trend = o.gmvTrend.filter((x) => x.currency === (gmv?.currency ?? 'USD')).map((x) => ({
    label: date(x.day, locale, { day: 'numeric', month: 'short' }), value: Number(x.amount), display: m(x.amount, x.currency),
  }));
  return (
    <>
      <PageHeader title={t('admin.nav.overview')} description={t('admin.overviewBody')} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('admin.gmv')} value={gmv ? m(gmv.amountMinor, gmv.currency) : '—'} hint={gmv ? t('admin.orders', { count: gmv.orders }) : undefined} />
        <StatCard label={t('admin.activeUsers')} value={number(o.activeUsers, locale)} hint={t('admin.totalUsers', { count: o.users })} />
        <StatCard label={t('admin.activeSellers')} value={number(o.activeSellers, locale)} />
        <StatCard label={t('admin.activeCampaigns')} value={number(o.activeCampaigns, locale)} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <SectionTitle title={t('admin.gmvTrend')} />
          {trend.length > 1 ? <AreaChart data={trend} title={t('admin.gmvTrend')} valueHeader={t('admin.gmv')} dateHeader={t('app.orders.date')} /> : <p className="py-10 text-center text-sm text-muted">{t('app.seller.notEnoughData')}</p>}
        </Card>
        <Card className="p-5">
          <SectionTitle title={t('admin.platformRevenue')} />
          {o.revenue.length === 0 ? <p className="text-sm text-muted">{t('common.noResults')}</p> : <BarList rows={o.revenue.map((r) => ({ label: `${t(`admin.streams.${r.stream}`)} · ${r.currency}`, value: Number(r.amountMinor), display: m(r.amountMinor, r.currency) }))} />}
        </Card>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <StatCard label={t('admin.paymentFailures')} value={o.paymentFailures} />
        <StatCard label={t('admin.refunds')} value={o.refunds[0] ? m(o.refunds[0].amountMinor, o.refunds[0].currency) : '—'} hint={o.refunds[0] ? t('admin.orders', { count: o.refunds[0].count }) : undefined} />
        <Card className="p-5">
          <p className="text-[0.8125rem] text-muted">{t('admin.ledger')}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {o.trialBalance.map((b) => <li key={b.currency} className="flex items-center justify-between gap-2">{b.currency}<Badge tone={b.balanced ? 'positive' : 'negative'}>{b.balanced ? t('admin.balanced') : t('admin.unbalanced')}</Badge></li>)}
          </ul>
        </Card>
      </div>
    </>
  );
}
