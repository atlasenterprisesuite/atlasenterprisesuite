/**
 * TRUST-0001: pure, read-only evidence evaluator.
 * 'supported' only means an authenticated regulator source supports a specific
 * claim. It does NOT certify the app is licensed, lawful, safe or pays reliably.
 * Trusted server adapters must authenticate sources; never accept client-supplied
 * verification flags as authority.
 */
export type TrustEvidence = {
  id: string;
  subjectKey: string;
  jurisdiction: string;
  claim: 'authorized' | 'prohibited' | 'other';
  sourceType: 'regulator' | 'operator' | 'user-review' | 'independent';
  verification: 'authenticated' | 'self-reported' | 'unknown';
  retrievedAt: string;
  expiresAt: string;
  digest: string;
};
export type TrustClaimDecision = {
  status: 'unverified' | 'needs-review' | 'supported' | 'prohibited';
  evidenceIds: string[];
};
const validDate = (value: string): number | null => {
  if (!/^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d(?:\\.\\d+)?Z$/.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};
export function assessTrustClaim(
  subjectKey: string,
  jurisdiction: string,
  evidence: readonly TrustEvidence[],
  nowIso: string
): TrustClaimDecision {
  const now = validDate(nowIso);
  if (now === null || !subjectKey.trim() || !jurisdiction.trim()) return {status:'unverified',evidenceIds:[]};
  const qualified = evidence.filter(item => {
    const seen = validDate(item.retrievedAt);
    const expiry = validDate(item.expiresAt);
    return item.subjectKey === subjectKey && item.jurisdiction === jurisdiction &&
      item.sourceType === 'regulator' && item.verification === 'authenticated' &&
      item.id.trim().length > 0 && /^sha256:[a-zA-Z0-9_-]{12,}$/.test(item.digest) &&
      seen !== null && expiry !== null && seen <= now && expiry > now && expiry > seen &&
      (item.claim === 'authorized' || item.claim === 'prohibited');
  });
  const positive = qualified.some(item => item.claim === 'authorized');
  const negative = qualified.some(item => item.claim === 'prohibited');
  const evidenceIds = [...new Set(qualified.map(item => item.id))].sort();
  if (positive && negative) return {status:'needs-review',evidenceIds};
  if (negative) return {status:'prohibited',evidenceIds};
  if (positive) return {status:'supported',evidenceIds};
  return {status:'unverified',evidenceIds:[]};
}
