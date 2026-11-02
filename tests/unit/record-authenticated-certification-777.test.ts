import { describe, expect, it, vi } from 'vitest';
import { recordAuthenticatedCertification777 } from '../../packages/core/src/recordAuthenticatedCertification777';

const org='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const evidence={moduleId:'atlas-pay',sha:'a'.repeat(40),state:'validation' as const,certified:false,blockers:['P0_OPEN'],verifiedChecks:['unit']};
function fixture(membership={org_id:org,role:'admin',status:'active'}) {
  const limit=vi.fn(async()=>({data:[membership],error:null}));
  const status=vi.fn(()=>({limit}));
  const orgEq=vi.fn(()=>({eq:status}));
  const userEq=vi.fn(()=>({eq:orgEq}));
  const select=vi.fn(()=>({eq:userEq}));
  const from=vi.fn(()=>({select}));
  const getUser=vi.fn(async()=>({data:{user:{id:'user-verified'}},error:null}));
  const privilegedRpc=vi.fn(async()=>({data:true,error:null}));
  return {clients:{authenticated:{auth:{getUser},from},privilegedRpc},limit,userEq,orgEq,status,getUser,privilegedRpc};
}
describe('authenticated atomic certification composition',()=>{
  it('verifies user, active org membership and server-derived tenant',async()=>{
    const f=fixture();
    await recordAuthenticatedCertification777('Bearer token',org,evidence,f.clients);
    expect(f.getUser).toHaveBeenCalledWith('token');
    expect(f.userEq).toHaveBeenCalledWith('user_id','user-verified');
    expect(f.orgEq).toHaveBeenCalledWith('org_id',org);
    expect(f.status).toHaveBeenCalledWith('status','active');
    expect(f.privilegedRpc).toHaveBeenCalledWith(expect.objectContaining({p_org_id:org,p_tenant_id:org}));
  });
  it('rejects missing authentication without membership or RPC',async()=>{
    const f=fixture();
    await expect(recordAuthenticatedCertification777('',org,evidence,f.clients)).rejects.toThrow('CERTIFICATION_AUTH_REQUIRED');
    expect(f.getUser).not.toHaveBeenCalled();
    expect(f.privilegedRpc).not.toHaveBeenCalled();
  });
  it('rejects revoked membership and cross-tenant responses',async()=>{
    for(const m of [{org_id:org,role:'admin',status:'revoked'},{org_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',role:'admin',status:'active'}]){
      const f=fixture(m);
      await expect(recordAuthenticatedCertification777('Bearer token',org,evidence,f.clients)).rejects.toThrow('CERTIFICATION_MEMBERSHIP_REQUIRED');
      expect(f.privilegedRpc).not.toHaveBeenCalled();
    }
  });
  it('fails closed on missing membership or failed RPC',async()=>{
    const f=fixture();
    f.limit.mockResolvedValueOnce({data:[],error:null});
    await expect(recordAuthenticatedCertification777('Bearer token',org,evidence,f.clients)).rejects.toThrow('CERTIFICATION_MEMBERSHIP_REQUIRED');
    expect(f.privilegedRpc).not.toHaveBeenCalled();
    const g=fixture();
    g.privilegedRpc.mockResolvedValueOnce({data:false,error:null});
    await expect(recordAuthenticatedCertification777('Bearer token',org,evidence,g.clients)).rejects.toThrow('CERTIFICATION_WRITE_UNCONFIRMED');
  });
});
