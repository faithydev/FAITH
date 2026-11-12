import { isSupportedCurrency } from '@faith/money';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { getMe, tryPublicApi } from './api';

export type Rates = { base: string[]; scale: string; source: string | null; asOf: string | null; rates: Record<string, string> };

/** Official rates, refreshed on the server a few times a day; five minutes of caching is plenty. */
export const getRates = cache(async (): Promise<Rates | null> => tryPublicApi<Rates>('/rates', 300));

const EURO = ['AT', 'BE', 'BG', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES', 'ME', 'XK', 'MC', 'SM', 'VA', 'AD'];
const BY_COUNTRY: Record<string, string> = {
  UZ: 'UZS', US: 'USD', KZ: 'KZT', KG: 'KGS', TJ: 'TJS', TM: 'TMT', AF: 'AFN',
  TR: 'TRY', AZ: 'AZN', GE: 'GEL', AM: 'AMD', AE: 'AED', SA: 'SAR', QA: 'QAR', KW: 'KWD', BH: 'BHD', OM: 'OMR', JO: 'JOD', IL: 'ILS', IQ: 'IQD',
  IN: 'INR', PK: 'PKR', BD: 'BDT',
  CN: 'CNY', JP: 'JPY', KR: 'KRW', HK: 'HKD', SG: 'SGD', MY: 'MYR', TH: 'THB', VN: 'VND', ID: 'IDR', PH: 'PHP', MN: 'MNT', KH: 'KHR', LA: 'LAK', MM: 'MMK', BN: 'BND',
  GB: 'GBP', CH: 'CHF', LI: 'CHF', PL: 'PLN', CZ: 'CZK', SE: 'SEK', NO: 'NOK', DK: 'DKK', HU: 'HUF', RO: 'RON', UA: 'UAH', RU: 'RUB', BY: 'BYN', MD: 'MDL', RS: 'RSD', IS: 'ISK',
  CA: 'CAD', AU: 'AUD', NZ: 'NZD',
  ...Object.fromEntries(EURO.map((c) => [c, 'EUR'])),
};
/** A last resort when the visitor's country is unknown: the currency most readers of a language use. */
const BY_LOCALE: Record<string, string> = { uz: 'UZS', ru: 'RUB', en: 'USD', tr: 'TRY', kk: 'KZT', ar: 'AED', zh: 'CNY', es: 'EUR' };

/**
 * The currency this visitor reads prices in. An explicit choice on this device wins; then a
 * choice saved on the account; then the country the request came from; then the language.
 * The account default (the soum) is not treated as a choice, so a visitor from abroad is not
 * shown soum just because they have an account.
 */
export const getDisplayCurrency = cache(async (locale: string): Promise<string> => {
  const [jar, head, me] = await Promise.all([cookies(), headers(), getMe()]);
  const chosen = jar.get('faith_currency')?.value;
  if (chosen && isSupportedCurrency(chosen)) return chosen;
  if (me && me.currency !== 'UZS' && isSupportedCurrency(me.currency)) return me.currency;
  const country = (head.get('x-vercel-ip-country') ?? head.get('cf-ipcountry') ?? '').toUpperCase();
  const byCountry = BY_COUNTRY[country];
  if (byCountry) return byCountry;
  return BY_LOCALE[locale] ?? 'USD';
});
