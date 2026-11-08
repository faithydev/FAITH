import 'server-only';
import { getLocale, getTranslations } from 'next-intl/server';
import { api, getMe } from './api';
import { date, money } from './format';
import type { Me, Store } from './types';

/** Everything a page in the signed-in app usually needs. The layout already guarantees `me`. */
export async function pageContext() {
  const [t, locale, me] = await Promise.all([getTranslations(), getLocale(), getMe()]);
  return {
    t, locale, me: me as Me,
    m: (minor: string | bigint | null | undefined, currency: string) => money(minor, currency, locale),
    d: (value: string | Date | null | undefined) => date(value, locale),
    status: (s: string) => (t.has(`status.${s}`) ? t(`status.${s}`) : s),
  };
}

/** The store a seller page is about: the requested one, else their first. */
export async function activeStore(requested?: string): Promise<{ store: Store | null; stores: Store[] }> {
  const stores = await api<Store[]>('/seller/stores');
  return { stores, store: stores.find((s) => s.id === requested) ?? stores[0] ?? null };
}
