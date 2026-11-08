import { ProductCardView } from '@/components/commerce/product-card';
import { EmptyState, LinkButton, PageHeader } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';
import type { ProductCard } from '@/lib/types';

export default async function WishlistPage() {
  const { t } = await pageContext();
  const items = await api<ProductCard[]>('/wishlist');
  return (
    <>
      <PageHeader title={t('app.wishlist.title')} />
      {items.length === 0 ? (
        <EmptyState title={t('app.wishlist.emptyTitle')} description={t('app.wishlist.emptyBody')} action={<LinkButton href="/marketplace">{t('cart.browse')}</LinkButton>} />
      ) : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((p) => <ProductCardView key={p.id} product={p} />)}</div>}
    </>
  );
}
