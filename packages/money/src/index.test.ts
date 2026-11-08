import { describe, expect, it } from 'vitest';
import {
  allocate, commissionFor, commissionReversal, discountFor, divRoundHalfUp, formatMoney,
  rewardFor, toMajorString, toMinor,
} from './index';

describe('commissionFor', () => {
  it('charges $3.50 on $100.00 at 3.5%', () => {
    expect(commissionFor(10_000n, 350)).toBe(350n);
  });
  it('rounds half up at the minor-unit boundary', () => {
    expect(commissionFor(100n, 350)).toBe(4n); // 3.5 -> 4
    expect(commissionFor(99n, 350)).toBe(3n); // 3.465 -> 3
    expect(commissionFor(1n, 350)).toBe(0n);
  });
  it('rejects fractional or out-of-range rates', () => {
    expect(() => commissionFor(100n, 3.5)).toThrow();
    expect(() => commissionFor(100n, 10_001)).toThrow();
  });
  it('stays exact beyond the safe integer range', () => {
    // 9007199254740993000 * 0.035 = 315251973915934755
    expect(commissionFor(9_007_199_254_740_993_000n, 350)).toBe(315_251_973_915_934_755n);
  });
});

describe('divRoundHalfUp', () => {
  it('rounds exactly at .5', () => {
    expect(divRoundHalfUp(5n, 2n)).toBe(3n);
    expect(divRoundHalfUp(7n, 3n)).toBe(2n);
  });
});

describe('allocate', () => {
  it('sums to the total and is deterministic', () => {
    const parts = allocate(100n, [1n, 1n, 1n]);
    expect(parts).toEqual([34n, 33n, 33n]);
    expect(parts.reduce((a, b) => a + b, 0n)).toBe(100n);
  });
  it('respects weights', () => {
    expect(allocate(1000n, [3n, 1n])).toEqual([750n, 250n]);
  });
  it('allocates zero across zero weights but refuses a non-zero total', () => {
    expect(allocate(0n, [0n, 0n])).toEqual([0n, 0n]);
    expect(() => allocate(1n, [0n])).toThrow();
  });
  it('holds across many random inputs', () => {
    let seed = 7;
    const rnd = (n: number) => (seed = (seed * 48271) % 2147483647) % n;
    for (let t = 0; t < 500; t++) {
      const weights = Array.from({ length: 1 + rnd(6) }, () => BigInt(1 + rnd(50_000)));
      const total = BigInt(rnd(1_000_000));
      expect(allocate(total, weights).reduce((a, b) => a + b, 0n)).toBe(total);
    }
  });
});

describe('commissionReversal', () => {
  const base = { netMinor: 10_000n, commissionMinor: 350n, refundedMinor: 0n, reversedMinor: 0n };
  it('reverses all of it on a full refund', () => {
    expect(commissionReversal({ ...base, refundMinor: 10_000n })).toBe(350n);
  });
  it('prorates a partial refund', () => {
    expect(commissionReversal({ ...base, refundMinor: 2_500n })).toBe(88n); // 87.5 -> 88
  });
  it('never drifts across repeated partial refunds', () => {
    let refunded = 0n;
    let reversed = 0n;
    for (const refundMinor of [3_333n, 3_333n, 3_334n]) {
      const r = commissionReversal({ ...base, refundedMinor: refunded, reversedMinor: reversed, refundMinor });
      refunded += refundMinor;
      reversed += r;
    }
    expect(reversed).toBe(350n);
  });
  it('holds for arbitrary refund sequences', () => {
    let seed = 11;
    const rnd = (n: number) => (seed = (seed * 48271) % 2147483647) % n;
    for (let t = 0; t < 300; t++) {
      const net = BigInt(1 + rnd(5_000_000));
      const fee = commissionFor(net, 350);
      let refunded = 0n;
      let reversed = 0n;
      while (refunded < net) {
        const left = net - refunded;
        const step = left <= 1n ? left : 1n + BigInt(rnd(Number(left)));
        const r = commissionReversal({ netMinor: net, commissionMinor: fee, refundedMinor: refunded, reversedMinor: reversed, refundMinor: step });
        expect(r).toBeGreaterThanOrEqual(0n);
        refunded += step;
        reversed += r;
      }
      expect(reversed).toBe(fee);
    }
  });
  it('refuses to refund more than was paid', () => {
    expect(() => commissionReversal({ ...base, refundedMinor: 9_000n, refundMinor: 2_000n })).toThrow();
  });
  it('handles a zero-net line', () => {
    expect(commissionReversal({ netMinor: 0n, commissionMinor: 0n, refundedMinor: 0n, reversedMinor: 0n, refundMinor: 0n })).toBe(0n);
  });
});

describe('discountFor', () => {
  it('caps at the subtotal', () => {
    expect(discountFor(500n, { kind: 'FIXED', amountMinor: 900n })).toBe(500n);
    expect(discountFor(10_000n, { kind: 'PERCENT', bps: 2_000 })).toBe(2_000n);
  });
});

describe('rewardFor', () => {
  const rule = { unitSize: 1000n, rateMinor: 150n };
  it('pays completed steps only', () => {
    expect(rewardFor({ ...rule, qualified: 1999n })).toBe(150n);
    expect(rewardFor({ ...rule, qualified: 999n })).toBe(0n);
  });
  it('applies the minimum and the cap', () => {
    expect(rewardFor({ ...rule, qualified: 5000n, minQualified: 10_000n })).toBe(0n);
    expect(rewardFor({ ...rule, qualified: 1_000_000n, capMinor: 5000n })).toBe(5000n);
  });
});

describe('conversions', () => {
  it('round-trips decimal strings', () => {
    expect(toMinor('12.50', 'USD')).toBe(1250n);
    expect(toMinor('12', 'USD')).toBe(1200n);
    expect(toMajorString(1250n, 'USD')).toBe('12.50');
    expect(toMajorString(-5n, 'USD')).toBe('-0.05');
  });
  it('rejects excess precision and junk', () => {
    expect(() => toMinor('1.234', 'USD')).toThrow();
    expect(() => toMinor('abc', 'USD')).toThrow();
    expect(() => toMinor('1', 'XXX')).toThrow();
  });
  it('formats by locale and hides tiyin', () => {
    expect(formatMoney(10_000n, 'USD', 'en-US')).toBe('$100.00');
    expect(formatMoney('12500000', 'UZS', 'en-US')).toContain('125,000');
    expect(formatMoney('12500000', 'UZS', 'en-US')).not.toContain('.00');
  });
});
