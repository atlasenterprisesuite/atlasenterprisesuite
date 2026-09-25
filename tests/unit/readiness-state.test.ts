import { describe, expect, it } from 'vitest';
import { deriveProductionReadiness } from '../../apps/web/src/modules/readiness';

describe('ATLAS production readiness derivation', () => {
  it('fails closed when mandatory evidence is missing', () => {
    const result = deriveProductionReadiness({ gates: [] });

    expect(result.status).toBe('pending-gate');
    expect(result.reasons).toContain('mandatory_gate_evidence_missing');
    expect(result.reasons).toContain('expected_sha_missing');
    expect(result.reasons).toContain('deployed_sha_missing');
  });

  it('blocks when a mandatory gate fails', () => {
    const result = deriveProductionReadiness({
      gates: [
        { key: 'oauth', required: true, status: 'passed' },
        { key: 'rbac', required: true, status: 'failed', failureReason: 'rbac_verification_failed' }
      ],
      expectedSha: 'abc123',
      deployedSha: 'abc123'
    });

    expect(result).toEqual({
      status: 'blocked',
      label: 'Blocked',
      reasons: ['rbac_verification_failed']
    });
  });

  it('blocks exact-runtime SHA drift', () => {
    const result = deriveProductionReadiness({
      gates: [{ key: 'e2e', required: true, status: 'passed' }],
      expectedSha: 'approved-sha',
      deployedSha: 'different-sha'
    });

    expect(result.status).toBe('blocked');
    expect(result.reasons).toEqual(['exact_runtime_sha_mismatch']);
  });

  it('keeps missing required gates pending instead of inventing success', () => {
    const result = deriveProductionReadiness({
      gates: [{ key: 'oauth', required: true, status: 'passed' }],
      requiredGateKeys: ['oauth', 'rbac'],
      expectedSha: 'abc123',
      deployedSha: 'abc123'
    });

    expect(result.status).toBe('pending-gate');
    expect(result.reasons).toContain('gate_missing:rbac');
  });

  it('declares production verified only after every required gate and exact SHA pass', () => {
    const result = deriveProductionReadiness({
      gates: [
        { key: 'oauth', required: true, status: 'passed' },
        { key: 'rbac', required: true, status: 'passed' },
        { key: 'tenant-isolation', required: true, status: 'passed' },
        { key: 'e2e', required: true, status: 'passed' }
      ],
      requiredGateKeys: ['oauth', 'rbac', 'tenant-isolation', 'e2e'],
      expectedSha: 'abc123',
      deployedSha: 'abc123'
    });

    expect(result).toEqual({
      status: 'production-verified',
      label: 'Production Verified',
      reasons: []
    });
  });
});
