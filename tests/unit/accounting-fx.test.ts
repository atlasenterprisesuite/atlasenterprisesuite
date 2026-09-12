import { describe, expect, test } from 'vitest';
import { mapAccountingFxRate, revalueForeignBalance, translateForeignAmount, validateFxRate } from '../../packages/accounting/src';

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

  test('maps source type and source name without collapsing provenance', () => {
    expect(mapAccountingFxRate({
      id: 'rate-1', org_id: 'org-1', entity_id: 'entity-1', rate_date: '2026-09-12',
      base_currency: 'EUR', quote_currency: 'USD', rate: 1.08, source_type: 'manual',
      source_name: 'Manual entry', source_reference: 'Treasury worksheet', evidence_state: 'manual',
      created_by: 'user-1', created_at: '2026-09-12T06:00:00Z',
    })).toEqual({
      id: 'rate-1', organizationId: 'org-1', entityId: 'entity-1', rateDate: '2026-09-12',
      baseCurrency: 'EUR', quoteCurrency: 'USD', rate: 1.08, sourceType: 'manual',
      sourceName: 'Manual entry', sourceReference: 'Treasury worksheet', evidenceState: 'manual',
      createdBy: 'user-1', createdAt: '2026-09-12T06:00:00Z',
    });
  });
});