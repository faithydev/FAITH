import { Card, EmptyState, LinkButton, PageHeader, SectionTitle, StatCard, StatusBadge } from '@/components/ui/primitives';
import { Link, redirect } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';
import type { LibraryItem, Order } from '@/lib/types';

const HOME: Record<string, string> = { seller: '/app/seller', creator: '/app/creator', work: '/app/work', freelance: '/app/freelance', brand: '/app/brand', developer: '/app/developer' };

type Opportunities = { consent: boolean; items: { kind: string; title: string; href: string; reason: string; matched: string[] }[] };

export default async function DashboardPage() {
  const { t, locale, me, m, d, status } = await pageContext();
  const home = HOME[me.activeWorkspace];
  if (home) return redirect({ href: home, locale });

  const [orders, library, opportunities] = await Promise.all([
    api<Order[]>('/orders'), api<LibraryItem[]>('/library'), api<Opportunities>('/opportunities'),
  ]);
  return (
    <>
      <PageHeader title={t('app.home.greeting', { name: me.profile?.displayName ?? '' })} description={t('app.home.body')} />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t('app.home.orders')} value={orders.length} />
        <StatCard label={t('app.home.library')} value={library.length} />
        <StatCard label={t('app.home.plan')} value={t(`app.plans.${me.plan.key}`)} />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle title={t('app.home.recentOrders')} action={<Link href="/app/orders" className="text-sm text-muted hover:text-ink">{t('common.viewAll')}</Link>} />
          {orders.length === 0 ? (
            <EmptyState title={t('app.home.noOrdersTitle')} description={t('app.home.noOrdersBody')} action={<LinkButton href="/marketplace">{t('cart.browse')}</LinkButton>} />
          ) : (
            <ul className="card divide-y divide-line">
              {orders.slice(0, 5).map((o) => (
                <li key={o.id}>
                  <Link href={`/app/orders/${o.id}`} className="flex items-center justify-between gap-3 p-3.5 text-sm hover:bg-surface-2/50">
                    <span className="min-w-0"><span className="block truncate font-medium">{o.items[0]?.title}</span><span className="text-xs text-muted">{d(o.createdAt)}</span></span>
                    <span className="flex shrink-0 items-center gap-2.5"><StatusBadge status={o.status} label={status(o.status)} /><span className="tabular-nums">{m(o.totalMinor, o.currency)}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <SectionTitle title={t('app.home.opportunities')} />
          {opportunities.items.length === 0 ? (
            <Card className="p-5 text-sm text-muted">{opportunities.consent ? t('app.home.noOpportunities') : t('app.home.consentOff')}</Card>
          ) : (
            <ul className="card divide-y divide-line">
              {opportunities.items.slice(0, 5).map((o) => (
                <li key={o.href}>
                  <Link href={o.href} className="block p-3.5 text-sm hover:bg-surface-2/50">
                    <span className="font-medium">{o.title}</span>
                    <span className="mt-0.5 block text-xs text-muted">{t(`app.reasons.${o.reason}`, { matched: o.matched.join(', ') })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
