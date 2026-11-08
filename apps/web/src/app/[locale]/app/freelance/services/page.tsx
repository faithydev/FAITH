import { NoRole } from '@/components/seller/shared';
import { ActionButton, FormDialog } from '@/components/ui/client';
import { DataTable, EmptyState, PageHeader, StatusBadge } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';

type Row = { id: string; slug: string; title: string; status: string; currency: string; packages: { priceMinor: string }[]; _count: { projects: number } };

export default async function FreelanceServicesPage() {
  const { t, m, status, me } = await pageContext();
  if (!me.permissions.includes('service.manage')) return <NoRole persona="services" />;
  const rows = await api<Row[]>('/freelance/services');
  const create = (
    <FormDialog
      trigger={t('app.freelance.newService')} title={t('app.freelance.newService')} endpoint="/freelance/services/quick" submitLabel={t('app.seller.publish')} success={t('common.saved')}
      extra={{ currency: 'USD', publish: true }}
      fields={[
        { name: 'title', label: t('app.seller.productTitle'), required: true },
        { name: 'summary', label: t('app.seller.summary'), type: 'textarea', rows: 2, required: true },
        { name: 'description', label: t('app.seller.description'), type: 'textarea', rows: 4, required: true },
        { name: 'packageName', label: t('app.freelance.packageName'), required: true, defaultValue: t('app.seller.variantDefault') },
        { name: 'priceMinor', label: t('app.seller.priceIn', { currency: 'USD' }), type: 'money', currency: 'USD', required: true },
        { name: 'deliveryDays', label: t('app.freelance.deliveryDays'), type: 'number', required: true, min: 1, max: 365, defaultValue: 7 },
      ]}
    />
  );
  return (
    <>
      <PageHeader title={t('nav.items.services')} actions={create} />
      {rows.length === 0 ? <EmptyState title={t('app.freelance.noServices')} /> : (
        <DataTable
          caption={t('nav.items.services')} rows={rows} rowKey={(r) => r.id}
          columns={[
            { header: t('app.seller.productTitle'), cell: (r) => <Link href={`/services/${r.slug}`} className="font-medium hover:underline">{r.title}</Link> },
            { header: t('app.orders.status'), cell: (r) => <StatusBadge status={r.status} label={status(r.status)} /> },
            { header: t('app.seller.price'), align: 'end', cell: (r) => <span className="tabular-nums">{r.packages[0] ? m(r.packages[0].priceMinor, r.currency) : '—'}</span> },
            { header: t('nav.items.projects'), align: 'end', cell: (r) => r._count.projects },
            { header: '', align: 'end', cell: (r) => <ActionButton endpoint={`/freelance/services/${r.id}`} method="PATCH" body={{ status: r.status === 'PUBLISHED' ? 'PAUSED' : 'PUBLISHED' }} label={r.status === 'PUBLISHED' ? t('app.automations.pause') : t('app.seller.publish')} /> },
          ]}
        />
      )}
    </>
  );
}
