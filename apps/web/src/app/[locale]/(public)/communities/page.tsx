import { Badge, EmptyState } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { publicApi } from '@/lib/api';
import { getTranslations } from 'next-intl/server';

type Row = { slug: string; name: string; description: string; visibility: string; _count: { members: number } };

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('communities.title') };
}

export default async function CommunitiesPage() {
  const [t, rows] = await Promise.all([getTranslations(), publicApi<Row[]>('/communities')]);
  return (
    <div className="mx-auto max-w-[92rem] px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="tracking-display text-4xl font-semibold">{t('communities.title')}</h1>
      <p className="mt-2 mb-8 max-w-xl text-muted">{t('communities.body')}</p>
      {rows.length === 0 ? <EmptyState title={t('communities.empty')} /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <Link key={c.slug} href={`/communities/${c.slug}`} className="card hover-depth p-5">
              <div className="flex items-start justify-between gap-2"><h2 className="font-sans font-semibold">{c.name}</h2><Badge>{t(`communities.${c.visibility}`)}</Badge></div>
              <p className="mt-1.5 line-clamp-2 text-sm text-muted">{c.description}</p>
              <p className="mt-3 text-xs text-subtle">{t('communities.memberCount', { count: c._count.members })}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
