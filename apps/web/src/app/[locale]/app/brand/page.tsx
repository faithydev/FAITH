import { NoRole } from '@/components/seller/shared';
import { Card, DataTable, EmptyState, LinkButton, PageHeader, SectionTitle, StatCard, StatusBadge } from '@/components/ui/primitives';
import { AutoForm } from '@/components/ui/client';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';
import type { Campaign } from '@/lib/types';

type Org = { id: string; name: string; memberRole: string };

export default async function BrandHome() {
  const { t, m, status, me } = await pageContext();
  if (!me.permissions.includes('campaign.manage')) return <NoRole persona="brand" />;
  const [campaigns, orgs] = await Promise.all([api<Campaign[]>('/rewards/brand/campaigns'), api<Org[]>('/organizations')]);
  const live = campaigns.filter((c) => c.status === 'ACTIVE');
  const funded = campaigns.reduce((a, c) => a + BigInt(c.fundedMinor), 0n);
  const spent = campaigns.reduce((a, c) => a + BigInt(c.accruedMinor), 0n);
  const cur = campaigns[0]?.currency ?? 'USD';
  const submissions = campaigns.reduce((a, c) => a + c._count.submissions, 0);
  if (orgs.length === 0) {
    return (
      <>
        <PageHeader title={t('app.brand.orgTitle')} description={t('app.brand.orgBody')} />
        <Card className="max-w-lg p-5">
          <AutoForm
            endpoint="/organizations" submitLabel={t('common.create')} success={t('common.saved')}
            fields={[
              { name: 'name', label: t('app.brand.orgName'), required: true },
              { name: 'type', label: t('app.brand.orgType'), type: 'select', required: true, defaultValue: 'BRAND', options: ['BRAND', 'BUSINESS', 'AGENCY', 'STUDIO'].map((o) => ({ value: o, label: t(`app.brand.orgTypes.${o}`) })) },
            ]}
          />
        </Card>
      </>
    );
  }
  const cta = <LinkButton href="/app/brand/campaigns/new" size="sm">{t('nav.items.newCampaign')}</LinkButton>;
  return (
    <>
      <PageHeader title={orgs[0]!.name} description={t('app.brand.body')} actions={cta} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('app.brand.live')} value={live.length} />
        <StatCard label={t('app.brand.funded')} value={m(funded, cur)} />
        <StatCard label={t('app.brand.spent')} value={m(spent, cur)} />
        <StatCard label={t('app.brand.submissions')} value={submissions} />
      </div>
      <section className="mt-8">
        <SectionTitle title={t('nav.items.campaigns')} />
        {campaigns.length === 0 ? <EmptyState title={t('app.brand.noCampaigns')} action={cta} /> : (
          <DataTable
            caption={t('nav.items.campaigns')} rows={campaigns.slice(0, 6)} rowKey={(c) => c.id}
            columns={[
              { header: t('app.seller.productTitle'), cell: (c) => <Link href={`/app/brand/campaigns/${c.id}`} className="font-medium hover:underline">{c.title}</Link> },
              { header: t('app.orders.status'), cell: (c) => <StatusBadge status={c.status ?? ''} label={status(c.status ?? '')} /> },
              { header: t('app.brand.submissions'), align: 'end', cell: (c) => c._count.submissions },
              { header: t('app.brand.spent'), align: 'end', cell: (c) => <span className="tabular-nums">{m(c.accruedMinor, c.currency)}</span> },
            ]}
          />
        )}
      </section>
    </>
  );
}
