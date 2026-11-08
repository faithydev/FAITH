import { NoRole } from '@/components/seller/shared';
import { ActionButton, FormDialog } from '@/components/ui/client';
import { DataTable, EmptyState, PageHeader, StatusBadge } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';

type Row = { id: string; slug: string; title: string; status: string; org: { name: string }; _count: { applications: number } };

export default async function HiringPage() {
  const { t, status, me } = await pageContext();
  if (!me.permissions.includes('job.post')) return <NoRole persona="business" />;
  const [jobs, orgs] = await Promise.all([api<Row[]>('/employer/jobs'), api<{ id: string; name: string }[]>('/organizations')]);
  const opts = (key: string, values: string[]) => values.map((v) => ({ value: v, label: t(`jobs.${key}.${v}`) }));
  return (
    <>
      <PageHeader
        title={t('nav.items.hiring')} description={t('app.hiring.body')}
        actions={orgs.length > 0 && (
          <FormDialog
            trigger={t('app.hiring.post')} title={t('app.hiring.post')} description={t('app.hiring.postBody')} endpoint="/jobs" submitLabel={t('app.hiring.submit')} success={t('app.hiring.submitted')}
            extra={{ currency: 'USD' }}
            fields={[
              { name: 'orgId', label: t('app.brand.organization'), type: 'select', required: true, defaultValue: orgs[0]!.id, options: orgs.map((o) => ({ value: o.id, label: o.name })) },
              { name: 'title', label: t('app.seller.productTitle'), required: true },
              { name: 'description', label: t('app.seller.description'), type: 'textarea', rows: 5, required: true },
              { name: 'employmentType', label: t('jobs.employment'), type: 'select', required: true, defaultValue: 'FULL_TIME', options: opts('types', ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP']) },
              { name: 'workplace', label: t('jobs.workplaceLabel'), type: 'select', required: true, defaultValue: 'REMOTE', options: opts('workplace', ['REMOTE', 'ONSITE', 'HYBRID']) },
              { name: 'experience', label: t('jobs.experienceLabel'), type: 'select', required: true, defaultValue: 'MID', options: opts('experience', ['ENTRY', 'MID', 'SENIOR', 'LEAD']) },
              { name: 'skills', label: t('jobs.skills'), type: 'tags', hint: t('app.seller.tagsHint') },
            ]}
          />
        )}
      />
      {jobs.length === 0 ? <EmptyState title={t('app.hiring.empty')} /> : (
        <DataTable
          caption={t('nav.items.hiring')} rows={jobs} rowKey={(j) => j.id}
          columns={[
            { header: t('app.seller.productTitle'), cell: (j) => <Link href={`/app/brand/hiring/${j.id}`} className="font-medium hover:underline">{j.title}</Link> },
            { header: t('app.brand.organization'), cell: (j) => j.org.name },
            { header: t('app.orders.status'), cell: (j) => <StatusBadge status={j.status} label={status(j.status)} /> },
            { header: t('nav.items.applications'), align: 'end', cell: (j) => j._count.applications },
            { header: '', align: 'end', cell: (j) => j.status === 'OPEN' && <ActionButton endpoint={`/employer/jobs/${j.id}/close`} label={t('app.hiring.close')} /> },
          ]}
        />
      )}
    </>
  );
}
