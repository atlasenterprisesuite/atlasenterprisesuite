import { describe, expect, it } from 'vitest';
import { assertTaskTransition, evaluateTaskCompletion } from '../../packages/execution/src';

describe('ATLAS execution state machine', () => {
  it('rejects direct completion from draft', () => {
    expect(() => assertTaskTransition('draft', 'completed')).toThrow('invalid_execution_transition:draft->completed');
  });

  it('allows an actionable task to become blocked or await approval', () => {
    expect(() => assertTaskTransition('now', 'blocked')).not.toThrow();
    expect(() => assertTaskTransition('now', 'awaiting_approval')).not.toThrow();
  });

  it('refuses completion without verified evidence and required approvals', () => {
    expect(evaluateTaskCompletion({
      steps: [{ id: 'step-1', status: 'completed', evidenceRequirement: ['domain_record'] }],
      evidence: [{ id: 'ev-1', kind: 'domain_record', verified: false }],
      approvals: [{ status: 'approved', payloadVersion: 1, payloadDigest: 'abc' }],
      unresolvedDependencies: []
    })).toEqual({ eligible: false, reasons: ['unverified_evidence:domain_record'] });
  });

  it('permits completion only when every gate passes', () => {
    expect(evaluateTaskCompletion({
      steps: [{ id: 'step-1', status: 'completed', evidenceRequirement: ['domain_record'] }],
      evidence: [{ id: 'ev-1', kind: 'domain_record', verified: true }],
      approvals: [{ status: 'approved', payloadVersion: 1, payloadDigest: 'abc' }],
      unresolvedDependencies: []
    })).toEqual({ eligible: true, reasons: [] });
  });
});
