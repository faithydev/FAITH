/**
 * Money maths for FAITH. Amounts are bigint minor units (cents, tiyin). No floating
 * point appears anywhere in a financial calculation.
 */

export type CurrencyCode = string;

export type CurrencyDef = {
  code: CurrencyCode;
  /** ISO-4217 exponent: how many minor digits are stored. */
  exponent: number;
  /** Fraction digits shown to people. UZS is stored in tiyin but displayed in whole soum. */
  displayDigits: number;
};

/**
 * Prices are set, charged and settled in the base currencies only. Every other currency is a
 * display currency: people see amounts converted into their own money at the official rate.
 */
export const BASE_CURRENCIES = ['UZS', 'USD'] as const;
export type BaseCurrency = (typeof BASE_CURRENCIES)[number];
export const isBaseCurrency = (code: string): code is BaseCurrency => (BASE_CURRENCIES as readonly string[]).includes(code);

/** ISO-4217 exponents that are not 2, and currencies shown without decimals. */
const EXPONENT: Record<string, number> = { JPY: 0, KRW: 0, VND: 0, ISK: 0, KWD: 3, BHD: 3, OMR: 3, JOD: 3, IQD: 3 };
const WHOLE = new Set(['UZS', 'KZT', 'AMD', 'IDR', 'IQD', 'MNT', 'KHR', 'LAK', 'MMK', 'HUF', 'RSD', 'JPY', 'KRW', 'VND', 'ISK']);

/** Display currencies by region, in the order menus show them. All are in the official rate feed. */
export const CURRENCY_REGIONS: { region: 'base' | 'centralAsia' | 'westAsia' | 'southAsia' | 'eastAsia' | 'europe' | 'other'; codes: string[] }[] = [
  { region: 'base', codes: ['UZS', 'USD'] },
  { region: 'centralAsia', codes: ['KZT', 'KGS', 'TJS', 'TMT', 'AFN'] },
  { region: 'westAsia', codes: ['TRY', 'AZN', 'GEL', 'AMD', 'AED', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR', 'JOD', 'ILS', 'IQD'] },
  { region: 'southAsia', codes: ['INR', 'PKR', 'BDT'] },
  { region: 'eastAsia', codes: ['CNY', 'JPY', 'KRW', 'HKD', 'SGD', 'MYR', 'THB', 'VND', 'IDR', 'PHP', 'MNT', 'KHR', 'LAK', 'MMK', 'BND'] },
  { region: 'europe', codes: ['EUR', 'GBP', 'CHF', 'PLN', 'CZK', 'SEK', 'NOK', 'DKK', 'HUF', 'RON', 'UAH', 'RUB', 'BYN', 'MDL', 'RSD', 'ISK'] },
  { region: 'other', codes: ['CAD', 'AUD', 'NZD'] },
];

const CURRENCIES = new Map<CurrencyCode, CurrencyDef>(
  CURRENCY_REGIONS.flatMap((r) => r.codes).map((code) => {
    const exponent = EXPONENT[code] ?? 2;
    return [code, { code, exponent, displayDigits: WHOLE.has(code) ? 0 : Math.min(exponent, 2) }];
  }),
);
export const isSupportedCurrency = (code: string): boolean => CURRENCIES.has(code);

export function registerCurrency(def: CurrencyDef): void {
  CURRENCIES.set(def.code, def);
}
export function supportedCurrencies(): CurrencyCode[] {
  return [...CURRENCIES.keys()];
}
export function currencyDef(code: CurrencyCode): CurrencyDef {
  const def = CURRENCIES.get(code);
  if (!def) throw new Error(`Unsupported currency: ${code}`);
  return def;
}

const BPS_DENOMINATOR = 10_000n;

/** Rounds a non-negative rational to the nearest integer, ties away from zero. */
export function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new RangeError('denominator must be positive');
  if (numerator < 0n) throw new RangeError('numerator must be non-negative');
  return (numerator * 2n + denominator) / (denominator * 2n);
}

/** Commission on a net amount. 10000 minor at 350 bps is 350 minor. */
export function commissionFor(netMinor: bigint, bps: number): bigint {
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) throw new RangeError(`invalid bps: ${bps}`);
  if (netMinor < 0n) throw new RangeError('net must be non-negative');
  return divRoundHalfUp(netMinor * BigInt(bps), BPS_DENOMINATOR);
}

/**
 * Splits `total` across `weights` so the parts sum to exactly `total`, using the
 * largest-remainder method. Ties go to the earlier index, so results are deterministic.
 */
export function allocate(total: bigint, weights: readonly bigint[]): bigint[] {
  if (total < 0n) throw new RangeError('total must be non-negative');
  if (weights.some((w) => w < 0n)) throw new RangeError('weights must be non-negative');
  const sum = weights.reduce((a, b) => a + b, 0n);
  if (sum === 0n) {
    if (total === 0n) return weights.map(() => 0n);
    throw new RangeError('cannot allocate a non-zero total across zero weights');
  }
  const parts = weights.map((w) => (total * w) / sum);
  const remainders = weights.map((w, i) => ({ i, r: (total * w) % sum }));
  let left = total - parts.reduce((a, b) => a + b, 0n);
  remainders.sort((a, b) => (a.r === b.r ? a.i - b.i : a.r > b.r ? -1 : 1));
  for (const { i } of remainders) {
    if (left === 0n) break;
    parts[i]! += 1n;
    left -= 1n;
  }
  return parts;
}

export type ReversalInput = {
  /** Net amount commission was charged on. */
  netMinor: bigint;
  /** Commission originally charged. */
  commissionMinor: bigint;
  /** Net already refunded before this refund. */
  refundedMinor: bigint;
  /** Commission already reversed before this refund. */
  reversedMinor: bigint;
  /** Net being refunded now. */
  refundMinor: bigint;
};

/**
 * Commission to reverse for a refund. Computed cumulatively, so repeated partial
 * refunds never drift: refunding everything reverses exactly the commission charged.
 */
export function commissionReversal(i: ReversalInput): bigint {
  const refundedAfter = i.refundedMinor + i.refundMinor;
  if (i.refundMinor < 0n) throw new RangeError('refund must be non-negative');
  if (refundedAfter > i.netMinor) throw new RangeError('refund exceeds refundable net');
  if (i.netMinor === 0n) return 0n;
  const targetReversed = divRoundHalfUp(i.commissionMinor * refundedAfter, i.netMinor);
  return targetReversed - i.reversedMinor;
}

export type DiscountDef = { kind: 'PERCENT'; bps: number } | { kind: 'FIXED'; amountMinor: bigint };

/** Discount amount for a subtotal, never more than the subtotal. */
export function discountFor(subtotalMinor: bigint, d: DiscountDef): bigint {
  const raw = d.kind === 'PERCENT' ? commissionFor(subtotalMinor, d.bps) : d.amountMinor;
  return raw > subtotalMinor ? subtotalMinor : raw;
}

export type RewardRuleInput = {
  /** Qualified count, such as verified views. */
  qualified: bigint;
  /** Units per payout step, such as 1000 views. */
  unitSize: bigint;
  /** Amount per step. */
  rateMinor: bigint;
  /** Minimum qualified count before anything is paid. */
  minQualified?: bigint;
  /** Upper bound for one submission. */
  capMinor?: bigint | null;
};

/** Reward earned so far. Only completed steps count: 1999 views at 1000 per step is one step. */
export function rewardFor(r: RewardRuleInput): bigint {
  if (r.unitSize <= 0n) throw new RangeError('unitSize must be positive');
  if (r.qualified < (r.minQualified ?? 0n)) return 0n;
  const earned = (r.qualified / r.unitSize) * r.rateMinor;
  return r.capMinor != null && earned > r.capMinor ? r.capMinor : earned;
}

/** Parses a decimal string such as "12.50" into minor units, rejecting excess precision. */
export function toMinor(major: string, currency: CurrencyCode): bigint {
  const { exponent } = currencyDef(currency);
  const m = /^(\d+)(?:\.(\d+))?$/.exec(major.trim());
  if (!m) throw new RangeError(`invalid amount: ${major}`);
  const frac = m[2] ?? '';
  if (frac.length > exponent) throw new RangeError(`too many decimals for ${currency}: ${major}`);
  return BigInt(m[1]!) * 10n ** BigInt(exponent) + BigInt(frac.padEnd(exponent, '0') || '0');
}

/** Renders minor units as an exact decimal string, without locale formatting. */
export function toMajorString(minor: bigint, currency: CurrencyCode): string {
  const { exponent } = currencyDef(currency);
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const base = 10n ** BigInt(exponent);
  const whole = abs / base;
  const frac = (abs % base).toString().padStart(exponent, '0');
  return `${negative ? '-' : ''}${whole}${exponent ? `.${frac}` : ''}`;
}

/** Locale-aware display string. Accepts bigint or the string form the API sends. */
export function formatMoney(minor: bigint | string, currency: CurrencyCode, localeTag: string): string {
  const value = typeof minor === 'string' ? BigInt(minor) : minor;
  const { displayDigits } = currencyDef(currency);
  const fmt = new Intl.NumberFormat(localeTag, {
    style: 'currency',
    currency,
    minimumFractionDigits: displayDigits,
    maximumFractionDigits: displayDigits,
  });
  // Intl accepts a decimal string, which keeps values beyond 2^53 exact.
  return fmt.format(toMajorString(value, currency) as unknown as number);
}

// --- Exchange rates -----------------------------------------------------------

/** A rate is "soum per one unit", scaled by a million, so conversion never touches floats. */
export const RATE_SCALE = 1_000_000n;

/** Parses the feed's decimal strings exactly: rate "6.59" for nominal "10" is 659000 micro-soum. */
export function parseRateMicro(rate: string, nominal: string): bigint {
  const m = /^(\d+)(?:\.(\d{1,6}))?$/.exec(rate.trim());
  const n = /^\d+$/.test(nominal.trim()) ? BigInt(nominal.trim()) : 0n;
  if (!m || n <= 0n) throw new RangeError(`invalid rate: ${rate} / ${nominal}`);
  const micro = BigInt(m[1]!) * RATE_SCALE + BigInt((m[2] ?? '').padEnd(6, '0') || '0');
  if (micro <= 0n) throw new RangeError(`invalid rate: ${rate}`);
  return micro / n;
}

/**
 * Converts minor units of one currency into minor units of another through the soum rates.
 * `rates` maps a currency to micro-soum per unit; the soum itself is always RATE_SCALE.
 * Returns null when either rate is unknown, so the caller shows nothing rather than a guess.
 */
export function convertMinor(amountMinor: bigint, from: CurrencyCode, to: CurrencyCode, rates: ReadonlyMap<string, bigint> | Record<string, bigint>): bigint | null {
  if (from === to) return amountMinor;
  const get = (c: string) => (c === 'UZS' ? RATE_SCALE : rates instanceof Map ? rates.get(c) : (rates as Record<string, bigint>)[c]);
  const rf = get(from);
  const rt = get(to);
  if (!rf || !rt || rf <= 0n || rt <= 0n) return null;
  const negative = amountMinor < 0n;
  const abs = negative ? -amountMinor : amountMinor;
  const num = abs * rf * 10n ** BigInt(currencyDef(to).exponent);
  const den = rt * 10n ** BigInt(currencyDef(from).exponent);
  const out = divRoundHalfUp(num, den);
  return negative ? -out : out;
}
