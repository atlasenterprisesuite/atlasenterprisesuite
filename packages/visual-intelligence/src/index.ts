export type VisualEvidence = {
  tenantId: string;
  imageSha256: string;
  sourceUrl: string;
  observedAt: string;
  similarity: number;
  provenanceVerified: boolean;
};
export type VisualAssessment = {
  status: 'INCONCLUSIVE' | 'VERIFIED_MATCH';
  reason: string;
  matches: VisualEvidence[];
};
export function assessVisualEvidence(
  tenantId: string,
  imageSha256: string,
  candidates: readonly VisualEvidence[]
): VisualAssessment {
  if (!tenantId.trim() || !/^[a-f0-9]{64}$/i.test(imageSha256)) {
    return { status: 'INCONCLUSIVE', reason: 'invalid_request', matches: [] };
  }
  const matches = candidates.filter(e =>
    e.tenantId === tenantId &&
    e.imageSha256.toLowerCase() === imageSha256.toLowerCase() &&
    e.provenanceVerified === true &&
    Number.isFinite(e.similarity) && e.similarity >= 0 && e.similarity <= 1 &&
    Number.isFinite(Date.parse(e.observedAt)) &&
    /^https:\/\//i.test(e.sourceUrl)
  );
  return matches.length
    ? { status: 'VERIFIED_MATCH', reason: 'matching_hash_with_provenance', matches }
    : { status: 'INCONCLUSIVE', reason: 'no_verified_exact_match', matches: [] };
}
