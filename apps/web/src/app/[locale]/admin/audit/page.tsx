import { Badge, DataTable, PageHeader, SectionTitle } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';

type Log = { id: string; action: string; resourceType: string; resourceId: string | null; createdAt: string; actor: { email: string } | null };
type Security = { id: string; kind: string; ipAddress: string | null; createdAt: string };
type Outbox = { id: string; type: string; attempts: number; lastError: string | null; processedAt: string | null; createdAt: string };

export default async function AdminAudit() {
  const { t, d } = await pageContext();
  const [logs, security, outbox] = await Promise.all([api<Log[]>('/admin/audit?pageSize=50'), api<Security[]>('/admin/security-events'), api<Outbox[]>('/admin/outbox')]);
  return (
    <>
      <PageHeader title={t('admin.nav.audit')} description={t('admin.auditBody')} />
      <DataTable
        caption={t('admin.nav.audit')} rows={logs} rowKey={(l) => l.id}
        columns={[
          { header: t('app.orders.date'), cell: (l) => d(l.createdAt) },
          { header: t('admin.actor'), cell: (l) => l.actor?.email ?? t('admin.system') },
          { header: t('admin.action'), cell: (l) => <code className="font-mono text-xs">{l.action}</code> },
          { header: t('admin.resource'), cell: (l) => <span className="text-xs text-muted">{l.resourceType}</span> },
        ]}
      />
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle title={t('admin.securityEvents')} />
          <ul className="card divide-y divide-line">
            {security.slice(0, 15).map((s) => <li key={s.id} className="flex items-center justify-between gap-2 p-2.5 text-xs"><code className="font-mono">{s.kind}</code><span className="text-subtle">{s.ipAddress} · {d(s.createdAt)}</span></li>)}
          </ul>
        </section>
        <section>
          <SectionTitle title={t('admin.events')} />
          <ul className="card divide-y divide-line">
            {outbox.slice(0, 15).map((o) => <li key={o.id} className="flex items-center justify-between gap-2 p-2.5 text-xs"><code className="font-mono">{o.type}</code><Badge tone={o.processedAt ? 'positive' : o.lastError ? 'negative' : 'warning'}>{o.processedAt ? t('admin.processed') : t('admin.pending')}</Badge></li>)}
          </ul>
        </section>
      </div>
    </>
  );
}
