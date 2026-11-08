import { Card, EmptyState, LinkButton, PageHeader, SectionTitle } from '@/components/ui/primitives';
import { ActionButton } from '@/components/ui/client';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';
import type { AppCard } from '@/lib/types';

type Opportunities = { consent: boolean; items: { kind: string; title: string; href: string; reason: string; matched: string[] }[] };
type Installed = { id: string; app: AppCard; version: { version: string; permissions: string[] } };

export default async function ExplorePage() {
  const { t } = await pageContext();
  const [opportunities, installed] = await Promise.all([api<Opportunities>('/opportunities'), api<Installed[]>('/installed-apps')]);
  return (
    <>
      <PageHeader title={t('app.explore.title')} description={t('app.explore.body')} />
      <section>
        <SectionTitle title={t('app.home.opportunities')} />
        {opportunities.items.length === 0 ? (
          <EmptyState title={t('app.home.noOpportunities')} description={opportunities.consent ? t('app.explore.improve') : t('app.home.consentOff')} action={<LinkButton href="/app/settings" variant="secondary">{t('nav.settings')}</LinkButton>} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {opportunities.items.map((o) => (
              <Link key={o.href} href={o.href} className="card hover-depth p-4">
                <p className="eyebrow">{t(`app.opportunityKinds.${o.kind}`)}</p>
                <p className="mt-1.5 font-medium">{o.title}</p>
                <p className="mt-1 text-xs text-muted">{t(`app.reasons.${o.reason}`, { matched: o.matched.join(', ') })}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
      <section className="mt-10">
        <SectionTitle title={t('app.explore.installedApps')} action={<Link href="/apps" className="text-sm text-muted hover:text-ink">{t('nav.apps')}</Link>} />
        {installed.length === 0 ? <Card className="p-5 text-sm text-muted">{t('app.explore.noApps')}</Card> : (
          <ul className="card divide-y divide-line">
            {installed.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 p-3.5 text-sm">
                <span className="min-w-0"><Link href={`/apps/${i.app.slug}`} className="font-medium hover:underline">{i.app.name}</Link><span className="block truncate text-xs text-muted">{i.version.permissions.map((p) => t(`app.permissions.${p.replace(':', '_')}`)).join(', ')}</span></span>
                <ActionButton endpoint={`/apps/${i.app.slug}/uninstall`} label={t('app.explore.uninstall')} confirm={{ title: t('app.explore.uninstallConfirm', { name: i.app.name }), danger: true, confirmLabel: t('app.explore.uninstall') }} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
