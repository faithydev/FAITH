import { ActionButton } from '@/components/ui/client';
import { DataTable, EmptyState, LinkButton, PageHeader, StatusBadge } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';

type Row = { id: string; status: string; createdAt: string; job: { slug: string; title: string; org: { name: string } } };

export default async function ApplicationsPage() {
  const { t, d, status } = await pageContext();
  const rows = await api<Row[]>('/work/applications');
  return (
    <>
      <PageHeader title={t('nav.items.applications')} />
      {rows.length === 0 ? <EmptyState title={t('app.work.noApplications')} action={<LinkButton href="/jobs">{t('app.work.browse')}</LinkButton>} /> : (
        <DataTable
          caption={t('nav.items.applications')} rows={rows} rowKey={(r) => r.id}
          columns={[
            { header: t('app.work.role'), cell: (r) => <Link href={`/jobs/${r.job.slug}`} className="font-medium hover:underline">{r.job.title}</Link> },
            { header: t('app.brand.organization'), cell: (r) => r.job.org.name },
            { header: t('app.orders.date'), cell: (r) => d(r.createdAt) },
            { header: t('app.orders.status'), cell: (r) => <StatusBadge status={r.status} label={status(r.status)} /> },
            { header: '', align: 'end', cell: (r) => !['HIRED', 'REJECTED', 'WITHDRAWN'].includes(r.status) && <ActionButton endpoint={`/work/applications/${r.id}/withdraw`} label={t('app.work.withdraw')} variant="ghost" confirm={{ title: t('app.work.withdrawConfirm'), danger: true }} /> },
          ]}
        />
      )}
    </>
  );
}
