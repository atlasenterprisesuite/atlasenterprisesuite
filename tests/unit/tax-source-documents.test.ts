
import { describe, expect, it } from 'vitest';
import {
  map1099DIVToReturn,
  map1099INTToReturn,
  map1099NECToReturn,
  mapPartnershipK1ToReturn
} from '../../packages/tax-forms/src';

describe('ATLAS Tax additional source-document mapping', () => {
  it('maps 1099-INT taxable and tax-exempt interest without duplication', () => {
    const result = map1099INTToReturn({
      taxYear: 2025,
      box1InterestIncome: 1200,
      box4FederalWithholding: 100,
      box8TaxExemptInterest: 300
    });
    expect(result.mappings).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: '1099-INT box 1', destinationLine: '2b', amount: 1200 }),
      expect.objectContaining({ source: '1099-INT box 4', destinationLine: '25b', amount: 100 }),
      expect.objectContaining({ source: '1099-INT box 8', destinationLine: '2a', amount: 300 })
    ]));
  });

  it('maps 1099-DIV ordinary and qualified dividends to distinct 1040 lines', () => {
    const result = map1099DIVToReturn({
      taxYear: 2025,
      box1aOrdinaryDividends: 2000,
      box1bQualifiedDividends: 1500
    });
    expect(result.mappings).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: '1099-DIV box 1a', destinationLine: '3b', amount: 2000 }),
      expect.objectContaining({ source: '1099-DIV box 1b', destinationLine: '3a', amount: 1500 })
    ]));
  });

  it('does not blindly classify 1099-NEC as Schedule C', () => {
    const unknown = map1099NECToReturn({ taxYear: 2025, box1NonemployeeCompensation: 9000, classification: 'unknown' });
    expect(unknown.mappings[0]).toEqual(expect.objectContaining({ destinationForm: 'Income classification review', reviewRequired: true }));

    const selfEmployment = map1099NECToReturn({ taxYear: 2025, box1NonemployeeCompensation: 9000, classification: 'self-employment' });
    expect(selfEmployment.mappings[0]).toEqual(expect.objectContaining({ destinationForm: 'Schedule C + Schedule SE' }));
  });

  it('routes partnership portfolio and capital items to their IRS destinations', () => {
    const result = mapPartnershipK1ToReturn({
      taxYear: 2025,
      box5InterestIncome: 500,
      box6aOrdinaryDividends: 400,
      box8ShortTermCapitalGain: 300,
      box9aLongTermCapitalGain: 200
    });
    expect(result.mappings).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'K-1 (1065) box 5', destinationLine: '2b' }),
      expect.objectContaining({ source: 'K-1 (1065) box 6a', destinationLine: '3b' }),
      expect.objectContaining({ source: 'K-1 (1065) box 8', destinationForm: 'Schedule D (Form 1040)', destinationLine: '5' }),
      expect.objectContaining({ source: 'K-1 (1065) box 9a', destinationForm: 'Schedule D (Form 1040)', destinationLine: '12' })
    ]));
  });

  it('keeps partnership operating and rental income behind limitation review', () => {
    const result = mapPartnershipK1ToReturn({ taxYear: 2025, box1OrdinaryBusinessIncome: -10000, box2RentalRealEstateIncome: -5000 });
    expect(result.mappings.every((item) => item.reviewRequired)).toBe(true);
    expect(result.mappings.every((item) => item.destinationForm === 'Schedule E (Form 1040)')).toBe(true);
  });

  it('gates 2026 line destinations pending final-year approval', () => {
    expect(map1099INTToReturn({ taxYear: 2026, box1InterestIncome: 1 }).revisionStatus).toBe('destination-review-gated');
    expect(mapPartnershipK1ToReturn({ taxYear: 2026, box5InterestIncome: 1 }).revisionStatus).toBe('destination-review-gated');
  });
});
