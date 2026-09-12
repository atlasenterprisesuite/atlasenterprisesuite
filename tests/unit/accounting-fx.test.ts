import { describe, expect, test } from 'vitest';
import { revalueForeignBalance, translateForeignAmount, validateFxRate } from '../../packages/accounting/src';

describe('Accounting FX rules', () => {
  test('translates transaction currency into functional currency with cent precision', () => {
    expect(translateForeignAmount(123.45, 1.08765)).toBe(134.27);
  });

  test('requires a unit rate when transaction and functional currencies are identical', () => {
    expect(() => validateFxRate('USD', 'USD', 1)).not.toThrow();
    expect(() => validateFxRate('USD', 'USD', 1.01)).toThrow('Same-currency rate must equal 1');
  });

  test('rejects invalid currency codes and non-positive cross-currency rates', () => {
    expect(() => validateFxRate('US', 'EUR', 1)).toThrow('Currency code must use three letters');
    expect(() => validateFxRate('USD', 'EUR', 0)).toThrow('FX rate must be greater than zero');
  });

  test('calculates the functional revaluation adjustment without changing the foreign balance', () => {
    expect(revalueForeignBalance({ foreignAmount: 1000, carryingFunctionalAmount: 1080, closingRate: 1.095 })).toEqual({
      translatedFunctionalAmount: 1095,
      adjustment: 15,
    });
  });
});
