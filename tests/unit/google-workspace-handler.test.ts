// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
let handler:(request:Request)=>Promise<Response>;
let providerCalls=0, permission=true;
const vars:Record<string,string>={SUPABASE_URL:'https://atlas.example',SUPABASE_SERVICE_ROLE_KEY:'service-test',SUPABASE_ANON_KEY:'anon-test',ATLAS_INTEGRATION_CREDENTIAL_KEY:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'secret',GOOGLE_REDIRECT_URI:'https://www.atlasenterprisesuite.com/connect/google',GOOGLE_OAUTH_STATE_SECRET:'state-secret-longer-than-32-test-characters'};
beforeEach(async()=>{
 vi.resetModules();providerCalls=0;permission=true;
 vi.stubGlobal('Deno',{env:{get:(name:string)=>vars[name]},serve:(fn:any)=>{handler=fn;}});
 vi.stubGlobal('fetch',vi.fn(async(url:string,init:RequestInit)=>{
  if(url.endsWith('/auth/v1/user'))return Response.json({id:'33333333-3333-4333-8333-333333333333'});
  if(url.endsWith('/rpc/has_identity_permission')){expect((init.headers as any).Authorization).toBe('Bearer session');return Response.json(permission);}
  if(url.includes('atlas_integration_connections')){expect((init.headers as any).Authorization).toBe('Bearer service-test');return Response.json([]);}
  providerCalls++;return new Response('not expected',{status:500});
 }));
 await import('../../supabase/functions/atlas-google-workspace/index');
});
afterEach(()=>vi.unstubAllGlobals());
function request(origin='https://www.atlasenterprisesuite.com',token='Bearer session'){
 return new Request('https://atlas.example/functions/v1/atlas-google-workspace',{method:'POST',headers:{Origin:origin,Authorization:token},body:JSON.stringify({action:'status',organizationId:'11111111-1111-4111-8111-111111111111'})});
}
it('rejects foreign origins and missing sessions before reading private storage',async()=>{
 expect((await handler(request('https://evil.example'))).status).toBe(403);
 expect((await handler(request(undefined,''))).status).toBe(401);
 expect(fetch).not.toHaveBeenCalled();
});
it('uses the user session for RBAC and never returns credential material in status',async()=>{
 const response=await handler(request());expect(response.status).toBe(200);
 expect(await response.json()).toEqual({connected:false});
 expect(response.headers.get('cache-control')).toBe('no-store');expect(providerCalls).toBe(0);
});
it('denies organization access before server storage or Google requests',async()=>{
 permission=false;const response=await handler(request());expect(response.status).toBe(403);
 expect(await response.json()).toEqual({error:'permission_denied'});expect(providerCalls).toBe(0);
 expect(fetch).toHaveBeenCalledTimes(2);
});
it('returns 401 for an expired session so the existing client can refresh it',async()=>{
 vi.mocked(fetch).mockResolvedValueOnce(new Response('{}',{status:401}));
 expect((await handler(request())).status).toBe(401);
});
