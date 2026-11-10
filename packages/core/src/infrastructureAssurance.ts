export type AssuranceStatus =
  | 'verified'
  | 'partially_verified'
  | 'unverified'
  | 'unknown'
  | 'blocked'
  | 'not_applicable'
  | 'degraded'
  | 'failed';

export type AssuranceConfidence = 'high' | 'medium' | 'low' | 'unknown';

export type AssuranceFact<T> = {
  desired: T | null;
  observed: T | null;
  verified: T | null;
  status: AssuranceStatus;
  stale: boolean;
  missingEvidence: boolean;
  confidence: AssuranceConfidence;
  evidenceIds: string[];
};

export type InfrastructureProviderProfile = {
  providerId: string;
  providerKind: 'supabase' | 'cloudflare' | 'vercel' | 'aws' | 'self_hosted' | 'other';
  displayName: string;
  organizationId: string;
  environment: 'preview' | 'staging' | 'production';
  authoritativeFor: string[];
  optionalFor: string[];
  connectionEvidenceRef: string | null;
  lastObservedAt: string | null;
};

export type RecoveryEvidence = {
  backupMode: 'daily_backup' | 'pitr' | 'external' | 'none' | 'unknown';
  retentionDays: number | null;
  lastSuccessfulBackupAt: string | null;
  lastRestoreDrillAt: string | null;
  restoreTarget: string | null;
  observedRestoreDurationSeconds: number | null;
  declaredRpoSeconds: number | null;
  declaredRtoSeconds: number | null;
  providerContractRef: string | null;
  runbookEvidenceRef: string | null;
};

export type SharedResponsibilityControl = {
  controlId: string;
  framework: 'SOC2' | 'ISO27001' | 'HIPAA' | 'PCI' | 'custom';
  responsibility: 'provider' | 'atlas' | 'shared';
  providerEvidenceRef: string | null;
  atlasEvidenceRef: string | null;
  status: AssuranceStatus;
  expiresAt: string | null;
};

export type InfrastructureAssuranceEvidence = {
  evidenceId: string;
  organizationId: string;
  providerId: string;
  domain: string;
  claim: string;
  observedValue: unknown;
  status: AssuranceStatus;
  sourceType:
    | 'provider_api'
    | 'runtime_probe'
    | 'contract'
    | 'document'
    | 'operator_attestation'
    | 'test_run';
  sourceRef: string | null;
  confidence: AssuranceConfidence;
  observedAt: string;
  expiresAt: string | null;
  supersedesEvidenceId: string | null;
};

export type InfrastructureAssurancePolicy = {
  policyId: string;
  organizationId: string;
  environment: 'staging' | 'production';
  domain: string;
  requirement: string;
  severity: 'P0' | 'P1' | 'P2';
  requiredStatus: AssuranceStatus;
  maxEvidenceAgeSeconds: number | null;
  blocking: boolean;
};

export type CapacityState = 'nominal' | 'watch' | 'warning' | 'critical';

export type ReleaseAssuranceBlocker = {
  policyId: string;
  domain: string;
  requirement: string;
  severity: 'P0' | 'P1' | 'P2';
  status: AssuranceStatus;
  requiredStatus: AssuranceStatus;
};

export type ReleaseAssuranceGate = {
  blocked: boolean;
  blockers: ReleaseAssuranceBlocker[];
};

export type ProviderFitnessDomain = {
  score: number | null;
  status: AssuranceStatus;
  stale?: boolean;
};

export type ProviderFitnessInput = {
  reliability: ProviderFitnessDomain;
  security: ProviderFitnessDomain;
  compliance: ProviderFitnessDomain;
  scalability: ProviderFitnessDomain;
  operationalSupport: ProviderFitnessDomain;
  costPredictability: ProviderFitnessDomain;
  portability: ProviderFitnessDomain;
  developerVelocity: ProviderFitnessDomain;
};

export type ProviderFitnessClassification =
  | 'strong_strategic_fit'
  | 'viable_with_mitigations'
  | 'selective_use'
  | 'do_not_deepen_dependency'
  | 'insufficient_evidence';

export type ProviderFitnessScore = {
  score: number | null;
  classification: ProviderFitnessClassification;
  confidence: AssuranceConfidence;
  missingEvidence: string[];
  staleEvidence: string[];
  weights: Record<keyof ProviderFitnessInput, number>;
};

const PROVIDER_FITNESS_WEIGHTS: Record<keyof ProviderFitnessInput, number> = {
  reliability: 0.2,
  security: 0.15,
  compliance: 0.15,
  scalability: 0.15,
  operationalSupport: 0.1,
  costPredictability: 0.1,
  portability: 0.1,
  developerVelocity: 0.05
};

export function capacityStateForPercent(percent: number): CapacityState {
  if (!Number.isFinite(percent) || percent < 0) {
    throw new Error('capacity percentage must be a finite non-negative number');
  }
  if (percent >= 95) return 'critical';
  if (percent >= 85) return 'warning';
  if (percent >= 70) return 'watch';
  return 'nominal';
}

function parseTimestamp(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isEvidenceStale(input: {
  evidence: InfrastructureAssuranceEvidence;
  nowMs: number;
  maxEvidenceAgeSeconds: number | null;
}): boolean {
  const expiresAt = parseTimestamp(input.evidence.expiresAt);
  if (expiresAt !== null && expiresAt <= input.nowMs) return true;

  if (input.maxEvidenceAgeSeconds === null) return false;
  const observedAt = parseTimestamp(input.evidence.observedAt);
  if (observedAt === null) return true;
  return input.nowMs - observedAt > input.maxEvidenceAgeSeconds * 1000;
}

export function evaluateAssuranceFact<T>(input: {
  desired: T | null;
  observed: T | null;
  evidence: InfrastructureAssuranceEvidence[];
  now: string;
  maxEvidenceAgeSeconds: number | null;
}): AssuranceFact<T> {
  const nowMs = Date.parse(input.now);
  if (!Number.isFinite(nowMs)) throw new Error('invalid assurance evaluation timestamp');

  if (input.evidence.length === 0) {
    return {
      desired: input.desired,
      observed: input.observed,
      verified: null,
      status: 'unknown',
      stale: false,
      missingEvidence: true,
      confidence: 'unknown',
      evidenceIds: []
    };
  }

  const ordered = [...input.evidence].sort(
    (a, b) => (parseTimestamp(b.observedAt) ?? 0) - (parseTimestamp(a.observedAt) ?? 0)
  );
  const current = ordered[0];
  const stale = isEvidenceStale({
    evidence: current,
    nowMs,
    maxEvidenceAgeSeconds: input.maxEvidenceAgeSeconds
  });

  if (stale) {
    return {
      desired: input.desired,
      observed: input.observed,
      verified: null,
      status: 'unverified',
      stale: true,
      missingEvidence: false,
      confidence: 'low',
      evidenceIds: ordered.map((item) => item.evidenceId)
    };
  }

  const verified = current.status === 'verified' ? input.observed : null;
  return {
    desired: input.desired,
    observed: input.observed,
    verified,
    status: current.status,
    stale: false,
    missingEvidence: false,
    confidence: current.confidence,
    evidenceIds: ordered.map((item) => item.evidenceId)
  };
}

export function evaluateSharedResponsibilityControl(
  control: SharedResponsibilityControl
): SharedResponsibilityControl {
  const providerPresent = Boolean(control.providerEvidenceRef);
  const atlasPresent = Boolean(control.atlasEvidenceRef);

  let status: AssuranceStatus;
  if (control.responsibility === 'provider') {
    status = providerPresent ? 'verified' : 'unverified';
  } else if (control.responsibility === 'atlas') {
    status = atlasPresent ? 'verified' : 'unverified';
  } else if (providerPresent && atlasPresent) {
    status = 'verified';
  } else if (providerPresent || atlasPresent) {
    status = 'partially_verified';
  } else {
    status = 'unverified';
  }

  return { ...control, status };
}

export function evaluateReleaseAssuranceGate(input: {
  policies: InfrastructureAssurancePolicy[];
  facts: Record<string, { status: AssuranceStatus } | undefined>;
}): ReleaseAssuranceGate {
  const blockers = input.policies.flatMap<ReleaseAssuranceBlocker>((policy) => {
    if (!policy.blocking) return [];
    const status = input.facts[policy.requirement]?.status ?? 'unknown';
    if (status === policy.requiredStatus) return [];
    return [
      {
        policyId: policy.policyId,
        domain: policy.domain,
        requirement: policy.requirement,
        severity: policy.severity,
        status,
        requiredStatus: policy.requiredStatus
      }
    ];
  });

  return { blocked: blockers.length > 0, blockers };
}

function classificationForScore(score: number): ProviderFitnessClassification {
  if (score >= 4.25) return 'strong_strategic_fit';
  if (score >= 3.5) return 'viable_with_mitigations';
  if (score >= 2.75) return 'selective_use';
  return 'do_not_deepen_dependency';
}

export function calculateProviderFitnessScore(input: ProviderFitnessInput): ProviderFitnessScore {
  const keys = Object.keys(PROVIDER_FITNESS_WEIGHTS) as (keyof ProviderFitnessInput)[];
  const missingEvidence = keys.filter((key) => {
    const domain = input[key];
    return domain.score === null || !['verified', 'partially_verified'].includes(domain.status);
  });
  const staleEvidence = keys.filter((key) => input[key].stale === true);

  const weightedScore = keys.reduce((total, key) => {
    const score = input[key].score;
    return total + (score === null ? 0 : score * PROVIDER_FITNESS_WEIGHTS[key]);
  }, 0);

  if (missingEvidence.length > 0 || staleEvidence.length > 0) {
    return {
      score: Number(weightedScore.toFixed(2)),
      classification: 'insufficient_evidence',
      confidence: 'low',
      missingEvidence,
      staleEvidence,
      weights: { ...PROVIDER_FITNESS_WEIGHTS }
    };
  }

  const hasPartial = keys.some((key) => input[key].status === 'partially_verified');
  return {
    score: Number(weightedScore.toFixed(2)),
    classification: classificationForScore(weightedScore),
    confidence: hasPartial ? 'medium' : 'high',
    missingEvidence,
    staleEvidence,
    weights: { ...PROVIDER_FITNESS_WEIGHTS }
  };
}
