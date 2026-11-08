import { ActionButton, FormDialog } from '@/components/ui/client';
import { Badge, Breadcrumbs, Card, EmptyState, LinkButton, PageHeader, SectionTitle, StatusBadge } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';
import { APP_PERMISSIONS } from '@/lib/app-permissions';
import { notFound } from 'next/navigation';

type App = {
  id: string; slug: string; name: string; tagline: string; status: string; reviewNote: string | null; installCount: number;
  versions: { id: string; version: string; status: string; permissions: string[]; reviewNote: string | null }[];
};

export default async function DeveloperAppPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { t, status }] = await Promise.all([params, pageContext()]);
  const app = (await api<App[]>('/developer/apps')).find((a) => a.id === id);
  if (!app) notFound();
  const perm = (p: string) => t(`app.permissions.${p.replace(':', '_')}`);
  const hasDraft = app.versions.some((v) => ['DRAFT', 'REJECTED'].includes(v.status));
  return (
    <>
      <Breadcrumbs label={t('common.breadcrumbs')} items={[{ label: t('nav.items.apps'), href: '/app/developer/apps' }, { label: app.name }]} />
      <PageHeader
        title={app.name} description={app.tagline}
        actions={
          <>
            <span data-testid="app-status"><StatusBadge status={app.status} label={status(app.status)} /></span>
            {app.status === 'PUBLISHED' && <LinkButton href={`/apps/${app.slug}`} variant="secondary" size="sm">{t('app.seller.viewListing')}</LinkButton>}
            <FormDialog
              trigger={t('app.developer.newVersion')} title={t('app.developer.newVersion')} triggerVariant="secondary" endpoint={`/developer/apps/${app.id}/versions`} submitLabel={t('common.add')}
              fields={[
                { name: 'version', label: t('app.developer.version'), required: true, placeholder: '1.0.0' },
                { name: 'changelog', label: t('app.developer.changelog'), type: 'textarea', rows: 3 },
                { name: 'permissions', label: t('app.developer.permissions'), type: 'checkboxes', options: APP_PERMISSIONS.map((p) => ({ value: p, label: perm(p) })) },
              ]}
            />
            {hasDraft && <ActionButton endpoint={`/developer/apps/${app.id}/submit`} variant="primary" label={t('app.developer.submit')} success={t('app.developer.submitted')} />}
          </>
        }
      />
      {app.reviewNote && <p className="mb-5 rounded-md bg-surface-2 p-3 text-sm">{app.reviewNote}</p>}
      <SectionTitle title={t('app.developer.versions')} />
      {app.versions.length === 0 ? <EmptyState title={t('app.developer.noVersions')} /> : (
        <div className="space-y-3">
          {app.versions.map((v) => (
            <Card key={v.id} className="p-4">
              <div className="flex items-center justify-between gap-2"><span className="font-mono font-medium">{v.version}</span><StatusBadge status={v.status} label={status(v.status)} /></div>
              <div className="mt-2 flex flex-wrap gap-1.5">{v.permissions.map((p) => <Badge key={p}>{perm(p)}</Badge>)}</div>
              {v.reviewNote && <p className="mt-2 text-sm text-muted">{v.reviewNote}</p>}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
