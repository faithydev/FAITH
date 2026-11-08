import { ActionButton, FormDialog } from '@/components/ui/client';
import { Badge, Card, EmptyState, PageHeader, SectionTitle, StatusBadge } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';

type Rule = { id: string; name: string; trigger: string; active: boolean; runs: { id: string; status: string; startedAt: string; error: string | null }[] };
type Data = { mine: Rule[]; system: { id: string; name: string; trigger: string; active: boolean; key: string }[] };

const TRIGGERS = ['order.paid', 'subscription.activated', 'reward.approved', 'course.enrolled', 'job.application.submitted'];

export default async function AutomationsPage() {
  const { t, d, status } = await pageContext();
  const data = await api<Data>('/automations');
  const triggerLabel = (x: string) => t(`app.automations.triggers.${x.replaceAll('.', '_')}`);
  return (
    <>
      <PageHeader
        title={t('app.automations.title')} description={t('app.automations.body')}
        actions={
          <FormDialog
            trigger={t('app.automations.new')} title={t('app.automations.new')} endpoint="/automations" submitLabel={t('common.create')} success={t('common.saved')}
            extra={{ conditions: [], actions: [{ type: 'notify', target: 'owner', kind: 'automation.custom' }] }}
            fields={[
              { name: 'name', label: t('app.automations.name'), required: true },
              { name: 'trigger', label: t('app.automations.trigger'), type: 'select', required: true, defaultValue: TRIGGERS[0], options: TRIGGERS.map((x) => ({ value: x, label: triggerLabel(x) })) },
            ]}
          />
        }
      />
      <section>
        <SectionTitle title={t('app.automations.yours')} />
        {data.mine.length === 0 ? <EmptyState title={t('app.automations.emptyTitle')} description={t('app.automations.emptyBody')} /> : (
          <div className="space-y-3">
            {data.mine.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted">{triggerLabel(r.trigger)}</p></div>
                  <div className="flex gap-2">
                    <ActionButton endpoint={`/automations/${r.id}`} method="PATCH" body={{ active: !r.active }} label={r.active ? t('app.automations.pause') : t('app.automations.resume')} />
                    <ActionButton endpoint={`/automations/${r.id}`} method="DELETE" label={t('common.delete')} variant="ghost" confirm={{ title: t('app.automations.deleteConfirm'), danger: true }} />
                  </div>
                </div>
                {r.runs.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-line pt-3 text-xs">
                    {r.runs.map((x) => <li key={x.id} className="flex items-center justify-between gap-2"><StatusBadge status={x.status} label={status(x.status)} /><span className="text-subtle">{d(x.startedAt)}</span></li>)}
                  </ul>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
      <section className="mt-10">
        <SectionTitle title={t('app.automations.system')} />
        <ul className="card divide-y divide-line">
          {data.system.map((r) => <li key={r.id} className="flex items-center justify-between gap-3 p-3 text-sm"><span>{t.has(`app.automations.rules.${r.key}`) ? t(`app.automations.rules.${r.key}`) : r.name}</span><Badge tone={r.active ? 'positive' : 'neutral'}>{r.active ? t('common.on') : t('common.off')}</Badge></li>)}
        </ul>
      </section>
    </>
  );
}
