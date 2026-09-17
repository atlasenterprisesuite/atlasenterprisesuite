import { getProtectedActionPolicy, resolveSecurityDelaySeconds } from './policy';
import type {
  OptionalRiskSignal,
  RiskEvaluation,
  RiskEvaluationInput,
  RiskReason,
  RiskSignalName
} from './types';

function appendProviderSignal(
  signalName: RiskSignalName,
  value: OptionalRiskSignal | undefined,
  signalsUsed: string[],
  signalsUnknown: RiskSignalName[]
) {
  if (value === undefined || value === 'unknown') {
    signalsUnknown.push(signalName);
    return;
  }
  signalsUsed.push(`${signalName}_${value}`);
}

function calculateScore(input: RiskEvaluationInput) {
  let score = 10;
  if (input.deviceStatus === 'unknown') score = Math.max(score, 40);
  if (input.deviceStatus === 'untrusted') score = Math.max(score, 60);
  if (input.riskLevel === 'medium') score = Math.max(score, 50);
  if (input.riskLevel === 'high') score = Math.max(score, 80);
  if (input.recentCriticalChange) score = Math.min(100, score + 10);
  if (input.recoveryHold || input.sessionRevoked || input.deviceStatus === 'revoked' || input.deviceStatus === 'compromised') return 100;
  return score;
}

export function evaluateSecurityRisk(input: RiskEvaluationInput): RiskEvaluation {
  const policy = getProtectedActionPolicy(input.action);
  const reasons: RiskReason[] = [];
  const signalsUsed: string[] = [];
  const signalsUnknown: RiskSignalName[] = [];

  if (input.deviceStatus === 'unknown') signalsUnknown.push('device_status');
  else signalsUsed.push(`device_${input.deviceStatus}`);

  appendProviderSignal('network_reputation', input.networkReputation, signalsUsed, signalsUnknown);
  appendProviderSignal('location_consistency', input.locationConsistency, signalsUsed, signalsUnknown);
  appendProviderSignal('sim_evidence', input.simEvidence, signalsUsed, signalsUnknown);

  if (input.deviceStatus === 'revoked') reasons.push('device_revoked');
  if (input.deviceStatus === 'compromised') reasons.push('device_compromised');
  if (input.sessionRevoked) reasons.push('session_revoked');
  if (input.recoveryHold) reasons.push('recovery_hold');

  if (reasons.length > 0) {
    return {
      decision: 'deny',
      score: 100,
      reasons,
      requiredAssurance: null,
      delaySeconds: null,
      signalsUsed,
      signalsUnknown,
      policyVersion: 'security-protection-v1'
    };
  }

  if (policy.requiresPasskey && !input.passkeyVerified) {
    reasons.push('passkey_required');
    return {
      decision: 'step_up',
      score: calculateScore(input),
      reasons,
      requiredAssurance: 'passkey',
      delaySeconds: null,
      signalsUsed,
      signalsUnknown,
      policyVersion: 'security-protection-v1'
    };
  }

  const nonTrustedDevice = input.deviceStatus !== 'trusted';
  const highRiskContext = input.riskLevel === 'high';
  const shouldDelay = policy.delayOnUntrustedOrHighRisk && (nonTrustedDevice || highRiskContext || input.recentCriticalChange);

  if (shouldDelay) {
    if (input.deviceStatus === 'untrusted') reasons.push('untrusted_device');
    if (input.deviceStatus === 'unknown') reasons.push('unknown_device');
    if (highRiskContext) reasons.push('high_risk_context');
    if (input.recentCriticalChange) reasons.push('recent_critical_change');

    return {
      decision: 'delay',
      score: calculateScore(input),
      reasons,
      requiredAssurance: 'passkey',
      delaySeconds: resolveSecurityDelaySeconds(policy, input.configuredDelaySeconds),
      signalsUsed,
      signalsUnknown,
      policyVersion: 'security-protection-v1'
    };
  }

  return {
    decision: 'allow',
    score: calculateScore(input),
    reasons,
    requiredAssurance: 'passkey',
    delaySeconds: null,
    signalsUsed,
    signalsUnknown,
    policyVersion: 'security-protection-v1'
  };
}
