import { describe, expect, it, vi } from 'vitest';
import { trustedCertificationStore777 } from '../../packages/core/src/trustedCertificationStore777';

const orgA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const orgB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const userId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const evidence = { moduleId:'atlas-pay',sha:'a'.repeat(40),state:'validation' as const,certified:false,blockers:['P0_OPEN'],verifiedChecks:['unit'] };
describe('trusted atomic certification membership', () => {
  it('uses verified active membership and canonical tenant scope', async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    const memberships = vi.fn(async () => [{ org_id:orgA,role:'admin',status:'active' }]);
    const store = await trustedCertificationStore777({userId,memberships},orgA,rpc);
    await store.record(evidence);
    expect(memberships).toHaveBeenCalledWith(userId);
    expect(rpc).toHaveBeenCalledWith(expect.objectContaining({p_org_id:orgA,p_tenant_id:orgA}));
  });
  it('rejects cross-tenant requests without invoking RPC', async () => {
    const rpc = vi.fn();
    await expect(trustedCertificationStore777({userId,memberships:async()=>[{org_id:orgA,role:'admin',status:'active'}]},orgB,rpc)).rejects.toThrow('CERTIFICATION_MEMBERSHIP_REQUIRED');
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rejects inactive or insufficiently privileged membership', async () => {
    const rpc = vi.fn();
    for (const membership of [{org_id:orgA,role:'admin',status:'revoked'},{org_id:orgA,role:'member',status:'active'}]) {
      await expect(trustedCertificationStore777({userId,memberships:async()=>[membership]},orgA,rpc)).rejects.toThrow('CERTIFICATION_MEMBERSHIP_REQUIRED');
    }
    expect(rpc).not.toHaveBeenCalled();
  });
  it('fails closed when membership lookup is unavailable', async () => {
    const rpc = vi.fn();
    await expect(trustedCertificationStore777({userId,memberships:async()=>{throw new Error('membership offline');}},orgA,rpc)).rejects.toThrow('membership offline');
    expect(rpc).not.toHaveBeenCalled();
  });
});
