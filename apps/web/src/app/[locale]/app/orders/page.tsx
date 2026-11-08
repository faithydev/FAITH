import { DataTable, EmptyState, LinkButton, PageHeader, StatusBadge } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';
import type { Order } from '@/lib/types';

export default async function OrdersPage() {
  const { t, m, d, status } = await pageContext();
  const orders = await api<Order[]>('/orders');
  return (
    <>
      <PageHeader title={t('app.orders.title')} />
      {orders.length === 0 ? (
        <EmptyState title={t('app.home.noOrdersTitle')} description={t('app.home.noOrdersBody')} action={<LinkButton href="/marketplace">{t('cart.browse')}</LinkButton>} />
      ) : (
        <DataTable
          caption={t('app.orders.title')} rows={orders} rowKey={(o) => o.id}
          columns={[
            { header: t('app.orders.number'), cell: (o) => <Link href={`/app/orders/${o.id}`} className="font-mono text-[0.8125rem] hover:underline">{o.number}</Link> },
            { header: t('app.orders.items'), cell: (o) => <span className="block max-w-56 truncate">{o.items.map((i) => i.title).join(', ')}</span> },
            { header: t('app.orders.date'), cell: (o) => d(o.createdAt) },
            { header: t('app.orders.status'), cell: (o) => <StatusBadge status={o.status} label={status(o.status)} /> },
            { header: t('app.orders.total'), align: 'end', cell: (o) => <span className="tabular-nums">{m(o.totalMinor, o.currency)}</span> },
          ]}
        />
      )}
    </>
  );
}
