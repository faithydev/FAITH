import { CreateStore, NoRole } from '@/components/seller/shared';
import { ActionButton } from '@/components/ui/client';
import { DataTable, EmptyState, PageHeader, SectionTitle, StatusBadge } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { activeStore, pageContext } from '@/lib/page';
import type { Paged } from '@/lib/types';

type Row = { id: string; status: string; netMinor: string; commissionMinor: string; sellerNetMinor: string; items: { id: string; title: string }[]; order: { number: string; paidAt: string; currency: string; buyer: { profile: { displayName: string } | null } } };
type RefundRow = { id: string; status: string; reason: string; amountMinor: string; currency: string; createdAt: string; order: { number: string }; items: { orderItem: { title: string } }[] };

export default async function SellerOrdersPage() {
  const { t, m, d, status, me } = await pageContext();
  if (!me.permissions.includes('order.sell.read')) return <NoRole persona="sell" />;
  const { store } = await activeStore();
  if (!store) return <CreateStore />;
  const [orders, refunds] = await Promise.all([
    api<Paged<Row>>(`/seller/stores/${store.id}/orders?pageSize=50`), api<RefundRow[]>(`/seller/stores/${store.id}/refunds`),
  ]);
  const open = refunds.filter((r) => r.status === 'REQUESTED');
  return (
    <>
      <PageHeader title={t('nav.items.orders')} description={t('app.seller.ordersBody')} />
      {open.length > 0 && (
        <section className="mb-8">
          <SectionTitle title={t('app.seller.refundRequests')} />
          <ul className="card divide-y divide-line">
            {open.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <span className="min-w-0"><span className="font-medium">{r.items[0]?.orderItem.title}</span> <span className="text-muted">· {r.order.number}</span><span className="block text-xs text-muted">{r.reason}</span></span>
                <span className="flex items-center gap-2">
                  <span className="font-medium tabular-nums">{m(r.amountMinor, r.currency)}</span>
                  <ActionButton endpoint={`/seller/refunds/${r.id}/decide`} body={{ approve: false }} label={t('common.reject')} />
                  <ActionButton endpoint={`/seller/refunds/${r.id}/decide`} body={{ approve: true }} label={t('common.approve')} variant="primary" confirm={{ title: t('app.seller.refundConfirm', { amount: m(r.amountMinor, r.currency) }), body: t('app.seller.refundConfirmBody') }} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {orders.items.length === 0 ? <EmptyState title={t('app.seller.noOrdersTitle')} description={t('app.seller.noOrdersBody')} /> : (
        <DataTable
          caption={t('nav.items.orders')} rows={orders.items} rowKey={(o) => o.id}
          columns={[
            { header: t('app.orders.number'), cell: (o) => <span className="font-mono text-[0.8125rem]">{o.order.number}</span> },
            { header: t('app.seller.customer'), cell: (o) => o.order.buyer.profile?.displayName },
            { header: t('app.orders.date'), cell: (o) => d(o.order.paidAt) },
            { header: t('app.orders.status'), cell: (o) => <StatusBadge status={o.status} label={status(o.status)} /> },
            { header: t('app.orders.total'), align: 'end', cell: (o) => <span className="tabular-nums">{m(o.netMinor, o.order.currency)}</span> },
            { header: t('app.seller.commission'), align: 'end', cell: (o) => <span className="text-muted tabular-nums">−{m(o.commissionMinor, o.order.currency)}</span> },
            { header: t('app.seller.youReceive'), align: 'end', cell: (o) => <span className="font-medium tabular-nums">{m(o.sellerNetMinor, o.order.currency)}</span> },
          ]}
        />
      )}
    </>
  );
}
