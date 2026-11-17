import { describe, expect, it } from 'vitest';
import { generateKeyPairSync, sign, type JsonWebKey } from 'node:crypto';
import { createAtlasJwtVerifier, atlasProtectedResourceMetadata } from '../../packages/atlas-mcp/src/chatgptOAuthResource';
import { handleChatGptCatalogMcp } from '../../packages/atlas-mcp/src/chatgptReadOnlyAdapter';
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format:'jwk' }) as JsonWebKey, kid:'key-1', alg:'RS256', use:'sig' };
const base = { iss:'https://issuer.example.test', aud:'https://resource.example.test', sub:'user-a',
  exp:2000001000, nbf:1900000000, iat:1900000000, jti:'nonce-1', scope:'atlas:apps:read',
  tenant_id:'injected-tenant', organization_id:'injected-org' };
const jwt = (claims:Record<string,unknown>=base, key=privateKey, header:Record<string,unknown>={alg:'RS256',kid:'key-1',typ:'at+jwt'}) => {
 const h=Buffer.from(JSON.stringify(header)).toString('base64url');
 const p=Buffer.from(JSON.stringify(claims)).toString('base64url');
 return h+'.'+p+'.'+sign('RSA-SHA256',Buffer.from(h+'.'+p),key).toString('base64url');
};
const make = (changes:Record<string,unknown>={}) => createAtlasJwtVerifier({
 issuer:base.iss,audience:base.aud,getJwks:async()=>({keys:[jwk]}),
 resolveIdentity:async()=>({tenantId:'trusted-tenant',organizationId:'trusted-org',active:true}),
 isRevoked:async()=>false,nowSeconds:()=>1900000001,...changes,
});
describe('OAuth resource server fail closed',()=>{
 it('accepts a valid signature and ignores injected tenant claims',async()=>{
  const identity=await make()(jwt());expect(identity?.tenantId).toBe('trusted-tenant');
  expect(identity?.organizationId).toBe('trusted-org');
 });
 it('looks up membership only by the signed subject and token id, never caller tenant claims',async()=>{
  const observed: Array<[string,string]>=[];
  const verify=make({resolveIdentity:async(subject:string,jti:string)=>{
   observed.push([subject,jti]);
   return {tenantId:'trusted-tenant',organizationId:'trusted-org',active:true};
  }});
  const identity=await verify(jwt({...base,tenant_id:'other-tenant',organization_id:'other-org'}));
  expect(identity?.tenantId).toBe('trusted-tenant');
  expect(identity?.organizationId).toBe('trusted-org');
  expect(observed).toEqual([['user-a','nonce-1']]);
 });
 it('denies another subject even if its signed claims name an existing tenant',async()=>{
  const verify=make({resolveIdentity:async(subject:string,jti:string)=>
   subject==='user-a' && jti==='nonce-1'
    ? {tenantId:'trusted-tenant',organizationId:'trusted-org',active:true}
    : null});
  expect(await verify(jwt({...base,sub:'user-b',tenant_id:'trusted-tenant',organization_id:'trusted-org'}))).toBeNull();
 });
 it('rejects forged signature, alg none and unknown JWKS kid',async()=>{
  const other=generateKeyPairSync('rsa',{modulusLength:2048});
  expect(await make()(jwt(base,other.privateKey))).toBeNull();
  expect(await make()(jwt(base,privateKey,{alg:'none',kid:'key-1'}))).toBeNull();
  expect(await make({getJwks:async()=>({keys:[]})})(jwt())).toBeNull();
 });
 it('rejects invalid issuer, audience, expiry, nbf, scope and missing jti',async()=>{
  for(const change of [{iss:'evil'},{aud:'evil'},{exp:1},{nbf:2000000002},{scope:'atlas:apps:write'},{jti:''}])
   expect(await make()(jwt({...base,...change}))).toBeNull();
 });
 it('rejects revocation, missing membership, failed JWKS and replay',async()=>{
  expect(await make({isRevoked:async()=>true})(jwt())).toBeNull();
  expect(await make({resolveIdentity:async()=>null})(jwt())).toBeNull();
  expect(await make({getJwks:async()=>{throw Error('unavailable')}})(jwt())).toBeNull();
  expect(await make({rejectReplay:async()=>true})(jwt())).toBeNull();
 });
 it('fails closed when revocation, replay or membership services return malformed answers',async()=>{
  expect(await make({isRevoked:async()=>undefined})(jwt())).toBeNull();
  expect(await make({isRevoked:async()=>null})(jwt())).toBeNull();
  expect(await make({rejectReplay:async()=>undefined})(jwt())).toBeNull();
  expect(await make({resolveIdentity:async()=>({tenantId:'trusted-tenant',organizationId:'trusted-org',active:'yes'})})(jwt())).toBeNull();
 });
 it('rejects malformed transport and unauthorized writes through MCP',async()=>{
  const verifyToken=make();
  const request={jsonrpc:'2.0' as const,id:1,method:'tools/call',params:{name:'atlas.deploy.request',arguments:{}}};
  const result=await handleChatGptCatalogMcp({request,authorization:'Bearer '+jwt(),verifyToken,expectedIssuer:base.iss,expectedAudience:base.aud,nowSeconds:1900000001});
  expect(result.status).toBe(403);
  expect((await handleChatGptCatalogMcp({...{request},authorization:'Basic '+jwt(),verifyToken,expectedIssuer:base.iss,expectedAudience:base.aud})).status).toBe(401);
 });
 it('publishes protected resource metadata only for HTTPS',()=>{
  expect(atlasProtectedResourceMetadata(base.aud,base.iss).scopes_supported).toEqual(['atlas:apps:read']);
  expect(()=>atlasProtectedResourceMetadata('http://localhost:8788',base.iss)).toThrow();
 });
});
