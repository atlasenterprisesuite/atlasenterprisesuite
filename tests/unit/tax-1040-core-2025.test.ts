
import { describe, expect, it } from 'vitest';
import {
  buildForm1040Core2025,
  buildScheduleA2025,
  calculateOrdinaryRateScheduleTax2025,
  calculateSaltDeduction2025,
  calculateStandardDeduction2025,
  type ProductiveTaxFact
} from '../../packages/tax-forms/src';

const fact = (taxFactKey: string, amount: number, subjectKey = taxFactKey): ProductiveTaxFact => ({
  taxFactKey,
  subjectKey,
  jurisdiction: 'federal',
  value: { amount },
  isCurrent: true
});

describe('ATLAS Tax 2025 Form 1040 core', () => {
  it('uses the official 2025 base standard deductions', () => {
    expect(calculateStandardDeduction2025({ filingStatus: 'single' }).amount).toBe(15750);
    expect(calculateStandardDeduction2025({ filingStatus: 'married-filing-jointly' }).amount).toBe(31500);
    expect(calculateStandardDeduction2025({ filingStatus: 'head-of-household' }).amount).toBe(23625);
  });

  it('applies age/blind additions and dependent worksheet limits', () => {
    expect(calculateStandardDeduction2025({
      filingStatus: 'single',
      taxpayer65OrOlder: true,
      taxpayerBlind: true
    }).amount).toBe(19750);

    expect(calculateStandardDeduction2025({
      filingStatus: 'single',
      canBeClaimedAsDependent: true,
      earnedIncome: 5000
    }).amount).toBe(5450);
  });

  it('sets standard deduction to zero when MFS spouse itemizes', () => {
    expect(calculateStandardDeduction2025({
      filingStatus: 'married-filing-separately',
      spouseItemizesSeparateReturn: true,
      taxpayer65OrOlder: true
    }).amount).toBe(0);
  });

  it('fails closed for dual-status standard-deduction treatment', () => {
    const result = calculateStandardDeduction2025({
      filingStatus: 'single',
      dualStatusAlien: true
    });
    expect(result.status).toBe('blocked');
    expect(result.amount).toBeNull();
  });

  it('calculates ordinary 2025 rate-schedule tax as a non-filing estimate', () => {
    expect(calculateOrdinaryRateScheduleTax2025(11925, 'single')).toBe(1192.5);
    expect(calculateOrdinaryRateScheduleTax2025(48475, 'single')).toBe(5578.5);
    expect(calculateOrdinaryRateScheduleTax2025(100000, 'married-filing-jointly')).toBeCloseTo(12014, 2);
  });

  it('builds lines 1 through 15 from normalized ledger inputs', () => {
    const result = buildForm1040Core2025({
      filingStatus: 'single',
      standardDeductionContext: {},
      facts: [
        fact('w2Wages', 60000, 'w2-a'),
        fact('taxableInterest', 500),
        fact('ordinaryDividends', 800),
        fact('federalIncomeTaxWithheldW2', 7000)
      ],
      schedule1AdditionalIncome: 1000,
      schedule1Adjustments: 2000
    });

    expect(result.lines.line9TotalIncome).toBe(62300);
    expect(result.lines.line11bAdjustedGrossIncome).toBe(60300);
    expect(result.lines.line12eStandardOrItemizedDeduction).toBe(15750);
    expect(result.lines.line15TaxableIncome).toBe(44550);
    expect(result.lines.line25aW2Withholding).toBe(7000);
    expect(result.line16Status).toBe('rate-schedule-estimate-only');
  });

  it('blocks line 9 when Social Security line 6b has not been calculated', () => {
    const result = buildForm1040Core2025({
      filingStatus: 'single',
      standardDeductionContext: {},
      facts: [fact('socialSecurityBenefitsGross', 18000, 'ssa-a')]
    });
    expect(result.lines.line6aSocialSecurityBenefits).toBe(18000);
    expect(result.lines.line6bTaxableSocialSecurityBenefits).toBeNull();
    expect(result.lines.line9TotalIncome).toBeNull();
    expect(result.blockers.join(' ')).toContain('taxable-benefits worksheet');
  });

  it('requires reviewed QBI and Schedule 1-A amounts', () => {
    const result = buildForm1040Core2025({
      filingStatus: 'single',
      standardDeductionContext: {},
      facts: [fact('w2Wages', 100000)],
      qbiDeduction: 5000,
      schedule1AAdditionalDeductions: 6000
    });
    expect(result.blockers.join(' ')).toContain('Form 8995');
    expect(result.blockers.join(' ')).toContain('Schedule 1-A');
  });

  it('flags qualified dividends/capital gains for special line 16 treatment', () => {
    const result = buildForm1040Core2025({
      filingStatus: 'single',
      standardDeductionContext: {},
      facts: [
        fact('ordinaryDividends', 10000),
        fact('qualifiedDividends', 8000)
      ],
      scheduleDNetCapitalGainLoss: 5000
    });
    expect(result.reviewFlags.join(' ')).toContain('Qualified dividends');
    expect(result.reviewFlags.join(' ')).toContain('special line 16 tax method');
  });
});

describe('ATLAS Tax 2025 Schedule A', () => {
  it('applies the 7.5% AGI medical floor', () => {
    const result = buildScheduleA2025({
      filingStatus: 'single',
      adjustedGrossIncome: 100000,
      medicalAndDentalExpenses: 12000
    });
    expect(result.medical.agiThreshold).toBe(7500);
    expect(result.medical.deductible).toBe(4500);
  });

  it('applies the 2025 SALT cap and MFS half-limit', () => {
    expect(calculateSaltDeduction2025({
      filingStatus: 'single',
      adjustedGrossIncome: 200000,
      stateLocalIncomeOrSalesTaxes: 30000,
      realEstateTaxes: 20000,
      personalPropertyTaxes: 0
    }).line5eSaltDeduction).toBe(40000);

    expect(calculateSaltDeduction2025({
      filingStatus: 'married-filing-separately',
      adjustedGrossIncome: 100000,
      stateLocalIncomeOrSalesTaxes: 18000,
      realEstateTaxes: 10000,
      personalPropertyTaxes: 0
    }).line5eSaltDeduction).toBe(20000);
  });

  it('applies the 30% SALT phase-down with statutory floor', () => {
    const phased = calculateSaltDeduction2025({
      filingStatus: 'single',
      adjustedGrossIncome: 550000,
      stateLocalIncomeOrSalesTaxes: 40000,
      realEstateTaxes: 20000,
      personalPropertyTaxes: 0
    });
    expect(phased.saltLimit).toBe(25000);
    expect(phased.line5eSaltDeduction).toBe(25000);

    const floor = calculateSaltDeduction2025({
      filingStatus: 'single',
      adjustedGrossIncome: 700000,
      stateLocalIncomeOrSalesTaxes: 40000,
      realEstateTaxes: 20000,
      personalPropertyTaxes: 0
    });
    expect(floor.saltLimit).toBe(10000);
  });

  it('blocks unreviewed mortgage interest rather than accepting raw Form 1098', () => {
    const result = buildScheduleA2025({
      filingStatus: 'single',
      adjustedGrossIncome: 100000,
      deductibleMortgageInterestAndPoints: 15000,
      mortgageInterestReviewed: false
    });
    expect(result.status).toBe('blocked');
    expect(result.totalItemizedDeductions).toBeNull();
    expect(result.blockers.join(' ')).toContain('qualified-home/debt-limit');
  });

  it('produces total itemized deductions only when gated components are reviewed', () => {
    const result = buildScheduleA2025({
      filingStatus: 'single',
      adjustedGrossIncome: 100000,
      medicalAndDentalExpenses: 10000,
      stateLocalIncomeOrSalesTaxes: 12000,
      realEstateTaxes: 8000,
      deductibleMortgageInterestAndPoints: 10000,
      mortgageInterestReviewed: true,
      charitableContributions: 5000,
      charitableContributionsReviewed: true
    });
    expect(result.status).toBe('calculated');
    expect(result.totalItemizedDeductions).toBe(37500);
  });
});
