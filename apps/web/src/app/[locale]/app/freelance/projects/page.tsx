import { DataTable, EmptyState, PageHeader, StatusBadge } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';

type Person = { id: string; profile: { displayName: string } | null };
type Row = { id: string; title: string; status: string; currency: string; totalMinor: string; client: Person; freelancer: Person };

export default async function ProjectsPage() {
  const { t, m, status, me } = await pageContext();
  const rows = await api<Row[]>('/projects');
  return (
    <>
      <PageHeader title={t('nav.items.projects')} description={t('app.freelance.projectsBody')} />
      {rows.length === 0 ? <EmptyState title={t('app.freelance.noProjects')} /> : (
        <DataTable
          caption={t('nav.items.projects')} rows={rows} rowKey={(r) => r.id}
          columns={[
            { header: t('app.seller.productTitle'), cell: (r) => <Link href={`/app/freelance/projects/${r.id}`} className="font-medium hover:underline">{r.title}</Link> },
            { header: t('app.freelance.with'), cell: (r) => (r.client.id === me.id ? r.freelancer : r.client).profile?.displayName },
            { header: t('app.orders.status'), cell: (r) => <StatusBadge status={r.status} label={status(r.status)} /> },
            { header: t('app.orders.total'), align: 'end', cell: (r) => <span className="tabular-nums">{m(r.totalMinor, r.currency)}</span> },
          ]}
        />
      )}
    </>
  );
}
