/** Issue #908: evidence contracts. No model inference or persistence is performed here. */
export type EvidenceState = 'observed' | 'inferred' | 'unverified';
export type EvidenceFinding = {
  id: string;
  startSecond: number;
  endSecond: number;
  state: EvidenceState;
  confidence: number;
  description: string;
  evidencePointer: string;
  accessibilitySuggestion?: string;
};
export type VideoEvidence = {
  organizationId: string;
  sourceSha256: string;
  mimeType: 'video/mp4' | 'video/webm';
  durationSeconds: number;
  findings: EvidenceFinding[];
};
export type EvidenceAccess = { organizationId: string; permissions: readonly string[] };

export function validateVideoEvidence(value: VideoEvidence, access: EvidenceAccess | null): string[] {
  const errors: string[] = [];
  if (!access || !access.organizationId || access.organizationId !== value.organizationId ||
      !access.permissions.includes('creator.read')) errors.push('unauthorized');
  if (!/^[a-f0-9]{64}$/i.test(value.sourceSha256)) errors.push('invalid_sha256');
  if (!['video/mp4', 'video/webm'].includes(value.mimeType)) errors.push('unsupported_media');
  if (!Number.isFinite(value.durationSeconds) || value.durationSeconds <= 0) errors.push('invalid_duration');
  if (!Array.isArray(value.findings)) return [...errors, 'invalid_findings'];
  for (const finding of value.findings) {
    if (!finding.id?.trim() || !finding.description?.trim() || !finding.evidencePointer?.trim() ||
        !['observed', 'inferred', 'unverified'].includes(finding.state) ||
        !Number.isFinite(finding.confidence) || finding.confidence < 0 || finding.confidence > 1 ||
        !Number.isFinite(finding.startSecond) || !Number.isFinite(finding.endSecond) ||
        finding.startSecond < 0 || finding.endSecond < finding.startSecond ||
        finding.endSecond > value.durationSeconds) errors.push('invalid_finding');
  }
  return [...new Set(errors)];
}
