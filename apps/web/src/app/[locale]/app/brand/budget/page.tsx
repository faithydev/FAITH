import { RewardProgress } from '@/components/rewards/reward-progress';
import { NoRole } from '@/components/seller/shared';
import { Card, EmptyState, PageHeader, SimulatedNotice } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';
import type { Campaign } from '@/lib/types';

export default async function BrandBudgetPage() {
  const { t, me } = await pageContext();
  if (!me.permissions.includes('campaign.manage')) return <NoRole persona="brand" />;
  const campaigns = await api<Campaign[]>('/rewards/brand/campaigns');
  return (
    <>
      <PageHeader title={t('nav.items.budget')} description={t('app.brand.budgetBody')} />
      <div className="mb-5"><SimulatedNotice>{t('app.finance.ledgerNote')}</SimulatedNotice></div>
      {campaigns.length === 0 ? <EmptyState title={t('app.brand.noCampaigns')} /> : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <Card key={c.id} className="p-4">
              <Link href={`/app/brand/campaigns/${c.id}`} className="mb-2 block font-medium hover:underline">{c.title}</Link>
              <RewardProgress accruedMinor={c.accruedMinor} fundedMinor={c.fundedMinor} currency={c.currency} label={t('rewards.budgetUsed')} />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
