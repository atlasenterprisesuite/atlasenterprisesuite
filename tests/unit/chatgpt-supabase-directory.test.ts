import { describe, expect, it } from 'vitest';
import { createAtlasChatGptSupabaseDirectory } from '../../packages/atlas-mcp/src/chatgptSupabaseDirectory';

const orgA = '11111111-1111-4111-8111-111111111111';
const orgB = '22222222-2222-4222-8222-222222222222';
const userA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const now = Date.parse('2026-10-28T12:00:00Z');
const issuer = 'https://issuer.example.test';
const grants = [
  { issuer, subject:'alice', token_id:'token-a', user_id:userA, org_id:orgA, expires_at:'2026-10-29T12:00:00Z', revoked_at:null, session_revoked_at:null },
  { issuer, subject:'bob', token_id:'token-b', user_id:userB, org_id:orgB, expires_at:'2026-10-29T12:00:00Z', revoked_at:null, session_revoked_at:null },
];
const memberships = [
  { user_id:userA, org_id:orgA, status:'active' },
  { user_id:userB, org_id:orgB, status:'active' },
];
const organizations = [{id:orgA,active:true},{id:orgB,active:true}];
const make = (overrides: { grants?: unknown; memberships?: unknown; organizations?: unknown; fail?: boolean; issuerSessionActive?: boolean } = {}) => {
  const hits: string[] = [];
  const lookup = (items: unknown, params: URLSearchParams, fields: string[]) =>
    Array.isArray(items) ? items.filter(row => fields.every(field => {
      const eq = params.get(field);
      return !eq || String((row as Record<string,unknown>)[field]) === eq.slice(3);
    })) : items;
  const fetchFn = async (url: string, init: RequestInit): Promise<Response> => {
    hits.push(url);
    const headers = init.headers as Record<string,string>;
    expect(headers.apikey).toBe('test-secret');
    expect(headers.Authorization).toBe('Bearer test-secret');
    if (overrides.fail) throw new Error('store_unavailable');
    const u = new URL(url);
    const data = u.pathname.endsWith('/atlas_chatgpt_oauth_grants')
      ? lookup(overrides.grants ?? grants,u.searchParams,['issuer','subject','token_id'])
      : u.pathname.endsWith('/organization_members')
      ? lookup(overrides.memberships ?? memberships,u.searchParams,['user_id','org_id','status'])
      : u.pathname.endsWith('/organizations')
      ? lookup(overrides.organizations ?? organizations,u.searchParams,['id','active'])
      : null;
    return { ok:true, status:200, json:async()=>data } as Response;
  };
  return { directory:createAtlasChatGptSupabaseDirectory({issuer,supabaseUrl:'https://project.example.test',serviceRoleKey:'test-secret',fetchFn,verifyIssuerSession:async()=>overrides.issuerSessionActive !== false,nowSeconds:()=>now/1000}), hits };
};

describe('ATLAS ChatGPT server-bound Supabase directory: isolated two-org E2E',()=>{
  it('binds verified subjects to their own active memberships, never to caller org claims',async()=>{
    const {directory,hits}=make();
    const identity = await directory.resolveIdentity('alice','token-a');
    expect(hits.map(url => new URL(url).pathname)).toEqual([
      '/rest/v1/atlas_chatgpt_oauth_grants', '/rest/v1/organization_members', '/rest/v1/organizations'
    ]);
    expect(identity).toEqual({tenantId:orgA,organizationId:orgA,active:true});
    expect(await directory.resolveIdentity('bob','token-b')).toEqual({tenantId:orgB,organizationId:orgB,active:true});
    expect(await directory.resolveIdentity('alice','token-b')).toBeNull();
    expect(await directory.resolveIdentity('bob','token-a')).toBeNull();
    expect(hits.every(url=>!url.includes('test-secret'))).toBe(true);
  });
  it('denies revoked token and signed-out session, including on a subsequent request',async()=>{
    const {directory}=make();
    expect(await directory.isRevoked('token-a','alice')).toBe(false);
    const after=make({grants:[{...grants[0],session_revoked_at:'2026-10-28T11:30:00Z'},grants[1]]}).directory;
    expect(await after.resolveIdentity('alice','token-a')).toBeNull();
    expect(await after.isRevoked('token-a','alice')).toBe(true);
    const revoked=make({grants:[{...grants[0],revoked_at:'2026-10-28T11:30:00Z'},grants[1]]}).directory;
    expect(await revoked.resolveIdentity('alice','token-a')).toBeNull();
    expect(await revoked.isRevoked('token-a','alice')).toBe(true);
    const issuerRevoked=make({issuerSessionActive:false}).directory;
    expect(await issuerRevoked.resolveIdentity('alice','token-a')).toBeNull();
    expect(await issuerRevoked.isRevoked('token-a','alice')).toBe(true);
  });
  it('denies removed membership, inactive organization, expired grant and duplicate grants',async()=>{
    const removed=make({memberships:[{...memberships[0],status:'revoked'},memberships[1]]}).directory;
    expect(await removed.resolveIdentity('alice','token-a')).toBeNull();
    expect(await removed.isRevoked('token-a','alice')).toBe(true);
    expect(await make({organizations:[{id:orgA,active:false},organizations[1]]}).directory.resolveIdentity('alice','token-a')).toBeNull();
    expect(await make({grants:[{...grants[0],expires_at:'2026-10-27T12:00:00Z'},grants[1]]}).directory.resolveIdentity('alice','token-a')).toBeNull();
    expect(await make({grants:[grants[0],grants[0]]}).directory.resolveIdentity('alice','token-a')).toBeNull();
  });
  it('accepts canonical UUID grants but denies malformed UUID identifiers',async()=>{
    expect(await make().directory.resolveIdentity('alice','token-a')).toEqual({tenantId:orgA,organizationId:orgA,active:true});
    const invalidUser = make({grants:[{...grants[0],user_id:'aaaaaaaa-aaaa-4aaa-8aaaaaaaaaaaa'},grants[1]]}).directory;
    expect(await invalidUser.resolveIdentity('alice','token-a')).toBeNull();
    const invalidOrg = make({grants:[{...grants[0],org_id:'11111111-1111-4111-811111111111'},grants[1]]}).directory;
    expect(await invalidOrg.resolveIdentity('alice','token-a')).toBeNull();
  });
  it('fails closed on malformed responses, backend outage and malformed identifiers',async()=>{
    expect(await make({grants:{unexpected:'object'}}).directory.resolveIdentity('alice','token-a')).toBeNull();
    expect(await make({fail:true}).directory.resolveIdentity('alice','token-a')).toBeNull();
    expect(await make({fail:true}).directory.isRevoked('token-a','alice')).toBe(true);
    expect(await make().directory.resolveIdentity('alice,org_id.eq.'+orgB,'token-a')).toBeNull();
  });
  it('requires an issuer-scoped grant, even for an identical signed subject and token id',async()=>{
    const foreign = make({grants:[{...grants[0],issuer:'https://other-issuer.example.test'},grants[1]]}).directory;
    expect(await foreign.resolveIdentity('alice','token-a')).toBeNull();
    expect(await foreign.isRevoked('token-a','alice')).toBe(true);
  });
  it('rejects unsafe server configuration before any fetch',()=>{
    expect(()=>createAtlasChatGptSupabaseDirectory({issuer,supabaseUrl:'http://project.example.test',serviceRoleKey:'key',verifyIssuerSession:async()=>true})).toThrow();
    expect(()=>createAtlasChatGptSupabaseDirectory({issuer,supabaseUrl:'https://project.example.test',serviceRoleKey:'',verifyIssuerSession:async()=>true})).toThrow();
    expect(()=>createAtlasChatGptSupabaseDirectory({issuer,supabaseUrl:'https://project.example.test',serviceRoleKey:'key'} as never)).toThrow();
    expect(()=>createAtlasChatGptSupabaseDirectory({supabaseUrl:'https://project.example.test',serviceRoleKey:'key',verifyIssuerSession:async()=>true} as never)).toThrow();
    expect(()=>createAtlasChatGptSupabaseDirectory({issuer:'http://issuer.example.test',supabaseUrl:'https://project.example.test',serviceRoleKey:'key',verifyIssuerSession:async()=>true})).toThrow();
  });
});
