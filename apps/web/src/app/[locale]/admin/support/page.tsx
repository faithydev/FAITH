import { ActionButton, FormDialog } from '@/components/ui/client';
import { DataTable, EmptyState, PageHeader, SectionTitle, StatusBadge } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';

type Ticket = { id: string; subject: string; body: string; status: string; createdAt: string; user: { profile: { displayName: string } | null } };
type Dispute = { id: string; reason: string; status: string; raisedBy: { profile: { displayName: string } | null }; project: { title: string } | null; order: { number: string } | null };

export default async function AdminSupport() {
  const { t, d, status } = await pageContext();
  const [tickets, disputes] = await Promise.all([api<Ticket[]>('/admin/tickets'), api<Dispute[]>('/admin/disputes')]);
  return (
    <>
      <PageHeader title={t('admin.nav.support')} />
      <section className="mb-8">
        <SectionTitle title={t('admin.disputes')} />
        {disputes.length === 0 ? <EmptyState title={t('admin.queueEmpty')} /> : (
          <ul className="card divide-y divide-line">
            {disputes.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 p-3.5 text-sm">
                <span className="min-w-0"><span className="font-medium">{x.project?.title ?? x.order?.number}</span><span className="block text-muted">{x.reason}</span></span>
                {x.status === 'OPEN' ? (
                  <FormDialog
                    trigger={t('admin.resolve')} title={t('admin.resolve')} endpoint={`/admin/disputes/${x.id}/resolve`} submitLabel={t('admin.resolve')} triggerVariant="secondary"
                    fields={[
                      { name: 'status', label: t('app.orders.status'), type: 'select', required: true, defaultValue: 'RESOLVED', options: ['RESOLVED', 'REJECTED'].map((s) => ({ value: s, label: status(s) })) },
                      { name: 'resolution', label: t('admin.resolution'), type: 'textarea', required: true },
                    ]}
                  />
                ) : <StatusBadge status={x.status} label={status(x.status)} />}
              </li>
            ))}
          </ul>
        )}
      </section>
      <SectionTitle title={t('admin.tickets')} />
      {tickets.length === 0 ? <EmptyState title={t('admin.queueEmpty')} /> : (
        <DataTable
          caption={t('admin.tickets')} rows={tickets} rowKey={(x) => x.id}
          columns={[
            { header: t('admin.subject'), cell: (x) => <span><span className="font-medium">{x.subject}</span><span className="block text-xs text-muted">{x.body}</span></span> },
            { header: t('nav.account'), cell: (x) => x.user.profile?.displayName },
            { header: t('app.orders.date'), cell: (x) => d(x.createdAt) },
            { header: t('app.orders.status'), cell: (x) => <StatusBadge status={x.status} label={status(x.status)} /> },
            { header: '', align: 'end', cell: (x) => x.status !== 'CLOSED' && <ActionButton endpoint={`/admin/tickets/${x.id}/status`} body={{ status: 'CLOSED' }} label={t('common.close')} /> },
          ]}
        />
      )}
    </>
  );
}
