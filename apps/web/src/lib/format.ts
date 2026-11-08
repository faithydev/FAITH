import { LOCALE_TAGS, Locale } from '@faith/config';
import { formatMoney } from '@faith/money';

export const localeTag = (locale: string) => LOCALE_TAGS[locale as Locale] ?? 'en-US';

export function money(minor: string | bigint | null | undefined, currency: string, locale: string): string {
  if (minor === null || minor === undefined) return '—';
  return formatMoney(minor, currency, localeTag(locale));
}

/** "155.2K" or "155,2 ming": a short, rounded count for tight places such as a chart's centre. */
export function numberCompact(value: number, locale: string): string {
  return new Intl.NumberFormat(localeTag(locale), { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function number(value: number | string | bigint, locale: string): string {
  return new Intl.NumberFormat(localeTag(locale)).format(typeof value === 'string' ? Number(value) : value);
}

export function date(value: string | Date | null | undefined, locale: string, opts?: Intl.DateTimeFormatOptions): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(localeTag(locale), opts ?? { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Tashkent' }).format(new Date(value));
}

export const percent = (bps: number, locale: string) =>
  new Intl.NumberFormat(localeTag(locale), { style: 'percent', maximumFractionDigits: 1 }).format(bps / 10_000);

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const rating = (sum: number, count: number) => (count ? (sum / count).toFixed(1) : null);
export const fileUrl = (key: string) => `/api/v1/files/${key}`;
