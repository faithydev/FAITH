import { NoRole } from '@/components/seller/shared';
import { AutoForm } from '@/components/ui/client';
import { Card, PageHeader, SectionTitle } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';
import { toMajorString } from '@faith/money';

type Profile = { headline: string; bio: string | null; hourlyRateMinor: string | null; currency: string; skills: string[]; available: boolean } | null;

export default async function FreelanceHome() {
  const { t, me } = await pageContext();
  if (!me.permissions.includes('service.manage')) return <NoRole persona="services" />;
  const p = (await api<Profile | ''>('/freelance/profile').catch(() => null)) || null;
  const currency = p?.currency ?? 'USD';
  return (
    <>
      <PageHeader title={t('app.freelance.title')} description={t('app.freelance.body')} />
      <Card className="max-w-xl p-5">
        <SectionTitle title={t('app.freelance.profile')} />
        <AutoForm
          endpoint="/freelance/profile" method="PUT" submitLabel={t('common.save')} success={t('common.saved')} extra={{ currency }}
          fields={[
            { name: 'headline', label: t('app.creator.headline'), required: true, defaultValue: p?.headline ?? '' },
            { name: 'bio', label: t('app.settings.bio'), type: 'textarea', defaultValue: p?.bio ?? '' },
            { name: 'hourlyRateMinor', label: t('app.freelance.hourly', { currency }), type: 'money', currency, defaultValue: p?.hourlyRateMinor ? toMajorString(BigInt(p.hourlyRateMinor), currency) : '' },
            { name: 'skills', label: t('jobs.skills'), type: 'tags', hint: t('app.seller.tagsHint'), defaultValue: p?.skills.join(', ') ?? '' },
            { name: 'available', label: t('app.freelance.available'), type: 'checkbox', defaultValue: p?.available ?? true },
          ]}
        />
      </Card>
    </>
  );
}
