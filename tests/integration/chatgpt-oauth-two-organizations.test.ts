import { describe, expect, it } from 'vitest';
import { generateKeyPairSync, sign, type JsonWebKey } from 'node:crypto';
import { createAtlasJwtVerifier } from '../../packages/atlas-mcp/src/chatgptOAuthResource';
import { createAtlasChatGptSupabaseDirectory } from '../../packages/atlas-mcp/src/chatgptSupabaseDirectory';
import { handleAtlasChatGptHttp } from '../../packages/atlas-mcp/src/chatgptHttpResource';

const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}) as JsonWebKey,kid:'test-key',alg:'RS256',use:'sig'};
const issuer='https://issuer.example.test';
const audience='https://resource.example.test';
const orgA='11111111-1111-4111-8111-111111111111';
const orgB='22222222-2222-4222-8222-222222222222';
const userA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const claims=(subject:string,jti:string,org:string)=>({
 iss:issuer,aud:audience,sub:subject,jti,exp:2000001000,nbf:1900000000,iat:1900000000,
 scope:'atlas:apps:read',tenant_id:org,organization_id:org
});
const token=(payload:Record<string,unknown>)=>{
 const h=Buffer.from(JSON.stringify({alg:'RS256',kid:'test-key',typ:'at+jwt'})).toString('base64url');
 const p=Buffer.from(JSON.stringify(payload)).toString('base64url');
 return h+'.'+p+'.'+sign('RSA-SHA256',Buffer.from(h+'.'+p),privateKey).toString('base64url');
};
const rpc={jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'atlas.apps.catalog',arguments:{}}};

describe('ATLAS ChatGPT OAuth → Supabase → MCP two-organization isolated integration',()=>{
 it('allows two distinct signed identities, rejects org injection, and revokes a session on next request',async()=>{
  const records=[
   {subject:'alice',token_id:'alice-jti',user_id:userA,org_id:orgA,expires_at:'2031-01-01T00:00:00Z',revoked_at:null as string|null,session_revoked_at:null as string|null},
   {subject:'bob',token_id:'bob-jti',user_id:userB,org_id:orgB,expires_at:'2031-01-01T00:00:00Z',revoked_at:null as string|null,session_revoked_at:null as string|null}
  ];
  const memberships=[{user_id:userA,org_id:orgA,status:'active'},{user_id:userB,org_id:orgB,status:'active'}];
  const organizations=[{id:orgA,active:true},{id:orgB,active:true}];
  const fetchFn=async (raw:string):Promise<Response>=>{
   const url=new URL(raw);
   const matching=(rows:Array<Record<string,unknown>>, keys:string[])=>rows.filter(row=>keys.every(k=>{
    const q=url.searchParams.get(k);
    return !q || row[k]===q.slice(3);
   }));
   const data=url.pathname.endsWith('/atlas_chatgpt_oauth_grants')
    ? matching(records,['subject','token_id'])
    : url.pathname.endsWith('/organization_members')
    ? matching(memberships,['org_id','user_id','status'])
    : url.pathname.endsWith('/organizations')
    ? matching(organizations,['id']) : null;
   return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
  };
  const directory=createAtlasChatGptSupabaseDirectory({
   supabaseUrl:'https://project.example.test',serviceRoleKey:'server-only-test',fetchFn,nowSeconds:()=>1900000001
  });
  const verifyToken=createAtlasJwtVerifier({
   issuer,audience,getJwks:async()=>({keys:[jwk]}),
   resolveIdentity:directory.resolveIdentity,isRevoked:directory.isRevoked,nowSeconds:()=>1900000001
  });
  const invoke=(bearer:string,body:unknown=rpc)=>handleAtlasChatGptHttp({
   method:'POST',path:'/mcp',authorization:'Bearer '+bearer,body
  },{resource:audience,issuer,verifyToken,nowSeconds:1900000001});

  const alice=token(claims('alice','alice-jti',orgB)); // Signed malicious org claim cannot grant B.
  const bob=token(claims('bob','bob-jti',orgB));
  expect((await invoke(alice)).status).toBe(200);
  expect((await verifyToken(alice))?.organizationId).toBe(orgA);
  expect((await invoke(bob)).status).toBe(200);
  expect((await verifyToken(bob))?.organizationId).toBe(orgB);
  const crossTenant=token(claims('alice','bob-jti',orgB));
  expect((await invoke(crossTenant)).status).toBe(401);
  expect((await invoke(alice,{...rpc,params:{name:'atlas.apps.catalog',arguments:{organizationId:orgB}}})).status).toBe(403);

  records[0].session_revoked_at='2030-03-16T00:00:00Z';
  expect((await invoke(alice)).status).toBe(401);
  expect((await invoke(bob)).status).toBe(200);
  memberships[1].status='revoked';
  expect((await invoke(bob)).status).toBe(401);
 });
});
