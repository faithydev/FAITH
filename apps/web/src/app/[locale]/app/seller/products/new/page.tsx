import { CreateStore, NoRole } from '@/components/seller/shared';
import { AutoForm } from '@/components/ui/client';
import { Breadcrumbs, Card, PageHeader } from '@/components/ui/primitives';
import { publicApi } from '@/lib/api';
import { activeStore, pageContext } from '@/lib/page';
import type { Category } from '@/lib/types';
import { productTypes } from '@faith/validators';

export default async function NewProductPage() {
  const { t, me, locale } = await pageContext();
  if (!me.permissions.includes('product.manage')) return <NoRole persona="sell" />;
  const { store } = await activeStore();
  if (!store) return <CreateStore />;
  const categories = await publicApi<Category[]>('/marketplace/categories', 300);
  return (
    <>
      <Breadcrumbs label={t('common.breadcrumbs')} items={[{ label: t('nav.items.products'), href: '/app/seller/products' }, { label: t('app.seller.newProduct') }]} />
      <PageHeader title={t('app.seller.newProduct')} description={t('app.seller.newProductBody')} />
      <Card className="max-w-2xl p-5">
        <AutoForm
          endpoint={`/seller/stores/${store.id}/products/quick`} columns={2} submitLabel={t('app.seller.saveDraft')} success={t('common.saved')} redirectTo="/app/seller/products/{id}"
          extra={{ currency: store.currency }}
          fields={[
            { name: 'title', label: t('app.seller.productTitle'), required: true },
            { name: 'type', label: t('market.type'), type: 'select', required: true, defaultValue: 'DIGITAL_DOWNLOAD', options: productTypes.map((p) => ({ value: p, label: t(`productTypes.${p}`) })) },
            { name: 'summary', label: t('app.seller.summary'), type: 'textarea', rows: 2, required: true },
            { name: 'description', label: t('app.seller.description'), type: 'textarea', rows: 6, required: true },
            { name: 'categoryId', label: t('market.category'), type: 'select', options: categories.map((c) => ({ value: c.id, label: c.names[locale] ?? c.names.en ?? c.slug })) },
            { name: 'tags', label: t('app.seller.tags'), type: 'tags', hint: t('app.seller.tagsHint') },
            { name: 'variantName', label: t('app.seller.variantName'), required: true, defaultValue: t('app.seller.variantDefault') },
            { name: 'priceMinor', label: t('app.seller.priceIn', { currency: store.currency }), type: 'money', currency: store.currency, required: true, placeholder: '49.00' },
          ]}
        />
      </Card>
    </>
  );
}
