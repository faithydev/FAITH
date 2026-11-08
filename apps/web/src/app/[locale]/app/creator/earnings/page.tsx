import { PayoutPanel } from '@/components/finance/earnings';
import type { Balance, Payout } from '@/components/finance/earnings';
import { NoRole } from '@/components/seller/shared';
import { PageHeader, StatCard } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';

type Earnings = {
  estimated: { currency: string; amountMinor: string }[];
  accruals: { currency: string; status: string; amountMinor: string }[];
  balances: Balance[]; payouts: Payout[];
};

export default async function CreatorEarningsPage() {
  const { t, m, me } = await pageContext();
  if (!me.permissions.includes('campaign.participate')) return <NoRole persona="create" />;
  const e = await api<Earnings>('/rewards/creator/earnings');
  const sum = (status: string) => e.accruals.filter((a) => a.status === status);
  const show = (rows: { currency: string; amountMinor: string }[]) => (rows.length ? rows.map((r) => m(r.amountMinor, r.currency)).join(' · ') : '—');
  return (
    <>
      <PageHeader title={t('nav.items.earnings')} description={t('app.finance.body')} />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label={t('app.creator.estimated')} value={show(e.estimated)} hint={t('app.creator.estimatedHint')} />
        <StatCard label={t('app.creator.approved')} value={show(sum('APPROVED'))} />
        <StatCard label={t('app.creator.reversed')} value={show(sum('REVERSED'))} />
      </div>
      <PayoutPanel balances={e.balances} payouts={e.payouts} />
    </>
  );
}
