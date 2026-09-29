const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "connect-src 'self' https://ggmanzcgtlrvqfoccgsh.supabase.co wss://ggmanzcgtlrvqfoccgsh.supabase.co https://unpkg.com https://tiles.openfreemap.org https://basemap.nationalmap.gov https://tiles.mapterhorn.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "style-src 'self' 'unsafe-inline' https://unpkg.com",
  "script-src 'self' https://unpkg.com",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ');

const LOCAL_CONTROL_URL = 'https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-local-control';
const LOCAL_BUS_PREFIX = '/_atlas/local-bus/';
const CHAT_CONTROL_URL = 'https://ggmanzcgtlrvqfoccgsh.supabase.co/rest/v1/rpc/atlas_chat_api';
const CHAT_PUBLISHABLE_KEY = 'sb_publishable_wicVjdsduxa5FAnRW9k0Lw_HxtBW72d';
const CHAT_BUS_PREFIX = '/_atlas/chat/';

interface AssetsBinding {
  fetch(request: Request): Promise<Response> | Response;
}

interface WorkerVersionMetadata {
  id: string;
  tag?: string;
  timestamp: string;
}

interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

interface DurableObjectNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): DurableObjectStub;
}

interface Env {
  ASSETS: AssetsBinding;
  CF_VERSION_METADATA?: WorkerVersionMetadata;
  LOCAL_REALTIME_BUS: DurableObjectNamespace;
  CHAT_REALTIME_BUS: DurableObjectNamespace;
  ATLAS_POLAR_CHECKOUT_URL?: string;
}

const DEFAULT_POLAR_CHECKOUT_URL =
  'https://polar.sh/checkout/polar_c_7Uw8jpDTb0EGlA6ru00ihSm9t4WXxEiueEzRJ2G9hnX';

function polarCheckoutUrl(env: Env) {
  const configured = String(env.ATLAS_POLAR_CHECKOUT_URL || DEFAULT_POLAR_CHECKOUT_URL).trim();
  try {
    const target = new URL(configured);
    if (target.protocol !== 'https:' || target.hostname !== 'polar.sh' || !target.pathname.startsWith('/checkout/')) return null;
    return target;
  } catch {
    return null;
  }
}

type TlsClientAuth = {
  certVerified?: string;
  certRevoked?: string;
  certFingerprintSHA256?: string;
  certSerial?: string;
};

type CloudflareRequest = Request & {
  cf?: { tlsClientAuth?: TlsClientAuth };
};

type DurableStorage = {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
};

type DurableState = {
  acceptWebSocket(socket: WebSocket): void;
  getWebSockets(): WebSocket[];
  storage: DurableStorage;
};

declare const WebSocketPair: {
  new(): { 0: WebSocket; 1: WebSocket };
};

type DeploymentManifest = {
  commit_sha?: string;
};

let deploymentCommitCache: { versionId: string; promise: Promise<string | null> } | null = null;

function canonicalCommitSha(value: unknown) {
  const sha = String(value || '').trim().toLowerCase();
  return /^[a-f0-9]{40}$/.test(sha) ? sha : null;
}

async function deploymentCommitSha(env: Env, request: Request) {
  const metadataTag = canonicalCommitSha(env.CF_VERSION_METADATA?.tag);
  if (metadataTag) return metadataTag;

  const versionId = String(env.CF_VERSION_METADATA?.id || '').trim();
  if (!versionId) return null;

  if (!deploymentCommitCache || deploymentCommitCache.versionId !== versionId) {
    deploymentCommitCache = {
      versionId,
      promise: (async () => {
        try {
          const manifestUrl = new URL('/deployment.json', request.url);
          const manifestResponse = await env.ASSETS.fetch(new Request(manifestUrl, {
            method: 'GET',
            headers: { 'cache-control': 'no-store' }
          }));
          if (!manifestResponse.ok) return null;
          const manifest = await manifestResponse.json().catch(() => null) as DeploymentManifest | null;
          return canonicalCommitSha(manifest?.commit_sha);
        } catch {
          return null;
        }
      })()
    };
  }

  const commitSha = await deploymentCommitCache.promise;
  if (!commitSha) deploymentCommitCache = null;
  return commitSha;
}

function withSecurityHeaders(
  response: Response,
  version?: WorkerVersionMetadata,
  commitSha?: string | null
): Response {
  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), geolocation=(self), payment=(), usb=(), xr-spatial-tracking=(self)');
  headers.set('X-Frame-Options', 'DENY');
  if (version?.id) headers.set('X-Atlas-Version-Id', version.id);
  const effectiveTag = canonicalCommitSha(version?.tag) || canonicalCommitSha(commitSha);
  if (effectiveTag) {
    headers.set('X-Atlas-Version-Tag', effectiveTag);
    headers.set('X-Atlas-Commit-Sha', effectiveTag);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}

const GEMINI_MCP_TOKEN_SHA256 = '931923afb99942b2dd10c2ae2a74fecfa773465a84775950950854d0ec7b4413';
const MCP_MODERN_PROTOCOL = '2026-07-28';
const MCP_LEGACY_PROTOCOL = '2025-11-25';
const MCP_SERVER_INFO = { name: 'ATLAS Gemini MCP', version: '1.0.0' };
const MCP_CONTROL_PLANE_READINESS =
  'https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-infra-evidence?api=readiness';

const MCP_TOOLS = [
  {
    name: 'atlas.production.status',
    description: 'Read the immutable ATLAS production release identity currently served by Cloudflare. Read-only.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: 'atlas.production.routes',
    description: 'Verify the current ATLAS production SPA shell for a fixed allowlist of critical public routes. Read-only.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: 'atlas.control_plane.readiness',
    description: 'Read the public ATLAS Manager control-plane readiness contract. Read-only.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }
] as const;

function mcpRpcResult(id: unknown, result: unknown) {
  return json({ jsonrpc: '2.0', id, result });
}

function mcpRpcError(id: unknown, code: number, message: string, data?: unknown, status = 200) {
  return new Response(JSON.stringify({
    jsonrpc: '2.0',
    id: id ?? null,
    error: { code, message, ...(data === undefined ? {} : { data }) }
  }), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function geminiMcpAuthorized(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.toLowerCase().startsWith('bearer ')) return false;
  const token = authorization.slice(7).trim();
  if (!token || token.length > 256) return false;
  return (await sha256Hex(token)) === GEMINI_MCP_TOKEN_SHA256;
}

function mcpServerMeta() {
  return { 'io.modelcontextprotocol/serverInfo': MCP_SERVER_INFO };
}

async function mcpProductionStatus(env: Env, request: Request) {
  const commitSha = await deploymentCommitSha(env, request);
  return {
    service: 'atlas-enterprise-suite-web',
    environment: 'production',
    release: {
      version_id: env.CF_VERSION_METADATA?.id || null,
      commit_sha: canonicalCommitSha(env.CF_VERSION_METADATA?.tag) || canonicalCommitSha(commitSha)
    },
    verified_at: new Date().toISOString()
  };
}

async function mcpProductionRoutes(env: Env, request: Request) {
  const paths = ['/', '/identity', '/finance', '/health', '/work', '/execution/manager/readiness'];
  const results = [];
  for (const path of paths) {
    const target = new URL(path, request.url);
    const assetResponse = await env.ASSETS.fetch(new Request(target, {
      method: 'GET',
      headers: { 'cache-control': 'no-store' }
    }));
    results.push({
      path,
      reachable: assetResponse.ok,
      status: assetResponse.status,
      content_type: assetResponse.headers.get('content-type') || null
    });
  }
  return {
    service: 'atlas-enterprise-suite-web',
    routes: results,
    all_reachable: results.every(item => item.reachable),
    verified_at: new Date().toISOString()
  };
}

async function mcpControlPlaneReadiness() {
  const response = await fetch(MCP_CONTROL_PLANE_READINESS, {
    method: 'GET',
    headers: { accept: 'application/json', 'cache-control': 'no-store' }
  });
  const payload = await response.json().catch(() => null);
  return {
    reachable: response.ok,
    status: response.status,
    payload: response.ok ? payload : null,
    verified_at: new Date().toISOString()
  };
}

async function executeMcpTool(name: string, env: Env, request: Request) {
  if (name === 'atlas.production.status') return mcpProductionStatus(env, request);
  if (name === 'atlas.production.routes') return mcpProductionRoutes(env, request);
  if (name === 'atlas.control_plane.readiness') return mcpControlPlaneReadiness();
  throw new Error('tool_not_found');
}

function mcpToolResult(data: unknown, modern: boolean) {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
    structuredContent: data,
    isError: false,
    ...(modern ? { _meta: mcpServerMeta() } : {})
  };
}

async function handleGeminiMcp(request: Request, env: Env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers':
          'authorization, content-type, accept, mcp-protocol-version, mcp-method, mcp-name',
        'access-control-max-age': '86400'
      }
    });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json; charset=utf-8', allow: 'POST, OPTIONS' }
    });
  }
  if (!(await geminiMcpAuthorized(request))) {
    return new Response(JSON.stringify({ ok: false, error: 'authentication_required' }), {
      status: 401,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'www-authenticate': 'Bearer realm="ATLAS Gemini MCP"'
      }
    });
  }

  const message = await request.json().catch(() => null) as any;
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return mcpRpcError(message?.id ?? null, -32600, 'Invalid Request', undefined, 400);
  }

  const method = message.method;
  const protocolHeader = request.headers.get('mcp-protocol-version');
  const modern = protocolHeader === MCP_MODERN_PROTOCOL;

  if (modern) {
    const routedMethod = request.headers.get('mcp-method');
    const routedName = request.headers.get('mcp-name');
    if (!routedMethod || routedMethod !== method) {
      return mcpRpcError(message.id, -32020, 'HeaderMismatch', { field: 'Mcp-Method' }, 400);
    }
    if (method === 'tools/call' && (!routedName || routedName !== String(message?.params?.name || ''))) {
      return mcpRpcError(message.id, -32020, 'HeaderMismatch', { field: 'Mcp-Name' }, 400);
    }
  }

  if (method === 'server/discover') {
    return mcpRpcResult(message.id, {
      supportedVersions: [MCP_MODERN_PROTOCOL, MCP_LEGACY_PROTOCOL],
      capabilities: { tools: {} },
      instructions:
        'ATLAS Gemini MCP exposes least-privilege, read-only production verification tools. It does not expose secrets, credentials, private tenant records, or write actions.',
      _meta: mcpServerMeta()
    });
  }

  if (method === 'initialize') {
    return mcpRpcResult(message.id, {
      protocolVersion: MCP_LEGACY_PROTOCOL,
      capabilities: { tools: {} },
      serverInfo: MCP_SERVER_INFO,
      instructions: 'ATLAS Gemini MCP read-only production gateway.'
    });
  }

  if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
    return new Response(null, { status: 202 });
  }

  if (method === 'ping') return mcpRpcResult(message.id, {});

  if (method === 'tools/list') {
    return mcpRpcResult(message.id, {
      tools: MCP_TOOLS,
      ...(modern ? { ttlMs: 30000, cacheScope: 'private', _meta: mcpServerMeta() } : {})
    });
  }

  if (method === 'tools/call') {
    const name = String(message?.params?.name || '');
    try {
      const data = await executeMcpTool(name, env, request);
      return mcpRpcResult(message.id, mcpToolResult(data, modern));
    } catch (error) {
      const errorCode = clean((error as Error)?.message, 120) || 'tool_failed';
      if (errorCode === 'tool_not_found') return mcpRpcError(message.id, -32601, 'Method not found');
      return mcpRpcError(message.id, -32000, 'ATLAS tool failed', { code: errorCode });
    }
  }

  return mcpRpcError(message.id, -32601, 'Method not found');
}

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

async function controlPost(request: Request, body: Record<string, unknown>, agentToken?: string) {
  const headers = new Headers({ 'content-type': 'application/json' });
  const authorization = request.headers.get('authorization');
  if (authorization) headers.set('authorization', authorization);
  if (agentToken) headers.set('x-atlas-agent-token', agentToken);
  const response = await fetch(LOCAL_CONTROL_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => null) as any;
  if (!response.ok || payload?.ok !== true) {
    return { ok: false as const, status: response.status, error: clean(payload?.error, 120) || 'local_control_authorization_failed' };
  }
  return { ok: true as const, payload };
}


function sameOriginRequest(request: Request) {
  const origin = clean(request.headers.get('origin'), 300);
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function chatControlPost(request: Request, api: string, body: Record<string, unknown>) {
  const authorization = request.headers.get('authorization');
  if (!authorization) {
    return { ok: false as const, status: 401, error: 'authentication_required', payload: null as any };
  }
  const orgId = clean(request.headers.get('x-atlas-org-id'), 80);
  if (!orgId) {
    return { ok: false as const, status: 422, error: 'organization_required', payload: null as any };
  }
  const headers = new Headers({
    apikey: CHAT_PUBLISHABLE_KEY,
    'content-type': 'application/json',
    authorization
  });
  const response = await fetch(CHAT_CONTROL_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      p_api: api,
      p_org_id: orgId,
      p_payload: body
    })
  });
  const payload = await response.json().catch(() => null) as any;
  if (!response.ok || payload?.ok !== true) {
    return {
      ok: false as const,
      status: response.status,
      error: clean(payload?.message || payload?.error, 120) || 'chat_authorization_failed',
      payload
    };
  }
  return { ok: true as const, status: response.status, payload };
}

function chatRealtimeStub(env: Env, orgId: string, conversationId: string) {
  const id = env.CHAT_REALTIME_BUS.idFromName(`${orgId}:${conversationId}`);
  return env.CHAT_REALTIME_BUS.get(id);
}

async function createChatTicket(request: Request, env: Env) {
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  if (!sameOriginRequest(request)) return json({ ok: false, error: 'origin_denied' }, 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return json({ ok: false, error: 'invalid_json' }, 400);
  const conversationId = clean(body.conversation_id, 80);
  if (!conversationId) return json({ ok: false, error: 'chat_conversation_id_required' }, 422);

  const authorization = await chatControlPost(request, 'authorize-realtime', {
    conversation_id: conversationId
  });
  if (!authorization.ok) return json({ ok: false, error: authorization.error }, authorization.status);

  const realtime = authorization.payload?.realtime || {};
  const orgId = clean(realtime.org_id, 80);
  const userId = clean(realtime.user_id, 80);
  const authorizedConversationId = clean(realtime.conversation_id, 80);
  if (!orgId || !userId || authorizedConversationId !== conversationId) {
    return json({ ok: false, error: 'chat_realtime_authorization_mismatch' }, 403);
  }

  const stub = chatRealtimeStub(env, orgId, conversationId);
  const response = await stub.fetch(new Request('https://atlas.chat/ticket', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ org_id: orgId, user_id: userId, conversation_id: conversationId })
  }));
  const ticket = await response.json().catch(() => null) as any;
  if (!response.ok || ticket?.ok !== true) return json({ ok: false, error: 'chat_ticket_failed' }, 502);
  return json({
    ok: true,
    org_id: orgId,
    conversation_id: conversationId,
    ticket: clean(ticket.ticket, 80),
    expires_in: Number(ticket.expires_in || 30)
  });
}

async function connectChat(request: Request, env: Env) {
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
    return json({ ok: false, error: 'websocket_upgrade_required' }, 426);
  }
  if (!sameOriginRequest(request)) return json({ ok: false, error: 'origin_denied' }, 403);

  const url = new URL(request.url);
  const orgId = clean(url.searchParams.get('org_id'), 80);
  const conversationId = clean(url.searchParams.get('conversation_id'), 80);
  const ticket = clean(url.searchParams.get('ticket'), 80);
  if (!orgId || !conversationId || !ticket) {
    return json({ ok: false, error: 'chat_realtime_parameters_required' }, 422);
  }

  const headers = new Headers(request.headers);
  headers.delete('authorization');
  headers.delete('cookie');
  const internal = new URL('https://atlas.chat/connect');
  internal.searchParams.set('ticket', ticket);
  return chatRealtimeStub(env, orgId, conversationId).fetch(new Request(internal, {
    method: 'GET',
    headers
  }));
}

async function publishChat(request: Request, env: Env) {
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  if (!sameOriginRequest(request)) return json({ ok: false, error: 'origin_denied' }, 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return json({ ok: false, error: 'invalid_json' }, 400);
  const conversationId = clean(body.conversation_id, 80);
  const messageId = clean(body.message_id, 80);
  if (!conversationId || !messageId) return json({ ok: false, error: 'chat_publish_target_required' }, 422);

  const authorization = await chatControlPost(request, 'publish-authorize', {
    conversation_id: conversationId,
    message_id: messageId
  });
  if (!authorization.ok) return json({ ok: false, error: authorization.error }, authorization.status);

  const publish = authorization.payload?.publish || {};
  const orgId = clean(publish.org_id, 80);
  const authorizedConversationId = clean(publish.conversation_id, 80);
  const authorizedMessageId = clean(publish.message_id, 80);
  const sequence = Number(publish.sequence || 0);
  if (!orgId || authorizedConversationId !== conversationId || authorizedMessageId !== messageId || sequence < 1) {
    return json({ ok: false, error: 'chat_publish_authorization_mismatch' }, 403);
  }

  const response = await chatRealtimeStub(env, orgId, conversationId).fetch(new Request('https://atlas.chat/publish', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      event: 'chat.message',
      conversation_id: conversationId,
      message_id: messageId,
      sequence
    })
  }));
  const result = await response.json().catch(() => ({ delivered: 0 })) as { delivered?: number };
  return json({ ok: true, delivered: Number(result.delivered || 0), sequence }, 202);
}

function realtimeStub(env: Env, orgId: string, agentId: string) {
  const id = env.LOCAL_REALTIME_BUS.idFromName(`${orgId}:${agentId}`);
  return env.LOCAL_REALTIME_BUS.get(id);
}

async function connectLocalBus(request: CloudflareRequest, env: Env) {
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
    return json({ ok: false, error: 'websocket_upgrade_required' }, 426);
  }

  const tls = request.cf?.tlsClientAuth;
  const fingerprint = clean(tls?.certFingerprintSHA256, 64).toLowerCase();
  const serial = clean(tls?.certSerial, 160);
  if (!tls || tls.certVerified !== 'SUCCESS' || tls.certRevoked === '1' || !/^[a-f0-9]{64}$/.test(fingerprint) || !serial) {
    return json({ ok: false, error: 'mtls_required' }, 401);
  }

  const agentToken = clean(request.headers.get('x-atlas-agent-token'), 500);
  if (!agentToken) return json({ ok: false, error: 'agent_authentication_required' }, 401);

  const authorization = await controlPost(request, {
    operation: 'agent.bus.verify',
    mtls_cert_verified: true,
    mtls_cert_fingerprint_sha256: fingerprint,
    mtls_cert_serial: serial
  }, agentToken);

  if (!authorization.ok) {
    return json({ ok: false, error: authorization.error }, authorization.status === 401 ? 401 : 403);
  }

  const orgId = clean(authorization.payload?.bus?.org_id, 80);
  const agentId = clean(authorization.payload?.bus?.agent_id, 80);
  if (!orgId || !agentId) return json({ ok: false, error: 'invalid_bus_authorization' }, 502);

  const headers = new Headers(request.headers);
  headers.delete('authorization');
  headers.delete('x-atlas-agent-token');
  headers.set('x-atlas-bus-agent-id', agentId);
  headers.set('x-atlas-bus-org-id', orgId);
  headers.set('x-atlas-mtls-fingerprint', fingerprint);
  const internal = new Request('https://atlas.local/connect', {
    method: 'GET',
    headers
  });
  return realtimeStub(env, orgId, agentId).fetch(internal);
}

async function publishLocalBus(request: Request, env: Env) {
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  if (!request.headers.get('authorization')) return json({ ok: false, error: 'authentication_required' }, 401);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return json({ ok: false, error: 'invalid_json' }, 400);
  const organizationId = clean(body.organization_id, 80);
  const agentId = clean(body.agent_id, 80);
  const commandId = clean(body.command_id, 80);
  if (!organizationId || !agentId || !commandId) return json({ ok: false, error: 'bus_target_required' }, 422);

  const authorization = await controlPost(request, {
    operation: 'bus.publish.authorize',
    organization_id: organizationId,
    agent_id: agentId,
    command_id: commandId
  });
  if (!authorization.ok) return json({ ok: false, error: authorization.error }, authorization.status);

  const bus = authorization.payload?.bus || {};
  if (clean(bus.org_id, 80) !== organizationId || clean(bus.agent_id, 80) !== agentId || clean(bus.command_id, 80) !== commandId) {
    return json({ ok: false, error: 'bus_authorization_mismatch' }, 403);
  }

  const stub = realtimeStub(env, organizationId, agentId);
  const response = await stub.fetch(new Request('https://atlas.local/publish', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event: 'command.ready', command_id: commandId })
  }));
  const result = await response.json().catch(() => ({ delivered: 0 })) as { delivered?: number };
  return json({ ok: true, delivered: Number(result.delivered || 0) }, 202);
}


type ChatTicket = {
  orgId: string;
  userId: string;
  conversationId: string;
  expiresAt: number;
};

export class AtlasChatRealtimeBus {
  constructor(private readonly state: DurableState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/ticket' && request.method === 'POST') {
      const body = await request.json().catch(() => null) as any;
      const orgId = clean(body?.org_id, 80);
      const userId = clean(body?.user_id, 80);
      const conversationId = clean(body?.conversation_id, 80);
      if (!orgId || !userId || !conversationId) {
        return json({ ok: false, error: 'chat_ticket_identity_required' }, 422);
      }
      const ticket = crypto.randomUUID();
      const expiresIn = 30;
      const record: ChatTicket = {
        orgId,
        userId,
        conversationId,
        expiresAt: Date.now() + expiresIn * 1000
      };
      await this.state.storage.put(`ticket:${ticket}`, record);
      return json({ ok: true, ticket, expires_in: expiresIn }, 201);
    }

    if (url.pathname === '/connect') {
      if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
        return json({ ok: false, error: 'websocket_upgrade_required' }, 426);
      }
      const ticket = clean(url.searchParams.get('ticket'), 80);
      if (!ticket) return json({ ok: false, error: 'chat_ticket_required' }, 401);
      const key = `ticket:${ticket}`;
      const record = await this.state.storage.get<ChatTicket>(key);
      await this.state.storage.delete(key);
      if (!record || record.expiresAt <= Date.now()) {
        return json({ ok: false, error: 'chat_ticket_invalid_or_expired' }, 401);
      }

      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      server.serializeAttachment({
        orgId: record.orgId,
        userId: record.userId,
        conversationId: record.conversationId,
        connectedAt: new Date().toISOString()
      });
      this.state.acceptWebSocket(server);
      server.send(JSON.stringify({
        event: 'chat.ready',
        conversation_id: record.conversationId
      }));
      return new Response(null, { status: 101, webSocket: client } as any);
    }

    if (url.pathname === '/publish' && request.method === 'POST') {
      const body = await request.json().catch(() => null) as any;
      if (
        clean(body?.event, 80) !== 'chat.message' ||
        !clean(body?.conversation_id, 80) ||
        !clean(body?.message_id, 80) ||
        Number(body?.sequence || 0) < 1
      ) {
        return json({ ok: false, error: 'invalid_chat_event' }, 422);
      }

      const event = JSON.stringify({
        event: 'chat.message',
        conversation_id: clean(body.conversation_id, 80),
        message_id: clean(body.message_id, 80),
        sequence: Number(body.sequence)
      });
      let delivered = 0;
      for (const socket of this.state.getWebSockets()) {
        try {
          socket.send(event);
          delivered += 1;
        } catch {
          // Persistent storage is authoritative; clients recover through polling.
        }
      }
      return json({ ok: true, delivered });
    }

    return json({ ok: false, error: 'not_found' }, 404);
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    if (typeof message === 'string' && message === 'ping') {
      socket.send('pong');
      return;
    }
    try { socket.close(1008, 'client_messages_use_http_api'); } catch {}
  }

  async webSocketClose(_socket: WebSocket, _code: number, _reason: string, _wasClean: boolean) {
    // Hibernating WebSocket lifecycle is managed by Cloudflare.
  }

  async webSocketError(socket: WebSocket) {
    try { socket.close(1011, 'websocket_error'); } catch {}
  }
}

export class AtlasLocalRealtimeBus {
  constructor(private readonly state: DurableState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/connect') {
      if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
        return json({ ok: false, error: 'websocket_upgrade_required' }, 426);
      }
      const agentId = clean(request.headers.get('x-atlas-bus-agent-id'), 80);
      const orgId = clean(request.headers.get('x-atlas-bus-org-id'), 80);
      const fingerprint = clean(request.headers.get('x-atlas-mtls-fingerprint'), 64);
      if (!agentId || !orgId || !fingerprint) return json({ ok: false, error: 'internal_bus_identity_required' }, 403);

      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      server.serializeAttachment({ agentId, orgId, fingerprint, connectedAt: new Date().toISOString() });
      this.state.acceptWebSocket(server);
      server.send(JSON.stringify({ event: 'bus.ready', agent_id: agentId }));
      return new Response(null, { status: 101, webSocket: client } as any);
    }

    if (url.pathname === '/publish' && request.method === 'POST') {
      const body = await request.json().catch(() => null) as any;
      if (clean(body?.event, 80) !== 'command.ready' || !clean(body?.command_id, 80)) {
        return json({ ok: false, error: 'invalid_bus_event' }, 422);
      }
      let delivered = 0;
      const message = JSON.stringify({ event: 'command.ready', command_id: clean(body.command_id, 80) });
      for (const socket of this.state.getWebSockets()) {
        try {
          socket.send(message);
          delivered += 1;
        } catch {
          // A stale socket is ignored. Polling remains the safety fallback.
        }
      }
      return json({ ok: true, delivered });
    }

    return json({ ok: false, error: 'not_found' }, 404);
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    if (typeof message === 'string' && message === 'ping') socket.send('pong');
  }

  async webSocketClose(_socket: WebSocket, _code: number, _reason: string, _wasClean: boolean) {
    // Cloudflare completes the close handshake on current compatibility dates.
  }

  async webSocketError(socket: WebSocket) {
    try { socket.close(1011, 'websocket_error'); } catch {}
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/mcp') {
      const commitSha = await deploymentCommitSha(env, request);
      return withSecurityHeaders(
        await handleGeminiMcp(request, env),
        env.CF_VERSION_METADATA,
        commitSha
      );
    }
    if (url.pathname === '/status' && request.method === 'GET') {
      const commitSha = await deploymentCommitSha(env, request);
      const effectiveCommitSha =
        canonicalCommitSha(env.CF_VERSION_METADATA?.tag) || canonicalCommitSha(commitSha);
      return withSecurityHeaders(
        json({
          ok: true,
          status: 'ok',
          service: 'atlas-enterprise-suite-web',
          environment: 'production',
          release: {
            version_id: env.CF_VERSION_METADATA?.id || null,
            commit_sha: effectiveCommitSha
          }
        }),
        env.CF_VERSION_METADATA,
        commitSha
      );
    }
    if (url.pathname === '/checkout/polar') {
      const commitSha = await deploymentCommitSha(env, request);
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return withSecurityHeaders(
          new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET, HEAD' } }),
          env.CF_VERSION_METADATA,
          commitSha
        );
      }
      const target = polarCheckoutUrl(env);
      if (!target) {
        return withSecurityHeaders(
          json({ ok: false, error: 'polar_checkout_not_configured' }, 503),
          env.CF_VERSION_METADATA,
          commitSha
        );
      }
      return withSecurityHeaders(
        new Response(null, { status: 303, headers: { location: target.toString(), 'cache-control': 'no-store' } }),
        env.CF_VERSION_METADATA,
        commitSha
      );
    }
    if (url.pathname === `${LOCAL_BUS_PREFIX}connect`) return connectLocalBus(request as CloudflareRequest, env);
    if (url.pathname === `${LOCAL_BUS_PREFIX}publish`) return publishLocalBus(request, env);
    if (url.pathname === `${CHAT_BUS_PREFIX}ticket`) return createChatTicket(request, env);
    if (url.pathname === `${CHAT_BUS_PREFIX}connect`) return connectChat(request, env);
    if (url.pathname === `${CHAT_BUS_PREFIX}publish`) return publishChat(request, env);
    const assetResponse = await env.ASSETS.fetch(request);
    const commitSha = await deploymentCommitSha(env, request);
    return withSecurityHeaders(assetResponse, env.CF_VERSION_METADATA, commitSha);
  }
};
