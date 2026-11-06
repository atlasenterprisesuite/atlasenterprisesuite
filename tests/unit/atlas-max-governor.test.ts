import { describe, expect, it } from 'vitest';
import { evaluateExecutionBudget } from '../../apps/web/src/services/atlas-max/governor';

describe('ATLAS MAX governor', () => {
  const base = {
    entitled: true,
    quotaRemaining: 100,
    requestedSpeed: 'max' as const,
    eligibleSpeeds: ['standard', 'fast', 'max'] as const,
    budgetRemaining: 50,
    estimatedCost: 10,
    canManageFinancialLimits: false,
    evidenceRef: 'gov-1'
  };
  it('denies exhausted quota', () =>
    expect(evaluateExecutionBudget({ ...base, quotaRemaining: 0 }).outcome).toBe('deny'));

  it('downgrades only when fast is eligible and its cost is affordable', () =>
    expect(evaluateExecutionBudget({ ...base, budgetRemaining: 5, estimatedFastCost: 4 })).toMatchObject({
      outcome: 'downgrade-speed', resolvedSpeed: 'fast'
    }));

  it('fails closed without a separate fast cost estimate', () =>
    expect(evaluateExecutionBudget({ ...base, budgetRemaining: 5 })).toMatchObject({
      outcome: 'deny', reason: 'budget_insufficient'
    }));

  it('rejects unaffordable and invalid alternate estimates', () => {
    for (const estimate of [6, Number.NaN, -1, Number.POSITIVE_INFINITY]) {
      expect(evaluateExecutionBudget({ ...base, budgetRemaining: 5, estimatedFastCost: estimate }).outcome).toBe('deny');
    }
  });

  it('rejects disallowed speed or unentitled fast fallback', () => {
    expect(evaluateExecutionBudget({ ...base, eligibleSpeeds: ['standard'] })).toMatchObject({
      outcome: 'deny', reason: 'speed_not_entitled'
    });
    expect(evaluateExecutionBudget({ ...base, budgetRemaining: 5, estimatedFastCost: 4, eligibleSpeeds: ['max'] })).toMatchObject({
      outcome: 'deny', reason: 'budget_insufficient'
    });
  });

  it('fails closed on invalid numeric inputs', () => {
    for (const patch of [
      { estimatedCost: Number.NaN }, { estimatedCost: -1 },
      { budgetRemaining: -1 }, { budgetRemaining: Number.POSITIVE_INFINITY },
      { quotaRemaining: Number.NaN }
    ]) {
      expect(evaluateExecutionBudget({ ...base, ...patch }).outcome).toBe('deny');
    }
  });

  it('allows an entitled speed within configured cap', () =>
    expect(evaluateExecutionBudget(base).outcome).toBe('allow'));

  it('denies unauthorized financial limit changes', () =>
    expect(evaluateExecutionBudget({ ...base, requestedBudgetChange: 100 }).outcome).toBe('deny'));

  it('denies unentitled execution', () =>
    expect(evaluateExecutionBudget({ ...base, entitled: false }).outcome).toBe('deny'));
});
