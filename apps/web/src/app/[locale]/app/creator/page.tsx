import { NoRole } from '@/components/seller/shared';
import { Card, LinkButton, PageHeader, SectionTitle, StatCard } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';

type Overview = { submissions: Record<string, number>; courses: number; communities: number; stores: number; students: number; members: number };
type Earnings = { estimated: { currency: string; amountMinor: string }[]; accruals: { currency: string; status: string; amountMinor: string }[]; balances: { key: string; currency: string; balanceMinor: string }[] };

export default async function CreatorHome() {
  const { t, m, me } = await pageContext();
  if (!me.permissions.includes('campaign.participate')) return <NoRole persona="create" />;
  const [o, e] = await Promise.all([api<Overview>('/creator/overview'), api<Earnings>('/rewards/creator/earnings')]);
  const first = (rows: { currency: string; amountMinor: string }[]) => (rows[0] ? m(rows[0].amountMinor, rows[0].currency) : '—');
  return (
    <>
      <PageHeader title={t('app.creator.title')} description={t('app.creator.body')} actions={<LinkButton href="/rewards" size="sm">{t('app.creator.browse')}</LinkButton>} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('app.creator.estimated')} value={first(e.estimated)} hint={t('app.creator.estimatedHint')} />
        <StatCard label={t('app.creator.approved')} value={first(e.accruals.filter((a) => a.status === 'APPROVED'))} />
        <StatCard label={t('app.creator.inReview')} value={(o.submissions.SUBMITTED ?? 0) + (o.submissions.APPEALED ?? 0)} />
        <StatCard label={t('app.creator.approvedSubmissions')} value={o.submissions.APPROVED ?? 0} />
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Link href="/app/creator/courses" className="card hover-depth p-5"><p className="text-sm text-muted">{t('nav.items.courses')}</p><p className="mt-1 font-display text-xl font-semibold">{o.courses}</p><p className="text-xs text-subtle">{t('app.creator.students', { count: o.students })}</p></Link>
        <Link href="/app/creator/community" className="card hover-depth p-5"><p className="text-sm text-muted">{t('nav.items.community')}</p><p className="mt-1 font-display text-xl font-semibold">{o.communities}</p><p className="text-xs text-subtle">{t('app.creator.members', { count: o.members })}</p></Link>
        <Link href="/app/seller" className="card hover-depth p-5"><p className="text-sm text-muted">{t('nav.items.store')}</p><p className="mt-1 font-display text-xl font-semibold">{o.stores}</p></Link>
      </div>
      <Card className="mt-6 p-5">
        <SectionTitle title={t('app.creator.scheduling')} />
        <p className="text-sm text-muted">{t('app.creator.schedulingBody')}</p>
      </Card>
    </>
  );
}
