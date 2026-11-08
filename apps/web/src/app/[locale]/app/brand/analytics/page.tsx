import { NoRole } from '@/components/seller/shared';
import { BarList } from '@/components/ui/chart';
import { Card, DataTable, EmptyState, PageHeader, SectionTitle, StatCard } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { number } from '@/lib/format';
import { pageContext } from '@/lib/page';
import type { Campaign } from '@/lib/types';

type Report = { currency: string; spentMinor: string; submissions: number; approved: number; rejected: number; qualified: Record<string, string>; costPerApprovedMinor: string };

export default async function BrandAnalyticsPage() {
  const { t, m, me, locale } = await pageContext();
  if (!me.permissions.includes('campaign.manage')) return <NoRole persona="brand" />;
  const campaigns = await api<Campaign[]>('/rewards/brand/campaigns');
  const reports = await Promise.all(campaigns.map(async (c) => ({ c, r: await api<Report>(`/rewards/brand/campaigns/${c.id}/report`) })));
  if (reports.length === 0) return <><PageHeader title={t('nav.items.analytics')} /><EmptyState title={t('app.brand.noCampaigns')} /></>;
  const cur = reports[0]!.r.currency;
  const sum = (f: (r: Report) => bigint) => reports.reduce((a, x) => a + f(x.r), 0n);
  const approved = reports.reduce((a, x) => a + x.r.approved, 0);
  const spent = sum((r) => BigInt(r.spentMinor));
  const views = sum((r) => BigInt(r.qualified.VIEWS ?? '0'));
  return (
    <>
      <PageHeader title={t('nav.items.analytics')} description={t('app.brand.analyticsBody')} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('app.brand.spent')} value={m(spent, cur)} />
        <StatCard label={t('app.brand.qualifiedViews')} value={number(views, locale)} />
        <StatCard label={t('app.brand.approvedContent')} value={approved} />
        <StatCard label={t('app.brand.costPerApproved')} value={approved ? m(spent / BigInt(approved), cur) : '—'} />
      </div>
      <Card className="mt-6 p-5">
        <SectionTitle title={t('app.brand.spendByCampaign')} />
        <BarList rows={reports.map(({ c, r }) => ({ label: c.title, value: Number(r.spentMinor), display: m(r.spentMinor, r.currency) }))} />
      </Card>
      <section className="mt-6">
        <DataTable
          caption={t('app.brand.spendByCampaign')} rows={reports} rowKey={(x) => x.c.id}
          columns={[
            { header: t('app.seller.productTitle'), cell: (x) => <Link href={`/app/brand/campaigns/${x.c.id}`} className="font-medium hover:underline">{x.c.title}</Link> },
            { header: t('app.brand.submissions'), align: 'end', cell: (x) => x.r.submissions },
            { header: t('app.brand.approvedContent'), align: 'end', cell: (x) => x.r.approved },
            { header: t('app.brand.costPerApproved'), align: 'end', cell: (x) => <span className="tabular-nums">{x.r.approved ? m(x.r.costPerApprovedMinor, x.r.currency) : '—'}</span> },
          ]}
        />
      </section>
    </>
  );
}
