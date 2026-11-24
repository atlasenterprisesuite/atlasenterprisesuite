import { describe, expect, it } from 'vitest';
import {
  calculateProviderFitnessScore,
  capacityStateForPercent,
  evaluateAssuranceFact,
  evaluateReleaseAssuranceGate,
  evaluateSharedResponsibilityControl,
  type InfrastructureAssuranceEvidence,
  type InfrastructureAssurancePolicy
} from '../../packages/core/src';

const NOW = '2026-10-05T10:00:00.000Z';

function evidence(
  overrides: Partial<InfrastructureAssuranceEvidence> = {}
): InfrastructureAssuranceEvidence {
  return {
    evidenceId: 'evidence-1',
    organizationId: 'org-1',
    providerId: 'supabase-prod',
    domain: 'resilience',
    claim: 'runtime_health_verified',
    observedValue: true,
    status: 'verified',
    sourceType: 'runtime_probe',
    sourceRef: 'runtime:probe:1',
    confidence: 'high',
    observedAt: '2026-10-05T09:59:00.000Z',
    expiresAt: null,
    supersedesEvidenceId: null,
    ...overrides
  };
}

describe('ATLAS Infrastructure Assurance domain', () => {
  it('maps capacity thresholds exactly at the approved boundaries', () => {
    expect(capacityStateForPercent(69.9)).toBe('nominal');
    expect(capacityStateForPercent(70)).toBe('watch');
    expect(capacityStateForPercent(84.99)).toBe('watch');
    expect(capacityStateForPercent(85)).toBe('warning');
    expect(capacityStateForPercent(94.99)).toBe('warning');
    expect(capacityStateForPercent(95)).toBe('critical');
  });

  it('degrades stale evidence instead of preserving a verified claim', () => {
    const fact = evaluateAssuranceFact({
      desired: true,
      observed: true,
      evidence: [
        evidence({ observedAt: '2026-10-05T07:00:00.000Z' })
      ],
      now: NOW,
      maxEvidenceAgeSeconds: 3600
    });

    expect(fact.status).toBe('unverified');
    expect(fact.verified).toBeNull();
    expect(fact.stale).toBe(true);
  });

  it('keeps missing evidence unknown rather than inventing readiness', () => {
    const fact = evaluateAssuranceFact({
      desired: true,
      observed: true,
      evidence: [],
      now: NOW,
      maxEvidenceAgeSeconds: 3600
    });

    expect(fact.status).toBe('unknown');
    expect(fact.verified).toBeNull();
    expect(fact.missingEvidence).toBe(true);
  });

  it('does not let a verified read replica satisfy a missing cross-region failover gate', () => {
    const policies: InfrastructureAssurancePolicy[] = [
      {
        policyId: 'policy-failover',
        organizationId: 'org-1',
        environment: 'production',
        domain: 'resilience',
        requirement: 'cross_region_failover_runbook_verified',
        severity: 'P0',
        requiredStatus: 'verified',
        maxEvidenceAgeSeconds: 86400,
        blocking: true
      }
    ];

    const gate = evaluateReleaseAssuranceGate({
      policies,
      facts: {
        read_replica_present: { status: 'verified' },
        cross_region_failover_runbook_verified: { status: 'unverified' }
      }
    });

    expect(gate.blocked).toBe(true);
    expect(gate.blockers).toEqual([
      expect.objectContaining({
        requirement: 'cross_region_failover_runbook_verified',
        severity: 'P0'
      })
    ]);
  });

  it('keeps shared compliance partial when only provider evidence exists', () => {
    const result = evaluateSharedResponsibilityControl({
      controlId: 'soc2-access-control',
      framework: 'SOC2',
      responsibility: 'shared',
      providerEvidenceRef: 'provider:soc2:2026',
      atlasEvidenceRef: null,
      status: 'unverified',
      expiresAt: null
    });

    expect(result.status).toBe('partially_verified');
  });

  it('blocks a release when a blocking P0 policy is not verified', () => {
    const policies: InfrastructureAssurancePolicy[] = [
      {
        policyId: 'policy-runtime',
        organizationId: 'org-1',
        environment: 'production',
        domain: 'readiness',
        requirement: 'runtime_health_verified',
        severity: 'P0',
        requiredStatus: 'verified',
        maxEvidenceAgeSeconds: 900,
        blocking: true
      }
    ];

    const gate = evaluateReleaseAssuranceGate({
      policies,
      facts: { runtime_health_verified: { status: 'unknown' } }
    });

    expect(gate.blocked).toBe(true);
    expect(gate.blockers).toHaveLength(1);
  });

  it('uses approved weights and refuses a strong classification when required evidence is missing', () => {
    const complete = calculateProviderFitnessScore({
      reliability: { score: 5, status: 'verified' },
      security: { score: 5, status: 'verified' },
      compliance: { score: 5, status: 'verified' },
      scalability: { score: 5, status: 'verified' },
      operationalSupport: { score: 5, status: 'verified' },
      costPredictability: { score: 5, status: 'verified' },
      portability: { score: 5, status: 'verified' },
      developerVelocity: { score: 5, status: 'verified' }
    });

    expect(complete.score).toBe(5);
    expect(complete.classification).toBe('strong_strategic_fit');
    expect(complete.weights).toEqual({
      reliability: 0.2,
      security: 0.15,
      compliance: 0.15,
      scalability: 0.15,
      operationalSupport: 0.1,
      costPredictability: 0.1,
      portability: 0.1,
      developerVelocity: 0.05
    });

    const incomplete = calculateProviderFitnessScore({
      reliability: { score: 5, status: 'verified' },
      security: { score: 5, status: 'verified' },
      compliance: { score: 5, status: 'verified' },
      scalability: { score: 5, status: 'verified' },
      operationalSupport: { score: 5, status: 'verified' },
      costPredictability: { score: null, status: 'unknown' },
      portability: { score: 5, status: 'verified' },
      developerVelocity: { score: 5, status: 'verified' }
    });

    expect(incomplete.missingEvidence).toContain('costPredictability');
    expect(incomplete.classification).toBe('insufficient_evidence');
    expect(incomplete.confidence).toBe('low');
  });
});
