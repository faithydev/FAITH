import { CreatorCard, CreatorRow } from '@/components/rewards/creator-card';
import { EmptyState } from '@/components/ui/primitives';
import { publicApi } from '@/lib/api';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('creators.title') };
}

export default async function CreatorsPage() {
  const [t, rows] = await Promise.all([getTranslations(), publicApi<CreatorRow[]>('/creators')]);
  return (
    <div className="mx-auto max-w-[92rem] px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="tracking-display text-4xl font-semibold">{t('creators.title')}</h1>
      <p className="mt-2 mb-8 max-w-xl text-muted">{t('creators.body')}</p>
      {rows.length === 0 ? <EmptyState title={t('creators.empty')} /> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{rows.map((c) => <CreatorCard key={c.userId} c={c} />)}</div>}
    </div>
  );
}
