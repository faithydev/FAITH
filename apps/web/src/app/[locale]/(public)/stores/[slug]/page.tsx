import { ProductCardView } from '@/components/commerce/product-card';
import { Cover } from '@/components/ui/cover';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import { fileUrl } from '@/lib/format';
import Image from 'next/image';
import { EmptyState } from '@/components/ui/primitives';
import { publicApi } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { number } from '@/lib/format';
import type { Paged, ProductCard } from '@/lib/types';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

type StoreView = { slug: string; name: string; tagline: string | null; description: string | null; country: string | null; productCount: number; salesCount: number; logoKey: string | null; bannerKey: string | null; badge: string | null };

export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, t, locale] = await Promise.all([params, getTranslations(), getLocale()]);
  const store = await publicApi<StoreView>(`/marketplace/stores/${slug}`).catch((e: unknown) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const products = await publicApi<Paged<ProductCard>>(`/marketplace/products?store=${slug}&pageSize=48`);
  return (
    <div>
      <div className="relative h-44 overflow-hidden bg-surface-2 sm:h-64">
        {store.bannerKey ? <Image src={fileUrl(store.bannerKey)} alt="" fill unoptimized priority className="object-cover" /> : <Cover seed={store.slug} />}
      </div>
      <div className="mx-auto max-w-[92rem] px-4 py-8 sm:px-6 lg:px-8">
        {store.logoKey && (
          <div className="relative -mt-20 mb-4 size-24 overflow-hidden rounded-2xl border-4 border-[var(--bg)] bg-surface-2 shadow-xl sm:-mt-24 sm:size-28">
            <Image src={fileUrl(store.logoKey)} alt={store.name} fill unoptimized className="object-cover" />
          </div>
        )}
        <h1 className="tracking-display flex items-center gap-3 text-4xl font-semibold">{store.name}{store.badge && <VerifiedBadge kind={store.badge} label={`${t('badges.verified')} · ${t(`badges.kinds.${store.badge}`)}`} size={36} />}</h1>
        {store.tagline && <p className="mt-2 text-lg text-muted">{store.tagline}</p>}
        {store.description && <p className="mt-3 max-w-2xl text-sm text-muted">{store.description}</p>}
        <p className="mt-4 text-sm text-subtle">{t('market.storeStats', { products: number(store.productCount, locale), sales: number(store.salesCount, locale) })}</p>
        <div className="mt-8">
          {products.items.length === 0 ? <EmptyState title={t('market.storeEmpty')} /> : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{products.items.map((p) => <ProductCardView key={p.id} product={p} />)}</div>
          )}
        </div>
      </div>
    </div>
  );
}
