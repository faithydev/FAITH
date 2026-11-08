import { IntlScope } from '@/components/auth/scope';
import { CampaignForm } from '@/components/rewards/campaign-form';
import { NoRole } from '@/components/seller/shared';
import { Breadcrumbs, EmptyState, LinkButton, PageHeader } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';

export default async function NewCampaignPage() {
  const { t, me } = await pageContext();
  if (!me.permissions.includes('campaign.manage')) return <NoRole persona="brand" />;
  const orgs = await api<{ id: string; name: string }[]>('/organizations');
  if (orgs.length === 0) return <EmptyState title={t('app.brand.orgTitle')} description={t('app.brand.orgBody')} action={<LinkButton href="/app/brand">{t('common.continue')}</LinkButton>} />;
  return (
    <>
      <Breadcrumbs label={t('common.breadcrumbs')} items={[{ label: t('nav.items.campaigns'), href: '/app/brand/campaigns' }, { label: t('nav.items.newCampaign') }]} />
      <PageHeader title={t('nav.items.newCampaign')} description={t('app.brand.newBody')} />
      <IntlScope ns={['app', 'rewards']}><CampaignForm orgs={orgs} /></IntlScope>
    </>
  );
}
