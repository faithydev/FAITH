'use client';

import { useRouter } from '@/i18n/navigation';
import { clientApi } from '@/lib/client';
import { localeTag } from '@/lib/format';
import { CURRENCY_REGIONS, convertMinor, formatMoney } from '@faith/money';
import { Check } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { DropdownMenu } from 'radix-ui';
import { createContext, useContext, useMemo, useState, useTransition, type ReactNode } from 'react';
import { cx } from '../ui/primitives';

type Ctx = { display: string; rates: Record<string, string>; asOf: string | null };
const CurrencyContext = createContext<Ctx>({ display: 'USD', rates: {}, asOf: null });

/** Holds the visitor's currency and the official rates for everything rendered below it. */
export function CurrencyProvider({ display, rates, asOf, children }: Ctx & { children: ReactNode }) {
  const value = useMemo(() => ({ display, rates, asOf }), [display, rates, asOf]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

/** The amount in the visitor's own currency, or null when it is the same currency or no rate exists. */
export function useApprox() {
  const { display, rates } = useContext(CurrencyContext);
  const locale = useLocale();
  const table = useMemo(() => new Map(Object.entries(rates).map(([k, v]) => [k, BigInt(v)])), [rates]);
  return (minor: string | bigint | null | undefined, currency: string): string | null => {
    if (minor === null || minor === undefined || currency === display) return null;
    try {
      const out = convertMinor(typeof minor === 'string' ? BigInt(minor) : minor, currency, display, table);
      return out === null ? null : formatMoney(out, display, localeTag(locale));
    } catch {
      return null;
    }
  };
}

/**
 * "≈ 630 000 soʻm" beside a price. The price itself stays in the currency that is charged; this
 * line is the same amount at the official rate, for reading only. Renders nothing when it has
 * nothing true to say.
 */
export function Approx({ minor, currency, className }: { minor: string | bigint | null | undefined; currency: string; className?: string }) {
  const approx = useApprox();
  const text = approx(minor, currency);
  if (!text) return null;
  return <span data-testid="approx" className={cx('block text-xs font-normal tabular-nums text-subtle', className)}>≈ {text}</span>;
}

/**
 * Says plainly which currency a payment is taken in, shown only to someone reading prices in
 * another currency. The local amount is a guide at the official rate, not what a bank will charge.
 */
export function ChargeNote({ currencies }: { currencies: string[] }) {
  const t = useTranslations();
  const { display, asOf } = useContext(CurrencyContext);
  const charged = [...new Set(currencies)].filter((c) => c !== display);
  if (charged.length === 0) return null;
  return (
    <p data-testid="charge-note" className="mt-3 rounded-lg border border-line bg-[color-mix(in_srgb,var(--text)_3%,transparent)] p-2.5 text-xs text-muted">
      {t('currency.chargeNote', { charged: charged.join(', '), display })}{asOf ? ` ${t('currency.rateDate', { date: asOf })}` : ''}
    </p>
  );
}

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Lets anyone, signed in or not, read prices in their own currency. */
export function CurrencySwitcher({ persist, className }: { persist?: boolean; className?: string }) {
  const t = useTranslations();
  const router = useRouter();
  const { display, rates } = useContext(CurrencyContext);
  const [query, setQuery] = useState('');
  const [, start] = useTransition();
  const locale = useLocale();
  const names = useMemo(() => {
    try {
      return new Intl.DisplayNames([localeTag(locale)], { type: 'currency' });
    } catch {
      return null;
    }
  }, [locale]);
  const label = (code: string) => names?.of(code) ?? code;
  const q = query.trim().toLowerCase();

  const pick = (code: string) => {
    document.cookie = `faith_currency=${code}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
    if (persist) void clientApi('/me/preferences', { method: 'PATCH', body: { currency: code } }).catch(() => {});
    start(() => router.refresh());
  };

  return (
    <DropdownMenu.Root modal={false} onOpenChange={(open) => { if (!open) setQuery(''); }}>
      <DropdownMenu.Trigger aria-label={t('currency.choose')} data-testid="currency-switcher" className={cx('flex h-9 items-center rounded-md px-2 text-[0.8125rem] font-medium tabular-nums text-muted transition-colors hover:bg-surface-2 hover:text-ink', className)}>
        {display}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className="glass z-50 max-h-[min(26rem,70svh)] w-64 overflow-y-auto rounded-2xl p-1.5 text-sm shadow-xl">
          <input
            value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder={t('currency.search')} aria-label={t('currency.search')}
            className="fx-input mb-1.5 min-h-9 py-1.5 text-[0.8125rem]"
          />
          {CURRENCY_REGIONS.map((r) => {
            // A currency with no official rate cannot be shown honestly, so it is not offered.
            const codes = r.codes.filter((c) => rates[c] && (!q || c.toLowerCase().includes(q) || label(c).toLowerCase().includes(q)));
            if (codes.length === 0) return null;
            return (
              <DropdownMenu.Group key={r.region}>
                <DropdownMenu.Label className="px-2 pt-2 pb-1 font-mono text-[0.62rem] tracking-[0.14em] text-subtle uppercase">{t(`currency.regions.${r.region}`)}</DropdownMenu.Label>
                {codes.map((c) => (
                  <DropdownMenu.Item key={c} onSelect={() => pick(c)} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 outline-none data-[highlighted]:bg-[color-mix(in_srgb,var(--neon)_11%,transparent)]">
                    <span className="w-4 text-neon">{c === display && <Check size={14} />}</span>
                    <span className="w-9 font-mono text-xs">{c}</span>
                    <span className="min-w-0 flex-1 truncate text-muted">{label(c)}</span>
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Group>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
