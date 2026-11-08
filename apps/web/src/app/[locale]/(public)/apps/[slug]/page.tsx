import { ActionButton } from '@/components/ui/client';
import { Badge, Breadcrumbs, Card, LinkButton, SectionTitle } from '@/components/ui/primitives';
import { api, getMe, publicApi } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { money } from '@/lib/format';
import { ShieldCheck } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

type View = {
  slug: string; name: string; tagline: string; description: string; category: string; pricing: string; priceMinor: string; currency: string; installCount: number; website: string | null;
  developer: { developerProfile: { name: string; website: string | null } | null };
  latest: { version: string; permissions: string[]; changelog: string | null } | null;
  installation: { status: string } | null;
  reviews: { id: string; rating: number; body: string; user: { profile: { displayName: string } | null } }[];
};

export default async function AppPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, t, locale, me] = await Promise.all([params, getTranslations(), getLocale(), getMe()]);
  const a = await (me ? api<View>(`/apps/${slug}`) : publicApi<View>(`/apps/${slug}`, 30)).catch((e: unknown) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const permissions = a.latest?.permissions ?? [];
  const installed = a.installation?.status === 'ACTIVE';
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Breadcrumbs label={t('common.breadcrumbs')} items={[{ label: t('apps.title'), href: '/apps' }, { label: a.name }]} />
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="min-w-0">
          <h1 className="tracking-display text-3xl font-semibold">{a.name}</h1>
          <p className="mt-1.5 text-muted">{a.tagline}</p>
          <div className="mt-3 flex gap-1.5"><Badge>{t(`apps.categories.${a.category}`)}</Badge>{a.latest && <Badge>{a.latest.version}</Badge>}</div>
          <p className="mt-6 leading-relaxed text-muted">{a.description}</p>
          {a.reviews.length > 0 && (
            <section className="mt-8">
              <SectionTitle title={t('market.reviews')} />
              <ul className="space-y-2">{a.reviews.map((r) => <li key={r.id} className="card p-3.5 text-sm"><span className="font-medium">{r.user.profile?.displayName}</span> · {r.rating}/5<p className="mt-1 text-muted">{r.body}</p></li>)}</ul>
            </section>
          )}
        </div>
        <aside className="space-y-4 lg:sticky lg:top-20">
          <Card className="p-5">
            <p className="font-display text-xl font-semibold">{a.pricing === 'FREE' ? t('apps.pricing.FREE') : money(a.priceMinor, a.currency, locale)}</p>
            <p className="mt-1 text-sm text-muted">{a.developer.developerProfile?.name}</p>
            <p className="text-xs text-subtle">{t('apps.installs', { count: a.installCount })}</p>
            <div className="mt-4">
              {!me ? <LinkButton href={`/login?next=/apps/${a.slug}`} className="w-full">{t('nav.login')}</LinkButton>
                : installed ? <ActionButton endpoint={`/apps/${a.slug}/uninstall`} label={t('app.explore.uninstall')} size="md" confirm={{ title: t('app.explore.uninstallConfirm', { name: a.name }), danger: true }} />
                : <ActionButton endpoint={`/apps/${a.slug}/install`} body={{ acceptedPermissions: permissions }} followPayment label={t('apps.install')} variant="primary" size="md" success={t('apps.installed')} confirm={{ title: t('apps.installConfirm', { name: a.name }), body: permissions.map((p) => t(`app.permissions.${p.replace(':', '_')}`)).join(', ') || t('apps.noPermissions'), confirmLabel: t('apps.allowInstall') }} />}
            </div>
          </Card>
          <Card className="p-5">
            <SectionTitle title={t('apps.permissions')} />
            {permissions.length === 0 ? <p className="text-sm text-muted">{t('apps.noPermissions')}</p> : (
              <ul className="space-y-1.5 text-sm">{permissions.map((p) => <li key={p} className="flex items-center gap-2"><ShieldCheck size={14} className="text-accent" />{t(`app.permissions.${p.replace(':', '_')}`)}</li>)}</ul>
            )}
            <p className="mt-3 text-xs text-subtle">{t('apps.sandboxNote')}</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
