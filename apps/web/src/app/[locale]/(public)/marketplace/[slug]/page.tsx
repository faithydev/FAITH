import { IntlScope } from '@/components/auth/scope';
import { BuyBox } from '@/components/commerce/buy-box';
import { Gallery } from '@/components/commerce/gallery';
import { Cover } from '@/components/ui/cover';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import { Badge, Breadcrumbs, Card, SectionTitle } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { api, getMe, publicApi } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { date, fileUrl, rating } from '@/lib/format';
import type { ProductDetail } from '@/lib/types';
import { BadgeCheck, Star } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { notFound } from 'next/navigation';

async function load(slug: string, signedIn: boolean) {
  try {
    return await (signedIn ? api<ProductDetail>(`/marketplace/products/${slug}`) : publicApi<ProductDetail>(`/marketplace/products/${slug}`, 15));
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}

export default async function ProductPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ ref?: string }> }) {
  const [{ slug }, { ref }, t, locale, me] = await Promise.all([params, searchParams, getTranslations(), getLocale(), getMe()]);
  const p = await load(slug, !!me);
  const score = rating(p.ratingSum, p.ratingCount);
  const files = p.assets.filter((a) => a.kind === 'FILE');

  // The cover first, then the other preview images in the seller's order.
  const gallery = [...new Set([p.coverKey, ...p.assets.filter((a) => a.kind === 'IMAGE' && a.storageKey?.startsWith('public/')).map((a) => a.storageKey!)].filter((k): k is string => !!k))];
  return (
    <div className="mx-auto max-w-[92rem] px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs label={t('common.breadcrumbs')} items={[{ label: t('market.title'), href: '/marketplace' }, { label: p.title }]} />
      <div className="grid gap-8 lg:grid-cols-[1fr_24rem] lg:items-start">
        <div className="min-w-0">
          {gallery.length > 1 ? <Gallery images={gallery} title={p.title} /> : (
            <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-surface-2">
              {p.coverKey ? <Image src={fileUrl(p.coverKey)} alt={p.title} fill unoptimized className="object-cover" sizes="(max-width: 1024px) 100vw, 60vw" priority /> : <Cover seed={p.slug} label={p.title} />}
            </div>
          )}
          <section className="mt-8">
            <SectionTitle title={t('market.about')} />
            <div className="prose-faith text-[0.95rem] text-muted">
              {p.description.split('\n\n').map((para) => <p key={para}>{para}</p>)}
            </div>
            {p.tags.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{p.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}</div>}
          </section>

          {p.license && (
            <section className="mt-10">
              <SectionTitle title={t('market.license')} />
              <Card className="p-5">
                <p className="font-medium">{p.license.name}</p>
                <p className="mt-1.5 text-sm text-muted">{p.license.terms}</p>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                  <div><dt className="text-subtle">{t('market.commercialUse')}</dt><dd className="font-medium">{p.license.commercialUse ? t('common.yes') : t('common.no')}</dd></div>
                  <div><dt className="text-subtle">{t('market.seats')}</dt><dd className="font-medium">{p.license.seats}</dd></div>
                  <div><dt className="text-subtle">{t('market.territory')}</dt><dd className="font-medium">{p.license.territory}</dd></div>
                </dl>
              </Card>
            </section>
          )}

          {p.versions.length > 0 && (
            <section className="mt-10">
              <SectionTitle title={t('market.versions')} />
              <ul className="space-y-2 text-sm">
                {p.versions.map((v) => (
                  <li key={v.version} className="flex items-baseline gap-3"><span className="font-mono">{v.version}</span><span className="text-muted">{v.changelog}</span><span className="ms-auto text-xs text-subtle">{date(v.createdAt, locale)}</span></li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-10">
            <SectionTitle title={t('market.reviews')} />
            {p.reviews.length === 0 ? <p className="text-sm text-muted">{t('market.noReviews')}</p> : (
              <ul className="space-y-3">
                {p.reviews.map((r) => (
                  <li key={r.id} className="card p-4">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{r.user.profile?.displayName}</span>
                      <span className="flex items-center gap-1 text-xs text-muted" aria-label={t('market.ratingLabel', { rating: r.rating })}><Star size={12} className="fill-current" />{r.rating}</span>
                    </div>
                    <p className="mt-1.5 text-sm text-muted">{r.body}</p>
                    <p className="mt-2 flex items-center gap-1 text-xs text-subtle"><BadgeCheck size={13} />{t('market.verifiedPurchase')}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-20">
          <Card className="p-5 sm:p-6">
            <p className="flex items-center gap-1.5 text-sm text-muted"><Link href={`/stores/${p.store.slug}`} className="hover:text-ink">{p.store.name}</Link>{p.store.badge && <VerifiedBadge kind={p.store.badge} label={`${t('badges.verified')} · ${t(`badges.kinds.${p.store.badge}`)}`} size={18} />}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{p.title}</h1>
            <p className="mt-2 text-sm text-muted">{p.summary}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
              <Badge>{t(`productTypes.${p.type}`)}</Badge>
              {score && <span className="flex items-center gap-1"><Star size={12} className="fill-current" />{score} ({p.ratingCount})</span>}
            </div>
            <IntlScope ns={['market']}>
              <BuyBox product={{ id: p.id, slug: p.slug, currency: p.currency, wishlisted: p.wishlisted, ownedEntitlementId: p.ownedEntitlementId, isOwnProduct: p.isOwnProduct, variants: p.variants }} signedIn={!!me} refCode={ref} loginHref={`/login?next=${encodeURIComponent(`/marketplace/${p.slug}`)}`} />
            </IntlScope>
            {files.length > 0 && <p className="mt-4 text-xs text-subtle">{t('market.filesIncluded', { count: files.length })}</p>}
          </Card>
        </aside>
      </div>
    </div>
  );
}
