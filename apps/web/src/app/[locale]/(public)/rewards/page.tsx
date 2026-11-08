import { CampaignCard } from '@/components/rewards/campaign-card';
import { Button, EmptyState, fieldClass, Pagination } from '@/components/ui/primitives';
import { publicApi } from '@/lib/api';
import type { Campaign, Paged } from '@/lib/types';
import { campaignTypes } from '@faith/validators';
import { getTranslations } from 'next-intl/server';

type Search = { q?: string; type?: string; platform?: string; page?: string };
const PLATFORMS = ['youtube', 'tiktok', 'instagram', 'other'];

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('rewards.title'), description: t('rewards.body') };
}

export default async function RewardsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [t, s] = await Promise.all([getTranslations(), searchParams]);
  const clean = Object.fromEntries(Object.entries(s).filter(([, v]) => v));
  const results = await publicApi<Paged<Campaign>>(`/rewards/campaigns?${new URLSearchParams({ pageSize: '24', ...clean })}`);
  const select = 'rounded-md border border-line-strong bg-surface px-2.5 py-2 text-sm';
  return (
    <div className="mx-auto max-w-[92rem] px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 max-w-2xl">
        <h1 className="tracking-display text-4xl font-semibold">{t('rewards.title')}</h1>
        <p className="mt-2 text-muted">{t('rewards.body')}</p>
      </header>
      <form role="search" className="mb-8 flex flex-wrap items-center gap-2">
        <input type="search" name="q" aria-label={t('nav.search')} defaultValue={s.q} placeholder={t('rewards.search')} className={`${fieldClass.input} min-w-48 flex-1`} />
        <select name="type" aria-label={t('app.brand.campaignType')} defaultValue={s.type ?? ''} className={select}>
          <option value="">{t('rewards.allTypes')}</option>
          {campaignTypes.map((x) => <option key={x} value={x}>{t(`rewards.types.${x}`)}</option>)}
        </select>
        <select name="platform" aria-label={t('app.brand.platforms')} defaultValue={s.platform ?? ''} className={select}>
          <option value="">{t('rewards.allPlatforms')}</option>
          {PLATFORMS.map((p) => <option key={p} value={p}>{t(`rewards.platforms.${p}`)}</option>)}
        </select>
        <Button type="submit">{t('common.apply')}</Button>
      </form>
      {results.items.length === 0 ? <EmptyState title={t('rewards.emptyTitle')} description={t('rewards.emptyBody')} /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{results.items.map((c) => <CampaignCard key={c.id} c={c} />)}</div>
      )}
      <Pagination page={results.page} pages={results.pages} hrefFor={(p) => `/rewards?${new URLSearchParams({ ...clean, page: String(p) })}`} labels={{ previous: t('common.previous'), next: t('common.next'), page: t('common.pagination') }} />
    </div>
  );
}
