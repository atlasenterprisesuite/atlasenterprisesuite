import { describe, expect, it } from 'vitest';
import { applyBasisPoints, calculateCnrMinor } from '../../packages/network/src';

describe('ATLAS Network money', () => {
  it('applies basis points using integer minor units', () => {
    expect(applyBasisPoints(10_000, 1200)).toBe(1_200);
    expect(applyBasisPoints(9_999, 150)).toBe(150);
  });

  it('preserves signed reversal values', () => {
    expect(applyBasisPoints(-10_000, 1200)).toBe(-1_200);
  });

  it('calculates commissionable net revenue exactly', () => {
    expect(calculateCnrMinor({
      cashCollectedMinor: 20_000,
      taxesMinor: 1_300,
      refundsMinor: 2_000,
      chargebacksMinor: 500,
      creditsMinor: 200,
      passThroughFeesMinor: 1_000
    })).toBe(15_000);
  });
});
