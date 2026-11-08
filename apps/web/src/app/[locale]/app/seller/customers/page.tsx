import { CreateStore, NoRole } from '@/components/seller/shared';
import { DataTable, EmptyState, PageHeader } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { activeStore, pageContext } from '@/lib/page';

type Row = { key: string; displayName: string; orders: string; spentMinor: string; currency: string; lastOrderAt: string };

export default async function CustomersPage() {
  const { t, m, d, me } = await pageContext();
  if (!me.permissions.includes('order.sell.read')) return <NoRole persona="sell" />;
  const { store } = await activeStore();
  if (!store) return <CreateStore />;
  const rows = await api<Row[]>(`/seller/stores/${store.id}/customers`);
  return (
    <>
      <PageHeader title={t('nav.items.customers')} description={t('app.seller.customersBody')} />
      {rows.length === 0 ? <EmptyState title={t('app.seller.noCustomers')} /> : (
        <DataTable
          caption={t('nav.items.customers')} rows={rows} rowKey={(r) => r.key}
          columns={[
            { header: t('app.seller.customer'), cell: (r) => r.displayName },
            { header: t('nav.items.orders'), align: 'end', cell: (r) => r.orders },
            { header: t('app.seller.spent'), align: 'end', cell: (r) => <span className="tabular-nums">{m(r.spentMinor, r.currency)}</span> },
            { header: t('app.seller.lastOrder'), cell: (r) => d(r.lastOrderAt) },
          ]}
        />
      )}
    </>
  );
}
