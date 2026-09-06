import { describe, expect, it } from 'vitest';
import { validateCurabilityUpgrade } from './index';
import type { EvidenceRecord } from '../types';

const baseEvidence: EvidenceRecord = {
  id: 'ev-case',
  diseaseIds: ['hiv'],
  title: 'Exceptional remission case',
  sourceType: 'journal',
  sourceName: 'Example journal',
  sourceIdentifier: 'doi:10.example/case',
  publicationDate: '2026-07-01',
  evidenceLevel: 'human_case_report',
  studyDesign: 'case report',
  populationOrModel: 'One adult',
  sampleSize: 1,
  finding: 'Long treatment-free remission was observed.',
  limitations: ['Single case; not generalizable.'],
  safetySignals: ['High-risk intervention context.'],
  replicationStatus: 'unreplicated',
  regulatoryStatus: 'not_applicable',
  confidence: 0.8,
  status: 'active',
  demo: true
};

describe('Curability Index guardrails', () => {
  it('blocks C5-C7 from a single case report', () => {
    const result = validateCurabilityUpgrade('C4', 'C5', [baseEvidence]);
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/reproducible human evidence/i);
  });

  it('blocks retracted evidence from supporting any upgrade', () => {
    const retracted = { ...baseEvidence, status: 'retracted' as const };
    const result = validateCurabilityUpgrade('C2', 'C3', [retracted]);
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/retracted|falsified/i);
  });

  it('permits C5 only with replicated human interventional evidence', () => {
    const replicated: EvidenceRecord = {
      ...baseEvidence,
      id: 'ev-human-interventional',
      evidenceLevel: 'human_interventional',
      studyDesign: 'multicenter interventional trial',
      sampleSize: 220,
      replicationStatus: 'independently_replicated',
      limitations: ['Defined subtype and eligibility criteria.'],
      finding: 'Reproducible individual cure was demonstrated in the defined subtype.'
    };
    const result = validateCurabilityUpgrade('C4', 'C5', [replicated]);
    expect(result.allowed).toBe(true);
  });
});
