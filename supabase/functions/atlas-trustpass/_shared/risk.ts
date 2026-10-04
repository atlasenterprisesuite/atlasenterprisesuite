import {
  calculateRisk,
  evaluateTrustDecision,
  type ActionClass,
  type AssuranceLevel,
  type RiskReason,
  type TrustDecision
} from '../../../../packages/trustpass/src/index.ts';
import type { TrustPolicyRow } from './repository.ts';

export const HARD_INTEGRITY_REASONS = [
  'trust_replay_detected',
  'trust_tenant_mismatch',
  'trust_session_mismatch',
  'trust_action_mismatch'
] as const;

function baselineAssurance(actionClass: ActionClass): AssuranceLevel {
  if (actionClass === 'P0') return 'phishing_resistant';
  if (actionClass === 'P1') return 'aal2';
  return 'authenticated';
}

export type TrustEvaluation = {
  decision: TrustDecision['decision'];
  recommendedDecision: TrustDecision['recommendedDecision'];
  riskScore: number;
  riskBand: TrustDecision['riskBand'];
  reasonCodes: string[];
  policyId: string;
  persistedPolicyId: string | null;
  policyVersion: number;
  mode: 'shadow' | 'enforce';
  minimumAssurance: AssuranceLevel;
};

export function evaluateTrustRequest(input: {
  actionClass: ActionClass;
  observedAssurance: AssuranceLevel;
  policy: TrustPolicyRow | null;
  serverReasons: readonly RiskReason[];
  correlationId: string;
}): TrustEvaluation {
  const { policy } = input;
  const risk = calculateRisk(input.serverReasons);
  const mode: 'shadow' | 'enforce' = policy?.mode === 'enforce' ? 'enforce' : 'shadow';
  const minimumAssurance = policy?.minimum_assurance || baselineAssurance(input.actionClass);
  const policyId = policy?.id || 'platform-baseline-v1';
  const policyVersion = policy?.version || 1;

  const result = evaluateTrustDecision({
    mode,
    actionClass: input.actionClass,
    minimumAssurance,
    observedAssurance: input.observedAssurance,
    riskScore: risk.score,
    reasonCodes: risk.reasonCodes,
    policyId,
    policyVersion,
    correlationId: input.correlationId
  });

  return {
    decision: result.decision,
    recommendedDecision: result.recommendedDecision,
    riskScore: result.riskScore,
    riskBand: result.riskBand,
    reasonCodes: result.reasonCodes,
    policyId,
    persistedPolicyId: policy?.id || null,
    policyVersion,
    mode,
    minimumAssurance
  };
}
