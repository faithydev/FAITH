import { Balance, Payout, PayoutPanel } from '@/components/finance/earnings';
import { CreateStore, NoRole } from '@/components/seller/shared';
import { PageHeader } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { activeStore, pageContext } from '@/lib/page';

export default async function EarningsPage() {
  const { t, me } = await pageContext();
  if (!me.permissions.includes('order.sell.read')) return <NoRole persona="sell" />;
  const { store } = await activeStore();
  if (!store) return <CreateStore />;
  const data = await api<{ balances: Balance[]; payouts: Payout[] }>(`/seller/stores/${store.id}/earnings`);
  return (
    <>
      <PageHeader title={t('nav.items.earnings')} description={t('app.finance.body')} />
      <PayoutPanel balances={data.balances} payouts={data.payouts} />
    </>
  );
}
