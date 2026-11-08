import { PayoutPanel } from '@/components/finance/earnings';
import type { Balance, Payout } from '@/components/finance/earnings';
import { NoRole } from '@/components/seller/shared';
import { BarList } from '@/components/ui/chart';
import { Card, PageHeader, SectionTitle } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { number } from '@/lib/format';
import { pageContext } from '@/lib/page';

type Analytics = { apps: { id: string; name: string; installCount: number }[]; balances: Balance[] };

export default async function DeveloperAnalyticsPage() {
  const { t, me, locale } = await pageContext();
  if (!me.permissions.includes('app.manage')) return <NoRole persona="build" />;
  const [a, payouts] = await Promise.all([api<Analytics>('/developer/analytics'), api<{ payouts: Payout[] }>('/payouts')]);
  return (
    <>
      <PageHeader title={t('nav.items.analytics')} />
      <Card className="mb-6 p-5">
        <SectionTitle title={t('app.developer.installs')} />
        {a.apps.length === 0 ? <p className="text-sm text-muted">{t('app.developer.noApps')}</p> : <BarList rows={a.apps.map((x) => ({ label: x.name, value: x.installCount, display: number(x.installCount, locale) }))} />}
      </Card>
      <PayoutPanel balances={a.balances} payouts={payouts.payouts} />
    </>
  );
}
