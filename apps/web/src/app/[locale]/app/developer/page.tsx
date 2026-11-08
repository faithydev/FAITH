import { NoRole } from '@/components/seller/shared';
import { AutoForm } from '@/components/ui/client';
import { Card, LinkButton, PageHeader, SectionTitle, StatCard } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';

type Analytics = { apps: { id: string; name: string; status: string; installCount: number }[]; balances: { currency: string; balanceMinor: string }[] };
type Profile = { name: string; website: string | null; bio: string | null } | null;

export default async function DeveloperHome() {
  const { t, m, me } = await pageContext();
  if (!me.permissions.includes('app.manage')) return <NoRole persona="build" />;
  const [a, raw] = await Promise.all([api<Analytics>('/developer/analytics'), api<Profile | ''>('/developer/profile').catch(() => null)]);
  const p = raw || null;
  const installs = a.apps.reduce((n, x) => n + x.installCount, 0);
  return (
    <>
      <PageHeader title={t('app.developer.title')} description={t('app.developer.body')} actions={<LinkButton href="/app/developer/apps/new" size="sm">{t('app.developer.newApp')}</LinkButton>} />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t('nav.items.apps')} value={a.apps.length} />
        <StatCard label={t('app.developer.installs')} value={installs} />
        <StatCard label={t('app.developer.revenue')} value={a.balances[0] ? m(a.balances[0].balanceMinor, a.balances[0].currency) : '—'} />
      </div>
      <Card className="mt-6 max-w-xl p-5">
        <SectionTitle title={t('app.developer.profile')} />
        <AutoForm
          endpoint="/developer/profile" method="PUT" submitLabel={t('common.save')} success={t('common.saved')}
          fields={[
            { name: 'name', label: t('app.developer.publisherName'), required: true, defaultValue: p?.name ?? me.profile?.displayName },
            { name: 'website', label: t('app.work.link'), type: 'url', defaultValue: p?.website ?? '' },
            { name: 'bio', label: t('app.settings.bio'), type: 'textarea', defaultValue: p?.bio ?? '' },
          ]}
        />
      </Card>
    </>
  );
}
