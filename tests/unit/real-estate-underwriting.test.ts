import { describe, expect, it } from 'vitest';
import { evaluateRealEstateDeal, type RealEstateDealInput } from '../../apps/web/src/modules/real-estate/underwriting';

const base: RealEstateDealInput = {
  purchasePrice: 1000000,
  units: 10,
  rentPerUnitMonthly: 1500,
  otherIncomeMonthly: 0,
  vacancyPercent: 5,
  operatingExpensesMonthly: 5000,
  downPaymentPercent: 25,
  interestRatePercent: 6,
  amortizationYears: 30,
  closingCosts: 30000,
  repairsBudget: 20000
};

describe('ATLAS Real Estate underwriting — deterministic, user-provided inputs', () => {
  it('calculates gross income, NOI, debt service, cashflow, cap rate and DSCR', () => {
    const result = evaluateRealEstateDeal(base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.values.grossPotentialAnnual).toBe(180000);
    expect(result.values.effectiveGrossAnnual).toBe(171000);
    expect(result.values.noiAnnual).toBe(111000);
    expect(result.values.loanAmount).toBe(750000);
    expect(result.values.initialCashRequired).toBe(300000);
    expect(result.values.capRatePercent).toBeCloseTo(11.1, 8);
    expect(result.values.annualDebtService).toBeGreaterThan(0);
    expect(result.values.dscr).toBeGreaterThan(1);
    expect(result.values.cashFlowAnnual).toBeCloseTo(result.values.noiAnnual - result.values.annualDebtService);
  });

  it('uses straight-line principal repayment when annual interest is zero', () => {
    const result = evaluateRealEstateDeal({ ...base, interestRatePercent: 0 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.values.monthlyDebtService).toBeCloseTo(750000 / (30 * 12));
  });

  it('handles an all-cash purchase without dividing by zero', () => {
    const result = evaluateRealEstateDeal({ ...base, downPaymentPercent: 100 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.loanAmount).toBe(0);
      expect(result.values.monthlyDebtService).toBe(0);
      expect(result.values.dscr).toBeNull();
    }
  });

  it('rejects invalid, nonfinite and out-of-range inputs without fake metrics', () => {
    const invalid = [
      { ...base, purchasePrice: 0 },
      { ...base, units: 0 },
      { ...base, units: 1.5 },
      { ...base, vacancyPercent: 101 },
      { ...base, downPaymentPercent: -1 },
      { ...base, rentPerUnitMonthly: Number.NaN },
      { ...base, interestRatePercent: Infinity },
      { ...base, amortizationYears: 0 },
      { ...base, closingCosts: -1 }
    ];
    invalid.forEach((item) => expect(evaluateRealEstateDeal(item).ok).toBe(false));
  });

  it('flags loss-making properties but does not present a financing approval', () => {
    const result = evaluateRealEstateDeal({ ...base, rentPerUnitMonthly: 100 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.noiAnnual).toBeLessThan(0);
      expect(result.risks.some((risk) => risk.id === 'negative-noi')).toBe(true);
      expect(result.risks.some((risk) => risk.id === 'debt-coverage')).toBe(true);
    }
  });

  it('flags cash shortfall and conservative coverage threshold', () => {
    const result = evaluateRealEstateDeal({ ...base, interestRatePercent: 30 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.risks.some((risk) => risk.id === 'negative-cash-flow')).toBe(true);
      expect(result.risks.some((risk) => risk.id === 'debt-coverage')).toBe(true);
    }
  });
});
