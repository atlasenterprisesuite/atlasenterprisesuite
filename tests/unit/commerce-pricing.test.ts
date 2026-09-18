import { describe, expect, it } from 'vitest';
import {
  addCartLine,
  priceCart,
  removeCartLine,
  setCartLineQuantity
} from '../../packages/commerce/src';

describe('ATLAS Commerce deterministic pricing', () => {
  it('prices in integer minor units in a fixed operation order', () => {
    const result = priceCart({
      currency: 'USD',
      lines: [{ variantId: 'v1', quantity: 2, unitPriceMinor: 1250n }],
      adjustments: [{ code: 'WELCOME', amountMinor: -500n, source: 'promotion' }],
      shippingMinor: 300n,
      taxMinor: 161n
    });

    expect(result.subtotalMinor).toBe(2500n);
    expect(result.adjustmentMinor).toBe(-500n);
    expect(result.totalMinor).toBe(2461n);
    expect(result.currency).toBe('USD');
  });

  it('rejects a pricing source currency that differs from the cart currency', () => {
    expect(() => priceCart({
      currency: 'USD',
      sourceCurrency: 'EUR',
      lines: [],
      adjustments: [],
      shippingMinor: 0n,
      taxMinor: 0n
    })).toThrow('currency_mismatch');
  });

  it('rejects a negative final total instead of silently fabricating one', () => {
    expect(() => priceCart({
      currency: 'USD',
      lines: [{ variantId: 'v1', quantity: 1, unitPriceMinor: 100n }],
      adjustments: [{ code: 'TOO_LARGE', amountMinor: -200n, source: 'promotion' }],
      shippingMinor: 0n,
      taxMinor: 0n
    })).toThrow('negative_total');
  });
});

describe('ATLAS Commerce cart mutation', () => {
  const base = {
    scope: { tenantId: 'tenant-a', organizationId: 'org-a' },
    id: 'cart-1',
    storefrontId: 'store-1',
    currency: 'USD',
    state: 'active' as const,
    lines: [{ variantId: 'v1', quantity: 1 }]
  };

  it('adds, changes and removes lines without mutating the prior cart', () => {
    const added = addCartLine(base, { variantId: 'v2', quantity: 2 });
    const changed = setCartLineQuantity(added, 'v2', 3);
    const removed = removeCartLine(changed, 'v1');

    expect(base.lines).toEqual([{ variantId: 'v1', quantity: 1 }]);
    expect(added.lines).toEqual([
      { variantId: 'v1', quantity: 1 },
      { variantId: 'v2', quantity: 2 }
    ]);
    expect(changed.lines).toContainEqual({ variantId: 'v2', quantity: 3 });
    expect(removed.lines).toEqual([{ variantId: 'v2', quantity: 3 }]);
  });

  it('rejects non-positive quantities', () => {
    expect(() => addCartLine(base, { variantId: 'v2', quantity: 0 }))
      .toThrow('invalid_quantity');
  });
});
