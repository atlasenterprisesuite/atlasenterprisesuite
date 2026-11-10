export const GENESIS_TRACKS = ['GEN-01', 'GEN-02', 'GEN-03', 'GEN-04', 'GEN-05', 'GEN-06'] as const;
export const GENESIS_EVIDENCE_STATES = ['established', 'strongly-supported', 'active-hypothesis', 'open-question'] as const;

type Validation = { ok: boolean; errors: string[] };

export function validateGenesisResearchRecord(input: unknown): Validation {
  const errors: string[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['invalid-record'] };
  }
  const record = input as Record<string, unknown>;
  if (typeof record.id !== 'string' || !record.id.trim()) errors.push('missing-id');
  if (!GENESIS_TRACKS.includes(record.trackId as typeof GENESIS_TRACKS[number])) errors.push('invalid-track');
  if (typeof record.claim !== 'string' || !record.claim.trim()) errors.push('missing-claim');
  if (!GENESIS_EVIDENCE_STATES.includes(record.evidenceState as typeof GENESIS_EVIDENCE_STATES[number])) errors.push('invalid-evidence-state');
  if (!Array.isArray(record.sourceRefs) || record.sourceRefs.length === 0 ||
      !record.sourceRefs.every(ref => typeof ref === 'string' && /^https:\/\//.test(ref) && ref.length > 10)) {
    errors.push('missing-source');
  }
  if (record.domainOwner !== 'knowledge') errors.push('missing-owner');
  // Clinical authorization requires separate, independently verifiable regulatory evidence.
  if (record.clinicalReadiness !== 'not-evaluated' && record.clinicalReadiness !== 'preclinical' &&
      record.clinicalReadiness !== 'clinical-research') errors.push('unsupported-clinical-readiness');
  // This pure record validator cannot verify a CI run or production SHA.
  if (record.engineeringState !== 'specified') errors.push('unsupported-engineering-state');
  return { ok: errors.length === 0, errors };
}
