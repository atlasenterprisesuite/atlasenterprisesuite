import { listAtlasChatGptApps } from './chatgptAppCatalog';
import type { JsonRpcRequest } from './protocol';

export const ATLAS_CHATGPT_SCOPE = 'atlas:apps:read';
export interface VerifiedChatGptPrincipal {
  subject: string;
  tenantId: string;
  organizationId: string;
  scopes: readonly string[];
  issuer: string;
  audience: string;
  expiresAt: number;
  revoked: boolean;
}
export type VerifyChatGptAccessToken = (token: string) => Promise<VerifiedChatGptPrincipal | null>;
export type ChatGptAdapterResult = { status: number; body: Record<string, unknown> };
const fail = (id: JsonRpcRequest['id'], code: number, message: string) => ({
  jsonrpc: '2.0', id: id ?? null, error: { code, message },
});
const ok = (id: JsonRpcRequest['id'], result: unknown) => ({ jsonrpc: '2.0', id: id ?? null, result });
const catalogTool = {
  name: 'atlas.apps.catalog',
  description: 'Read the ATLAS application catalog. Entries are not installed or connected.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
};
/**
 * Isolated MCP resource handler. The caller MUST verify OAuth signature, issuer,
 * audience, expiration and revocation in verifyToken; no bearer token is trusted here.
 * Do not attach this to a public route until a real verifier is wired and tested.
 */
export async function handleChatGptCatalogMcp(input: {
  request: JsonRpcRequest;
  authorization?: string;
  verifyToken: VerifyChatGptAccessToken;
  expectedIssuer: string;
  expectedAudience: string;
  nowSeconds?: number;
}): Promise<ChatGptAdapterResult> {
  const { request, authorization, verifyToken, expectedIssuer, expectedAudience } = input;
  const unauthorized = (): ChatGptAdapterResult => ({ status: 401, body: fail(request.id, -32001, 'Unauthorized') });
  if (!request || request.jsonrpc !== '2.0' || !['initialize','ping','tools/list','tools/call'].includes(request.method)) {
    return { status: 400, body: fail(request?.id, -32601, 'Unsupported method') };
  }
  if (typeof authorization !== 'string' || !/^Bearer [A-Za-z0-9._~+\/-]+={0,2}$/.test(authorization)) return unauthorized();
  const token = authorization.slice(7);
  let principal: VerifiedChatGptPrincipal | null;
  try { principal = await verifyToken(token); } catch { return unauthorized(); }
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!principal || principal.revoked || principal.issuer !== expectedIssuer ||
      principal.audience !== expectedAudience || !Number.isFinite(principal.expiresAt) ||
      principal.expiresAt <= now || !principal.scopes.includes(ATLAS_CHATGPT_SCOPE) ||
      !principal.subject.trim() || !principal.tenantId.trim() || !principal.organizationId.trim()) return unauthorized();
  if (request.method === 'initialize') return { status: 200, body: ok(request.id, {
    protocolVersion: '2025-11-25', capabilities: { tools: {} }, serverInfo: { name: 'atlas-chatgpt-catalog', version: '0.1.0' },
  }) };
  if (request.method === 'ping') return { status: 200, body: ok(request.id, {}) };
  if (request.method === 'tools/list') return { status: 200, body: ok(request.id, { tools: [catalogTool] }) };
  const params = request.params;
  if (!params || typeof params !== 'object' || Array.isArray(params)) return { status: 400, body: fail(request.id, -32602, 'Invalid parameters') };
  const p = params as Record<string, unknown>;
  if (p.name !== catalogTool.name || !p.arguments || typeof p.arguments !== 'object' ||
      Array.isArray(p.arguments) || Object.keys(p.arguments).length !== 0)
    return { status: 403, body: fail(request.id, -32003, 'Tool not allowed') };
  const value = { apps: listAtlasChatGptApps() };
  return { status: 200, body: ok(request.id, { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value }) };
}
