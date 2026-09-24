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
