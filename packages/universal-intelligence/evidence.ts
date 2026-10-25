export type VideoSource = { sha256: string; durationSeconds: number; organizationId: string };
export type FindingClass = 'observed' | 'inferred' | 'unverified';
export type VideoFinding = { startSecond: number; endSecond: number; description: string; classification: FindingClass; confidence: number };
export type EvidenceRecord = VideoFinding & { sourceSha256: string; organizationId: string; status: 'draft' };

export function validateVideoFinding(source: VideoSource, finding: VideoFinding): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!source || !/^[a-f0-9]{64}$/i.test(source.sha256 ?? '')) errors.push('invalid-source-digest');
  if (!source?.organizationId?.trim()) errors.push('missing-organization');
  if (!Number.isFinite(source?.durationSeconds) || source.durationSeconds <= 0) errors.push('invalid-duration');
  if (!Number.isFinite(finding?.startSecond) || !Number.isFinite(finding?.endSecond) ||
    finding.startSecond < 0 || finding.endSecond <= finding.startSecond ||
    finding.endSecond > source.durationSeconds) errors.push('invalid-timecode');
  if (!finding?.description?.trim()) errors.push('missing-description');
  if (!['observed', 'inferred', 'unverified'].includes(finding?.classification)) errors.push('invalid-classification');
  if (!Number.isFinite(finding?.confidence) || finding.confidence < 0 || finding.confidence > 1) errors.push('invalid-confidence');
  return { ok: errors.length === 0, errors };
}

export function buildEvidenceRecord(source: VideoSource, finding: VideoFinding): EvidenceRecord {
  const result = validateVideoFinding(source, finding);
  if (!result.ok) throw new Error('Evidence rejected: ' + result.errors.join(', '));
  return { ...finding, sourceSha256: source.sha256.toLowerCase(), organizationId: source.organizationId, status: 'draft' };
}
