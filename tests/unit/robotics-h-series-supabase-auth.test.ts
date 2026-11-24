import { describe, expect, it, vi } from 'vitest';
import { createHSeriesSupabaseAuthorization, type ScopedSupabaseReader } from '../../packages/robotics/h-series-supabase-auth';
import { readAuthorizedHSeriesCatalog } from '../../packages/robotics/h-series-server-access';
const org = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const user = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const scope = { tenantId: org, organizationId: org };
function fixture(status = 'active', role = 'member', orgActive = true) {
  const tables: Record<string,unknown[]> = {
    organization_members: [{org_id:org,user_id:user,status,role}],
    organizations: [{id:org,active:orgActive}]
  };
  const getUser = vi.fn(async (_token?: string) => ({data:{user:{id:user}},error:null}));
  const rpc = vi.fn(async () => ({data:true as unknown,error:null}));
  const from = vi.fn((table:string) => ({
    select: (_columns:string) => ({
      eq: (_key:string,_value:string) => ({
        eq: async (_key2:string,_value2:string) => ({data:tables[table],error:null})
      })
    })
  }));
  return { client:{auth:{getUser},from,rpc} as unknown as ScopedSupabaseReader, tables, getUser, from, rpc };
}
describe('F11 real ATLAS membership adapter (isolated mocks)', () => {
  it('F11-001 allows verified user with active member and active organization',async()=>{
    const f=fixture(); expect((await readAuthorizedHSeriesCatalog(createHSeriesSupabaseAuthorization('token',org,f.client),scope)).ok).toBe(true);
  });
  it('F11-002 denies revoked membership',async()=>{
    const f=fixture('revoked');expect((await readAuthorizedHSeriesCatalog(createHSeriesSupabaseAuthorization('token',org,f.client),scope)).ok).toBe(false);
  });
  it('F11-003 denies inactive organization',async()=>{
    const f=fixture('active','member',false);expect((await readAuthorizedHSeriesCatalog(createHSeriesSupabaseAuthorization('token',org,f.client),scope)).ok).toBe(false);
  });
  it('F11-004 denies duplicate membership',async()=>{
    const f=fixture();f.tables.organization_members=[f.tables.organization_members[0],f.tables.organization_members[0]];
    expect((await readAuthorizedHSeriesCatalog(createHSeriesSupabaseAuthorization('token',org,f.client),scope)).ok).toBe(false);
  });
  it('F11-005 denies cross tenant',async()=>{
    const f=fixture();expect((await readAuthorizedHSeriesCatalog(createHSeriesSupabaseAuthorization('token',org,f.client),{...scope,tenantId:user})).ok).toBe(false);
  });
  it('F11-006 denies invalid org without network',async()=>{
    const f=fixture();expect((await readAuthorizedHSeriesCatalog(createHSeriesSupabaseAuthorization('token','invalid',f.client),scope)).ok).toBe(false);expect(f.getUser).not.toHaveBeenCalled();
  });
  it('F11-007 denies authentication failure',async()=>{
    const f=fixture();f.getUser.mockRejectedValueOnce(new Error('offline'));
    expect((await readAuthorizedHSeriesCatalog(createHSeriesSupabaseAuthorization('token',org,f.client),scope)).ok).toBe(false);
  });
  it('F12-001 denies absent effective permission even for active membership',async()=>{
    const f=fixture();f.rpc.mockResolvedValueOnce({data:false,error:null});
    expect((await readAuthorizedHSeriesCatalog(createHSeriesSupabaseAuthorization('token',org,f.client),scope)).ok).toBe(false);
  });
  it('F12-002 denies permission lookup failure',async()=>{
    const f=fixture();f.rpc.mockRejectedValueOnce(new Error('permission backend down'));
    expect((await readAuthorizedHSeriesCatalog(createHSeriesSupabaseAuthorization('token',org,f.client),scope)).ok).toBe(false);
  });
  it('F12-003 denies permission response that is not boolean true',async()=>{
    const f=fixture();f.rpc.mockResolvedValueOnce({data:'true',error:null});
    expect((await readAuthorizedHSeriesCatalog(createHSeriesSupabaseAuthorization('token',org,f.client),scope)).ok).toBe(false);
  });
  it('F16-001 denies reuse of a previously authorized session capability',async()=>{
    const f=fixture();const provider=createHSeriesSupabaseAuthorization('token',org,f.client);
    const session=await provider.verifiedSession();expect(session).not.toBeNull();
    expect(await provider.canReadCatalog(session!)).toBe(true);
    expect(await provider.canReadCatalog(session!)).toBe(false);
  });
  it('F16-002 independently accepts two verified sessions without overwriting either',async()=>{
    const f=fixture();const provider=createHSeriesSupabaseAuthorization('token',org,f.client);
    const first=await provider.verifiedSession();const second=await provider.verifiedSession();
    expect(await provider.canReadCatalog(first!)).toBe(true);
    expect(await provider.canReadCatalog(second!)).toBe(true);
  });
  it('F18-001 denies when scoped client identity differs from bearer user',async()=>{
    const f=fixture();f.getUser.mockImplementation(async (token?:string) => ({
      data:{user:{id:token ? user : 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'}},error:null
    }));
    expect((await readAuthorizedHSeriesCatalog(createHSeriesSupabaseAuthorization('token',org,f.client),scope)).ok).toBe(false);
    expect(f.from).not.toHaveBeenCalled();
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('F18-002 requires a scoped client identity check before membership access',async()=>{
    const f=fixture();const result=await readAuthorizedHSeriesCatalog(createHSeriesSupabaseAuthorization('token',org,f.client),scope);
    expect(result.ok).toBe(true);
    expect(f.getUser).toHaveBeenCalledWith('token');
    expect(f.getUser).toHaveBeenCalledWith();
  });
  it('F17-001 calls the exact atlas-core RPC with verified organization and permission',async()=>{
    const f=fixture();const result=await readAuthorizedHSeriesCatalog(createHSeriesSupabaseAuthorization('token',org,f.client),scope);
    expect(result.ok).toBe(true);
    expect(f.rpc).toHaveBeenCalledWith('has_identity_permission',{o:org,p:'execution.read'});
  });
  it('F17-002 rejects an effective role override denying permission',async()=>{
    const f=fixture('active','owner');f.rpc.mockResolvedValueOnce({data:false,error:null});
    expect((await readAuthorizedHSeriesCatalog(createHSeriesSupabaseAuthorization('token',org,f.client),scope)).ok).toBe(false);
  });
  it('F17-003 does not evaluate permissions for revoked membership',async()=>{
    const f=fixture('revoked');await readAuthorizedHSeriesCatalog(createHSeriesSupabaseAuthorization('token',org,f.client),scope);
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('F21-001 denies missing bearer token without consulting the client',async()=>{
    const f=fixture();
    expect((await readAuthorizedHSeriesCatalog(createHSeriesSupabaseAuthorization('',org,f.client),scope)).ok).toBe(false);
    expect(f.getUser).not.toHaveBeenCalled();
    expect(f.from).not.toHaveBeenCalled();
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('F21-002 denies failed scoped-client identity check before any database read',async()=>{
    const f=fixture();f.getUser.mockResolvedValueOnce({data:{user:{id:user}},error:null});
    f.getUser.mockRejectedValueOnce(new Error('scoped JWT unavailable'));
    expect((await readAuthorizedHSeriesCatalog(createHSeriesSupabaseAuthorization('token',org,f.client),scope)).ok).toBe(false);
    expect(f.from).not.toHaveBeenCalled();
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('F21-003 denies missing membership without consulting effective permission',async()=>{
    const f=fixture();f.tables.organization_members=[];
    expect((await readAuthorizedHSeriesCatalog(createHSeriesSupabaseAuthorization('token',org,f.client),scope)).ok).toBe(false);
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('F11-008 denies changed membership on next read',async()=>{
    const f=fixture();const provider=createHSeriesSupabaseAuthorization('token',org,f.client);
    expect((await readAuthorizedHSeriesCatalog(provider,scope)).ok).toBe(true);
    f.tables.organization_members=[{org_id:org,user_id:user,status:'revoked',role:'member'}];
    expect((await readAuthorizedHSeriesCatalog(provider,scope)).ok).toBe(false);
  });
});
