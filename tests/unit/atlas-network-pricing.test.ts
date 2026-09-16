import { describe, expect, it } from 'vitest';
import { ATLAS_NETWORK_LAUNCH_PRICES, validatePriceBookEntry } from '../../packages/network/src';

describe('ATLAS Network launch pricing', () => {
  it('contains the approved launch prices', () => {
    const bySku = Object.fromEntries(ATLAS_NETWORK_LAUNCH_PRICES.map((price) => [price.sku, price]));
    expect(bySku['atlas-core-monthly'].amountMinor).toBe(2_900);
    expect(bySku['atlas-pro-monthly'].amountMinor).toBe(5_900);
    expect(bySku['atlas-business-monthly'].amountMinor).toBe(14_900);
    expect(bySku['atlas-enterprise-monthly'].amountMinor).toBe(99_900);
    expect(bySku['atlas-network-partner'].amountMinor).toBe(0);
    expect(bySku['atlas-enterprise-monthly'].floorPrice).toBe(true);
  });

  it('rejects invalid currency, negative price, and cap above 20 percent', () => {
    expect(() => validatePriceBookEntry({ productKey: 'x', billingInterval: 'monthly', currency: 'usd', amountMinor: 100, baseUsdAmountMinor: 100, commissionable: true, productCommissionCapBps: 2000, taxCode: 'standard' })).toThrow();
    expect(() => validatePriceBookEntry({ productKey: 'x', billingInterval: 'monthly', currency: 'USD', amountMinor: -1, baseUsdAmountMinor: 100, commissionable: true, taxCode: 'standard' })).toThrow();
    expect(() => validatePriceBookEntry({ productKey: 'x', billingInterval: 'monthly', currency: 'USD', amountMinor: 100, baseUsdAmountMinor: 100, commissionable: true, productCommissionCapBps: 2001, taxCode: 'standard' })).toThrow();
  });
});
