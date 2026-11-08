import { NoRole } from '@/components/seller/shared';
import { DataTable, EmptyState, LinkButton, PageHeader, StatusBadge } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';

type App = { id: string; name: string; status: string; installCount: number; versions: { version: string; status: string }[] };

export default async function DeveloperAppsPage() {
  const { t, status, me } = await pageContext();
  if (!me.permissions.includes('app.manage')) return <NoRole persona="build" />;
  const apps = await api<App[]>('/developer/apps');
  const cta = <LinkButton href="/app/developer/apps/new" size="sm">{t('app.developer.newApp')}</LinkButton>;
  return (
    <>
      <PageHeader title={t('nav.items.apps')} actions={cta} />
      {apps.length === 0 ? <EmptyState title={t('app.developer.noApps')} action={cta} /> : (
        <DataTable
          caption={t('nav.items.apps')} rows={apps} rowKey={(a) => a.id}
          columns={[
            { header: t('app.seller.productTitle'), cell: (a) => <Link href={`/app/developer/apps/${a.id}`} className="font-medium hover:underline">{a.name}</Link> },
            { header: t('app.orders.status'), cell: (a) => <StatusBadge status={a.status} label={status(a.status)} /> },
            { header: t('app.developer.latestVersion'), cell: (a) => <span className="font-mono text-[0.8125rem]">{a.versions[0]?.version ?? '—'}</span> },
            { header: t('app.developer.installs'), align: 'end', cell: (a) => a.installCount },
          ]}
        />
      )}
    </>
  );
}
