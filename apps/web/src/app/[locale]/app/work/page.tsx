import { NoRole } from '@/components/seller/shared';
import { AutoForm } from '@/components/ui/client';
import { Card, LinkButton, PageHeader, SectionTitle } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';

type Profile = { headline: string; summary: string | null; skills: string[]; languages: string[]; discoverable: boolean } | null;
type Saved = { slug: string; title: string; org: { name: string } };

export default async function WorkHome() {
  const { t, me } = await pageContext();
  if (!me.permissions.includes('job.apply')) return <NoRole persona="job" />;
  const [raw, saved] = await Promise.all([api<Profile | ''>('/work/profile').catch(() => null), api<Saved[]>('/work/saved')]);
  const p = raw || null;
  return (
    <>
      <PageHeader title={t('app.work.title')} description={t('app.work.body')} actions={<LinkButton href="/jobs" size="sm">{t('app.work.browse')}</LinkButton>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <Card className="p-5">
          <SectionTitle title={t('app.work.profile')} />
          <AutoForm
            endpoint="/work/profile" method="PUT" submitLabel={t('common.save')} success={t('common.saved')}
            fields={[
              { name: 'headline', label: t('app.creator.headline'), required: true, defaultValue: p?.headline ?? '' },
              { name: 'summary', label: t('app.seller.summary'), type: 'textarea', defaultValue: p?.summary ?? '' },
              { name: 'skills', label: t('jobs.skills'), type: 'tags', hint: t('app.seller.tagsHint'), defaultValue: p?.skills.join(', ') ?? '' },
              { name: 'languages', label: t('app.work.languages'), type: 'tags', defaultValue: p?.languages.join(', ') ?? '' },
              { name: 'discoverable', label: t('app.work.discoverable'), hint: t('app.work.discoverableHint'), type: 'checkbox', defaultValue: p?.discoverable ?? false },
            ]}
          />
        </Card>
        <Card className="p-5">
          <SectionTitle title={t('app.work.saved')} />
          {saved.length === 0 ? <p className="text-sm text-muted">{t('app.work.noSaved')}</p> : (
            <ul className="space-y-2 text-sm">{saved.map((j) => <li key={j.slug}><Link href={`/jobs/${j.slug}`} className="font-medium hover:underline">{j.title}</Link><span className="block text-xs text-muted">{j.org.name}</span></li>)}</ul>
          )}
        </Card>
      </div>
    </>
  );
}
