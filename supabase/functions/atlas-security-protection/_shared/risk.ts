import { evaluateSecurityRisk } from '../../../../packages/security-protection/src/risk.ts';
import type {
  DeviceSecurityStatus,
  OptionalRiskSignal,
  ProtectedActionCode,
  RiskEvaluation
} from '../../../../packages/security-protection/src/types.ts';

export const RISK_DECISIONS = ['allow', 'step_up', 'delay', 'deny'] as const;

type PersistedDevice = { status?: string | null } | null;

type ServerRiskEvidence = {
  networkReputation?: OptionalRiskSignal;
  locationConsistency?: OptionalRiskSignal;
  simEvidence?: OptionalRiskSignal;
  recentCriticalChange?: boolean;
  sessionRevoked?: boolean;
  recoveryHold?: boolean;
};

function normalizeDeviceStatus(device: PersistedDevice): DeviceSecurityStatus {
  const status = String(device?.status || 'unknown');
  if (status === 'trusted' || status === 'untrusted' || status === 'revoked' || status === 'compromised') return status;
  return 'unknown';
}

function normalizeSignal(value: OptionalRiskSignal | undefined): OptionalRiskSignal {
  return value === 'positive' || value === 'negative' ? value : 'unknown';
}

export function evaluateProtectedActionRisk(input: {
  actionCode: ProtectedActionCode;
  device: PersistedDevice;
  passkeyVerified: boolean;
  evidence?: ServerRiskEvidence | null;
  configuredDelaySeconds?: number;
}): RiskEvaluation {
  const evidence = input.evidence || {};
  const deviceStatus = normalizeDeviceStatus(input.device);
  const networkReputation = normalizeSignal(evidence.networkReputation) || 'unknown';
  const locationConsistency = normalizeSignal(evidence.locationConsistency) || 'unknown';
  const simEvidence = normalizeSignal(evidence.simEvidence) || 'unknown';

  if (deviceStatus === 'revoked' || deviceStatus === 'compromised') {
    return evaluateSecurityRisk({
      action: input.actionCode,
      deviceStatus,
      passkeyVerified: input.passkeyVerified,
      recoveryHold: evidence.recoveryHold === true,
      sessionRevoked: evidence.sessionRevoked === true,
      recentCriticalChange: evidence.recentCriticalChange === true,
      riskLevel: 'high',
      networkReputation,
      locationConsistency,
      simEvidence,
      configuredDelaySeconds: input.configuredDelaySeconds
    });
  }

  return evaluateSecurityRisk({
    action: input.actionCode,
    deviceStatus,
    passkeyVerified: input.passkeyVerified,
    recoveryHold: evidence.recoveryHold === true,
    sessionRevoked: evidence.sessionRevoked === true,
    recentCriticalChange: evidence.recentCriticalChange === true,
    riskLevel: deviceStatus === 'trusted' ? 'low' : 'medium',
    networkReputation,
    locationConsistency,
    simEvidence,
    configuredDelaySeconds: input.configuredDelaySeconds
  });
}
