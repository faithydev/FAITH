import { NoRole } from '@/components/seller/shared';
import { ActionButton, FormDialog } from '@/components/ui/client';
import { Badge, Card, EmptyState, PageHeader, StatusBadge } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { WEBHOOK_EVENTS } from '@/lib/app-permissions';
import { pageContext } from '@/lib/page';

type Hook = { id: string; url: string; events: string[]; deliveries: { id: string; eventType: string; status: string; attempts: number; responseStatus: number | null; createdAt: string }[] };

export default async function WebhooksPage() {
  const { t, d, status, me } = await pageContext();
  if (!me.permissions.includes('webhook.manage')) return <NoRole persona="build" />;
  const hooks = await api<Hook[]>('/developer/webhooks');
  return (
    <>
      <PageHeader
        title={t('nav.items.webhooks')} description={t('app.developer.webhooksBody')}
        actions={
          <FormDialog
            trigger={t('app.developer.newWebhook')} title={t('app.developer.newWebhook')} endpoint="/developer/webhooks" submitLabel={t('common.create')}
            revealField="secret" revealTitle={t('app.developer.secretOnce')}
            fields={[
              { name: 'url', label: t('app.developer.endpoint'), type: 'url', required: true, placeholder: 'https://' },
              { name: 'events', label: t('app.developer.events'), type: 'checkboxes', options: WEBHOOK_EVENTS.map((e) => ({ value: e, label: e })) },
            ]}
          />
        }
      />
      {hooks.length === 0 ? <EmptyState title={t('app.developer.noWebhooks')} /> : (
        <div className="space-y-3">
          {hooks.map((h) => (
            <Card key={h.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <code className="min-w-0 truncate font-mono text-sm">{h.url}</code>
                <ActionButton endpoint={`/developer/webhooks/${h.id}`} method="DELETE" label={t('common.delete')} variant="ghost" confirm={{ title: t('app.developer.deleteWebhook'), danger: true }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">{h.events.map((e) => <Badge key={e}>{e}</Badge>)}</div>
              {h.deliveries.length > 0 && (
                <ul className="mt-3 divide-y divide-line border-t border-line text-xs">
                  {h.deliveries.map((x) => (
                    <li key={x.id} className="flex items-center justify-between gap-2 py-1.5">
                      <span className="font-mono">{x.eventType}</span>
                      <span className="flex items-center gap-2 text-subtle">{d(x.createdAt)}<StatusBadge status={x.status} label={status(x.status)} /></span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
