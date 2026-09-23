import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_BACKED_COMPLETION_STATES,
  canDisplayEvidenceBackedState,
  evidenceBackedDisplayState,
  hasAuthenticatedEvidence,
  requireAuthenticatedEvidence
} from '../../packages/core/src';

const evidence = {
  authenticated: true,
  authoritative: true,
  source: 'provider:test',
  reference: 'provider-record-1',
  observedAt: '2026-09-21T22:00:00.000Z'
};

describe('ATLAS authenticated evidence governance', () => {
  it.each(EVIDENCE_BACKED_COMPLETION_STATES)(
    'fails closed for %s without authenticated evidence',
    (state) => {
      expect(canDisplayEvidenceBackedState({
        state,
        evidence: null,
        policy: { nowMs: Date.parse('2026-09-21T22:05:00.000Z') }
      })).toBe(false);
      expect(evidenceBackedDisplayState({
        state,
        evidence: null,
        fallback: 'unverified',
        policy: { nowMs: Date.parse('2026-09-21T22:05:00.000Z') }
      })).toBe('unverified');
    }
  );

  it.each(EVIDENCE_BACKED_COMPLETION_STATES)(
    'allows %s only with authenticated authoritative evidence',
    (state) => {
      expect(canDisplayEvidenceBackedState({
        state,
        evidence,
        policy: { nowMs: Date.parse('2026-09-21T22:05:00.000Z') }
      })).toBe(true);
    }
  );

  it('rejects unauthenticated, non-authoritative, malformed and future evidence', () => {
    const nowMs = Date.parse('2026-09-21T22:05:00.000Z');
    expect(hasAuthenticatedEvidence({ ...evidence, authenticated: false }, { nowMs })).toBe(false);
    expect(hasAuthenticatedEvidence({ ...evidence, authoritative: false }, { nowMs })).toBe(false);
    expect(hasAuthenticatedEvidence({ ...evidence, reference: '' }, { nowMs })).toBe(false);
    expect(hasAuthenticatedEvidence({ ...evidence, observedAt: 'not-a-date' }, { nowMs })).toBe(false);
    expect(hasAuthenticatedEvidence(
      { ...evidence, observedAt: '2026-09-21T23:00:00.000Z' },
      { nowMs }
    )).toBe(false);
  });

  it('supports optional evidence freshness limits', () => {
    const nowMs = Date.parse('2026-09-21T22:05:00.000Z');
    expect(hasAuthenticatedEvidence(evidence, { nowMs, maxAgeMs: 10 * 60 * 1000 })).toBe(true);
    expect(hasAuthenticatedEvidence(evidence, { nowMs, maxAgeMs: 60 * 1000 })).toBe(false);
  });

  it('throws before backend code can persist a governed completion state without evidence', () => {
    expect(() => requireAuthenticatedEvidence({
      state: 'fulfilled',
      evidence: null
    })).toThrow('authenticated_evidence_required:fulfilled');
  });
});
