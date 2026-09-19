const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "connect-src 'self' https://ggmanzcgtlrvqfoccgsh.supabase.co wss://ggmanzcgtlrvqfoccgsh.supabase.co",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ');

const LOCAL_CONTROL_URL = 'https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-local-control';
const LOCAL_BUS_PREFIX = '/_atlas/local-bus/';

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

type DurableState = {
  acceptWebSocket(socket: WebSocket): void;
  getWebSockets(): WebSocket[];
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
  headers.set('Permissions-Policy', 'camera=(), geolocation=(), payment=(), usb=(), xr-spatial-tracking=(self)');
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
    if (url.pathname === `${LOCAL_BUS_PREFIX}connect`) return connectLocalBus(request as CloudflareRequest, env);
    if (url.pathname === `${LOCAL_BUS_PREFIX}publish`) return publishLocalBus(request, env);
    const assetResponse = await env.ASSETS.fetch(request);
    const commitSha = await deploymentCommitSha(env, request);
    return withSecurityHeaders(assetResponse, env.CF_VERSION_METADATA, commitSha);
  }
};
