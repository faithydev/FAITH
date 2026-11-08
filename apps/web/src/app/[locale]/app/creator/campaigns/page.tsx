import { CampaignCard } from '@/components/rewards/campaign-card';
import { EmptyState, PageHeader } from '@/components/ui/primitives';
import { publicApi } from '@/lib/api';
import { pageContext } from '@/lib/page';
import type { Campaign, Paged } from '@/lib/types';

export default async function CreatorCampaignsPage() {
  const { t } = await pageContext();
  const campaigns = await publicApi<Paged<Campaign>>('/rewards/campaigns?pageSize=48');
  return (
    <>
      <PageHeader title={t('nav.items.campaigns')} description={t('app.creator.campaignsBody')} />
      {campaigns.items.length === 0 ? <EmptyState title={t('rewards.emptyTitle')} /> : <div className="grid gap-3 md:grid-cols-2">{campaigns.items.map((c) => <CampaignCard key={c.id} c={c} />)}</div>}
    </>
  );
}
