import { CreateStore, NoRole } from '@/components/seller/shared';
import { DataTable, EmptyState, LinkButton, PageHeader, StatusBadge } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { activeStore, pageContext } from '@/lib/page';
import type { SellerProduct } from '@/lib/types';

export default async function SellerProductsPage() {
  const { t, m, status, me } = await pageContext();
  if (!me.permissions.includes('product.manage')) return <NoRole persona="sell" />;
  const { store } = await activeStore();
  if (!store) return <CreateStore />;
  const products = await api<SellerProduct[]>(`/seller/stores/${store.id}/products`);
  const cta = <LinkButton href="/app/seller/products/new" size="sm">{t('app.seller.newProduct')}</LinkButton>;
  return (
    <>
      <PageHeader title={t('nav.items.products')} actions={cta} />
      {products.length === 0 ? <EmptyState title={t('app.seller.noProductsTitle')} description={t('app.seller.noProductsBody')} action={cta} /> : (
        <DataTable
          caption={t('nav.items.products')} rows={products} rowKey={(p) => p.id}
          columns={[
            { header: t('app.seller.product'), cell: (p) => <Link href={`/app/seller/products/${p.id}`} className="font-medium hover:underline">{p.title}</Link> },
            { header: t('app.orders.status'), cell: (p) => <StatusBadge status={p.status} label={status(p.status)} /> },
            { header: t('app.seller.price'), align: 'end', cell: (p) => <span className="tabular-nums">{m(p.priceFromMinor, p.currency)}</span> },
            { header: t('app.seller.sales'), align: 'end', cell: (p) => p.salesCount },
          ]}
        />
      )}
    </>
  );
}
