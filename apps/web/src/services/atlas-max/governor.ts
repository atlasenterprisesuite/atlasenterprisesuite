import type { SpeedClass } from './contracts';

export type GovernorOutcome = 'allow' | 'allow-with-cap' | 'downgrade-speed' | 'choose-alternate-provider' | 'deny';

export interface ExecutionBudgetInput {
  entitled: boolean;
  quotaRemaining: number;
  requestedSpeed: SpeedClass;
  budgetRemaining: number;
  estimatedCost: number;
  canManageFinancialLimits: boolean;
  requestedBudgetChange?: number;
  evidenceRef?: string;
}

export interface GovernorDecision {
  outcome: GovernorOutcome;
  resolvedSpeed?: SpeedClass;
  reason?: string;
  evidenceRef?: string;
}

export function evaluateExecutionBudget(input: ExecutionBudgetInput): GovernorDecision {
  if (!input.entitled) return { outcome: 'deny', reason: 'not_entitled' };
  if (input.requestedBudgetChange !== undefined && !input.canManageFinancialLimits) return { outcome: 'deny', reason: 'financial_limit_change_unauthorized' };
  if (input.quotaRemaining <= 0) return { outcome: 'deny', reason: 'quota_exhausted' };
  if (input.estimatedCost > input.budgetRemaining) {
    if (input.requestedSpeed === 'max') return { outcome: 'downgrade-speed', resolvedSpeed: 'fast', reason: 'budget_insufficient', evidenceRef: input.evidenceRef };
    return { outcome: 'deny', reason: 'budget_insufficient', evidenceRef: input.evidenceRef };
  }
  return { outcome: 'allow', resolvedSpeed: input.requestedSpeed, evidenceRef: input.evidenceRef };
}
