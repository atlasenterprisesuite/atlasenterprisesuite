import { describe, expect, it } from 'vitest';
import {
  buildScheduleD2025,
  calculateOrdinaryRateScheduleTax2025,
  calculateQualifiedDividendsCapitalGainWorksheet2025,
  calculateSocialSecurityBenefits2025,
  resolveLine16Method2025
} from '../../packages/tax-forms/src';

describe('ATLAS Tax 2025 Social Security Benefits Worksheet', () => {
  it('returns zero taxable benefits below the base amount', () => {
    const result = calculateSocialSecurityBenefits2025({
      filingStatus: 'single',
      grossBenefits: 20000,
      otherIncomeLines1z2b3b4b5b7a8: 10000
    });
    expect(result.status).toBe('calculated');
    expect(result.taxableBenefits).toBe(0);
  });

  it('calculates the standard worksheet through line 18', () => {
    const result = calculateSocialSecurityBenefits2025({
      filingStatus: 'single',
      grossBenefits: 30000,
      otherIncomeLines1z2b3b4b5b7a8: 40000
    });
    expect(result.taxableBenefits).toBe(22350);
    expect(result.lines.line18).toBe(22350);
  });

  it('uses the 85% branch for MFS who lived with spouse', () => {
    const result = calculateSocialSecurityBenefits2025({
      filingStatus: 'married-filing-separately',
      grossBenefits: 30000,
      otherIncomeLines1z2b3b4b5b7a8: 0,
      marriedFilingSeparatelyLivedWithSpouse: true
    });
    expect(result.taxableBenefits).toBe(12750);
  });

  it('fails closed for IRS worksheet exceptions', () => {
    const result = calculateSocialSecurityBenefits2025({
      filingStatus: 'single',
      grossBenefits: 20000,
      otherIncomeLines1z2b3b4b5b7a8: 10000,
      traditionalIraCircularCalculationRequired: true
    });
    expect(result.status).toBe('blocked');
    expect(result.taxableBenefits).toBeNull();
    expect(result.blockers.join(' ')).toContain('Pub. 590-A');
  });

  it('keeps lump-sum election as professional review', () => {
    const result = calculateSocialSecurityBenefits2025({
      filingStatus: 'single',
      grossBenefits: 30000,
      otherIncomeLines1z2b3b4b5b7a8: 40000,
      lumpSumPriorYearPayment: true
    });
    expect(result.status).toBe('review');
    expect(result.reviewFlags.join(' ')).toContain('Pub. 915');
  });
});

describe('ATLAS Tax 2025 Schedule D core', () => {
  it('aggregates reviewed transactions and applies the $3,000 loss limit', () => {
    const result = buildScheduleD2025({
      filingStatus: 'single',
      transactions: [
        { id: 's1', term: 'short', proceeds: 5000, basis: 4000, reviewed: true },
        { id: 'l1', term: 'long', proceeds: 3000, basis: 10000, reviewed: true }
      ]
    });
    expect(result.shortTermNet).toBe(1000);
    expect(result.longTermNet).toBe(-7000);
    expect(result.combinedNet).toBe(-6000);
    expect(result.form1040Line7a).toBe(-3000);
    expect(result.carryforwardCandidate).toBe(true);
  });

  it('uses the $1,500 MFS capital-loss limit', () => {
    const result = buildScheduleD2025({
      filingStatus: 'married-filing-separately',
      transactions: [{ id: 'l1', term: 'long', proceeds: 1000, basis: 5000, reviewed: true }]
    });
    expect(result.capitalLossDeductionLimit).toBe(1500);
    expect(result.form1040Line7a).toBe(-1500);
  });

  it('blocks unreviewed brokerage transactions', () => {
    const result = buildScheduleD2025({
      filingStatus: 'single',
      transactions: [{ id: 'x', term: 'short', proceeds: 1000, basis: 900, reviewed: false }]
    });
    expect(result.status).toBe('blocked');
    expect(result.form1040Line7a).toBeNull();
  });
});

describe('ATLAS Tax 2025 line 16 method resolver', () => {
  it('uses Tax Table below $100,000 absent a special method', () => {
    const result = resolveLine16Method2025({
      filingStatus: 'single',
      taxableIncome: 50000
    });
    expect(result.method).toBe('tax-table');
    expect(result.canCalculateWithCurrentCore).toBe(false);
  });

  it('uses Tax Computation Worksheet at $100,000 or more absent a special method', () => {
    const result = resolveLine16Method2025({
      filingStatus: 'single',
      taxableIncome: 150000
    });
    expect(result.method).toBe('tax-computation-worksheet');
    expect(result.canCalculateWithCurrentCore).toBe(true);
  });

  it('selects Schedule D Tax Worksheet for special-rate gains', () => {
    const result = resolveLine16Method2025({
      filingStatus: 'single',
      taxableIncome: 200000,
      scheduleDRequired: true,
      scheduleDLine15: 50000,
      scheduleDLine16: 60000,
      scheduleDLine18: 10000
    });
    expect(result.method).toBe('schedule-d-tax-worksheet');
  });

  it('selects Qualified Dividends and Capital Gain worksheet when applicable', () => {
    const result = resolveLine16Method2025({
      filingStatus: 'single',
      taxableIncome: 200000,
      qualifiedDividends: 20000
    });
    expect(result.method).toBe('qualified-dividends-capital-gain-worksheet');
  });

  it('prioritizes Form 2555 and Form 8615 gates', () => {
    expect(resolveLine16Method2025({
      filingStatus: 'single',
      taxableIncome: 200000,
      form2555Filed: true,
      qualifiedDividends: 20000
    }).method).toBe('foreign-earned-income-tax-worksheet');

    expect(resolveLine16Method2025({
      filingStatus: 'single',
      taxableIncome: 200000,
      form8615Required: true
    }).method).toBe('form-8615');
  });

  it('calculates the qualified-dividend worksheet when an exact ordinary-tax function is supplied', () => {
    const result = calculateQualifiedDividendsCapitalGainWorksheet2025({
      filingStatus: 'single',
      taxableIncome: 200000,
      qualifiedDividends: 20000,
      scheduleDNetLongTermGainOrLine7aGain: 30000,
      ordinaryTax: (income) => calculateOrdinaryRateScheduleTax2025(income, 'single')
    });
    expect(result.tax).toBeLessThan(calculateOrdinaryRateScheduleTax2025(200000, 'single'));
    expect(result.lines.line25).toBe(result.tax);
  });
});
