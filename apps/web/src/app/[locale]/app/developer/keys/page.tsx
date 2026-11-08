import { NoRole } from '@/components/seller/shared';
import { ActionButton, FormDialog } from '@/components/ui/client';
import { Badge, DataTable, EmptyState, PageHeader } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { API_SCOPES } from '@/lib/app-permissions';
import { pageContext } from '@/lib/page';

type Key = { id: string; name: string; keyPrefix: string; scopes: string[]; env: string; lastUsedAt: string | null; revokedAt: string | null };

export default async function KeysPage() {
  const { t, d, me } = await pageContext();
  if (!me.permissions.includes('apikey.manage')) return <NoRole persona="build" />;
  const keys = await api<Key[]>('/developer/keys');
  return (
    <>
      <PageHeader
        title={t('nav.items.keys')} description={t('app.developer.keysBody')}
        actions={
          <FormDialog
            trigger={t('app.developer.newKey')} title={t('app.developer.newKey')} endpoint="/developer/keys" submitLabel={t('common.create')}
            revealField="key" revealTitle={t('app.developer.keyOnce')}
            fields={[
              { name: 'name', label: t('app.seller.productTitle'), required: true },
              { name: 'env', label: t('app.developer.environment'), type: 'select', required: true, defaultValue: 'SANDBOX', options: ['SANDBOX', 'LIVE'].map((e) => ({ value: e, label: t(`app.developer.envs.${e}`) })) },
              { name: 'scopes', label: t('app.developer.scopes'), type: 'checkboxes', options: API_SCOPES.map((s) => ({ value: s, label: s })) },
            ]}
          />
        }
      />
      {keys.length === 0 ? <EmptyState title={t('app.developer.noKeys')} /> : (
        <DataTable
          caption={t('nav.items.keys')} rows={keys} rowKey={(k) => k.id}
          columns={[
            { header: t('app.seller.productTitle'), cell: (k) => k.name },
            { header: t('app.developer.key'), cell: (k) => <code className="font-mono text-xs">{k.keyPrefix}…</code> },
            { header: t('app.developer.environment'), cell: (k) => <Badge tone={k.env === 'LIVE' ? 'accent' : 'neutral'}>{t(`app.developer.envs.${k.env}`)}</Badge> },
            { header: t('app.developer.lastUsed'), cell: (k) => d(k.lastUsedAt) },
            { header: '', align: 'end', cell: (k) => (k.revokedAt ? <Badge tone="negative">{t('app.developer.revoked')}</Badge> : <ActionButton endpoint={`/developer/keys/${k.id}`} method="DELETE" label={t('app.settings.revoke')} confirm={{ title: t('app.developer.revokeConfirm'), danger: true }} />) },
          ]}
        />
      )}
    </>
  );
}
