import { AutoForm } from '@/components/ui/client';
import { Card, LinkButton, PageHeader, SectionTitle } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';

type Profile = { headline: string; niches: string[] } | null;

export default async function CreatorContentPage() {
  const { t, me } = await pageContext();
  const profile = await api<Profile | ''>('/creator/profile').catch(() => null);
  const p = profile || null;
  return (
    <>
      <PageHeader title={t('nav.items.content')} description={t('app.creator.contentBody')} actions={p && me.profile && <LinkButton href={`/creators/${me.profile.username}`} variant="secondary" size="sm">{t('app.creator.viewPublic')}</LinkButton>} />
      <Card className="max-w-xl p-5">
        <SectionTitle title={t('app.creator.profile')} />
        <AutoForm
          endpoint="/creator/profile" method="PUT" submitLabel={t('common.save')} success={t('common.saved')}
          fields={[
            { name: 'headline', label: t('app.creator.headline'), required: true, defaultValue: p?.headline ?? '' },
            { name: 'niches', label: t('app.creator.niches'), type: 'tags', hint: t('app.seller.tagsHint'), defaultValue: p?.niches.join(', ') ?? '' },
          ]}
        />
      </Card>
    </>
  );
}
