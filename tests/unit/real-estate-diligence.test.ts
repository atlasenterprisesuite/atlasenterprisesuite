import { describe, expect, it } from 'vitest';
import {
  REAL_ESTATE_CHECKLIST,
  summarizeRealEstateReview,
  type RealEstateReviewMap
} from '../../apps/web/src/modules/real-estate/dueDiligence';
import { evaluateRealEstateDeal } from '../../apps/web/src/modules/real-estate/underwriting';

describe('Real estate due diligence stays fail-closed', () => {
  it('does not represent an empty or incomplete review as approved', () => {
    const summary = summarizeRealEstateReview({});
    expect(summary.total).toBeGreaterThan(20);
    expect(summary.pending).toBe(summary.total);
    expect(summary.p0Outstanding).toBeGreaterThan(0);
    expect(summary.readiness).toBe('blocked');
    expect(summary.independentlyVerified).toBe(false);
  });

  it('flags critical issues even with all other checks reviewed', () => {
    const statuses = Object.fromEntries(REAL_ESTATE_CHECKLIST.map((item) =>
      [item.id, 'reviewed'])) as RealEstateReviewMap;
    statuses['property-tax'] = 'issue';
    const summary = summarizeRealEstateReview(statuses);
    expect(summary.issues).toBe(1);
    expect(summary.p0Outstanding).toBe(1);
    expect(summary.readiness).toBe('blocked');
    expect(summary.independentlyVerified).toBe(false);
  });

  it('never upgrades manual completion to independent verification', () => {
    const statuses = Object.fromEntries(REAL_ESTATE_CHECKLIST.map((item) =>
      [item.id, 'reviewed'])) as RealEstateReviewMap;
    const summary = summarizeRealEstateReview(statuses);
    expect(summary.readiness).toBe('manual-review-complete');
    expect(summary.independentlyVerified).toBe(false);
  });

  it('includes hidden acquisition costs and recurring expenses', () => {
    const result = evaluateRealEstateDeal({
      purchasePrice: 500000, units: 4, rentPerUnitMonthly: 1800,
      otherIncomeMonthly: 0, vacancyPercent: 10, operatingExpensesMonthly: 1500,
      annualPropertyTaxes: 8000, annualInsurance: 6000, monthlyAssociationFees: 100,
      monthlyCapitalReserve: 400, downPaymentPercent: 20,
      interestRatePercent: 7, amortizationYears: 30,
      closingCosts: 12000, repairsBudget: 25000, lenderFees: 3000, cashReserves: 15000
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.values.effectiveGrossAnnual).toBeCloseTo(77760);
    expect(result.values.operatingExpensesAnnual).toBeCloseTo(33200);
    expect(result.values.noiAnnual).toBeCloseTo(44560);
    expect(result.values.initialCashRequired).toBe(155000);
    expect(result.values.cashFlowAnnual).toBeCloseTo(
      44560 - result.values.annualDebtService - 4800
    );
    expect(result.risks.some((risk) => risk.id === 'unpriced-tax')).toBe(false);
    expect(result.risks.some((risk) => risk.id === 'unpriced-insurance')).toBe(false);
  });

  it('flags missing insured and taxed operating costs instead of accepting zeros as verified', () => {
    const result = evaluateRealEstateDeal({
      purchasePrice: 300000, units: 1, rentPerUnitMonthly: 2500,
      otherIncomeMonthly: 0, vacancyPercent: 0, operatingExpensesMonthly: 0,
      downPaymentPercent: 25, interestRatePercent: 6, amortizationYears: 30,
      closingCosts: 0, repairsBudget: 0
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.risks.map((risk) => risk.id)).toEqual(
        expect.arrayContaining(['unpriced-tax', 'unpriced-insurance', 'missing-repairs'])
      );
    }
  });
});
