import {
  HubSpotLifecycleError,
  completeHubSpotConnection,
  disconnectHubSpotConnection,
  getHubSpotConnectionStatus,
  prepareHubSpotConnection,
  type HubSpotLifecycleDependencies
} from '../_shared/hubspot-connection-lifecycle.ts';
import {
  SupabaseHubSpotConnectionStore,
  type HubSpotConnectionStore
} from '../_shared/hubspot-connection-store.ts';
import {
  executeHubSpotCrmOperation,
  type HubSpotCrmReadAdapter
} from '../_shared/hubspot-crm-operations.ts';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://www.atlasenterprisesuite.com',
  'https://atlasenterprisesuite.com'
] as const;

const OPERATIONS = [
  'oauth.prepare',
  'oauth.callback',
  'connection.status',
  'connection.disconnect',
  'crm.list',
  'crm.search',
  'crm.get',
  'crm.associations',
  'crm.refresh'
] as const;

export type AtlasCrmHubSpotOperation = (typeof OPERATIONS)[number];

export type AtlasCrmHubSpotDependencies = {
  fetchImpl?: typeof fetch;
  env?: (name: string) => string | undefined;
  connectionStore?: HubSpotConnectionStore;
  crmAdapter?: HubSpotCrmReadAdapter;
  lifecycle?: Partial<
    Pick<
      HubSpotLifecycleDependencies,
      'oauth' | 'adapter' | 'now' | 'randomBytes' | 'credentialKey' | 'keyVersion'
    >
  >;
};

type AuthContext = { token: string; userId: string; organizationId: string };

const PERMISSIONS: Record<
  Exclude<AtlasCrmHubSpotOperation, 'oauth.callback'>,
  readonly string[]
> = {
  'oauth.prepare': ['integrations.admin', 'integrations.manage'],
  'connection.status': ['integrations.read', 'integrations.admin', 'integrations.manage'],
  'connection.disconnect': ['integrations.admin', 'integrations.manage'],
  'crm.list': ['crm.read', 'crm.admin'],
  'crm.search': ['crm.read', 'crm.admin'],
  'crm.get': ['crm.read', 'crm.admin'],
  'crm.associations': ['crm.read', 'crm.admin'],
  'crm.refresh': ['crm.sync', 'crm.admin']
};

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };
const CRM_INTEGRATION_RETURN_URL = 'https://www.atlasenterprisesuite.com/crm/integrations/hubspot';

function env(name: string, deps: AtlasCrmHubSpotDependencies): string {
  const injected = deps.env?.(name);
  if (injected !== undefined) return injected.trim();
  const deno = (globalThis as unknown as {
    Deno?: { env?: { get(name: string): string | undefined } };
  }).Deno;
  return deno?.env?.get(name)?.trim() ?? '';
}

function publishableKey(deps: AtlasCrmHubSpotDependencies): string {
  const modern = env('SUPABASE_PUBLISHABLE_KEYS', deps);
  if (modern) {
    try {
      const parsed = JSON.parse(modern) as Record<string, unknown>;
      if (typeof parsed.default === 'string' && parsed.default.trim()) return parsed.default.trim();
    } catch {
      // Fall back to the legacy anon key.
    }
  }
  return env('SUPABASE_ANON_KEY', deps);
}

function cors(req: Request, deps: AtlasCrmHubSpotDependencies): HeadersInit | null {
  const origin = req.headers.get('Origin');
  if (!origin) return {};
  const configured = env('ATLAS_ALLOWED_ORIGINS', deps);
  const allowed = new Set(
    (configured ? configured.split(',') : [...DEFAULT_ALLOWED_ORIGINS])
      .map((value) => value.trim())
      .filter(Boolean)
  );
  if (!allowed.has(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin'
  };
}

function json(
  req: Request,
  deps: AtlasCrmHubSpotDependencies,
  status: number,
  body: unknown
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...(cors(req, deps) ?? {}) }
  });
}

function bearer(req: Request): string | null {
  const value = req.headers.get('Authorization') ?? '';
  if (!value.startsWith('Bearer ')) return null;
  return value.slice(7).trim() || null;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isOperation(value: unknown): value is AtlasCrmHubSpotOperation {
  return typeof value === 'string' && (OPERATIONS as readonly string[]).includes(value);
}

async function authenticatedUser(
  token: string,
  deps: AtlasCrmHubSpotDependencies
): Promise<string | null> {
  const supabaseUrl = env('SUPABASE_URL', deps);
  const apiKey = publishableKey(deps);
  if (!supabaseUrl || !apiKey) return null;
  let response: Response;
  try {
    response = await (deps.fetchImpl ?? fetch)(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: apiKey }
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  try {
    const body = (await response.json()) as { id?: unknown };
    return typeof body.id === 'string' && body.id.trim() ? body.id : null;
  } catch {
    return null;
  }
}

async function hasPermission(
  context: AuthContext,
  permission: string,
  deps: AtlasCrmHubSpotDependencies
): Promise<boolean> {
  const supabaseUrl = env('SUPABASE_URL', deps);
  const apiKey = publishableKey(deps);
  if (!supabaseUrl || !apiKey) return false;
  try {
    const response = await (deps.fetchImpl ?? fetch)(
      `${supabaseUrl}/rest/v1/rpc/has_identity_permission`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${context.token}`,
          apikey: apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ o: context.organizationId, p: permission })
      }
    );
    return response.ok && (await response.json()) === true;
  } catch {
    return false;
  }
}

async function hasAnyPermission(
  context: AuthContext,
  permissions: readonly string[],
  deps: AtlasCrmHubSpotDependencies
): Promise<boolean> {
  for (const permission of permissions) {
    if (await hasPermission(context, permission, deps)) return true;
  }
  return false;
}

function store(deps: AtlasCrmHubSpotDependencies): HubSpotConnectionStore | null {
  if (deps.connectionStore) return deps.connectionStore;
  const supabaseUrl = env('SUPABASE_URL', deps);
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY', deps);
  if (!supabaseUrl || !serviceRoleKey) return null;
  return new SupabaseHubSpotConnectionStore({
    supabaseUrl,
    serviceRoleKey,
    fetchImpl: deps.fetchImpl
  });
}

function lifecycle(
  connectionStore: HubSpotConnectionStore,
  deps: AtlasCrmHubSpotDependencies
): HubSpotLifecycleDependencies {
  return {
    store: connectionStore,
    clientId: env('HUBSPOT_CLIENT_ID', deps),
    clientSecret: env('HUBSPOT_CLIENT_SECRET', deps),
    redirectUri: env('HUBSPOT_REDIRECT_URI', deps),
    credentialKey:
      deps.lifecycle?.credentialKey ?? env('ATLAS_INTEGRATION_CREDENTIAL_KEY', deps),
    keyVersion:
      deps.lifecycle?.keyVersion ?? (env('ATLAS_INTEGRATION_CREDENTIAL_KEY_VERSION', deps) || 'v1'),
    fetchImpl: deps.fetchImpl,
    ...(deps.lifecycle?.oauth ? { oauth: deps.lifecycle.oauth } : {}),
    ...(deps.lifecycle?.adapter ? { adapter: deps.lifecycle.adapter } : {}),
    ...(deps.lifecycle?.now ? { now: deps.lifecycle.now } : {}),
    ...(deps.lifecycle?.randomBytes ? { randomBytes: deps.lifecycle.randomBytes } : {})
  };
}

function hubSpotConfigured(deps: AtlasCrmHubSpotDependencies): boolean {
  return Boolean(
    env('HUBSPOT_CLIENT_ID', deps) &&
      env('HUBSPOT_CLIENT_SECRET', deps) &&
      env('HUBSPOT_REDIRECT_URI', deps) &&
      (deps.lifecycle?.credentialKey || env('ATLAS_INTEGRATION_CREDENTIAL_KEY', deps))
  );
}

function lifecycleError(
  req: Request,
  deps: AtlasCrmHubSpotDependencies,
  error: unknown
): Response {
  if (error instanceof HubSpotLifecycleError) {
    return json(req, deps, error.status, {
      error: 'HubSpot connection lifecycle failed',
      code: error.code
    });
  }
  return json(req, deps, 500, { error: 'HubSpot connection operation failed' });
}

async function callback(
  req: Request,
  deps: AtlasCrmHubSpotDependencies,
  state: unknown,
  code: unknown
): Promise<Response> {
  if (typeof state !== 'string' || !state.trim()) {
    return json(req, deps, 400, { error: 'OAuth state is required' });
  }
  if (typeof code !== 'string' || !code.trim()) {
    return json(req, deps, 400, { error: 'OAuth authorization code is required' });
  }
  const connectionStore = store(deps);
  if (!connectionStore) {
    return json(req, deps, 503, { error: 'ATLAS integration storage is not configured' });
  }
  if (!hubSpotConfigured(deps)) {
    return json(req, deps, 503, { error: 'HubSpot integration is not configured' });
  }
  try {
    const connection = await completeHubSpotConnection({
      state,
      code,
      deps: lifecycle(connectionStore, deps)
    });
    return json(req, deps, 200, { connection });
  } catch (error) {
    return lifecycleError(req, deps, error);
  }
}

export async function handleAtlasCrmHubSpotRequest(
  req: Request,
  deps: AtlasCrmHubSpotDependencies = {}
): Promise<Response> {
  const corsHeaders = cors(req, deps);
  if (corsHeaders === null) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: JSON_HEADERS
    });
  }
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  if (req.method === 'GET') {
    const url = new URL(req.url);
    if (url.searchParams.has('code') || url.searchParams.has('state')) {
      const result = await callback(req, deps, url.searchParams.get('state'), url.searchParams.get('code'));
      const returnUrl = new URL(CRM_INTEGRATION_RETURN_URL);
      returnUrl.searchParams.set('oauth', result.ok ? 'connected' : 'error');
      if (!result.ok) {
        try {
          const body = await result.clone().json() as { code?: unknown };
          if (typeof body.code === 'string' && body.code) returnUrl.searchParams.set('code', body.code);
        } catch {
          // Keep the redirect free of provider payload details.
        }
      }
      return Response.redirect(returnUrl.toString(), 303);
    }
    return json(req, deps, 405, { error: 'Method not allowed' });
  }
  if (req.method !== 'POST') return json(req, deps, 405, { error: 'Method not allowed' });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json(req, deps, 400, { error: 'Invalid JSON body' });
  }
  if (!isOperation(body.operation)) return json(req, deps, 400, { error: 'Unknown operation' });
  if (body.operation === 'oauth.callback') return callback(req, deps, body.state, body.code);

  const token = bearer(req);
  if (!token) return json(req, deps, 401, { error: 'Authentication required' });
  if (!isUuid(body.organizationId)) {
    return json(req, deps, 400, { error: 'Valid organizationId is required' });
  }

  const userId = await authenticatedUser(token, deps);
  if (!userId) return json(req, deps, 401, { error: 'Invalid or expired ATLAS session' });
  const auth: AuthContext = { token, userId, organizationId: body.organizationId };
  if (!(await hasAnyPermission(auth, PERMISSIONS[body.operation], deps))) {
    return json(req, deps, 403, { error: 'Permission denied' });
  }

  const connectionStore = store(deps);
  if (!connectionStore) {
    return json(req, deps, 503, { error: 'ATLAS integration storage is not configured' });
  }
  const lifecycleDeps = lifecycle(connectionStore, deps);

  try {
    if (body.operation === 'oauth.prepare') {
      if (!hubSpotConfigured(deps)) {
        return json(req, deps, 503, { error: 'HubSpot integration is not configured' });
      }
      return json(req, deps, 200, {
        provider: 'hubspot',
        ...(await prepareHubSpotConnection({
          organizationId: body.organizationId,
          userId,
          deps: lifecycleDeps
        }))
      });
    }
    if (body.operation === 'connection.status') {
      return json(req, deps, 200, {
        connection: await getHubSpotConnectionStatus({
          organizationId: body.organizationId,
          deps: lifecycleDeps
        })
      });
    }
    if (body.operation === 'connection.disconnect') {
      return json(req, deps, 200, {
        connection: await disconnectHubSpotConnection({
          organizationId: body.organizationId,
          actorUserId: userId,
          deps: lifecycleDeps
        })
      });
    }
  } catch (error) {
    return lifecycleError(req, deps, error);
  }

  const result = await executeHubSpotCrmOperation({
    operation: body.operation,
    organizationId: body.organizationId,
    actorUserId: userId,
    body,
    deps: {
      store: connectionStore,
      lifecycle: lifecycleDeps,
      adapter: deps.crmAdapter,
      now: deps.lifecycle?.now
    }
  });
  return json(req, deps, result.status, result.body);
}

const deno = (globalThis as unknown as {
  Deno?: { serve(handler: (req: Request) => Response | Promise<Response>): void };
}).Deno;

if (deno?.serve) deno.serve((req) => handleAtlasCrmHubSpotRequest(req));
