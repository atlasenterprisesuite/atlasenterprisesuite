export const EVIDENCE_BACKED_COMPLETION_STATES = [
  'connected',
  'approved',
  'paid',
  'signed',
  'printed',
  'shipped',
  'fulfilled'
] as const;

export type EvidenceBackedCompletionState =
  (typeof EVIDENCE_BACKED_COMPLETION_STATES)[number];

export type AuthenticatedEvidence = {
  authenticated: boolean;
  authoritative: boolean;
  source: string;
  reference: string;
  observedAt: string;
};

export type EvidenceFreshnessPolicy = {
  nowMs?: number;
  maxAgeMs?: number;
  futureToleranceMs?: number;
};

export type EvidencePriority = 'P0' | 'P1';
export type EvidenceStatus = 'pass' | 'fail' | 'unverified' | 'warning';
export type EvidenceMode = 'fail-closed' | 'warning-only';
export type EvidenceOutcome = 'pass' | 'blocked' | 'fail';

export type EvidenceCheck = {
  id: string;
  priority: EvidencePriority;
  status: EvidenceStatus;
  observedAt: string;
  required?: boolean;
  source?: string;
  reference?: string;
  detail?: string;
  sha256?: string;
};

export type EvidenceBundle = {
  version: 1;
  subject: string;
  environment: string;
  mode: EvidenceMode;
  generatedAt: string;
  checks: EvidenceCheck[];
};

export type EvidenceEvaluation = {
  outcome: EvidenceOutcome;
  productionReady: boolean;
  blockers: string[];
  failures: string[];
  warnings: string[];
  passed: string[];
};

export function isEvidenceBackedCompletionState(
  state: string
): state is EvidenceBackedCompletionState {
  return (EVIDENCE_BACKED_COMPLETION_STATES as readonly string[]).includes(state);
}

export function hasAuthenticatedEvidence(
  evidence: AuthenticatedEvidence | null | undefined,
  policy: EvidenceFreshnessPolicy = {}
): evidence is AuthenticatedEvidence {
  if (!evidence) return false;
  if (evidence.authenticated !== true || evidence.authoritative !== true) return false;
  if (!evidence.source?.trim() || !evidence.reference?.trim()) return false;

  const observedAtMs = Date.parse(evidence.observedAt);
  if (!Number.isFinite(observedAtMs)) return false;

  const nowMs = policy.nowMs ?? Date.now();
  const futureToleranceMs = policy.futureToleranceMs ?? 5 * 60 * 1000;
  if (observedAtMs > nowMs + futureToleranceMs) return false;

  if (
    policy.maxAgeMs !== undefined &&
    (!Number.isFinite(policy.maxAgeMs) ||
      policy.maxAgeMs < 0 ||
      nowMs - observedAtMs > policy.maxAgeMs)
  ) {
    return false;
  }

  return true;
}

export function canDisplayEvidenceBackedState(input: {
  state: string;
  evidence?: AuthenticatedEvidence | null;
  policy?: EvidenceFreshnessPolicy;
}): boolean {
  if (!isEvidenceBackedCompletionState(input.state)) return true;
  return hasAuthenticatedEvidence(input.evidence, input.policy);
}

export function evidenceBackedDisplayState(input: {
  state: string;
  evidence?: AuthenticatedEvidence | null;
  fallback?: string;
  policy?: EvidenceFreshnessPolicy;
}): string {
  return canDisplayEvidenceBackedState(input)
    ? input.state
    : (input.fallback ?? 'unverified');
}

export function requireAuthenticatedEvidence(input: {
  state: EvidenceBackedCompletionState;
  evidence?: AuthenticatedEvidence | null;
  policy?: EvidenceFreshnessPolicy;
}): AuthenticatedEvidence {
  if (!hasAuthenticatedEvidence(input.evidence, input.policy)) {
    throw new Error(`authenticated_evidence_required:${input.state}`);
  }
  return input.evidence;
}

function isBlockingEvidence(check: EvidenceCheck): boolean {
  return check.priority === 'P0' || check.required === true;
}

function validateEvidenceBundle(bundle: EvidenceBundle): void {
  if (bundle.version !== 1) throw new Error('invalid_evidence_bundle_version');
  if (!bundle.subject?.trim()) throw new Error('invalid_evidence_subject');
  if (!bundle.environment?.trim()) throw new Error('invalid_evidence_environment');
  if (!Number.isFinite(Date.parse(bundle.generatedAt))) {
    throw new Error('invalid_evidence_generated_at');
  }
  if (!Array.isArray(bundle.checks) || bundle.checks.length === 0) {
    throw new Error('evidence_checks_required');
  }

  const seen = new Set<string>();
  for (const check of bundle.checks) {
    const id = check.id?.trim();
    if (!id) throw new Error('invalid_evidence_check_id');
    if (seen.has(id)) throw new Error(`duplicate_evidence_check:${id}`);
    seen.add(id);

    if (!Number.isFinite(Date.parse(check.observedAt))) {
      throw new Error(`invalid_evidence_observed_at:${id}`);
    }
    if (!['P0', 'P1'].includes(check.priority)) {
      throw new Error(`invalid_evidence_priority:${id}`);
    }
    if (!['pass', 'fail', 'unverified', 'warning'].includes(check.status)) {
      throw new Error(`invalid_evidence_status:${id}`);
    }
  }
}

export function evaluateEvidenceBundle(bundle: EvidenceBundle): EvidenceEvaluation {
  validateEvidenceBundle(bundle);

  const failures = bundle.checks
    .filter((check) => isBlockingEvidence(check) && check.status === 'fail')
    .map((check) => check.id);

  const blockers = bundle.checks
    .filter((check) =>
      isBlockingEvidence(check) &&
      (check.status === 'unverified' || check.status === 'warning')
    )
    .map((check) => check.id);

  const warnings = bundle.checks
    .filter((check) =>
      !isBlockingEvidence(check) &&
      check.status !== 'pass'
    )
    .map((check) => check.id);

  const passed = bundle.checks
    .filter((check) => check.status === 'pass')
    .map((check) => check.id);

  if (bundle.mode === 'warning-only') {
    return {
      outcome: 'pass',
      productionReady: true,
      blockers: [],
      failures,
      warnings: bundle.checks
        .filter((check) => check.status !== 'pass')
        .map((check) => check.id),
      passed
    };
  }

  const outcome: EvidenceOutcome =
    failures.length > 0 ? 'fail' :
      blockers.length > 0 ? 'blocked' :
        'pass';

  return {
    outcome,
    productionReady: outcome === 'pass',
    blockers,
    failures,
    warnings,
    passed
  };
}
