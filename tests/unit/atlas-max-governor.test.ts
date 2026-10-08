import { describe, expect, it } from 'vitest';
import { evaluateExecutionBudget } from '../../apps/web/src/services/atlas-max/governor';

describe('ATLAS MAX governor', () => {
  const base = { entitled: true, quotaRemaining: 100, requestedSpeed: 'max' as const, budgetRemaining: 50, estimatedCost: 10, canManageFinancialLimits: false, evidenceRef: 'gov-1' };
  it('denies exhausted quota', () => expect(evaluateExecutionBudget({ ...base, quotaRemaining: 0 }).outcome).toBe('deny'));
  it('downgrades MAX when budget cannot support it', () => expect(evaluateExecutionBudget({ ...base, budgetRemaining: 5 }).outcome).toBe('downgrade-speed'));
  it('allows within configured cap', () => expect(evaluateExecutionBudget(base).outcome).toBe('allow'));
  it('denies unauthorized financial limit changes', () => expect(evaluateExecutionBudget({ ...base, requestedBudgetChange: 100 }).outcome).toBe('deny'));
});