import { describe, expect, it } from 'vitest';
import { evaluateTrustDecision } from '../../packages/trustpass/src';

const base = {
  policyId: 'trustpass-default',
  policyVersion: 1,
  correlationId: '00000000-0000-4000-8000-000000000001',
  reasonCodes: [] as string[]
};

describe('ATLAS TrustPass assurance policy', () => {
  it('never lets low risk waive P0 phishing-resistant assurance', () => {
    const result = evaluateTrustDecision({
      ...base,
      mode: 'enforce',
      actionClass: 'P0',
      minimumAssurance: 'phishing_resistant',
      observedAssurance: 'aal2',
      riskScore: 10
    });

    expect(result.decision).toBe('step_up_required');
    expect(result.recommendedDecision).toBe('step_up_required');
    expect(result.minimumAssurance).toBe('phishing_resistant');
  });

  it('denies critical-risk P0 actions rather than downgrading them to a weaker challenge', () => {
    const result = evaluateTrustDecision({
      ...base,
      mode: 'enforce',
      actionClass: 'P0',
      minimumAssurance: 'phishing_resistant',
      observedAssurance: 'phishing_resistant',
      riskScore: 95,
      reasonCodes: ['trust_replay_detected']
    });

    expect(result.decision).toBe('deny');
    expect(result.recommendedDecision).toBe('deny');
  });

  it('allows a low-risk P3 read when its baseline assurance is satisfied', () => {
    const result = evaluateTrustDecision({
      ...base,
      mode: 'enforce',
      actionClass: 'P3',
      minimumAssurance: 'authenticated',
      observedAssurance: 'authenticated',
      riskScore: 12
    });

    expect(result.decision).toBe('allow');
    expect(result.recommendedDecision).toBe('allow');
  });

  it('requires step-up for a high-risk P2 action in enforcement mode', () => {
    const result = evaluateTrustDecision({
      ...base,
      mode: 'enforce',
      actionClass: 'P2',
      minimumAssurance: 'authenticated',
      observedAssurance: 'authenticated',
      riskScore: 70,
      reasonCodes: ['unusual_velocity']
    });

    expect(result.decision).toBe('step_up_required');
    expect(result.recommendedDecision).toBe('step_up_required');
  });

  it('records the same P2 step-up recommendation without blocking in shadow mode', () => {
    const result = evaluateTrustDecision({
      ...base,
      mode: 'shadow',
      actionClass: 'P2',
      minimumAssurance: 'authenticated',
      observedAssurance: 'authenticated',
      riskScore: 70,
      reasonCodes: ['unusual_velocity']
    });

    expect(result.decision).toBe('allow');
    expect(result.recommendedDecision).toBe('step_up_required');
  });
});
