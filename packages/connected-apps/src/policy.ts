import type {
  ConnectedAppAccessDecision,
  ConnectedAppAccessInput,
  ConnectedAppPolicy,
  ConnectedAppPolicyEffect
} from './types';

function capabilityMatches(pattern: string, capabilityCode: string): boolean {
  const normalized = pattern.trim();
  if (!normalized) return false;
  if (normalized === capabilityCode) return true;
  if (normalized.endsWith('*')) return capabilityCode.startsWith(normalized.slice(0, -1));
  return false;
}

function policyMatches(policy: ConnectedAppPolicy, input: ConnectedAppAccessInput): boolean {
  if (!policy.enabled) return false;
  if (policy.actorKind !== 'any' && policy.actorKind !== input.actorKind) return false;
  return capabilityMatches(policy.capabilityPattern, input.capabilityCode);
}

function decision(effect: ConnectedAppPolicyEffect, reason: string): ConnectedAppAccessDecision {
  return { effect, reason };
}

export function evaluateConnectedAppPolicy(input: ConnectedAppAccessInput): ConnectedAppAccessDecision {
  const matching = input.policies.filter((policy) => policyMatches(policy, input));
  if (matching.some((policy) => policy.effect === 'deny')) return decision('deny', 'policy_denied');
  if (matching.some((policy) => policy.effect === 'approval_required')) {
    return decision('approval_required', 'policy_requires_approval');
  }
  if (matching.some((policy) => policy.effect === 'allow')) return decision('allow', 'policy_allowed');
  if (input.accessLevel === 'consequential') return decision('approval_required', 'consequential_default');
  return decision('allow', 'non_consequential_default');
}
