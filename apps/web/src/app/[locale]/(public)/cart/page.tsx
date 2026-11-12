import { Approx } from '@/components/money/currency';
import { IntlScope } from '@/components/auth/scope';
import { CheckoutSummary } from '@/components/commerce/checkout-summary';
import { ActionButton } from '@/components/ui/client';
import { Cover } from '@/components/ui/cover';
import { EmptyState, LinkButton } from '@/components/ui/primitives';
import { Link, redirect } from '@/i18n/navigation';
import { api, getMe } from '@/lib/api';
import { money } from '@/lib/format';
import type { CartView } from '@/lib/types';
import { getLocale, getTranslations } from 'next-intl/server';

export default async function CartPage() {
  const [t, locale, me] = await Promise.all([getTranslations(), getLocale(), getMe()]);
  if (!me) return redirect({ href: '/login?next=/cart', locale });
  const cart = await api<CartView>('/cart');
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="tracking-display mb-7 text-3xl font-semibold">{t('cart.title')}</h1>
      {cart.items.length === 0 ? (
        <EmptyState title={t('cart.emptyTitle')} description={t('cart.emptyBody')} action={<LinkButton href="/marketplace">{t('cart.browse')}</LinkButton>} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_21rem] lg:items-start">
          <ul className="space-y-2.5">
            {cart.items.map((i) => (
              <li key={i.id} className="card flex items-center gap-3 p-3" data-testid="cart-item">
                <div className="h-14 w-20 shrink-0 overflow-hidden rounded-sm"><Cover seed={i.product.slug} /></div>
                <div className="min-w-0 flex-1">
                  <Link href={`/marketplace/${i.product.slug}`} className="block truncate text-sm font-medium hover:underline">{i.product.title}</Link>
                  <p className="truncate text-xs text-muted">{i.product.store.name} · {i.variantName}{i.quantity > 1 ? ` × ${i.quantity}` : ''}</p>
                  {!i.available && <p className="text-xs text-negative">{t('cart.unavailable')}</p>}
                </div>
                <span className="text-end text-sm font-semibold tabular-nums">{money(BigInt(i.unitPriceMinor) * BigInt(i.quantity), i.product.currency, locale)}<Approx minor={(BigInt(i.unitPriceMinor) * BigInt(i.quantity)).toString()} currency={i.product.currency} /></span>
                <ActionButton endpoint={`/cart/items/${i.id}`} method="DELETE" label={t('common.remove')} variant="ghost" />
              </li>
            ))}
          </ul>
          <IntlScope ns={['cart']}><CheckoutSummary totals={cart.totals} /></IntlScope>
        </div>
      )}
    </div>
  );
}
