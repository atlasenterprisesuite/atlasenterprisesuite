import { describe, expect, it } from 'vitest';
import { evaluateUsageBudget } from '../../packages/execution/src/index';

describe('execution usage policy', () => {
  it('blocks before any provider call when estimated cost exceeds budget', () => {
    expect(evaluateUsageBudget({ estimatedCost: 12, remainingBudget: 10 })).toEqual({
      allowed: false,
      reason: 'budget_blocked',
      estimatedCost: 12,
      remainingBudget: 10
    });
  });

  it('requires approval when cost exceeds the approval threshold but not the budget', () => {
    expect(evaluateUsageBudget({ estimatedCost: 8, remainingBudget: 10, approvalThreshold: 5 }).reason).toBe('approval_required');
  });
});
