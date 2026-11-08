import { ProductCardView } from '@/components/commerce/product-card';
import { Button, EmptyState, fieldClass, Pagination } from '@/components/ui/primitives';
import { publicApi } from '@/lib/api';
import { number } from '@/lib/format';
import type { Category, Paged, ProductCard, Sponsored } from '@/lib/types';
import { productTypes } from '@faith/validators';
import { getLocale, getTranslations } from 'next-intl/server';

type Search = { q?: string; category?: string; type?: string; sort?: string; page?: string; minPrice?: string; maxPrice?: string };
const SORTS = ['relevance', 'newest', 'price_asc', 'price_desc', 'rating', 'popular'];

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('market.title'), description: t('market.body') };
}

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<Search> }) {
  const [t, locale, s] = await Promise.all([getTranslations(), getLocale(), searchParams]);
  const clean = Object.fromEntries(Object.entries(s).filter(([, v]) => v));
  const query = new URLSearchParams({ pageSize: '24', ...clean });
  const [results, categories, sponsored] = await Promise.all([
    publicApi<Paged<ProductCard>>(`/marketplace/products?${query}`),
    publicApi<Category[]>('/marketplace/categories', 300),
    publicApi<Sponsored[]>('/marketplace/sponsored?placement=MARKETPLACE_TOP', 60),
  ]);
  const hrefFor = (page: number) => `/marketplace?${new URLSearchParams({ ...clean, page: String(page) })}`;
  const select = 'rounded-md border border-line-strong bg-surface px-2.5 py-2 text-sm';

  return (
    <div className="mx-auto max-w-[92rem] px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="tracking-display text-4xl font-semibold">{t('market.title')}</h1>
        <p className="mt-2 max-w-xl text-muted">{t('market.body')}</p>
      </header>

      <form role="search" action="" className="mb-8 flex flex-wrap items-center gap-2">
        <input type="search" name="q" aria-label={t('market.searchLabel')} defaultValue={s.q} placeholder={t('market.searchPlaceholder')} className={`${fieldClass.input} min-w-48 flex-1`} />
        <select name="category" aria-label={t('market.category')} defaultValue={s.category ?? ''} className={select}>
          <option value="">{t('market.allCategories')}</option>
          {categories.map((c) => <option key={c.id} value={c.slug}>{c.names[locale] ?? c.names.en}</option>)}
        </select>
        <select name="type" aria-label={t('market.type')} defaultValue={s.type ?? ''} className={select}>
          <option value="">{t('market.allTypes')}</option>
          {productTypes.map((p) => <option key={p} value={p}>{t(`productTypes.${p}`)}</option>)}
        </select>
        <select name="sort" aria-label={t('market.sort')} defaultValue={s.sort ?? 'relevance'} className={select}>
          {SORTS.map((o) => <option key={o} value={o}>{t(`market.sorts.${o}`)}</option>)}
        </select>
        <Button type="submit">{t('common.apply')}</Button>
      </form>

      {sponsored.length > 0 && !s.q && (
        <section aria-label={t('common.sponsored')} className="mb-10">
          <p className="eyebrow mb-3">{t('common.sponsored')}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {sponsored.flatMap((a) => (a.product ? [<ProductCardView key={a.id} product={a.product} sponsored />] : []))}
          </div>
        </section>
      )}

      <p className="mb-4 text-sm text-muted" aria-live="polite">{t('market.resultCount', { count: results.total, formatted: number(results.total, locale) })}</p>
      {results.items.length === 0 ? (
        <EmptyState title={t('market.emptyTitle')} description={t('market.emptyBody')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.items.map((p) => <ProductCardView key={p.id} product={p} />)}
        </div>
      )}
      <Pagination page={results.page} pages={results.pages} hrefFor={hrefFor} labels={{ previous: t('common.previous'), next: t('common.next'), page: t('common.pagination') }} />
    </div>
  );
}
