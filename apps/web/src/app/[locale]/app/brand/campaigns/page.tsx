import { NoRole } from '@/components/seller/shared';
import { DataTable, EmptyState, LinkButton, PageHeader, StatusBadge } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';
import type { Campaign } from '@/lib/types';

export default async function BrandCampaignsPage() {
  const { t, m, d, status, me } = await pageContext();
  if (!me.permissions.includes('campaign.manage')) return <NoRole persona="brand" />;
  const campaigns = await api<Campaign[]>('/rewards/brand/campaigns');
  const cta = <LinkButton href="/app/brand/campaigns/new" size="sm">{t('nav.items.newCampaign')}</LinkButton>;
  return (
    <>
      <PageHeader title={t('nav.items.campaigns')} actions={cta} />
      {campaigns.length === 0 ? <EmptyState title={t('app.brand.noCampaigns')} action={cta} /> : (
        <DataTable
          caption={t('nav.items.campaigns')} rows={campaigns} rowKey={(c) => c.id}
          columns={[
            { header: t('app.seller.productTitle'), cell: (c) => <Link href={`/app/brand/campaigns/${c.id}`} className="font-medium hover:underline">{c.title}</Link> },
            { header: t('app.orders.status'), cell: (c) => <StatusBadge status={c.status ?? ''} label={status(c.status ?? '')} /> },
            { header: t('app.brand.deadline'), cell: (c) => d(c.submissionDeadline) },
            { header: t('app.brand.submissions'), align: 'end', cell: (c) => c._count.submissions },
            { header: t('app.brand.budget'), align: 'end', cell: (c) => <span className="tabular-nums">{m(c.budgetMinor, c.currency)}</span> },
          ]}
        />
      )}
    </>
  );
}
