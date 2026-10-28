import { atlasProtectedResourceMetadata } from './chatgptOAuthResource';
import { handleChatGptCatalogMcp, ATLAS_CHATGPT_SCOPE, type VerifyChatGptAccessToken } from './chatgptReadOnlyAdapter';
import type { JsonRpcRequest } from './protocol';

export interface AtlasChatGptHttpRequest { method: string; path: string; authorization?: string; body?: unknown; }
export interface AtlasChatGptHttpResponse { status: number; headers: Record<string,string>; body: unknown; }
export interface AtlasChatGptHttpOptions {
  resource: string; issuer: string; verifyToken: VerifyChatGptAccessToken; nowSeconds?: number;
}
/** Pure isolated HTTP adapter. Not mounted on the existing orchestrator. */
export async function handleAtlasChatGptHttp(req: AtlasChatGptHttpRequest, options: AtlasChatGptHttpOptions): Promise<AtlasChatGptHttpResponse> {
  const headers = { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', 'x-content-type-options':'nosniff' };
  let metadata: ReturnType<typeof atlasProtectedResourceMetadata>;
  try { metadata = atlasProtectedResourceMetadata(options.resource, options.issuer); }
  catch { return { status:503,headers,body:{error:'resource_not_configured'} }; }
  const metadataUrl = new URL('/.well-known/oauth-protected-resource', metadata.resource).href;
  if (req.path === '/.well-known/oauth-protected-resource' && req.method === 'GET')
    return {status:200,headers,body:metadata};
  if (req.path !== '/mcp' || req.method !== 'POST')
    return {status:404,headers,body:{error:'not_found'}};
  const challenge = 'Bearer resource_metadata="' + metadataUrl + '", scope="' + ATLAS_CHATGPT_SCOPE + '", error="invalid_token", error_description="Authentication required"';
  const unauthorized = (): AtlasChatGptHttpResponse => ({
    status:401, headers:{...headers,'www-authenticate':challenge}, body:{error:'unauthorized'},
  });
  const body=req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {status:400,headers,body:{error:'invalid_jsonrpc'}};
  const rpc=body as Record<string,unknown>;
  if (rpc.jsonrpc !== '2.0' || typeof rpc.method !== 'string' ||
      !(typeof rpc.id === 'number' || typeof rpc.id === 'string') ||
      (rpc.params !== undefined && (rpc.params === null || typeof rpc.params !== 'object' || Array.isArray(rpc.params))))
    return {status:400,headers,body:{error:'invalid_jsonrpc'}};
  const result=await handleChatGptCatalogMcp({
    request:rpc as unknown as JsonRpcRequest, authorization:req.authorization,verifyToken:options.verifyToken,
    expectedIssuer:metadata.authorization_servers[0],expectedAudience:metadata.resource,nowSeconds:options.nowSeconds,
  });
  if(result.status===401) return unauthorized();
  return {status:result.status,headers,body:result.body};
}
