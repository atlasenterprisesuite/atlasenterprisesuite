import { describe, expect, it } from 'vitest';
import { verifyEvidenceRequirements } from '../../packages/execution/src/index';

describe('execution evidence policy', () => {
  it('requires verified evidence of every required type', () => {
    const unverified = [{ evidenceId: 'e1', organizationId: 'org-1', taskId: 'task-1', stepId: 'step-1', evidenceType: 'provider_reference', sourceType: 'provider', sourceReference: 'ref-1', verificationState: 'unverified' as const, immutableDigest: null, createdAt: '2026-09-12T00:00:00Z' }];
    expect(verifyEvidenceRequirements(['provider_reference'], unverified)).toBe(false);
    expect(verifyEvidenceRequirements(['provider_reference'], [{ ...unverified[0], verificationState: 'verified' as const }])).toBe(true);
  });
});
