import { Approx } from '@/components/money/currency';
import { Cover } from '@/components/ui/cover';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { publicApi } from '@/lib/api';
import { money } from '@/lib/format';
import { getLocale, getTranslations } from 'next-intl/server';

type Row = { slug: string; title: string; summary: string; level: string; creator: { profile: { displayName: string } | null }; product: { priceFromMinor: string; currency: string } | null; _count: { enrollments: number } };

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('courses.title') };
}

export default async function CoursesPage() {
  const [t, locale, rows] = await Promise.all([getTranslations(), getLocale(), publicApi<Row[]>('/courses')]);
  return (
    <div className="mx-auto max-w-[92rem] px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="tracking-display text-4xl font-semibold">{t('courses.title')}</h1>
      <p className="mt-2 mb-8 max-w-xl text-muted">{t('courses.body')}</p>
      {rows.length === 0 ? <EmptyState title={t('courses.empty')} /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <Link key={c.slug} href={`/courses/${c.slug}`} className="card hover-depth flex flex-col overflow-hidden">
              <div className="aspect-[16/8]"><Cover seed={c.slug} /></div>
              <div className="flex flex-1 flex-col p-4">
                <p className="text-xs text-subtle">{c.creator.profile?.displayName}</p>
                <h2 className="mt-1 font-sans font-semibold">{c.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{c.summary}</p>
                <div className="mt-auto flex items-center justify-between pt-3 text-sm">
                  <Badge>{t(`courses.levels.${c.level}`)}</Badge>
                  <span className="text-end font-semibold tabular-nums">{c.product ? money(c.product.priceFromMinor, c.product.currency, locale) : t('courses.free')}{c.product && <Approx minor={c.product.priceFromMinor} currency={c.product.currency} />}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
