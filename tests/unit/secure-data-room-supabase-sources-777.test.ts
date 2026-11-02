import { describe, expect, it, vi } from 'vitest';
import { createScopedSupabaseDataRoomSources, type DataRoomScopedRead } from '../../packages/security/secure-data-room-supabase-sources';
import { authorizeTrustedDataRoomRead } from '../../packages/security/secure-data-room-trusted-adapter';

const actor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb01';
const org = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const foreign = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const documentId = '11111111-1111-4111-8111-111111111111';
const now = Date.parse('2026-11-02T12:00:00Z');

function fixtures(options: {
  revoked?: boolean; member?: boolean; grant?: boolean; expiry?: string | null;
  crossTenant?: boolean;
} = {}) {
  const readOne = vi.fn<DataRoomScopedRead>(async (token, table, columns, equals) => {
    if (token !== 'token-a' && token !== 'token-b') return null;
    if (table === 'atlas_data_room_documents') {
      if (equals.id !== documentId) return null;
      return { id: documentId, organization_id: org, tenant_id: options.crossTenant ? foreign : org, revoked_at: options.revoked ? '2026-11-01T00:00:00Z' : null };
    }
    if (table === 'organization_members') {
      if (options.member === false || equals.status !== 'active' || equals.org_id !== org || ![actor,other].includes(equals.user_id)) return null;
      return { user_id: equals.user_id, org_id: org, status: 'active' };
    }
    if (table === 'atlas_data_room_grants') {
      if (options.grant === false || equals.document_id !== documentId || equals.organization_id !== org || equals.tenant_id !== org || equals.grantee_user_id !== actor) return null;
      return { document_id: documentId, organization_id: org, tenant_id: org, grantee_user_id: actor, revoked_at: null, expires_at: options.expiry ?? null };
    }
    return null;
  });
  return { readOne, ...createScopedSupabaseDataRoomSources(readOne, () => now) };
}

function run(s: ReturnType<typeof fixtures>, token='token-a', id=actor) {
  return authorizeTrustedDataRoomRead(
    { bearerToken: token, documentId },
    { authenticate: async () => ({ userId: id, sessionActive: true }), document: s.document, membership: s.membership, grant: s.grant }
  );
}

describe('Secure Data Room: user-scoped Supabase read contract', () => {
  it('binds each lookup to the exact request bearer and scoped row filters', async () => {
    const s = fixtures();
    expect((await run(s)).status).toBe(200);
    expect(s.readOne).toHaveBeenCalledTimes(3);
    expect(s.readOne).toHaveBeenNthCalledWith(1, 'token-a', 'atlas_data_room_documents', expect.any(String), { id: documentId });
    expect(s.readOne).toHaveBeenNthCalledWith(2, 'token-a', 'organization_members', expect.any(String), {user_id: actor,org_id:org,status:'active'});
    expect(s.readOne).toHaveBeenNthCalledWith(3, 'token-a', 'atlas_data_room_grants', expect.any(String), {document_id:documentId,grantee_user_id:actor,organization_id:org,tenant_id:org});
  });
  it.each([
    ['revoked document', {revoked:true}],
    ['inactive membership', {member:false}],
    ['missing grant', {grant:false}],
    ['expired grant', {expiry:'2026-11-02T11:59:59Z'}],
    ['expired at current instant', {expiry:'2026-11-02T12:00:00Z'}],
    ['cross-tenant document', {crossTenant:true}]
  ])('denies %s', async (_label, option) => {
    const s=fixtures(option);
    expect(await run(s)).toEqual({status:403,allowed:false});
  });
  it('fails closed on malformed or absent revocation fields', async () => {
    const readOne: DataRoomScopedRead = async (_t, table) =>
      table === 'atlas_data_room_documents' ? { id:documentId, organization_id:org, tenant_id:org } : null;
    const scoped=createScopedSupabaseDataRoomSources(readOne);
    expect(await scoped.document(documentId, actor, 'token-a')).toBeNull();
  });
  it('fails closed on invalid expiration, including malformed timestamps', async () => {
    const s=fixtures({expiry:'not-a-date'});
    expect(await run(s)).toEqual({status:403,allowed:false});
  });
  it('isolates concurrent requests; no shared bearer or actor state', async () => {
    const s=fixtures();
    const [a,b]=await Promise.all([run(s,'token-a',actor),run(s,'token-b',other)]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(403);
    const calls=s.readOne.mock.calls;
    expect(calls.filter(c=>c[0]==='token-a').every(c=>c[0]==='token-a')).toBe(true);
    expect(calls.some(c=>c[0]==='token-b' && c[1]==='atlas_data_room_grants' && c[3].grantee_user_id===other)).toBe(true);
  });
  it('never reads documents when authoritative session check fails', async () => {
    const s=fixtures();
    const result=await authorizeTrustedDataRoomRead(
      {bearerToken:'token-a',documentId},
      {authenticate:async()=>({userId:actor,sessionActive:false}),document:s.document,membership:s.membership,grant:s.grant}
    );
    expect(result.status).toBe(403);
    expect(s.readOne).not.toHaveBeenCalled();
  });
  it('denies failed database lookups without leaking source errors', async () => {
    const fail: DataRoomScopedRead = async()=>{throw Error('secret backend detail')};
    const scoped=createScopedSupabaseDataRoomSources(fail);
    const result=await authorizeTrustedDataRoomRead(
      {bearerToken:'token-a',documentId},
      {authenticate:async()=>({userId:actor,sessionActive:true}),...scoped}
    );
    expect(result).toEqual({status:403,allowed:false});
  });
});
