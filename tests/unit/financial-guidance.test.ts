import { describe, expect, it } from 'vitest';
import { analyzeFinancialGuidance } from '../../packages/advisory/src';

describe('ATLAS client financial guidance', () => {
  it('prioritizes near-term collection risk ahead of ordinary APR optimization', () => {
    const result = analyzeFinancialGuidance({
      asOf: '2026-09-23',
      dataConfidence: 'confirmed',
      availableCash: 500,
      confirmedIncome30d: 1500,
      essentialExpenses30d: 700,
      recurringObligations30d: 100,
      debts: [
        { id: 'collection', name: 'Collection-risk plan', balance: 150, cureAmount: 150, aprPercent: 10, collectionRiskDate: '2026-09-28' },
        { id: 'card', name: 'High APR card', balance: 2000, minimumPayment: 100, aprPercent: 31 }
      ]
    });

    expect(result.priorities[0].debtId).toBe('collection');
    expect(result.priorities[0].urgency).toBe('critical');
  });

  it('protects essentials and a seven-day operating reserve before debt allocation', () => {
    const result = analyzeFinancialGuidance({
      asOf: '2026-09-23',
      dataConfidence: 'confirmed',
      availableCash: 300,
      confirmedIncome30d: 1200,
      essentialExpenses30d: 900,
      recurringObligations30d: 100,
      debts: [{ id: 'card', name: 'Card', balance: 1000, minimumPayment: 200, aprPercent: 29 }]
    });

    expect(result.operatingReserveTarget).toBeCloseTo(210, 2);
    expect(result.allocatableCash).toBeCloseTo(290, 2);
    expect(result.suggestedPayments[0].amount).toBe(200);
  });

  it('does not fabricate debt actions when balances are absent', () => {
    const result = analyzeFinancialGuidance({
      asOf: '2026-09-23',
      dataConfidence: 'incomplete',
      availableCash: 0,
      confirmedIncome30d: 0,
      essentialExpenses30d: 0,
      recurringObligations30d: 0,
      debts: []
    });

    expect(result.totalDebt).toBe(0);
    expect(result.priorities).toEqual([]);
    expect(result.suggestedPayments).toEqual([]);
    expect(result.warnings.some((warning) => warning.includes('incomplete'))).toBe(true);
  });

  it('surfaces missing cure amounts on overdue obligations', () => {
    const result = analyzeFinancialGuidance({
      asOf: '2026-09-23',
      dataConfidence: 'confirmed',
      availableCash: 100,
      confirmedIncome30d: 0,
      essentialExpenses30d: 0,
      recurringObligations30d: 0,
      debts: [{ id: 'late', name: 'Late account', balance: 500, overdue: true }]
    });

    expect(result.priorities[0].reasons).toContain('Amount needed to cure is not recorded');
    expect(result.warnings.join(' ')).toContain('cure amount');
  });
});
