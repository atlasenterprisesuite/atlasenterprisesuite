import type { WorkAutonomyLevel } from './work-types';

export type WorkActionSensitivity = 'low' | 'medium' | 'high' | 'critical';

export type WorkActionPolicyInput = {
  autonomyLevel: WorkAutonomyLevel;
  sensitivity: WorkActionSensitivity;
  reversible: boolean;
  mutation: boolean;
  paidCost: number;
  budgetLimit: number | null;
  permissionsSatisfied: boolean;
  envelopeAllowed: boolean;
  regulated: boolean;
};

export type WorkActionPolicyDecision = {
  outcome: 'allow' | 'require_approval' | 'deny';
  reason: string;
};

export function evaluateWorkActionPolicy(input: WorkActionPolicyInput): WorkActionPolicyDecision {
  if (!input.permissionsSatisfied) return { outcome: 'deny', reason: 'permission_required' };
  if (!input.envelopeAllowed) return { outcome: 'deny', reason: 'execution_envelope_denied' };

  const effectiveBudget = input.budgetLimit ?? 0;
  const paidCost = Number.isFinite(input.paidCost) && input.paidCost > 0 ? input.paidCost : 0;
  if (paidCost > effectiveBudget) return { outcome: 'deny', reason: 'budget_exceeded' };

  if (!input.mutation) return { outcome: 'allow', reason: 'read_only_action_allowed' };
  if (input.regulated) return { outcome: 'require_approval', reason: 'regulated_mutation_requires_approval' };
  if (!input.reversible) return { outcome: 'require_approval', reason: 'irreversible_mutation_requires_approval' };
  if (input.autonomyLevel === 'manual') return { outcome: 'require_approval', reason: 'manual_mutation_requires_approval' };
  if (input.autonomyLevel === 'guided' && (input.sensitivity === 'high' || input.sensitivity === 'critical')) {
    return { outcome: 'require_approval', reason: 'guided_high_risk_mutation' };
  }

  if (input.autonomyLevel === 'autonomous') return { outcome: 'allow', reason: 'autonomous_action_within_policy' };
  return { outcome: 'allow', reason: 'guided_reversible_mutation_allowed' };
}
