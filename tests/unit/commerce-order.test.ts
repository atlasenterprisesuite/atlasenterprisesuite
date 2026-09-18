import { describe, expect, it } from 'vitest';
import { canonicalCheckoutFingerprint } from '../../packages/commerce/src';

const base = {
  storefrontId: 'store-1',
  customerRef: 'customer-1',
  channel: 'storefront',
  currency: 'USD',
  lines: [
    { variantId: 'v2', sku: 'SKU-2', quantity: 1, unitPriceMinor: 500n },
    { variantId: 'v1', sku: 'SKU-1', quantity: 2, unitPriceMinor: 1000n }
  ],
  adjustments: [{ code: 'WELCOME', source: 'promotion', amountMinor: -100n }],
  shippingMinor: 0n,
  taxMinor: 130n,
  totalMinor: 2530n
};

describe('Commerce order idempotency fingerprint', () => {
  it('normalizes equivalent checkout commands to one fingerprint', () => {
    const reordered = {
      ...base,
      lines: [...base.lines].reverse(),
      adjustments: [...base.adjustments]
    };

    expect(canonicalCheckoutFingerprint(base))
      .toBe(canonicalCheckoutFingerprint(reordered));
  });

  it.each([
    ['sku', { ...base, lines: [{ ...base.lines[0], sku: 'SKU-X' }, base.lines[1]] }],
    ['quantity', { ...base, lines: [{ ...base.lines[0], quantity: 2 }, base.lines[1]] }],
    ['amount', { ...base, totalMinor: 2531n }],
    ['customer', { ...base, customerRef: 'customer-2' }],
    ['channel', { ...base, channel: 'pos' }]
  ])('changes the fingerprint when %s changes', (_label, changed) => {
    expect(canonicalCheckoutFingerprint(changed))
      .not.toBe(canonicalCheckoutFingerprint(base));
  });
});
