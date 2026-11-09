/**
 * AIR 777 model capability gate.
 *
 * This module authorizes a model candidate for a task. It does not perform
 * inference or infer provider readiness from documentation.
 */
export type AtlasModelCapability =
  | 'reasoning'
  | 'image_input'
  | 'structured_output'
  | 'tool_calling'
  | 'computer_use'
  | 'async_tools'
  | 'remote_mcp';

export type AtlasModelEvidence = {
  evidenceId: string;
  providerId: string;
  modelId: string;
  tenantId: string;
  verifiedAt: string;
  verifiedCapabilities: AtlasModelCapability[];
};

export type AtlasModelCandidate = {
  providerId: string;
  modelId: string;
  tenantId: string;
  declaredCapabilities: AtlasModelCapability[];
  evidence: AtlasModelEvidence | null;
  /** Verified zero-marginal-cost path, not a consumer subscription. */
  zeroMarginalCostVerified: boolean;
  /** Estimated upper bound for this invocation, denominated in USD. */
  estimatedCostUsd: number | null;
};

export type AtlasModelSelectionRequest = {
  tenantId: string;
  requiredCapabilities: AtlasModelCapability[];
  allowedModelIds: string[];
  allowPaid: boolean;
  budgetUsd: number;
  candidates: AtlasModelCandidate[];
  now: string;
  maxEvidenceAgeMs?: number;
};

export type AtlasModelSelection = {
  state: 'ready' | 'blocked';
  providerId: string | null;
  modelId: string | null;
  evidenceId: string | null;
  reason: string;
};

const DEFAULT_EVIDENCE_AGE_MS = 24 * 60 * 60 * 1000;

function verified(candidate: AtlasModelCandidate, request: AtlasModelSelectionRequest): boolean {
  const evidence = candidate.evidence;
  if (!evidence || !evidence.evidenceId.trim()) return false;
  if (
    evidence.providerId !== candidate.providerId ||
    evidence.modelId !== candidate.modelId ||
    evidence.tenantId !== candidate.tenantId
  ) return false;
  const at = Date.parse(evidence.verifiedAt);
  const now = Date.parse(request.now);
  const maxAge = request.maxEvidenceAgeMs ?? DEFAULT_EVIDENCE_AGE_MS;
  if (!Number.isFinite(at) || !Number.isFinite(now) || !Number.isFinite(maxAge) || maxAge <= 0) return false;
  return at <= now && now - at <= maxAge;
}

export function selectAtlasModel(request: AtlasModelSelectionRequest): AtlasModelSelection {
  const blocked = (reason: string): AtlasModelSelection => ({
    state: 'blocked', providerId: null, modelId: null, evidenceId: null, reason
  });

  if (!request.tenantId.trim()) return blocked('tenant_required');
  if (!Number.isFinite(request.budgetUsd) || request.budgetUsd < 0) return blocked('invalid_budget');
  if (!Number.isFinite(Date.parse(request.now))) return blocked('invalid_verification_clock');
  if (request.requiredCapabilities.length === 0) return blocked('capabilities_required');

  const eligible = request.candidates.filter((candidate) => {
    if (candidate.tenantId !== request.tenantId) return false;
    if (!request.allowedModelIds.includes(candidate.modelId)) return false;
    if (!verified(candidate, request)) return false;
    if (!request.requiredCapabilities.every((capability) =>
      candidate.declaredCapabilities.includes(capability) &&
      candidate.evidence!.verifiedCapabilities.includes(capability)
    )) return false;

    if (candidate.zeroMarginalCostVerified) {
      return candidate.estimatedCostUsd === 0;
    }
    return request.allowPaid &&
      candidate.estimatedCostUsd !== null &&
      Number.isFinite(candidate.estimatedCostUsd) &&
      candidate.estimatedCostUsd > 0 &&
      candidate.estimatedCostUsd <= request.budgetUsd;
  });

  // Zero-marginal-cost verified routes first; then the cheapest authorized call.
  eligible.sort((a, b) =>
    Number(!a.zeroMarginalCostVerified) - Number(!b.zeroMarginalCostVerified) ||
    (a.estimatedCostUsd ?? Infinity) - (b.estimatedCostUsd ?? Infinity) ||
    a.providerId.localeCompare(b.providerId) ||
    a.modelId.localeCompare(b.modelId)
  );
  const selected = eligible[0];
  if (!selected) return blocked('no_verified_authorized_model');
  return {
    state: 'ready',
    providerId: selected.providerId,
    modelId: selected.modelId,
    evidenceId: selected.evidence!.evidenceId,
    reason: 'verified_authorized_model'
  };
}
