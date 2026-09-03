import { describe, expect, it } from 'vitest';
import { canSupportCausalClaim, validateEvidenceRecord } from './index';
import type { EvidenceRecord } from '../types';

const humanObservation: EvidenceRecord = {
  id: 'ev-human-observation',
  diseaseIds: ['hiv'],
  title: 'Host-state association study',
  sourceType: 'journal',
  sourceName: 'Example peer-reviewed journal',
  sourceIdentifier: 'doi:10.example/atlas',
  publicationDate: '2026-08-01',
  evidenceLevel: 'human_observational',
  studyDesign: 'prospective cohort',
  populationOrModel: 'Adults',
  sampleSize: 104,
  finding: 'An immune state was associated with reservoir size.',
  limitations: ['Observational design cannot establish causality.'],
  safetySignals: [],
  replicationStatus: 'unreplicated',
  regulatoryStatus: 'not_applicable',
  confidence: 0.72,
  status: 'active',
  demo: true
};

describe('Evidence Registry guardrails', () => {
  it('requires provenance, limitations, evidence level and bounded confidence', () => {
    expect(validateEvidenceRecord(humanObservation)).toEqual({ valid: true, errors: [] });

    const invalid = { ...humanObservation, sourceIdentifier: '', limitations: [], confidence: 1.2 };
    const result = validateEvidenceRecord(invalid);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'sourceIdentifier is required',
      'at least one limitation is required',
      'confidence must be between 0 and 1'
    ]));
  });

  it('does not permit observational correlation alone to support a causal claim', () => {
    expect(canSupportCausalClaim([humanObservation])).toBe(false);

    const randomized: EvidenceRecord = {
      ...humanObservation,
      id: 'ev-rct',
      evidenceLevel: 'human_randomized',
      studyDesign: 'randomized controlled trial',
      finding: 'Intervention changed the prespecified mechanistic endpoint.',
      replicationStatus: 'independently_replicated'
    };

    expect(canSupportCausalClaim([randomized])).toBe(true);
  });
});
