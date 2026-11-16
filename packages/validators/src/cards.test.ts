import { describe, expect, it } from 'vitest';
import { cardBody, cardExpiryValid, cardNumberValid, detectCardBrand, luhnValid } from './index';

describe('card brand detection', () => {
  it('recognises each network from its first digits', () => {
    expect(detectCardBrand('8600 12')).toBe('uzcard');
    expect(detectCardBrand('9860')).toBe('humo');
    expect(detectCardBrand('4')).toBe('visa');
    expect(detectCardBrand('51')).toBe('mastercard');
    expect(detectCardBrand('2221')).toBe('mastercard');
    expect(detectCardBrand('2720')).toBe('mastercard');
    expect(detectCardBrand('2200')).toBe('mir');
    expect(detectCardBrand('62')).toBe('unionpay');
    expect(detectCardBrand('')).toBeNull();
    expect(detectCardBrand('3')).toBeNull();
  });

  it('checks length and Luhn where the network uses it', () => {
    expect(luhnValid('4242424242424242')).toBe(true);
    expect(cardNumberValid('4242 4242 4242 4242')).toBe(true);
    expect(cardNumberValid('4242 4242 4242 4241')).toBe(false);
    expect(cardNumberValid('5555 5555 5555 4444')).toBe(true);
    expect(cardNumberValid('8600 1234 5678 9012')).toBe(true);
    expect(cardNumberValid('8600 1234 5678')).toBe(false);
    expect(cardNumberValid('9860 0000 0000 0000')).toBe(true);
  });

  it('refuses an expired card', () => {
    const now = new Date('2026-11-16T00:00:00Z');
    expect(cardExpiryValid(11, 2026, now)).toBe(true);
    expect(cardExpiryValid(10, 2026, now)).toBe(false);
    expect(cardExpiryValid(1, 2027, now)).toBe(true);
    expect(cardExpiryValid(13, 2027, now)).toBe(false);
  });

  it('never accepts a full number in the linked-card body', () => {
    const ok = cardBody.safeParse({ brand: 'visa', last4: '4242', expMonth: 12, expYear: 2040, holder: 'ALI VALIYEV' });
    expect(ok.success).toBe(true);
    expect(cardBody.safeParse({ brand: 'visa', last4: '4242424242424242', expMonth: 12, expYear: 2040 }).success).toBe(false);
  });
});
