export type AtlasUsageDecision = {
  allowed: boolean;
  reason: 'allowed' | 'approval_required' | 'budget_blocked';
  estimatedCost: number;
  remainingBudget: number;
};

export type UsageBudgetInput = {
  estimatedCost: number;
  remainingBudget: number;
  approvalThreshold?: number;
};

export function evaluateUsageBudget(input: UsageBudgetInput): AtlasUsageDecision {
  if (input.estimatedCost < 0 || input.remainingBudget < 0 || (input.approvalThreshold !== undefined && input.approvalThreshold < 0)) {
    throw new Error('invalid_input');
  }

  if (input.estimatedCost > input.remainingBudget) {
    return {
      allowed: false,
      reason: 'budget_blocked',
      estimatedCost: input.estimatedCost,
      remainingBudget: input.remainingBudget
    };
  }

  if (input.approvalThreshold !== undefined && input.estimatedCost > input.approvalThreshold) {
    return {
      allowed: false,
      reason: 'approval_required',
      estimatedCost: input.estimatedCost,
      remainingBudget: input.remainingBudget
    };
  }

  return {
    allowed: true,
    reason: 'allowed',
    estimatedCost: input.estimatedCost,
    remainingBudget: input.remainingBudget
  };
}
