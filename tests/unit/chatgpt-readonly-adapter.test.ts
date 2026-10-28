import { describe, expect, it } from 'vitest';
import { handleChatGptCatalogMcp, type VerifiedChatGptPrincipal } from '../../packages/atlas-mcp/src/chatgptReadOnlyAdapter';
const principal: VerifiedChatGptPrincipal = { subject:'user-1',tenantId:'tenant-1',organizationId:'org-1',scopes:['atlas:apps:read'],issuer:'https://auth.example.test',audience:'https://mcp.example.test',expiresAt:2000000000,revoked:false };
const request = (method:string, params?:unknown) => ({ jsonrpc:'2.0' as const,id:1,method,params });
const call = (overrides:Partial<VerifiedChatGptPrincipal>|null={},method='tools/list',params?:unknown,authorization='Bearer opaque-token') =>
 handleChatGptCatalogMcp({request:request(method,params),authorization,verifyToken:async()=>overrides===null?null:{...principal,...overrides},expectedIssuer:principal.issuer,expectedAudience:principal.audience,nowSeconds:1900000000});
describe('ChatGPT catalog isolated MCP authorization',()=>{
 it('rejects absent credentials and unverifiable token',async()=>{expect((await call({},'tools/list',undefined,undefined)).status).toBe(401);expect((await call(null)).status).toBe(401)});
 it('rejects tenantless, orgless and subjectless identity',async()=>{for(const key of ['tenantId','organizationId','subject'] as const)expect((await call({[key]:''})).status).toBe(401)});
 it('rejects wrong issuer, audience, scope, expiry and revocation',async()=>{
  for(const change of [{issuer:'https://evil.test'},{audience:'wrong'},{scopes:[]},{expiresAt:1},{revoked:true}])expect((await call(change)).status).toBe(401);
 });
 it('rejects unknown methods, write tools and injected arguments',async()=>{
  expect((await call({},'tools/call',{name:'atlas.deploy.request',arguments:{}})).status).toBe(403);
  expect((await call({},'tools/call',{name:'atlas.apps.catalog',arguments:{organizationId:'other'}})).status).toBe(403);
  expect((await call({},'tools/call',{name:'atlas.apps.catalog',arguments:{__proto__:'x',tenant:'other'}})).status).toBe(403);
  expect((await call({},'tools/list',undefined,'Basic test')).status).toBe(401);
  expect((await call({},'resources/read')).status).toBe(400);
 });
 it('lists only one read-only tool and no connected apps',async()=>{
  const tools=await call();
  expect(tools.status).toBe(200);
  const list=(tools.body.result as {tools:Array<{name:string}>}).tools;
  expect(list.map(t=>t.name)).toEqual(['atlas.apps.catalog']);
  const result=await call({},'tools/call',{name:'atlas.apps.catalog',arguments:{}});
  expect(result.status).toBe(200);
  const apps=((result.body.result as {structuredContent:{apps:Array<{status:string}>}}).structuredContent.apps);
  expect(apps).toHaveLength(29);
  expect(apps.every(a=>a.status==='not_connected')).toBe(true);
 });
});
