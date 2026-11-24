import { describe, expect, it } from 'vitest';
import { authorizeTrustedDataRoomRead, type TrustedDataRoomSources } from '../../packages/security/secure-data-room-trusted-adapter';

const actor='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01';
const documentId='11111111-1111-4111-8111-111111111111';
const org='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const tenant='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function sources(overrides: Partial<TrustedDataRoomSources> = {}): TrustedDataRoomSources {
  return {
    authenticate: async () => ({userId:actor,sessionActive:true}),
    document: async () => ({tenantId:tenant,organizationId:org,revoked:false}),
    membership: async () => ({tenantId:tenant,active:true}),
    grant: async () => true,
    ...overrides
  };
}
const request={bearerToken:'valid-token',documentId};
describe('ATLAS Secure Data Room trusted-source fail-closed matrix',()=>{
  it.each([
    ['revoked session',{authenticate:async()=>({userId:actor,sessionActive:false})}],
    ['unknown identity',{authenticate:async()=>null}],
    ['unknown document',{document:async()=>null}],
    ['revoked document',{document:async()=>({tenantId:tenant,organizationId:org,revoked:true})}],
    ['inactive membership',{membership:async()=>({tenantId:tenant,active:false})}],
    ['cross-tenant membership',{membership:async()=>({tenantId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',active:true})}],
    ['revoked grant',{grant:async()=>false}]
  ] as const)('denies %s',async(_label,override)=>{
    const result=await authorizeTrustedDataRoomRead(request,sources(override as Partial<TrustedDataRoomSources>));
    expect(result.status).toBe(403);
  });
  it('denies resolver failure without leaking document details',async()=>{
    const result=await authorizeTrustedDataRoomRead(request,sources({grant:async()=>{throw Error('private internal failure')}}));
    expect(result.status).toBe(403);
  });
});
