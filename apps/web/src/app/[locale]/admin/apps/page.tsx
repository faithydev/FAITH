import { ActionButton, FormDialog } from '@/components/ui/client';
import { Badge, EmptyState, PageHeader } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';

type Row = { id: string; version: string; permissions: string[]; app: { name: string; tagline: string; developer: { profile: { displayName: string } | null } } };

export default async function AdminApps() {
  const { t } = await pageContext();
  const rows = await api<Row[]>('/admin/apps/review');
  return (
    <>
      <PageHeader title={t('admin.nav.apps')} description={t('admin.appsBody')} />
      {rows.length === 0 ? <EmptyState title={t('admin.queueEmpty')} /> : (
        <ul className="space-y-3">
          {rows.map((v) => (
            <li key={v.id} className="card flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium">{v.app.name} <span className="font-mono text-xs text-muted">{v.version}</span></p>
                <p className="text-sm text-muted">{v.app.tagline} · {v.app.developer.profile?.displayName}</p>
                <div className="mt-2 flex flex-wrap gap-1">{v.permissions.map((p) => <Badge key={p}>{t(`app.permissions.${p.replace(':', '_')}`)}</Badge>)}</div>
              </div>
              <span className="flex gap-2">
                <FormDialog trigger={t('common.reject')} title={t('common.reject')} triggerVariant="secondary" endpoint={`/admin/apps/versions/${v.id}/review`} extra={{ approve: false }} submitLabel={t('common.reject')} fields={[{ name: 'note', label: t('app.orders.refundReason'), type: 'textarea', required: true }]} />
                <ActionButton endpoint={`/admin/apps/versions/${v.id}/review`} body={{ approve: true }} label={t('common.approve')} variant="primary" />
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
