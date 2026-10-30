import { describe, expect, it } from 'vitest';
import { handleAtlasChatGptHttp } from '../../packages/atlas-mcp/src/chatgptHttpResource';
const opts = { resource:'https://resource.example.test',issuer:'https://issuer.example.test',nowSeconds:1900000000,
 verifyToken:async()=>({subject:'user',tenantId:'trusted-tenant',organizationId:'trusted-org',issuer:'https://issuer.example.test',audience:'https://resource.example.test',expiresAt:2000000000,scopes:['atlas:apps:read'],revoked:false}) };
const rpc={jsonrpc:'2.0',id:1,method:'tools/list'};
describe('isolated OAuth HTTP transport',()=>{
 it('publishes protected resource metadata',async()=>{
  const res=await handleAtlasChatGptHttp({method:'GET',path:'/.well-known/oauth-protected-resource'},opts);
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({resource:opts.resource,authorization_servers:[opts.issuer]});
 });
 it('challenges missing token without leaking secrets',async()=>{
  const res=await handleAtlasChatGptHttp({method:'POST',path:'/mcp',body:rpc},opts);
  expect(res.status).toBe(401);
  expect(res.headers['www-authenticate']).toContain('resource_metadata=');
  expect(JSON.stringify(res)).not.toContain('trusted-tenant');
 });
 it('denies unauthorized tool writes and injection',async()=>{
  const write=await handleAtlasChatGptHttp({method:'POST',path:'/mcp',authorization:'Bearer opaque',body:{...rpc,method:'tools/call',params:{name:'atlas.deploy.request',arguments:{}}}},opts);
  expect(write.status).toBe(403);
  const injection=await handleAtlasChatGptHttp({method:'POST',path:'/mcp',authorization:'Bearer opaque',body:{...rpc,method:'tools/call',params:{name:'atlas.apps.catalog',arguments:{organizationId:'other'}}}},opts);
  expect(injection.status).toBe(403);
 });
 it('rejects invalid RPC and unrelated routes',async()=>{
  expect((await handleAtlasChatGptHttp({method:'POST',path:'/mcp',body:[]},opts)).status).toBe(400);
  expect((await handleAtlasChatGptHttp({method:'GET',path:'/mcp'},opts)).status).toBe(404);
 });
 it('fails closed for revoked, missing tenant and missing organization identities',async()=>{
  const cases=[
   {revoked:true},
   {tenantId:''},
   {organizationId:''},
  ];
  for (const change of cases) {
   const denied={...opts,verifyToken:async()=>({...await opts.verifyToken(),...change})};
   const res=await handleAtlasChatGptHttp({method:'POST',path:'/mcp',authorization:'Bearer opaque',body:rpc},denied);
   expect(res.status).toBe(401);
   expect(JSON.stringify(res)).not.toContain('trusted-tenant');
  }
 });
 it('rejects tenant and organization selection supplied by the MCP caller',async()=>{
  for (const arguments_ of [{tenantId:'other-tenant'},{organizationId:'other-org'},{tenantId:'trusted-tenant',organizationId:'other-org'}]) {
   const res=await handleAtlasChatGptHttp({method:'POST',path:'/mcp',authorization:'Bearer opaque',body:{...rpc,method:'tools/call',params:{name:'atlas.apps.catalog',arguments:arguments_}}},opts);
   expect(res.status).toBe(403);
  }
 });
 it('rejects hostile origins and unsupported transport negotiation',async()=>{
  const base={method:'POST',path:'/mcp',authorization:'Bearer opaque',body:rpc};
  expect((await handleAtlasChatGptHttp({...base,origin:'https://evil.example.test'},opts)).status).toBe(403);
  expect((await handleAtlasChatGptHttp({...base,contentType:'text/plain'},opts)).status).toBe(415);
  expect((await handleAtlasChatGptHttp({...base,accept:'application/json'},opts)).status).toBe(406);
  expect((await handleAtlasChatGptHttp({...base,protocolVersion:'2026-07-28'},opts)).status).toBe(400);
 });
 it('does not acknowledge notifications without certified session lifecycle',async()=>{
  const res=await handleAtlasChatGptHttp({method:'POST',path:'/mcp',authorization:'Bearer opaque',body:{jsonrpc:'2.0',method:'notifications/initialized'}},opts);
  expect(res.status).toBe(400);
 });

});
