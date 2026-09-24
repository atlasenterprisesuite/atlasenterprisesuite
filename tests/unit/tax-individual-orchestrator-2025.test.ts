import { describe, expect, it } from 'vitest';
import {
  buildIndividualReturnComputation2025,
  type ProductiveTaxFact
} from '../../packages/tax-forms/src';

const fact = (taxFactKey: string, amount: number, subjectKey = taxFactKey): ProductiveTaxFact => ({
  taxFactKey,
  subjectKey,
  jurisdiction: 'federal',
  value: { amount },
  isCurrent: true
});

describe('ATLAS Tax 2025 individual-return orchestrator', () => {
  it('flows Social Security and Schedule D into Form 1040 before line 16 selection', () => {
    const result = buildIndividualReturnComputation2025({
      filingStatus: 'single',
      standardDeductionContext: {},
      facts: [fact('w2Wages', 150000)],
      socialSecurity: {
        filingStatus: 'single',
        grossBenefits: 30000,
        otherIncomeLines1z2b3b4b5b7a8: 150000
      },
      scheduleD: {
        filingStatus: 'single',
        transactions: [{ id: 'gain', term: 'long', proceeds: 20000, basis: 10000, reviewed: true }]
      }
    });

    expect(result.socialSecurity?.taxableBenefits).toBeGreaterThan(0);
    expect(result.scheduleD?.form1040Line7a).toBe(10000);
    expect(result.form1040.lines.line6bTaxableSocialSecurityBenefits).toBe(result.socialSecurity?.taxableBenefits);
    expect(result.form1040.lines.line7CapitalGainLoss).toBe(10000);
    expect(result.line16?.method).toBe('qualified-dividends-capital-gain-worksheet');
    expect(result.line16Tax).toBeNull();
    expect(result.status).toBe('review');
  });

  it('calculates line 16 only when the exact Tax Computation Worksheet path is available', () => {
    const result = buildIndividualReturnComputation2025({
      filingStatus: 'single',
      standardDeductionContext: {},
      facts: [fact('w2Wages', 200000)]
    });

    expect(result.form1040.lines.line15TaxableIncome).toBe(184250);
    expect(result.line16?.method).toBe('tax-computation-worksheet');
    expect(result.line16Tax).toBeGreaterThan(0);
    expect(result.blockers).toHaveLength(0);
  });

  it('blocks exact line 16 when the Tax Table is required', () => {
    const result = buildIndividualReturnComputation2025({
      filingStatus: 'single',
      standardDeductionContext: {},
      facts: [fact('w2Wages', 60000)]
    });

    expect(result.line16?.method).toBe('tax-table');
    expect(result.line16Tax).toBeNull();
    expect(result.status).toBe('blocked');
    expect(result.blockers.join(' ')).toContain('Tax Table lookup engine');
  });

  it('does not promote a review-only Social Security lump-sum result into line 6b', () => {
    const result = buildIndividualReturnComputation2025({
      filingStatus: 'single',
      standardDeductionContext: {},
      facts: [fact('w2Wages', 100000)],
      socialSecurity: {
        filingStatus: 'single',
        grossBenefits: 30000,
        otherIncomeLines1z2b3b4b5b7a8: 100000,
        lumpSumPriorYearPayment: true
      }
    });

    expect(result.socialSecurity?.status).toBe('review');
    expect(result.form1040.lines.line6bTaxableSocialSecurityBenefits).toBeNull();
    expect(result.status).toBe('blocked');
  });
});
