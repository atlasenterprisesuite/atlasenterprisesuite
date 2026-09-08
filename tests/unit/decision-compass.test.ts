import { describe, expect, it } from 'vitest';
import {
  canTransitionDecision,
  evaluateVerificationGate,
  transitionDecision,
  type DecisionCompassRecord
} from '../../packages/decision-compass';

const base: DecisionCompassRecord = {
  tenantId: 'tenant-1',
  organizationId: 'org-1',
  id: 'd-1',
  createdBy: 'u-1',
  createdAt: '2026-09-08T00:00:00Z',
  signalKind: 'symbolic',
  signalLabel: 'The Moon',
  signalText: 'Check uncertainty',
  interpretation: 'Review incomplete information before acting.',
  targetModule: 'governance',
  evidenceRefs: [],
  risk: 'medium',
  proposedAction: null,
  verificationGate: [
    { id: 'g1', label: 'Independent evidence attached', passed: false }
  ],
  truthState: 'reflection',
  verifiedBy: null,
  verifiedAt: null
};

describe('ATLAS Decision Compass truth-state engine', () => {
  it('forbids reflection to verified even when requested', () => {
    expect(canTransitionDecision('reflection', 'verified')).toBe(false);
    expect(() => transitionDecision(base, 'verified', { actorId: 'u-1' }))
      .toThrow('invalid_truth_state_transition');
  });

  it('requires independent evidence and every gate before verified', () => {
    const withEvidence: DecisionCompassRecord = {
      ...base,
      truthState: 'action_proposed',
      evidenceRefs: [
        { kind: 'workflow', sourceModule: 'github', sourceId: 'run-1', label: 'CI run' }
      ],
      verificationGate: [
        { id: 'g1', label: 'CI passed', passed: true }
      ]
    };

    expect(evaluateVerificationGate(withEvidence)).toEqual({ ready: true, missing: [] });
    const verified = transitionDecision(withEvidence, 'verified', {
      actorId: 'u-2',
      at: '2026-09-08T01:00:00Z'
    });
    expect(verified.truthState).toBe('verified');
    expect(verified.verifiedBy).toBe('u-2');
    expect(verified.verifiedAt).toBe('2026-09-08T01:00:00Z');
  });

  it('reports missing evidence and incomplete verification gates', () => {
    expect(evaluateVerificationGate(base)).toEqual({
      ready: false,
      missing: ['independent_evidence', 'Independent evidence attached']
    });
  });

  it('supports evidence-first progression without auto-verifying', () => {
    const evidenceFound = transitionDecision(
      { ...base, truthState: 'needs_evidence' },
      'evidence_found',
      { actorId: 'u-1' }
    );
    expect(evidenceFound.truthState).toBe('evidence_found');
    expect(evidenceFound.verifiedBy).toBeNull();
  });

  it('allows rejection and supersession without claiming success', () => {
    expect(canTransitionDecision('evidence_found', 'rejected')).toBe(true);
    expect(canTransitionDecision('action_proposed', 'superseded')).toBe(true);
  });
});
