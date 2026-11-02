import { describe, expect, it } from 'vitest';
import { quoteAtlasPaymentCost } from './costEngine';

describe('ATLAS Pay cost quotation', () => {
  const costs = {
    providerFixedMinor: 0n,
    providerVariableBps: 80n,
    providerCapMinor: 500n,
    expectedRiskMinor: 20n,
    allocatedOperationsMinor: 30n
  };
  it('applies provider variable fee cap and checks markup', () => {
    const quote = quoteAtlasPaymentCost(100000n, costs, 75n);
    expect(quote.totalCostMinor).toBe(550n);
    expect(quote.customerFeeMinor).toBe(750n);
    expect(quote.contributionMinor).toBe(200n);
    expect(quote.meetsMargin).toBe(true);
  });
  it('fails margin gate on small transactions', () => {
    const quote = quoteAtlasPaymentCost(10000n, costs, 75n);
    expect(quote.totalCostMinor).toBe(130n);
    expect(quote.meetsMargin).toBe(false);
  });
  it('rounds fractional minor units up', () => {
    const quote = quoteAtlasPaymentCost(101n, {
      providerFixedMinor: 0n, providerVariableBps: 1n,
      providerCapMinor: null, expectedRiskMinor: 0n, allocatedOperationsMinor: 0n
    }, 1n);
    expect(quote.totalCostMinor).toBe(1n);
    expect(quote.customerFeeMinor).toBe(1n);
  });
  it('rejects invalid inputs without executing payments', () => {
    expect(() => quoteAtlasPaymentCost(0n, costs, 75n)).toThrow('ATLAS_PAY_INVALID_COST_INPUT');
    expect(() => quoteAtlasPaymentCost(100n, costs, -1n)).toThrow('ATLAS_PAY_INVALID_COST_INPUT');
  });
});
