import { CreateStore, NoRole } from '@/components/seller/shared';
import { ActionButton, FormDialog } from '@/components/ui/client';
import { Card, DataTable, EmptyState, PageHeader, SectionTitle, StatusBadge } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { activeStore, pageContext } from '@/lib/page';
import type { SellerProduct } from '@/lib/types';

type Ad = { id: string; title: string; placement: string; status: string; budgetMinor: string; currency: string; impressions: number; clicks: number };
type Link = { id: string; code: string; clicks: number; commissionBps: number; product: { title: string; slug: string }; _count: { conversions: number } };

const PLACEMENTS = ['MARKETPLACE_TOP', 'PROMOTED_LISTING', 'SPONSORED_COLLECTION'];

export default async function GrowthPage() {
  const { t, m, status, me } = await pageContext();
  if (!me.permissions.includes('store.manage')) return <NoRole persona="sell" />;
  const { store } = await activeStore();
  if (!store) return <CreateStore />;
  const [ads, links, products] = await Promise.all([
    api<Ad[]>('/ads'), api<Link[]>('/affiliates'), api<SellerProduct[]>(`/seller/stores/${store.id}/products`),
  ]);
  const published = products.filter((p) => p.status === 'PUBLISHED');
  return (
    <>
      <PageHeader
        title={t('nav.items.growth')} description={t('app.growth.body')}
        actions={
          <FormDialog
            trigger={t('app.growth.newAd')} title={t('app.growth.newAd')} description={t('app.growth.adNote')} endpoint="/ads" submitLabel={t('common.create')} success={t('common.saved')}
            extra={{ currency: store.currency }}
            fields={[
              { name: 'title', label: t('app.growth.adTitle'), required: true },
              { name: 'placement', label: t('app.growth.placement'), type: 'select', required: true, defaultValue: PLACEMENTS[0], options: PLACEMENTS.map((p) => ({ value: p, label: t(`app.growth.placements.${p}`) })) },
              { name: 'productId', label: t('app.seller.product'), type: 'select', options: published.map((p) => ({ value: p.id, label: p.title })) },
              { name: 'budgetMinor', label: t('app.growth.budget'), type: 'money', currency: store.currency, required: true },
            ]}
          />
        }
      />
      <section>
        <SectionTitle title={t('app.growth.ads')} />
        {ads.length === 0 ? <EmptyState title={t('app.growth.noAds')} /> : (
          <DataTable
            caption={t('app.growth.ads')} rows={ads} rowKey={(a) => a.id}
            columns={[
              { header: t('app.growth.adTitle'), cell: (a) => a.title },
              { header: t('app.orders.status'), cell: (a) => <StatusBadge status={a.status} label={status(a.status)} /> },
              { header: t('app.growth.budget'), align: 'end', cell: (a) => <span className="tabular-nums">{m(a.budgetMinor, a.currency)}</span> },
              { header: t('app.growth.impressions'), align: 'end', cell: (a) => a.impressions },
              { header: t('app.growth.clicks'), align: 'end', cell: (a) => a.clicks },
              { header: '', align: 'end', cell: (a) => a.status === 'DRAFT' && <ActionButton endpoint={`/ads/${a.id}/fund`} idempotent followPayment label={t('app.growth.fund')} variant="primary" /> },
            ]}
          />
        )}
      </section>
      <section className="mt-10">
        <SectionTitle title={t('app.growth.affiliateLinks')} />
        {links.length === 0 ? <Card className="p-5 text-sm text-muted">{t('app.growth.noLinks')}</Card> : (
          <ul className="card divide-y divide-line">
            {links.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 p-3.5 text-sm">
                <span className="min-w-0"><span className="font-medium">{l.product.title}</span><code className="mt-0.5 block truncate text-xs text-muted">/marketplace/{l.product.slug}?ref={l.code}</code></span>
                <span className="text-xs text-muted">{t('app.growth.linkStats', { clicks: l.clicks, conversions: l._count.conversions })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
