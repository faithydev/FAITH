import { Cover } from '@/components/ui/cover';
import { Button, EmptyState, fieldClass } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { publicApi } from '@/lib/api';
import { money } from '@/lib/format';
import type { Paged, Service } from '@/lib/types';
import { getLocale, getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('services.title') };
}

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [t, locale, { q }] = await Promise.all([getTranslations(), getLocale(), searchParams]);
  const results = await publicApi<Paged<Service>>(`/services?pageSize=24${q ? `&q=${encodeURIComponent(q)}` : ''}`);
  return (
    <div className="mx-auto max-w-[92rem] px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="tracking-display text-4xl font-semibold">{t('services.title')}</h1>
      <p className="mt-2 mb-8 max-w-xl text-muted">{t('services.body')}</p>
      <form role="search" className="mb-8 flex max-w-lg gap-2">
        <input type="search" name="q" aria-label={t('nav.search')} defaultValue={q} placeholder={t('services.search')} className={fieldClass.input} />
        <Button type="submit">{t('common.apply')}</Button>
      </form>
      {results.items.length === 0 ? <EmptyState title={t('services.empty')} /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.items.map((s) => (
            <Link key={s.id} href={`/services/${s.slug}`} className="card hover-depth flex flex-col overflow-hidden">
              <div className="aspect-[16/8]"><Cover seed={s.slug} /></div>
              <div className="flex flex-1 flex-col p-4">
                <p className="text-xs text-subtle">{s.freelancer.profile?.displayName}</p>
                <h2 className="mt-1 font-sans font-semibold">{s.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{s.summary}</p>
                {s.packages[0] && <p className="mt-auto pt-3 text-sm">{t('services.from', { price: money(s.packages[0].priceMinor, s.currency, locale) })}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
