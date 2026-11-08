'use client';

import { toast, useErrorMessage } from '@/components/ui/client';
import { Button, LinkButton, cx } from '@/components/ui/primitives';
import { useRouter } from '@/i18n/navigation';
import { clientApi } from '@/lib/client';
import { money } from '@/lib/format';
import type { Variant } from '@/lib/types';
import { Heart, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

type Props = {
  product: { id: string; slug: string; currency: string; wishlisted: boolean; ownedEntitlementId: string | null; isOwnProduct: boolean; variants: Variant[] };
  signedIn: boolean; loginHref: string; refCode?: string;
};

export function BuyBox({ product: p, signedIn, loginHref, refCode }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [variant, setVariant] = useState(p.variants[0]?.id);
  const [wish, setWish] = useState(p.wishlisted);
  const [busy, setBusy] = useState(false);
  const current = p.variants.find((v) => v.id === variant);

  // An affiliate visit is remembered for this browser session only.
  useEffect(() => {
    if (!refCode) return;
    try { sessionStorage.setItem('faith-ref', refCode); } catch { /* storage may be unavailable */ }
    void clientApi(`/affiliates/${encodeURIComponent(refCode)}/click`, { body: {} }).catch(() => {});
  }, [refCode]);

  async function add() {
    setBusy(true);
    try {
      await clientApi('/cart/items', { body: { variantId: variant, quantity: 1 } });
      router.push('/cart');
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(false);
    }
  }
  async function toggleWish() {
    const next = !wish;
    setWish(next);
    try {
      await clientApi(`/wishlist/${p.id}`, { method: next ? 'PUT' : 'DELETE' });
    } catch (e) {
      setWish(!next);
      toast.error(errorMessage(e));
    }
  }

  return (
    <div className="mt-5">
      {p.variants.length > 1 && (
        <fieldset className="mb-4 space-y-1.5">
          <legend className="sr-only">{t('market.chooseVariant')}</legend>
          {p.variants.map((v) => (
            <label key={v.id} className={cx('flex cursor-pointer items-center justify-between gap-3 rounded-md border p-3 text-sm', v.id === variant ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong')}>
              <span className="flex items-center gap-2.5">
                <input type="radio" name="variant" checked={v.id === variant} onChange={() => setVariant(v.id)} className="accent-[var(--accent)]" />{v.name}
              </span>
              <span className="font-medium tabular-nums">{money(v.priceMinor, p.currency, locale)}</span>
            </label>
          ))}
        </fieldset>
      )}
      {current && <p data-testid="product-price" className="font-display text-3xl font-semibold tabular-nums">{money(current.priceMinor, p.currency, locale)}</p>}
      <div className="mt-4 flex gap-2">
        {p.ownedEntitlementId ? (
          <LinkButton href="/app/library" size="lg" className="flex-1">{t('market.openLibrary')}</LinkButton>
        ) : p.isOwnProduct ? (
          <p className="flex-1 rounded-md bg-surface-2 px-3 py-3 text-center text-sm text-muted">{t('market.ownProduct')}</p>
        ) : signedIn ? (
          <Button size="lg" className="flex-1" disabled={busy || !current} data-testid="add-to-cart" onClick={add}>{busy && <Loader2 size={15} className="animate-spin" />}{t('market.addToCart')}</Button>
        ) : (
          <LinkButton href={loginHref} size="lg" className="flex-1">{t('market.loginToBuy')}</LinkButton>
        )}
        {signedIn && (
          <Button size="lg" variant="secondary" aria-label={wish ? t('market.removeWishlist') : t('market.addWishlist')} aria-pressed={wish} onClick={toggleWish} className="px-3.5">
            <Heart size={17} className={cx(wish && 'fill-current text-negative')} />
          </Button>
        )}
      </div>
    </div>
  );
}
