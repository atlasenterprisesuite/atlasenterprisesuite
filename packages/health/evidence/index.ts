import type { EvidenceRecord, ValidationResult } from '../types';

const causalHumanLevels = new Set<EvidenceRecord['evidenceLevel']>(['human_randomized', 'human_interventional']);
const excludedStatuses = new Set<EvidenceRecord['status']>(['retracted', 'falsified', 'superseded']);

export function validateEvidenceRecord(record: EvidenceRecord): ValidationResult {
  const errors: string[] = [];
  if (!record.id.trim()) errors.push('id is required');
  if (!record.title.trim()) errors.push('title is required');
  if (record.diseaseIds.length === 0) errors.push('at least one diseaseId is required');
  if (!record.sourceName.trim()) errors.push('sourceName is required');
  if (!record.sourceIdentifier.trim()) errors.push('sourceIdentifier is required');
  if (!record.finding.trim()) errors.push('finding is required');
  if (record.limitations.length === 0) errors.push('at least one limitation is required');
  if (record.confidence < 0 || record.confidence > 1) errors.push('confidence must be between 0 and 1');
  if (record.sampleSize !== null && record.sampleSize < 1) errors.push('sampleSize must be null or at least 1');
  return { valid: errors.length === 0, errors };
}

export function isUsableEvidence(record: EvidenceRecord): boolean {
  return validateEvidenceRecord(record).valid && !excludedStatuses.has(record.status);
}

export function canSupportCausalClaim(records: EvidenceRecord[]): boolean {
  return records.some((record) =>
    isUsableEvidence(record) &&
    causalHumanLevels.has(record.evidenceLevel) &&
    record.replicationStatus === 'independently_replicated'
  );
}

export function evidenceLabel(level: EvidenceRecord['evidenceLevel']): string {
  return ({
    human_randomized: 'Human randomized',
    human_interventional: 'Human interventional',
    human_observational: 'Human observational',
    human_case_report: 'Human case report',
    preclinical_animal: 'Preclinical animal',
    preclinical_organoid: 'Preclinical organoid',
    in_vitro: 'In vitro',
    mechanistic: 'Mechanistic',
    hypothesis: 'Hypothesis'
  } as const)[level];
}
