/**
 * ATLAS 777 REVIEW — pure, read-only promotional evidence normalization.
 *
 * This is NOT a Gmail client, crawler, authorization flow, verifier, or work executor.
 * Caller-provided marketing claims can never be promoted to verified evidence here.
 * Higher-trust independent verification must be implemented behind its own boundary.
 */

export type PromotionEvidenceSourceKind =
  | 'gmail-promotion'
  | 'public-doc'
  | 'repository'
  | 'test';

export type PromotionEvidenceClaimStatus = 'advertised' | 'unknown';

export type PromotionEvidence = Readonly<{
  organizationId: string;
  sourceKind: PromotionEvidenceSourceKind;
  sourceRef: string;
  observedAt: string;
  vendor: string;
  claim: string;
  claimStatus: PromotionEvidenceClaimStatus;
  confidence: 'open-question';
}>;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('invalid_promotion_record');
  }
  return value as Record<string, unknown>;
}

function nonemptyString(
  value: unknown,
  field: string,
  maxLength: number
): string {
  if (typeof value !== 'string') throw new Error(`invalid_promotion_${field}`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(normalized)) {
    throw new Error(`invalid_promotion_${field}`);
  }
  return normalized;
}

function normalizedRef(value: unknown, field: string): string {
  const result = nonemptyString(value, field, 180);
  // Opaque identifiers, not raw mailbox URLs, bearer tokens or HTML payloads.
  if (!/^[a-zA-Z0-9][a-zA-Z0-9:._-]{7,179}$/.test(result)) {
    throw new Error(`invalid_promotion_${field}`);
  }
  return result;
}

export function normalizePromotionEvidence(value: unknown): PromotionEvidence {
  const data = record(value);
  const organizationId = nonemptyString(data.organizationId, 'organization_id', 128);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(organizationId)) {
    throw new Error('invalid_promotion_organization_id');
  }

  const kinds: readonly string[] = ['gmail-promotion', 'public-doc', 'repository', 'test'];
  if (typeof data.sourceKind !== 'string' || !kinds.includes(data.sourceKind)) {
    throw new Error('invalid_promotion_source_kind');
  }

  const sourceRef = normalizedRef(data.sourceRef, 'source_ref');
  const observedAt = nonemptyString(data.observedAt, 'observed_at', 32);
  const time = new Date(observedAt);
  if (!Number.isFinite(time.valueOf()) || time.toISOString() !== observedAt) {
    throw new Error('invalid_promotion_observed_at');
  }

  const vendor = nonemptyString(data.vendor, 'vendor', 120);
  const claim = nonemptyString(data.claim, 'claim', 1000);
  if (data.claimStatus !== 'advertised' && data.claimStatus !== 'unknown') {
    throw new Error('invalid_promotion_claim_status');
  }

  return Object.freeze({
    organizationId,
    sourceKind: data.sourceKind as PromotionEvidenceSourceKind,
    sourceRef,
    observedAt,
    vendor,
    claim,
    claimStatus: data.claimStatus as PromotionEvidenceClaimStatus,
    confidence: 'open-question' as const
  });
}

export function deduplicatePromotionEvidence(
  evidence: readonly PromotionEvidence[]
): PromotionEvidence[] {
  const seen = new Set<string>();
  const unique: PromotionEvidence[] = [];
  for (const item of evidence) {
    const normalizedClaim = item.claim.trim().replace(/\s+/g, ' ').toLowerCase();
    const key = JSON.stringify([
      item.organizationId,
      item.sourceKind,
      item.sourceRef,
      normalizedClaim
    ]);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}
