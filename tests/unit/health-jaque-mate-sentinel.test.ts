import { describe, expect, it } from 'vitest';
import { calculateSurveillanceCost } from '../../packages/health/jaque-mate/cost';
import { calculateSentinelFitness } from '../../packages/health/jaque-mate/fitness';
import { evaluateResponseGate } from '../../packages/health/jaque-mate/gating';
import { calculatePathologicalMemory } from '../../packages/health/jaque-mate/memory';
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

  describe('Sentinel engines', () => {
    it('measures adaptive stability against a declared tolerance without diagnosing', () => {
      const result = calculateSentinelFitness({ baseline: 100, current: 103, tolerance: 10 });
      expect(result.fitness).toBe(0.7);
      expect(result.deviation).toBe(3);
      expect(result.diagnosticConclusion).toBe(null);
    });

    it('decays pathological memory so transient old anomalies lose influence', () => {
      const now = Date.parse('2026-09-16T00:00:00.000Z');
      const recent = calculatePathologicalMemory({
        observations: [
          { severity: 1, observedAt: now },
          { severity: 1, observedAt: now - 1_000 }
        ],
        halfLifeMs: 1_000,
        now
      });
      const transientOld = calculatePathologicalMemory({
        observations: [{ severity: 1, observedAt: now - 3_000 }],
        halfLifeMs: 1_000,
        now
      });

      expect(recent.depth).toBe(0.75);
      expect(transientOld.depth).toBe(0.125);
    });

    it('blocks response gating when validated evidence is absent even at high confidence', () => {
      expect(evaluateResponseGate({ confidence: 1, validatedEvidenceCount: 0, threshold: 0.9 })).toEqual({
        state: 'BLOCKED',
        clinicalActionAllowed: false,
        reason: 'validated_evidence_required'
      });
    });

    it('only advances qualifying output to human review and never auto-executes treatment', () => {
      expect(evaluateResponseGate({ confidence: 0.95, validatedEvidenceCount: 2, threshold: 0.9 })).toEqual({
        state: 'ELIGIBLE_FOR_HUMAN_REVIEW',
        clinicalActionAllowed: false,
        reason: 'human_review_required'
      });
    });

    it('reports surveillance compute and energy burden transparently', () => {
      expect(calculateSurveillanceCost({
        sampleRateHz: 2,
        computeMsPerSample: 5,
        activeNodes: 3,
        energyMwPerNode: 10
      })).toEqual({
        computeMsPerSecond: 30,
        computeUtilizationRatio: 0.03,
        energyMw: 30,
        activeNodes: 3
      });
    });
  });
});
