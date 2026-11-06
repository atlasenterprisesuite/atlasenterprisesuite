import type { SpeedClass } from './contracts';

export type GovernorOutcome = 'allow' | 'allow-with-cap' | 'downgrade-speed' | 'choose-alternate-provider' | 'deny';

export interface ExecutionBudgetInput {
  entitled: boolean;
  quotaRemaining: number;
  requestedSpeed: SpeedClass;
  /** Must originate from server-authoritative entitlement policy, never a client-selected tier. */
  eligibleSpeeds?: readonly SpeedClass[];
  budgetRemaining: number;
  estimatedCost: number;
  /** Separate estimate for the lower-speed execution, produced by the trusted cost preflight. */
  estimatedFastCost?: number;
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

/**
 * Pure pre-dispatch policy helper: this never charges, books, or executes work.
 * Callers must enforce tenant/RBAC policy and use trusted server-side
 * entitlement and cost inputs; a browser-supplied estimate is not evidence.
 */
export function evaluateExecutionBudget(input: ExecutionBudgetInput): GovernorDecision {
  if (input.entitled !== true) return { outcome: 'deny', reason: 'not_entitled' };
  if (input.requestedBudgetChange !== undefined && input.canManageFinancialLimits !== true) {
    return { outcome: 'deny', reason: 'financial_limit_change_unauthorized' };
  }
  if (
    input.requestedBudgetChange !== undefined &&
    (!Number.isFinite(input.requestedBudgetChange) || input.requestedBudgetChange < 0)
  ) return { outcome: 'deny', reason: 'invalid_budget_change' };
  if (!Number.isFinite(input.quotaRemaining) || input.quotaRemaining <= 0) {
    return { outcome: 'deny', reason: 'quota_exhausted' };
  }
  if (
    !Number.isFinite(input.budgetRemaining) || input.budgetRemaining < 0 ||
    !Number.isFinite(input.estimatedCost) || input.estimatedCost < 0
  ) return { outcome: 'deny', reason: 'invalid_budget_estimate' };
  if (!Array.isArray(input.eligibleSpeeds) || !input.eligibleSpeeds.includes(input.requestedSpeed)) {
    return { outcome: 'deny', reason: 'speed_not_entitled' };
  }
  if (input.estimatedCost > input.budgetRemaining) {
    if (
      input.requestedSpeed === 'max' &&
      input.eligibleSpeeds.includes('fast') &&
      input.estimatedFastCost !== undefined &&
      Number.isFinite(input.estimatedFastCost) &&
      input.estimatedFastCost >= 0 &&
      input.estimatedFastCost <= input.budgetRemaining
    ) {
      return {
        outcome: 'downgrade-speed', resolvedSpeed: 'fast',
        reason: 'budget_insufficient', evidenceRef: input.evidenceRef
      };
    }
    return { outcome: 'deny', reason: 'budget_insufficient', evidenceRef: input.evidenceRef };
  }
  return { outcome: 'allow', resolvedSpeed: input.requestedSpeed, evidenceRef: input.evidenceRef };
}
