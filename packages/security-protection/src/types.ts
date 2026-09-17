export type RiskDecision = 'allow' | 'step_up' | 'delay' | 'deny';

export type DeviceSecurityStatus = 'trusted' | 'untrusted' | 'revoked' | 'compromised' | 'unknown';

export type OptionalRiskSignal = 'positive' | 'negative' | 'unknown';

export type RiskLevel = 'low' | 'medium' | 'high';

export type ProtectedActionCode =
  | 'account.password.change'
  | 'account.recovery.change'
  | 'account.passkey.remove'
  | 'account.protection.disable'
  | 'account.delete'
  | 'admin.role.grant'
  | 'admin.role.revoke'
  | 'payout.destination.change'
  | 'api_key.create_privileged'
  | 'api_key.revoke_privileged'
  | 'session.revoke_others'
  | 'device.trust'
  | 'device.revoke';

export type RiskReason =
  | 'device_revoked'
  | 'device_compromised'
  | 'session_revoked'
  | 'recovery_hold'
  | 'passkey_required'
  | 'untrusted_device'
  | 'unknown_device'
  | 'high_risk_context'
  | 'recent_critical_change';

export type RiskSignalName =
  | 'device_status'
  | 'network_reputation'
  | 'location_consistency'
  | 'sim_evidence';

export type ProtectedActionPolicy = {
  action: ProtectedActionCode;
  requiresPasskey: true;
  delayOnUntrustedOrHighRisk: boolean;
  defaultDelaySeconds: number | null;
  minDelaySeconds: number | null;
  maxDelaySeconds: number | null;
};

export type RiskEvaluationInput = {
  action: ProtectedActionCode;
  deviceStatus: DeviceSecurityStatus;
  passkeyVerified: boolean;
  recoveryHold: boolean;
  sessionRevoked: boolean;
  recentCriticalChange: boolean;
  riskLevel: RiskLevel;
  networkReputation?: OptionalRiskSignal;
  locationConsistency?: OptionalRiskSignal;
  simEvidence?: OptionalRiskSignal;
  configuredDelaySeconds?: number;
};

export type RiskEvaluation = {
  decision: RiskDecision;
  score: number;
  reasons: RiskReason[];
  requiredAssurance: 'passkey' | null;
  delaySeconds: number | null;
  signalsUsed: string[];
  signalsUnknown: RiskSignalName[];
  policyVersion: 'security-protection-v1';
};
