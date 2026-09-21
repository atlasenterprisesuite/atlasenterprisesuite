
import { describe, expect, it } from 'vitest';
import {
  map1098ToReturn,
  map1095AToReturn,
  mapSSA1099ToReturn,
  map1099BToReturn
} from '../../packages/tax-forms/src';

describe('ATLAS Tax depth source-document mapping', () => {
  it('maps 1098 mortgage interest and points behind deduction review', () => {
    const result = map1098ToReturn({
      taxYear: 2025,
      box1MortgageInterest: 12000,
      box6PointsPaidOnPurchase: 1500
    });
    expect(result.mappings).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: '1098 box 1', destinationForm: 'Schedule A (Form 1040)', destinationLine: '8a', amount: 12000, reviewRequired: true }),
      expect.objectContaining({ source: '1098 box 6', destinationLine: '8a', amount: 1500, reviewRequired: true })
    ]));
  });

  it('preserves 1095-A amounts by month for Form 8962', () => {
    const result = map1095AToReturn({
      taxYear: 2025,
      months: [
        { month: 1, enrollmentPremium: 600, slcspPremium: 550, advancePremiumTaxCredit: 400 },
        { month: 2, enrollmentPremium: 610, slcspPremium: 560, advancePremiumTaxCredit: 410 }
      ]
    });
    expect(result.mappings).toEqual(expect.arrayContaining([
      expect.objectContaining({ destinationField: 'ptcEnrollmentPremium.month01', amount: 600, destinationForm: 'Form 8962' }),
      expect.objectContaining({ destinationField: 'ptcSLCSPPremium.month02', amount: 560 }),
      expect.objectContaining({ destinationField: 'ptcAdvancePayment.month02', amount: 410 })
    ]));
  });

  it('routes SSA-1099 net benefits to 1040 line 6a and withholding to 25b', () => {
    const result = mapSSA1099ToReturn({
      taxYear: 2025,
      box5NetBenefits: 12000,
      box6FederalWithholding: 1000
    });
    expect(result.mappings).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'SSA-1099 box 5', destinationLine: '6a', amount: 12000 }),
      expect.objectContaining({ source: 'SSA-1099 box 6', destinationLine: '25b', amount: 1000 }),
      expect.objectContaining({ destinationField: 'socialSecurityTaxableBenefitsCalculation', destinationLine: '6b', reviewRequired: true })
    ]));
  });

  it('builds transaction-level 1099-B/Form 8949 mappings and wash-sale adjustment', () => {
    const result = map1099BToReturn({
      taxYear: 2025,
      transactions: [{
        transactionId: 'tx1',
        description: 'ABC',
        proceeds: 10000,
        basis: 12000,
        basisReportedToIRS: true,
        term: 'short',
        washSaleLossDisallowed: 500
      }]
    });
    expect(result.mappings).toEqual(expect.arrayContaining([
      expect.objectContaining({ destinationField: 'capitalTransaction.tx1.proceeds', amount: 10000, destinationForm: 'Form 8949 Part I' }),
      expect.objectContaining({ destinationField: 'capitalTransaction.tx1.basis', amount: 12000 }),
      expect.objectContaining({ destinationField: 'capitalTransaction.tx1.boxClass', value: 'A' }),
      expect.objectContaining({ destinationField: 'capitalTransaction.tx1.washSaleAdjustment', amount: 500, reviewRequired: true }),
      expect.objectContaining({ destinationForm: 'Schedule D (Form 1040)', destinationField: 'capitalTransactionAggregation' })
    ]));
  });

  it('fails brokerage basis/term into review rather than fabricating values', () => {
    const result = map1099BToReturn({
      taxYear: 2025,
      transactions: [{
        transactionId: 'tx2',
        proceeds: 5000,
        basisReportedToIRS: false,
        term: 'unknown'
      }]
    });
    expect(result.reviewFlags.join(' ')).toContain('short-term/long-term');
    expect(result.reviewFlags.join(' ')).toContain('missing reviewed basis');
  });

  it('keeps 2026 destinations review-gated', () => {
    expect(map1098ToReturn({ taxYear: 2026, box1MortgageInterest: 1 }).revisionStatus).toBe('destination-review-gated');
    expect(map1095AToReturn({ taxYear: 2026, months: [{ month: 1, enrollmentPremium: 1 }] }).revisionStatus).toBe('destination-review-gated');
    expect(mapSSA1099ToReturn({ taxYear: 2026, box5NetBenefits: 1 }).revisionStatus).toBe('destination-review-gated');
    expect(map1099BToReturn({ taxYear: 2026, transactions: [] }).revisionStatus).toBe('destination-review-gated');
  });
});
