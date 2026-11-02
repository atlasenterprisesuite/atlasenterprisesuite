import { describe, it, expect } from 'vitest';
import { handleAtlasChatGptHttp } from '../../packages/atlas-mcp/src/chatgptHttpResource';

const principal = {subject:'user-a',tenantId:'org-a',organizationId:'org-a',
  scopes:['atlas:apps:read'],issuer:'https://issuer.example.test',
  audience:'https://atlas.example.test',expiresAt:200,revoked:false};
const request = {method:'POST',path:'/mcp',authorization:'Bearer test-token',
  body:{jsonrpc:'2.0',method:'notifications/initialized'}};
const options = {resource:principal.audience,issuer:principal.issuer,nowSeconds:100,
  verifyToken:async () => principal};
describe('MCP initialized notification authentication', () => {
  it('accepts an authenticated notification with no JSON-RPC response', async () => {
    const result = await handleAtlasChatGptHttp(request,options);
    expect(result.status).toBe(202); expect(result.body).toBe(null);
  });
  it('rejects notifications that carry an id', async () => {
    expect((await handleAtlasChatGptHttp({...request,body:{...request.body,id:1}},options)).status).toBe(400);
  });
  it('rejects absent or malformed bearer authorization', async () => {
    for (const authorization of [undefined,'','Basic test','Bearer '])
      expect((await handleAtlasChatGptHttp({...request,authorization},options)).status).toBe(401);
  });
  it('denies invalid, expired, revoked, unscoped and misbound principals', async () => {
    for (const value of [null,{...principal,revoked:true},{...principal,expiresAt:100},
      {...principal,scopes:[]},{...principal,issuer:'https://evil.example.test'},
      {...principal,audience:'other'},{...principal,subject:''},{...principal,tenantId:''},
      {...principal,organizationId:''}])
      expect((await handleAtlasChatGptHttp(request,{...options,verifyToken:async () => value})).status).toBe(401);
  });
  it('fails closed on verifier outage', async () => {
    const result = await handleAtlasChatGptHttp(request,{...options,verifyToken:async () => {throw new Error('offline');}});
    expect(result.status).toBe(401);
  });
  it('rechecks authorization after membership or session revocation', async () => {
    let revoked=false;
    const settings={...options,verifyToken:async () => ({...principal,revoked})};
    expect((await handleAtlasChatGptHttp(request,settings)).status).toBe(202);
    revoked=true;
    expect((await handleAtlasChatGptHttp(request,settings)).status).toBe(401);
  });
});
