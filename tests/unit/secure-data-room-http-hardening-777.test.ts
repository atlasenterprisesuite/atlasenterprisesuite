import { describe, expect, it, vi } from 'vitest';
import { createDataRoomReadHandler } from '../../packages/security/secure-data-room-http';
import type { TrustedDataRoomSources } from '../../packages/security/secure-data-room-trusted-adapter';

const documentId = '123e4567-e89b-42d3-a456-426614174000';
function trusted(): TrustedDataRoomSources {
  return {
    authenticate: vi.fn(async () => ({userId:'user-a',sessionActive:true})),
    document: vi.fn(async () => ({tenantId:'org-a',organizationId:'org-a',revoked:false})),
    membership: vi.fn(async () => ({tenantId:'org-a',active:true})),
    grant: vi.fn(async () => true)
  };
}
function post(body: string, headers: Record<string,string>={}) {
  return new Request('https://example.invalid/atlas-secure-data-room',{
    method:'POST',
    headers:{authorization:'Bearer token-a','content-type':'application/json',...headers},
    body
  });
}
describe('Secure Data Room 777 HTTP predeploy privacy and input limits',()=>{
  it('rejects oversized body even when Content-Length lies',async()=>{
    const s=trusted();
    const res=await createDataRoomReadHandler(s)(post(JSON.stringify({documentId, padding:'z'.repeat(4096)}),{'content-length':'2'}));
    expect(res.status).toBe(403);
    expect(s.authenticate).not.toHaveBeenCalled();
    expect(await res.text()).toBe('');
  });
  it('rejects overly large declared length before invoking trust sources',async()=>{
    const s=trusted();
    const res=await createDataRoomReadHandler(s)(post(JSON.stringify({documentId}),{'content-length':'2048'}));
    expect(res.status).toBe(403);
    expect(s.authenticate).not.toHaveBeenCalled();
  });
  it('never accepts client-provided identity, tenant, or authorization flags',async()=>{
    const s=trusted();
    const res=await createDataRoomReadHandler(s)(post(JSON.stringify({documentId, tenantId:'org-b',grantActive:true,sessionActive:true})));
    expect(res.status).toBe(403);
    expect(s.authenticate).not.toHaveBeenCalled();
  });
  it('sends privacy headers and no payload for both authorized-only and denied decisions',async()=>{
    const s=trusted();
    const handler=createDataRoomReadHandler(s);
    for (const req of [post(JSON.stringify({documentId})),post(JSON.stringify({documentId:'bad'}))]){
      const res=await handler(req);
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.headers.get('pragma')).toBe('no-cache');
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
      expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
      expect(res.headers.get('vary')).toBe('Authorization');
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
      expect(res.headers.get('content-disposition')).toBeNull();
      expect(await res.text()).toBe('');
    }
  });
  it('fails closed before any lookup if session not certified',async()=>{
    const s=trusted();
    s.authenticate=vi.fn(async()=>({userId:'user-a',sessionActive:false}));
    const result=await createDataRoomReadHandler(s)(post(JSON.stringify({documentId})));
    expect(result.status).toBe(403);
    expect(s.document).not.toHaveBeenCalled();
  });
});
