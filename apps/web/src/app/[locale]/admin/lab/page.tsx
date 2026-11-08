import { ActionButton, FormDialog } from '@/components/ui/client';
import { Card, EmptyState, PageHeader, StatusBadge } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';

type Experiment = {
  id: string; key: string; name: string; hypothesis: string; status: string; variants: string[];
  flag: { key: string; enabled: boolean; rolloutPct: number } | null;
  _count: { exposures: number; feedback: number };
};

export default async function FutureLab() {
  const { t, status } = await pageContext();
  const rows = await api<Experiment[]>('/admin/experiments');
  return (
    <>
      <PageHeader
        title={t('admin.nav.lab')} description={t('admin.labBody')}
        actions={
          <FormDialog
            trigger={t('admin.newExperiment')} title={t('admin.newExperiment')} endpoint="/admin/experiments" submitLabel={t('common.create')} success={t('common.saved')}
            fields={[
              { name: 'key', label: t('admin.experimentKey'), required: true, placeholder: 'checkout-copy' },
              { name: 'name', label: t('app.seller.productTitle'), required: true },
              { name: 'hypothesis', label: t('admin.hypothesis'), type: 'textarea', required: true },
              { name: 'variants', label: t('admin.variants'), type: 'tags', required: true, hint: t('app.seller.tagsHint'), defaultValue: 'control, variant' },
            ]}
          />
        }
      />
      {rows.length === 0 ? <EmptyState title={t('admin.noExperiments')} /> : (
        <div className="space-y-3">
          {rows.map((e) => (
            <Card key={e.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-medium">{e.name}</p><p className="text-sm text-muted">{e.hypothesis}</p></div>
                <StatusBadge status={e.status} label={status(e.status)} />
              </div>
              <p className="mt-2 text-xs text-subtle">{t('admin.experimentStats', { exposures: e._count.exposures, feedback: e._count.feedback })} · {e.variants.join(' / ')}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {e.status !== 'RUNNING' && !['ROLLED_BACK', 'SHIPPED'].includes(e.status) && <ActionButton endpoint={`/admin/experiments/${e.key}/status`} body={{ status: 'RUNNING' }} label={t('admin.start')} variant="primary" />}
                {e.status === 'RUNNING' && <ActionButton endpoint={`/admin/experiments/${e.key}/status`} body={{ status: 'PAUSED' }} label={t('app.automations.pause')} />}
                {e.status === 'RUNNING' && <ActionButton endpoint={`/admin/experiments/${e.key}/status`} body={{ status: 'SHIPPED' }} label={t('admin.ship')} confirm={{ title: t('admin.shipConfirm') }} />}
                {!['ROLLED_BACK', 'SHIPPED'].includes(e.status) && <ActionButton endpoint={`/admin/experiments/${e.key}/status`} body={{ status: 'ROLLED_BACK' }} label={t('admin.rollback')} variant="ghost" confirm={{ title: t('admin.rollbackConfirm'), danger: true }} />}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
