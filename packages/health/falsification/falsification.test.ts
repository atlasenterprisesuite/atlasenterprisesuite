import { describe, expect, it } from 'vitest';
import { applyFalsification } from './index';
import type { FalsificationRecord } from '../types';

describe('Falsification Engine', () => {
  it('downgrades supported claims when strong contradictory evidence is recorded', () => {
    const record: FalsificationRecord = {
      id: 'f-1',
      hypothesisOrEdgeId: 'edge-1',
      challengeType: 'contradictory_human_evidence',
      counterexample: 'A defined human subgroup lacks the proposed mechanism.',
      contradictoryEvidenceIds: ['ev-negative'],
      escapeRoute: 'Alternative mechanistic subtype.',
      safetyLimitation: 'None relevant to this contradiction.',
      relapseEvidence: 'Not applicable.',
      alternativeExplanations: ['Assay sensitivity', 'mechanistic heterogeneity'],
      evidenceGaps: ['Prospective replication'],
      conclusion: 'The mechanism is not universal.',
      resultingStatus: 'mixed'
    };

    expect(applyFalsification('supported', record)).toBe('mixed');
  });

  it('preserves a falsified verdict from accidental upgrade by weaker records', () => {
    const weakRecord: FalsificationRecord = {
      id: 'f-2', hypothesisOrEdgeId: 'edge-1', challengeType: 'minor_counterexample', counterexample: 'One uncertain case.',
      contradictoryEvidenceIds: [], escapeRoute: '', safetyLimitation: '', relapseEvidence: '', alternativeExplanations: [], evidenceGaps: [],
      conclusion: 'Uncertain.', resultingStatus: 'mixed'
    };
    expect(applyFalsification('falsified', weakRecord)).toBe('falsified');
  });
});
