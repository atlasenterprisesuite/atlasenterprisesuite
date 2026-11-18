import {
  YouTubeLifecycleError,
  completeYouTubeConnection,
  prepareYouTubeConnection,
  type YouTubeLifecycleDependencies,
} from '../_shared/youtube-connection-lifecycle.ts';
import {
  SupabaseYouTubeConnectionStore,
  type YouTubeConnectionStore,
} from '../_shared/youtube-connection-store.ts';
import { getServerSecret } from '../_shared/server-secret-store.ts';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };
const RETURN_URL = 'https://atlasenterprisesuite.com/studio/social';
const DEFAULT_ALLOWED_ORIGINS = [
  'https://atlasenterprisesuite.com',
  'https://www.atlasenterprisesuite.com',
] as const;

type Operation = 'oauth.prepare' | 'connection.status';

export type AtlasYouTubeDirectDependencies = {
  fetchImpl?: typeof fetch;
  env?: (name: string) => string | undefined;
  store?: YouTubeConnectionStore;
  lifecycle?: Partial<
    Pick<
      YouTubeLifecycleDependencies,
      'now' | 'exchangeCode' | 'fetchChannel' | 'credentialKey' | 'keyVersion'
    >
  >;
};

function env(name: string, deps: AtlasYouTubeDirectDependencies): string {
  const injected = deps.env?.(name);
  if (injected !== undefined) return injected.trim();
  return Deno.env.get(name)?.trim() ?? '';
}

function publishableKey(deps: AtlasYouTubeDirectDependencies): string {
  const modern = env('SUPABASE_PUBLISHABLE_KEYS', deps);
  if (modern) {
    try {
      const parsed = JSON.parse(modern) as Record<string, unknown>;
      if (typeof parsed.default === 'string' && parsed.default.trim()) {
        return parsed.default.trim();
      }
    } catch {
      // Fall back to legacy anon key.
    }
  }
  return env('SUPABASE_ANON_KEY', deps);
}

function cors(req: Request, deps: AtlasYouTubeDirectDependencies): HeadersInit | null {
  const origin = req.headers.get('Origin');
  if (!origin) return {};
  const configured = env('ATLAS_ALLOWED_ORIGINS', deps);
  const allowed = new Set(
    (configured ? configured.split(',') : [...DEFAULT_ALLOWED_ORIGINS])
      .map((value) => value.trim())
      .filter(Boolean),
  );
  if (!allowed.has(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

function json(
  req: Request,
  deps: AtlasYouTubeDirectDependencies,
  status: number,
  body: unknown,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...(cors(req, deps) ?? {}) },
  });
}

function redirectResult(ok: boolean, code?: string): Response {
  const url = new URL(RETURN_URL);
  url.searchParams.set('youtube', ok ? 'connected' : 'error');
  if (code) url.searchParams.set('code', code);
  return Response.redirect(url.toString(), 302);
}

function bearer(req: Request): string | null {
  const value = req.headers.get('Authorization') ?? '';
  return value.startsWith('Bearer ') ? value.slice(7).trim() || null : null;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isChannelId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{10,128}$/.test(value.trim());
}

async function authenticatedUser(
  token: string,
  deps: AtlasYouTubeDirectDependencies,
): Promise<string | null> {
  const supabaseUrl = env('SUPABASE_URL', deps).replace(/\/$/, '');
  const apiKey = publishableKey(deps);
  if (!supabaseUrl || !apiKey) return null;
  try {
    const response = await (deps.fetchImpl ?? fetch)(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: apiKey },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { id?: unknown };
    return typeof body.id === 'string' && body.id.trim() ? body.id : null;
  } catch {
    return null;
  }
}

async function hasPermission(
  token: string,
  organizationId: string,
  permission: string,
  deps: AtlasYouTubeDirectDependencies,
): Promise<boolean> {
  const supabaseUrl = env('SUPABASE_URL', deps).replace(/\/$/, '');
  const apiKey = publishableKey(deps);
  if (!supabaseUrl || !apiKey) return false;
  try {
    const response = await (deps.fetchImpl ?? fetch)(
      `${supabaseUrl}/rest/v1/rpc/has_identity_permission`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ o: organizationId, p: permission }),
      },
    );
    return response.ok && (await response.json()) === true;
  } catch {
    return false;
  }
}

async function secret(
  directEnv: string,
  vaultName: string,
  deps: AtlasYouTubeDirectDependencies,
): Promise<string> {
  const direct = env(directEnv, deps);
  if (direct) return direct;
  const supabaseUrl = env('SUPABASE_URL', deps);
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY', deps);
  if (!supabaseUrl || !serviceRoleKey) return '';
  try {
    return (await getServerSecret({
      supabaseUrl,
      serviceRoleKey,
      name: vaultName,
      fetchImpl: deps.fetchImpl,
    }))?.trim() ?? '';
  } catch {
    return '';
  }
}

async function resolvedLifecycle(
  deps: AtlasYouTubeDirectDependencies,
): Promise<YouTubeLifecycleDependencies | null> {
  const supabaseUrl = env('SUPABASE_URL', deps);
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY', deps);
  if (!supabaseUrl || !serviceRoleKey) return null;

  const [clientId, clientSecret, stateSecret, credentialKey] = await Promise.all([
    secret('GOOGLE_CLIENT_ID', 'google_oauth_client_id', deps),
    secret('GOOGLE_CLIENT_SECRET', 'google_oauth_client_secret', deps),
    secret('GOOGLE_OAUTH_STATE_SECRET', 'google_oauth_state_secret', deps),
    secret('ATLAS_INTEGRATION_CREDENTIAL_KEY', 'atlas_integration_credential_key', deps),
  ]);
  const effectiveCredentialKey = deps.lifecycle?.credentialKey ?? credentialKey;
  if (!clientId || !clientSecret || stateSecret.length < 32 || !effectiveCredentialKey) return null;

  const store = deps.store ?? new SupabaseYouTubeConnectionStore({
    supabaseUrl,
    serviceRoleKey,
    fetchImpl: deps.fetchImpl,
  });
  const redirectUri = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/atlas-youtube-direct`;

  return {
    store,
    clientId,
    clientSecret,
    redirectUri,
    stateSecret,
    credentialKey: effectiveCredentialKey,
    keyVersion: deps.lifecycle?.keyVersion ?? 'v1',
    ...(deps.lifecycle?.now ? { now: deps.lifecycle.now } : {}),
    ...(deps.lifecycle?.exchangeCode ? { exchangeCode: deps.lifecycle.exchangeCode } : {}),
    ...(deps.lifecycle?.fetchChannel ? { fetchChannel: deps.lifecycle.fetchChannel } : {}),
  };
}

function lifecycleError(error: unknown): Response {
  if (error instanceof YouTubeLifecycleError) {
    return redirectResult(false, error.code);
  }
  return redirectResult(false, 'youtube_oauth_failed');
}

export async function handleAtlasYouTubeDirect(
  req: Request,
  deps: AtlasYouTubeDirectDependencies = {},
): Promise<Response> {
  const requestCors = cors(req, deps);
  if (requestCors === null) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: JSON_HEADERS,
    });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: requestCors });
  }

  const url = new URL(req.url);
  if (req.method === 'GET' && url.searchParams.has('state')) {
    const state = url.searchParams.get('state') ?? '';
    const code = url.searchParams.get('code') ?? '';
    const oauthError = url.searchParams.get('error');
    if (oauthError) return redirectResult(false, 'provider_denied');
    const lifecycle = await resolvedLifecycle(deps);
    if (!lifecycle) return redirectResult(false, 'youtube_not_configured');
    try {
      await completeYouTubeConnection({ state, code, deps: lifecycle });
      return redirectResult(true);
    } catch (error) {
      return lifecycleError(error);
    }
  }

  if (req.method !== 'POST') {
    return json(req, deps, 405, { error: 'Method not allowed' });
  }

  const token = bearer(req);
  if (!token) return json(req, deps, 401, { error: 'Authentication required' });
  const userId = await authenticatedUser(token, deps);
  if (!userId) return json(req, deps, 401, { error: 'Invalid or expired ATLAS session' });

  let body: {
    operation?: unknown;
    organizationId?: unknown;
    channelId?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return json(req, deps, 400, { error: 'Invalid JSON body' });
  }

  if (!isUuid(body.organizationId)) {
    return json(req, deps, 400, { error: 'Valid organizationId is required' });
  }
  if (body.operation !== 'oauth.prepare' && body.operation !== 'connection.status') {
    return json(req, deps, 400, { error: 'Unsupported YouTube Direct operation' });
  }
  const operation = body.operation as Operation;
  if (!isChannelId(body.channelId)) {
    return json(req, deps, 400, { error: 'Valid YouTube channelId is required' });
  }

  const requiredPermission = operation === 'connection.status'
    ? 'integrations.read'
    : 'integrations.manage';
  const permitted =
    await hasPermission(token, body.organizationId, requiredPermission, deps) ||
    await hasPermission(token, body.organizationId, 'integrations.admin', deps) ||
    await hasPermission(token, body.organizationId, 'integrations.manage', deps);
  if (!permitted) return json(req, deps, 403, { error: 'Integration permission required' });

  const lifecycle = await resolvedLifecycle(deps);
  if (!lifecycle) {
    return json(req, deps, 503, { error: 'YouTube Direct OAuth is not configured' });
  }

  if (operation === 'oauth.prepare') {
    try {
      const prepared = await prepareYouTubeConnection({
        organizationId: body.organizationId,
        userId,
        channelId: body.channelId.trim(),
        deps: lifecycle,
      });
      return json(req, deps, 200, {
        provider: 'youtube',
        authorizationUrl: prepared.authorizationUrl,
        expiresAt: prepared.expiresAt,
      });
    } catch {
      return json(req, deps, 400, { error: 'Unable to prepare YouTube authorization' });
    }
  }

  const connection = await lifecycle.store.getConnection(
    body.organizationId,
    body.channelId.trim(),
  );
  return json(req, deps, 200, {
    provider: 'youtube',
    channelId: body.channelId.trim(),
    state: connection?.state ?? 'unconfigured',
    authorized: connection?.authorized ?? false,
    providerVerified: connection?.provider_verified ?? false,
    channelTitle: connection?.provider_account_label ?? null,
    grantedScopes: connection?.granted_scopes ?? [],
    lastVerifiedAt: connection?.last_verified_at ?? null,
  });
}

Deno.serve((req) => handleAtlasYouTubeDirect(req));
