import { ActionButton, FormDialog } from '@/components/ui/client';
import { DataTable, PageHeader, StatusBadge } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';

type Row = { id: string; slug: string; title: string; status: string; type: string; currency: string; priceFromMinor: string; salesCount: number; store: { name: string; slug: string } };

export default async function AdminMarketplace() {
  const { t, m, status } = await pageContext();
  const rows = await api<Row[]>('/admin/products');
  return (
    <>
      <PageHeader title={t('admin.nav.marketplace')} description={t('admin.marketplaceBody')} />
      <DataTable
        caption={t('admin.nav.marketplace')} rows={rows} rowKey={(r) => r.id}
        columns={[
          { header: t('app.seller.product'), cell: (r) => <Link href={`/marketplace/${r.slug}`} className="font-medium hover:underline">{r.title}</Link> },
          { header: t('nav.items.store'), cell: (r) => r.store.name },
          { header: t('app.orders.status'), cell: (r) => <StatusBadge status={r.status} label={status(r.status)} /> },
          { header: t('app.seller.price'), align: 'end', cell: (r) => <span className="tabular-nums">{m(r.priceFromMinor, r.currency)}</span> },
          { header: t('app.seller.sales'), align: 'end', cell: (r) => r.salesCount },
          {
            header: '', align: 'end',
            cell: (r) => (r.status === 'PUBLISHED' ? (
              <FormDialog trigger={t('admin.takeDown')} title={t('admin.takeDown')} triggerVariant="secondary" endpoint={`/admin/products/${r.id}/moderate`} extra={{ approve: false }} submitLabel={t('admin.takeDown')} success={t('common.saved')} fields={[{ name: 'note', label: t('app.orders.refundReason'), type: 'textarea', required: true }]} />
            ) : r.status === 'REJECTED' ? <ActionButton endpoint={`/admin/products/${r.id}/moderate`} body={{ approve: true }} label={t('admin.restore')} /> : null),
          },
        ]}
      />
    </>
  );
}
