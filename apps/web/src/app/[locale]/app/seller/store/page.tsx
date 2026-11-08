import { ImageSlot } from '@/components/commerce/image-slot';
import { CreateStore, NoRole } from '@/components/seller/shared';
import { ActionButton, AutoForm, FormDialog } from '@/components/ui/client';
import { Badge, Card, LinkButton, PageHeader, SectionTitle } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { activeStore, pageContext } from '@/lib/page';

type Discount = { id: string; code: string; kind: string; value: string; redemptions: number; active: boolean };
type License = { id: string; name: string; storeId: string | null };

export default async function StoreSettingsPage() {
  const { t, me } = await pageContext();
  if (!me.permissions.includes('store.manage')) return <NoRole persona="sell" />;
  const { store } = await activeStore();
  if (!store) return <CreateStore />;
  const [discounts, licenses] = await Promise.all([
    api<Discount[]>(`/seller/stores/${store.id}/discounts`), api<License[]>(`/seller/stores/${store.id}/licenses`),
  ]);
  return (
    <>
      <PageHeader title={t('nav.items.store')} actions={<LinkButton variant="secondary" size="sm" href={`/stores/${store.slug}`}>{t('app.seller.viewStore')}</LinkButton>} />
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card className="p-5 lg:col-span-2">
          <SectionTitle title={t('app.seller.storeImages')} />
          <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
            <ImageSlot endpoint={`/seller/stores/${store.id}/images/logo`} current={store.logoKey ?? null} label={t('app.seller.logo')} upload={t('app.seller.uploadImage')} remove={t('common.remove')} />
            <ImageSlot endpoint={`/seller/stores/${store.id}/images/banner`} current={store.bannerKey ?? null} label={t('app.seller.banner')} upload={t('app.seller.uploadImage')} remove={t('common.remove')} shape="wide" />
          </div>
        </Card>
        <Card className="p-5">
          <SectionTitle title={t('app.seller.branding')} />
          <AutoForm
            endpoint={`/seller/stores/${store.id}`} method="PATCH" submitLabel={t('common.save')} success={t('common.saved')}
            fields={[
              { name: 'name', label: t('app.seller.storeName'), required: true, defaultValue: store.name },
              { name: 'tagline', label: t('app.seller.tagline'), defaultValue: store.tagline ?? '' },
              { name: 'description', label: t('app.seller.description'), type: 'textarea', defaultValue: store.description ?? '' },
              { name: 'country', label: t('app.settings.country'), defaultValue: store.country ?? '' },
            ]}
          />
        </Card>
        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle title={t('app.seller.discounts')} action={
              <FormDialog
                trigger={t('common.add')} title={t('app.seller.newDiscount')} endpoint={`/seller/stores/${store.id}/discounts`} submitLabel={t('common.create')} success={t('common.saved')} triggerVariant="secondary"
                extra={{ kind: 'PERCENT' }}
                fields={[
                  { name: 'code', label: t('app.seller.discountCode'), required: true },
                  { name: 'value', label: t('app.seller.discountBps'), hint: t('app.seller.discountBpsHint'), required: true, type: 'text' },
                ]}
              />
            } />
            {discounts.length === 0 ? <p className="text-sm text-muted">{t('app.seller.noDiscounts')}</p> : (
              <ul className="divide-y divide-line text-sm">
                {discounts.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="font-mono">{x.code}</span>
                    <span className="flex items-center gap-2 text-xs text-muted">{t('app.seller.redemptions', { count: x.redemptions })}
                      <ActionButton endpoint={`/seller/stores/${store.id}/discounts/${x.id}`} method="PATCH" body={{ active: !x.active }} label={x.active ? t('common.on') : t('common.off')} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-5">
            <SectionTitle title={t('app.seller.licenses')} action={
              <FormDialog
                trigger={t('common.add')} title={t('app.seller.newLicense')} endpoint={`/seller/stores/${store.id}/licenses`} submitLabel={t('common.create')} success={t('common.saved')} triggerVariant="secondary"
                fields={[
                  { name: 'name', label: t('app.seller.licenseName'), required: true },
                  { name: 'terms', label: t('app.seller.licenseTerms'), type: 'textarea', required: true, minLength: 10 },
                  { name: 'commercialUse', label: t('market.commercialUse'), type: 'checkbox' },
                ]}
              />
            } />
            <div className="flex flex-wrap gap-1.5">{licenses.map((l) => <Badge key={l.id}>{l.name}</Badge>)}</div>
          </Card>
        </div>
      </div>
    </>
  );
}
