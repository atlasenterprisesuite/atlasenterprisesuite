import { riskBand } from './risk';
import type {
  AssuranceLevel,
  TrustDecision,
  TrustDecisionInput,
  TrustDecisionKind
} from './types';

const ASSURANCE_RANK: Record<AssuranceLevel, number> = {
  anonymous: 0,
  authenticated: 1,
  aal2: 2,
  phishing_resistant: 3
};

const HARD_DENY_REASONS = new Set([
  'trust_replay_detected',
  'trust_tenant_mismatch',
  'trust_session_mismatch',
  'trust_action_mismatch',
  'trust_grant_consumed',
  'trust_grant_revoked'
]);

function assuranceSatisfied(observed: AssuranceLevel, minimum: AssuranceLevel) {
  return ASSURANCE_RANK[observed] >= ASSURANCE_RANK[minimum];
}

function recommendedDecision(input: TrustDecisionInput): TrustDecisionKind {
  const band = riskBand(input.riskScore);
  const hardDeny = input.reasonCodes.some((code) => HARD_DENY_REASONS.has(code));

  if (hardDeny) return 'deny';
  if (input.actionClass === 'P0' && band === 'critical') return 'deny';
  if (!assuranceSatisfied(input.observedAssurance, input.minimumAssurance)) return 'step_up_required';

  if (band === 'critical') {
    if (input.actionClass === 'P1') return 'temporary_hold';
    if (input.actionClass === 'P2') return 'step_up_required';
  }

  if (band === 'high' && input.actionClass !== 'P3') return 'step_up_required';
  if (band === 'medium' && (input.actionClass === 'P0' || input.actionClass === 'P1')) return 'step_up_required';

  return 'allow';
}

export function evaluateTrustDecision(input: TrustDecisionInput): TrustDecision {
  const recommended = recommendedDecision(input);
  const baselineSatisfied = assuranceSatisfied(input.observedAssurance, input.minimumAssurance);
  const hardDeny = input.reasonCodes.some((code) => HARD_DENY_REASONS.has(code));

  const decision: TrustDecisionKind = input.mode === 'shadow'
    && baselineSatisfied
    && !hardDeny
    && (input.actionClass === 'P2' || input.actionClass === 'P3')
    ? 'allow'
    : recommended;

  return {
    decision,
    recommendedDecision: recommended,
    minimumAssurance: input.minimumAssurance,
    observedAssurance: input.observedAssurance,
    policyId: input.policyId,
    policyVersion: input.policyVersion,
    riskScore: Math.min(100, Math.max(0, Math.round(input.riskScore))),
    riskBand: riskBand(input.riskScore),
    reasonCodes: [...input.reasonCodes],
    correlationId: input.correlationId
  };
}
