import { FileUploader } from '@/components/commerce/file-uploader';
import { ActionButton, AutoForm, FormDialog } from '@/components/ui/client';
import { Breadcrumbs, Card, LinkButton, PageHeader, SectionTitle, StatusBadge } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { fileSize, fileUrl } from '@/lib/format';
import Image from 'next/image';
import { pageContext } from '@/lib/page';
import type { SellerProduct } from '@/lib/types';
import { notFound } from 'next/navigation';

type Detail = SellerProduct & {
  versions: { id: string; version: string; changelog: string | null }[];
  revenueShares: { id: string; role: string; bps: number; participant: { profile: { displayName: string } | null } }[];
};

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { t, m, status }] = await Promise.all([params, pageContext()]);
  const p = await api<Detail>(`/seller/products/${id}`).catch((e: unknown) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const files = p.assets.filter((a) => a.kind === 'FILE');
  const images = p.assets.filter((a) => a.kind === 'IMAGE' && a.storageKey?.startsWith('public/'));
  return (
    <>
      <Breadcrumbs label={t('common.breadcrumbs')} items={[{ label: t('nav.items.products'), href: '/app/seller/products' }, { label: p.title }]} />
      <PageHeader
        title={p.title}
        actions={
          <>
            <span data-testid="product-status"><StatusBadge status={p.status} label={status(p.status)} /></span>
            {p.status === 'PUBLISHED' && <LinkButton href={`/marketplace/${p.slug}`} size="sm" variant="secondary">{t('app.seller.viewListing')}</LinkButton>}
            {p.status === 'PUBLISHED'
              ? <ActionButton endpoint={`/seller/products/${p.id}/archive`} label={t('app.seller.archive')} confirm={{ title: t('app.seller.archiveConfirm'), danger: true }} />
              : <ActionButton endpoint={`/seller/products/${p.id}/publish`} label={t('app.seller.publish')} variant="primary" success={t('app.seller.published')} />}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <Card className="p-5">
          <SectionTitle title={t('app.seller.details')} />
          <AutoForm
            endpoint={`/seller/products/${p.id}`} method="PATCH" submitLabel={t('common.save')} success={t('common.saved')}
            fields={[
              { name: 'title', label: t('app.seller.productTitle'), required: true, defaultValue: p.title },
              { name: 'summary', label: t('app.seller.summary'), type: 'textarea', rows: 2, required: true, defaultValue: p.summary },
              { name: 'description', label: t('app.seller.description'), type: 'textarea', rows: 7, required: true, defaultValue: p.description },
              { name: 'tags', label: t('app.seller.tags'), type: 'tags', hint: t('app.seller.tagsHint'), defaultValue: p.tags.join(', ') },
              { name: 'affiliateBps', label: t('app.seller.affiliateBps'), type: 'number', min: 1, max: 5000, hint: t('app.seller.affiliateHint'), defaultValue: p.affiliateBps ?? '' },
            ]}
          />
        </Card>
        <Card className="p-5 lg:col-start-1">
          <SectionTitle title={t('app.seller.imagesTitle')} />
          {images.length === 0 ? <p className="mb-3 text-sm text-muted">{t('app.seller.noImages')}</p> : (
            <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((img) => {
                const isCover = img.storageKey === p.coverKey;
                return (
                  <li key={img.id} className="overflow-hidden rounded-xl border border-line">
                    <div className="relative aspect-[16/10] bg-surface-2">
                      <Image src={fileUrl(img.storageKey!)} alt={img.filename} fill unoptimized className="object-cover" />
                      {isCover && <span className="absolute start-2 top-2 rounded-full bg-neon px-2 py-0.5 text-[0.65rem] font-semibold text-black">{t('app.seller.cover')}</span>}
                    </div>
                    <div className="flex items-center justify-between gap-1 p-1.5">
                      {!isCover ? <ActionButton endpoint={`/seller/products/${p.id}/cover`} method="PUT" body={{ assetId: img.id }} label={t('app.seller.makeCover')} variant="ghost" /> : <span />}
                      <ActionButton endpoint={`/seller/products/${p.id}/assets/${img.id}`} method="DELETE" label={t('common.remove')} variant="ghost" />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <FileUploader productId={p.id} accept="image/png,image/jpeg,image/webp,image/gif" multiple label={t('app.seller.uploadImages')} hint={t('app.seller.imagesHint')} />
        </Card>
        <div className="space-y-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <Card className="p-5">
            <SectionTitle title={t('app.seller.pricing')} />
            <ul className="space-y-1.5 text-sm">
              {p.variants.filter((v) => v.active).map((v) => <li key={v.id} className="flex justify-between gap-3"><span>{v.name}</span><span className="font-medium tabular-nums">{m(v.priceMinor, p.currency)}</span></li>)}
            </ul>
          </Card>
          <Card className="p-5">
            <SectionTitle title={t('app.seller.files')} />
            {files.length > 0 && (
              <ul className="mb-3 divide-y divide-line text-sm">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="min-w-0 truncate">{f.filename} <span className="text-xs text-subtle">{fileSize(f.sizeBytes)}</span></span>
                    <ActionButton endpoint={`/seller/products/${p.id}/assets/${f.id}`} method="DELETE" label={t('common.remove')} variant="ghost" />
                  </li>
                ))}
              </ul>
            )}
            <FileUploader productId={p.id} label={t('app.seller.uploadFile')} hint={t('app.seller.uploadHint')} />
          </Card>
          <Card className="p-5">
            <SectionTitle title={t('app.seller.collaborators')} action={
              <FormDialog
                trigger={t('common.add')} title={t('app.seller.addCollaborator')} description={t('app.seller.collaboratorBody')} triggerVariant="secondary"
                endpoint={`/seller/products/${p.id}/revenue-shares`} submitLabel={t('common.add')} success={t('common.saved')}
                fields={[
                  { name: 'participantEmail', label: t('auth.email'), type: 'email', required: true },
                  { name: 'role', label: t('app.seller.collaboratorRole'), type: 'select', required: true, defaultValue: 'COLLABORATOR', options: ['COLLABORATOR', 'CONTENT_CREATOR', 'AFFILIATE', 'OTHER'].map((r) => ({ value: r, label: t(`app.seller.shareRoles.${r}`) })) },
                  { name: 'bps', label: t('app.seller.shareBps'), type: 'number', required: true, min: 1, max: 10000, hint: t('app.seller.shareBpsHint') },
                ]}
              />
            } />
            {p.revenueShares.length === 0 ? <p className="text-sm text-muted">{t('app.seller.noCollaborators')}</p> : (
              <ul className="space-y-1.5 text-sm">
                {p.revenueShares.map((s) => <li key={s.id} className="flex justify-between gap-3"><span>{s.participant.profile?.displayName}</span><span className="tabular-nums">{s.bps / 100}%</span></li>)}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
