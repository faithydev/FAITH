import { FaithMark } from '@/components/ui/logo';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { publicApi } from '@/lib/api';
import { money } from '@/lib/format';
import type { AppCard, Paged } from '@/lib/types';
import { BadgeCheck } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('apps.title') };
}

export default async function AppsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const [t, locale, { category }] = await Promise.all([getTranslations(), getLocale(), searchParams]);
  const apps = await publicApi<Paged<AppCard>>(`/apps?pageSize=48${category ? `&category=${category}` : ''}`);
  return (
    <div className="mx-auto max-w-[92rem] px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="tracking-display text-4xl font-semibold">{t('apps.title')}</h1>
      <p className="mt-2 mb-6 max-w-xl text-muted">{t('apps.body')}</p>
      <nav aria-label={t('market.category')} className="mb-8 flex flex-wrap gap-1.5 text-sm">
        <Link href="/apps" className={`rounded-md border px-2.5 py-1 ${!category ? 'border-primary bg-primary text-on-primary' : 'border-line text-muted'}`}>{t('market.allCategories')}</Link>
        {['analytics', 'marketing', 'operations', 'finance', 'communication', 'developer'].map((c) => (
          <Link key={c} href={`/apps?category=${c}`} className={`rounded-md border px-2.5 py-1 ${category === c ? 'border-primary bg-primary text-on-primary' : 'border-line text-muted'}`}>{t(`apps.categories.${c}`)}</Link>
        ))}
      </nav>
      {apps.items.length === 0 ? <EmptyState title={t('apps.empty')} /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.items.map((a) => (
            <Link key={a.id} href={`/apps/${a.slug}`} className="card hover-depth flex gap-3.5 p-5" data-testid="app-card">
              <span className="grid size-11 shrink-0 place-items-center rounded-md bg-surface-2"><FaithMark size={18} /></span>
              <span className="min-w-0">
                <span className="block font-semibold">{a.name}</span>
                <span className="mt-0.5 line-clamp-2 block text-sm text-muted">{a.tagline}</span>
                <span className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-subtle">
                  {a.developer.developerProfile?.name}{a.developer.developerProfile?.verifiedAt && <BadgeCheck size={13} className="text-accent" />}
                  <Badge>{a.pricing === 'FREE' ? t('apps.pricing.FREE') : money(a.priceMinor, a.currency, locale)}</Badge>
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
