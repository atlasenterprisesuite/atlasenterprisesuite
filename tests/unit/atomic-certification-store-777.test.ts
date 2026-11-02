import { describe, expect, it, vi } from 'vitest';
import { atomicCertificationStore777 } from '../../packages/core/src/atomicCertificationStore777';
import type { ReadinessResult } from '../../packages/core/src/integrationReadiness777';

const organizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const sha = 'a'.repeat(40);
const evidence: ReadinessResult = {
  moduleId: 'atlas-pay', sha, state: 'validation', certified: false,
  blockers: ['P0_OPEN'], verifiedChecks: ['unit']
};
describe('atomic certification RPC boundary', () => {
  it('rejects untrusted or missing organization and tenant scopes', () => {
    const rpc = vi.fn();
    expect(() => atomicCertificationStore777({ organizationId: 'org-a', tenantId: 'tenant-a' }, rpc)).toThrow('INVALID_CERTIFICATION_SCOPE');
    expect(() => atomicCertificationStore777({ organizationId, tenantId: ' tenant-a ' }, rpc)).toThrow('INVALID_CERTIFICATION_SCOPE');
    expect(rpc).not.toHaveBeenCalled();
  });
  it('passes exact SHA and trusted tenant scope to a single RPC', async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    await atomicCertificationStore777({ organizationId, tenantId: 'tenant-a' }, rpc).record(evidence);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith({
      p_org_id: organizationId, p_tenant_id: 'tenant-a',
      p_module_id: 'atlas-pay', p_sha: sha, p_evidence: evidence
    });
  });
  it('fails closed for missing SHA or attempted operational certification', async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    const store = atomicCertificationStore777({ organizationId, tenantId: 'tenant-a' }, rpc);
    await expect(store.record({ ...evidence, sha: 'wrong' })).rejects.toThrow('INVALID_CERTIFICATION_EVIDENCE');
    await expect(store.record({ ...evidence, certified: true, state: 'operational_confirmed' })).rejects.toThrow('INVALID_CERTIFICATION_EVIDENCE');
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rejects RPC errors, null confirmations, and thrown network failures', async () => {
    const fail = atomicCertificationStore777({ organizationId, tenantId: 'tenant-a' }, async () => ({ data: null, error: { message: 'offline' } }));
    await expect(fail.record(evidence)).rejects.toThrow('CERTIFICATION_WRITE_UNCONFIRMED');
    const noConfirmation = atomicCertificationStore777({ organizationId, tenantId: 'tenant-a' }, async () => ({ data: false, error: null }));
    await expect(noConfirmation.record(evidence)).rejects.toThrow('CERTIFICATION_WRITE_UNCONFIRMED');
    const network = atomicCertificationStore777({ organizationId, tenantId: 'tenant-a' }, async () => { throw new Error('network'); });
    await expect(network.record(evidence)).rejects.toThrow('network');
  });
});
