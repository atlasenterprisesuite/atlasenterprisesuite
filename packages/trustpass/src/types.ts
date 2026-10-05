export type RiskBand = 'low' | 'medium' | 'high' | 'critical';
export type ActionClass = 'P0' | 'P1' | 'P2' | 'P3';
export type TrustMode = 'shadow' | 'enforce';
export type AssuranceLevel = 'anonymous' | 'authenticated' | 'aal2' | 'phishing_resistant';
export type TrustDecisionKind = 'allow' | 'step_up_required' | 'temporary_hold' | 'deny';

export type RiskReason = {
  code: string;
  weight: number;
  repeatable?: boolean;
};

export type RiskResult = {
  score: number;
  band: RiskBand;
  reasonCodes: string[];
};

export type TrustDecisionInput = {
  mode: TrustMode;
  actionClass: ActionClass;
  minimumAssurance: AssuranceLevel;
  observedAssurance: AssuranceLevel;
  riskScore: number;
  reasonCodes: readonly string[];
  policyId: string;
  policyVersion: number;
  correlationId: string;
};

export type TrustDecision = {
  decision: TrustDecisionKind;
  recommendedDecision: TrustDecisionKind;
  minimumAssurance: AssuranceLevel;
  observedAssurance: AssuranceLevel;
  policyId: string;
  policyVersion: number;
  riskScore: number;
  riskBand: RiskBand;
  reasonCodes: string[];
  correlationId: string;
};

export type TrustActionInput = {
  actionType: string;
  tenantId: string;
  resourceId: string | null;
  payload: unknown;
};
