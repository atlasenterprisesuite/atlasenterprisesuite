import {
  hasAuthenticatedEvidence,
  type AuthenticatedEvidence,
  type EvidenceFreshnessPolicy
} from '../../core/src/evidence';

export type AtlasExecutionEvidenceRecord = {
  kind: string;
  reference: string;
  verified: boolean;
  authenticated?: boolean;
  authoritative?: boolean;
  source?: string;
  observedAt?: string;
};

export type AtlasControlPlaneEvidenceInput = {
  requiredKinds: readonly string[];
  evidence: readonly AtlasExecutionEvidenceRecord[];
  auditEventIds: readonly string[];
  nowMs?: number;
  maxAgeMs?: number;
};

function nonEmpty(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function bridgeExecutionEvidence(
  record: AtlasExecutionEvidenceRecord,
  policy: EvidenceFreshnessPolicy = {}
): AuthenticatedEvidence {
  const kind = String(record.kind ?? '').trim() || 'unknown';
  if (record.verified !== true) throw new Error(`execution_evidence_unverified:${kind}`);

  const evidence: AuthenticatedEvidence = {
    authenticated: record.authenticated === true,
    authoritative: record.authoritative === true,
    source: String(record.source ?? '').trim(),
    reference: String(record.reference ?? '').trim(),
    observedAt: String(record.observedAt ?? '').trim()
  };

  if (!hasAuthenticatedEvidence(evidence, policy)) {
    throw new Error(`authenticated_execution_evidence_required:${kind}`);
  }

  return evidence;
}

export function requireControlPlaneEvidence(
  input: AtlasControlPlaneEvidenceInput
): AuthenticatedEvidence[] {
  if (!input.auditEventIds.length || input.auditEventIds.some((id) => !nonEmpty(id))) {
    throw new Error('control_plane_audit_required');
  }

  const policy: EvidenceFreshnessPolicy = {
    ...(input.nowMs !== undefined ? { nowMs: input.nowMs } : {}),
    ...(input.maxAgeMs !== undefined ? { maxAgeMs: input.maxAgeMs } : {})
  };

  return input.requiredKinds.map((kind) => {
    const record = input.evidence.find((candidate) => candidate.kind === kind);
    if (!record) throw new Error(`control_plane_evidence_missing:${kind}`);
    return bridgeExecutionEvidence(record, policy);
  });
}
