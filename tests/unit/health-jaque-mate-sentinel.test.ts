import { describe, expect, it } from 'vitest';
import { evaluateTensor } from '../../packages/health/jaque-mate/tensor';

describe('ATLAS Health Jaque Mate + Sentinel', () => {
  describe('Seed × State × Niche × Time tensor', () => {
    it('keeps hypothesis output explicitly separated from validated evidence', () => {
      const result = evaluateTensor({
        seed: 40,
        state: 60,
        niche: 80,
        time: 20,
        evidence: {
          evidenceType: 'HYPOTHESIS',
          hypothesisId: 'hyp-001',
          authoredBy: 'research-demo'
        }
      });

      expect(result.evidenceType).toBe('HYPOTHESIS');
      expect(result.researchScore).toBe(50);
      expect(result.dimensions).toEqual({ seed: 40, state: 60, niche: 80, time: 20 });
      expect(result.clinicalActionAllowed).toBe(false);
    });

    it('clamps tensor dimensions to the governed 0..100 research range', () => {
      const result = evaluateTensor({
        seed: -10,
        state: 50,
        niche: 125,
        time: 25,
        evidence: {
          evidenceType: 'SIMULATION',
          simulationId: 'sim-001',
          watermark: 'SIMULATION — NOT CLINICAL EVIDENCE'
        }
      });

      expect(result.dimensions).toEqual({ seed: 0, state: 50, niche: 100, time: 25 });
      expect(result.researchScore).toBe(43.75);
      expect(result.evidenceType).toBe('SIMULATION');
      expect(result.clinicalActionAllowed).toBe(false);
    });

    it('rejects validated evidence that lacks source provenance', () => {
      expect(() => evaluateTensor({
        seed: 50,
        state: 50,
        niche: 50,
        time: 50,
        evidence: {
          evidenceType: 'VALIDATED',
          sourceIdentifier: '',
          confirmedAt: '2026-09-15T23:30:00.000Z',
          provenanceKind: 'LAB'
        }
      })).toThrow('validated_evidence_requires_provenance');
    });

    it('accepts validated evidence only when provenance is explicit', () => {
      const result = evaluateTensor({
        seed: 50,
        state: 50,
        niche: 50,
        time: 50,
        evidence: {
          evidenceType: 'VALIDATED',
          sourceIdentifier: 'lab:demo-confirmed-001',
          confirmedAt: '2026-09-15T23:30:00.000Z',
          provenanceKind: 'LAB'
        }
      });

      expect(result.evidenceType).toBe('VALIDATED');
      expect(result.researchScore).toBe(50);
      expect(result.clinicalActionAllowed).toBe(false);
    });
  });
});
