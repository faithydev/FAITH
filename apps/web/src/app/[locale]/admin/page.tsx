import { BarChart, Donut } from '@/components/ui/chart';
import { Greeting } from '@/components/ui/greeting';
import { Badge, Card, LinkButton, PageHeader, SectionTitle, StatCard } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { date, number, numberCompact } from '@/lib/format';
import { pageContext } from '@/lib/page';
import { Activity, CircleDollarSign, Megaphone, RotateCcw, Scale, Store, TriangleAlert, Users } from 'lucide-react';

type Overview = {
  gmv: { currency: string; amountMinor: string; orders: number }[];
  revenue: { stream: string; currency: string; amountMinor: string }[];
  users: number; activeUsers: number; activeSellers: number; activeCampaigns: number; paymentFailures: number;
  refunds: { currency: string; amountMinor: string; count: number }[];
  gmvTrend: { day: string; currency: string; amount: string }[];
  trialBalance: { currency: string; debit: string; credit: string; balanced: boolean }[];
};

/** Staff overview, after the glass dashboard reference: greeting, two charts, then the numbers. */
export default async function AdminOverview() {
  const { t, m, me, locale } = await pageContext();
  const name = me.profile?.displayName ?? me.email;
  if (!me.permissions.includes('admin.finance.read')) {
    return <PageHeader title={<Greeting name={name} />} description={t('admin.limited')} />;
  }
  const o = await api<Overview>('/admin/overview');
  const gmv = o.gmv[0];
  const currency = gmv?.currency ?? 'USD';
  const trend = o.gmvTrend.filter((x) => x.currency === currency).map((x) => ({
    label: date(x.day, locale, { day: 'numeric', month: 'short' }), value: Number(x.amount), display: m(x.amount, x.currency),
  }));
  const streams = o.revenue.filter((r) => r.currency === currency && Number(r.amountMinor) > 0);
  const streamTotal = streams.reduce((a, r) => a + BigInt(r.amountMinor), 0n);
  const balanced = o.trialBalance.every((b) => b.balanced);
  return (
    <>
      <PageHeader
        eyebrow={t('admin.console')}
        title={<Greeting name={name} />}
        description={t('admin.overviewBody')}
        actions={(
          <>
            <LinkButton href="/admin/finance" variant="secondary" size="sm">{t('admin.nav.finance')}</LinkButton>
            <LinkButton href="/admin/rewards" size="sm" arrow>{t('admin.nav.rewards')}</LinkButton>
          </>
        )}
      />
      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <Card className="lift p-5">
          <SectionTitle title={t('admin.gmvTrend')} action={gmv ? <span className="font-display text-lg font-semibold tabular-nums">{m(gmv.amountMinor, gmv.currency)}</span> : undefined} />
          {trend.length > 1
            ? <BarChart data={trend} title={t('admin.gmvTrend')} valueHeader={t('admin.gmv')} dateHeader={t('app.orders.date')} />
            : <p className="py-14 text-center text-sm text-muted">{t('app.seller.notEnoughData')}</p>}
        </Card>
        <Card className="lift p-5">
          <SectionTitle title={t('admin.platformRevenue')} />
          {streams.length === 0
            ? <p className="py-14 text-center text-sm text-muted">{t('common.noResults')}</p>
            : <Donut title={t('admin.platformRevenue')} total={numberCompact(Number(streamTotal) / 100, locale)} totalLabel={currency} rows={streams.map((r) => ({ label: t(`admin.streams.${r.stream}`), value: Number(r.amountMinor), display: m(r.amountMinor, r.currency) }))} />}
        </Card>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<CircleDollarSign size={17} strokeWidth={1.7} />} label={t('admin.gmv')} value={gmv ? m(gmv.amountMinor, gmv.currency) : '—'} hint={gmv ? t('admin.orders', { count: gmv.orders }) : undefined} />
        <StatCard icon={<Activity size={17} strokeWidth={1.7} />} label={t('admin.activeUsers')} value={number(o.activeUsers, locale)} hint={t('admin.totalUsers', { count: o.users })} />
        <StatCard icon={<Store size={17} strokeWidth={1.7} />} label={t('admin.activeSellers')} value={number(o.activeSellers, locale)} />
        <StatCard icon={<Megaphone size={17} strokeWidth={1.7} />} label={t('admin.activeCampaigns')} value={number(o.activeCampaigns, locale)} />
        <StatCard icon={<TriangleAlert size={17} strokeWidth={1.7} />} label={t('admin.paymentFailures')} value={number(o.paymentFailures, locale)} />
        <StatCard icon={<RotateCcw size={17} strokeWidth={1.7} />} label={t('admin.refunds')} value={o.refunds[0] ? m(o.refunds[0].amountMinor, o.refunds[0].currency) : '—'} hint={o.refunds[0] ? t('admin.orders', { count: o.refunds[0].count }) : undefined} />
        <StatCard icon={<Users size={17} strokeWidth={1.7} />} label={t('admin.nav.users')} value={number(o.users, locale)} />
        <Card className="lift min-w-0 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[0.8125rem] text-muted">{t('admin.ledger')}</p>
            <span aria-hidden className="stat-icon shrink-0"><Scale size={17} strokeWidth={1.7} /></span>
          </div>
          <p className="mt-2 font-display text-[1.7rem] font-semibold tracking-tight">{balanced ? t('admin.balanced') : t('admin.unbalanced')}</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {o.trialBalance.map((b) => <li key={b.currency}><Badge tone={b.balanced ? 'positive' : 'negative'}>{b.currency}</Badge></li>)}
          </ul>
        </Card>
      </div>
    </>
  );
}
