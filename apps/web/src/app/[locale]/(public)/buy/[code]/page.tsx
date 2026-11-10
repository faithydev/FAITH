import { BuyNow } from '@/components/commerce/buy-link';
import { Cover } from '@/components/ui/cover';
import { LinkButton } from '@/components/ui/primitives';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import { Link } from '@/i18n/navigation';
import { getMe } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { fileUrl, money } from '@/lib/format';
import { ShieldCheck } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { notFound } from 'next/navigation';

type LinkView = {
  code: string; label: string;
  variant: { id: string; name: string; priceMinor: string; compareAtMinor: string | null };
  product: { slug: string; title: string; summary: string; type: string; currency: string; coverKey: string | null };
  store: { slug: string; name: string; logoKey: string | null; badge: string | null };
};

const BASE = process.env.INTERNAL_API_URL ?? 'http://localhost:4000';

/** Not cached: every opening of a checkout link is counted for the seller. */
async function load(code: string): Promise<LinkView> {
  const res = await fetch(`${BASE}/v1/marketplace/links/${encodeURIComponent(code)}`, { cache: 'no-store' });
  if (res.status === 404) notFound();
  if (!res.ok) throw new ApiError(res.status, 'LINK_UNAVAILABLE');
  return (await res.json()) as LinkView;
}

export const metadata = { robots: { index: false } };

/** A seller's checkout link: one plan, one button. */
export default async function BuyLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const [{ code }, t, locale] = await Promise.all([params, getTranslations(), getLocale()]);
  const [link, me] = await Promise.all([load(code), getMe()]);
  const { product: p, variant: v, store } = link;
  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:py-14">
      <div className="glass overflow-hidden rounded-[28px]" data-testid="buy-link">
        <div className="relative aspect-[16/10] bg-surface-2">
          {p.coverKey ? <Image src={fileUrl(p.coverKey)} alt={p.title} fill unoptimized priority className="object-cover" /> : <Cover seed={p.slug} label={p.title} />}
        </div>
        <div className="p-6">
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Link href={`/stores/${store.slug}`} className="hover:text-ink">{store.name}</Link>
            {store.badge && <VerifiedBadge kind={store.badge} label={`${t('badges.verified')} · ${t(`badges.kinds.${store.badge}`)}`} size={18} />}
          </p>
          <h1 className="tracking-display mt-1.5 text-2xl font-semibold">{p.title}</h1>
          <p className="mt-2 text-sm text-muted">{p.summary}</p>
          <div className="mt-5 flex items-end justify-between gap-3 border-t border-line pt-5">
            <span className="text-sm text-muted">{v.name}</span>
            <span className="text-end">
              {v.compareAtMinor && <span className="block text-xs text-subtle line-through">{money(v.compareAtMinor, p.currency, locale)}</span>}
              <span className="font-display text-3xl font-semibold tabular-nums">{money(v.priceMinor, p.currency, locale)}</span>
            </span>
          </div>
          <div className="mt-5">
            {me
              ? <BuyNow variantId={v.id} label={t('buyLink.buy')} />
              : <LinkButton href={`/login?next=/buy/${link.code}`} variant="primary" size="lg" arrow className="w-full">{t('buyLink.signInToBuy')}</LinkButton>}
          </div>
          {!me && <p className="mt-3 text-center text-xs text-muted">{t('buyLink.newHere')} <Link href="/register" className="text-ink underline-offset-4 hover:underline">{t('auth.signUp')}</Link></p>}
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-subtle"><ShieldCheck size={13} />{t('buyLink.secure')}</p>
        </div>
      </div>
      <p className="mt-5 text-center text-xs text-subtle"><Link href={`/marketplace/${p.slug}`} className="hover:text-ink">{t('buyLink.details')}</Link></p>
    </div>
  );
}
