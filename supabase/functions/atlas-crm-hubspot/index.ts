const DEFAULT_ALLOWED_ORIGINS = [
  'https://www.atlasenterprisesuite.com',
  'https://atlasenterprisesuite.com'
] as const;

const KNOWN_OPERATIONS = [
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

export type AtlasCrmHubSpotOperation = (typeof KNOWN_OPERATIONS)[number];

export type AtlasCrmHubSpotDependencies = {
  fetchImpl?: typeof fetch;
  env?: (name: string) => string | undefined;
};

type AtlasAuthenticatedContext = {
  token: string;
  userId: string;
  organizationId: string;
};

type PermissionRequirement = readonly string[];

const OPERATION_PERMISSIONS: Record<
  Exclude<AtlasCrmHubSpotOperation, 'oauth.callback'>,
  PermissionRequirement
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

function envValue(name: string, deps: AtlasCrmHubSpotDependencies): string {
  const fromDependency = deps.env?.(name);
  if (fromDependency !== undefined) return fromDependency.trim();
  const deno = (globalThis as unknown as {
    Deno?: { env?: { get(name: string): string | undefined } };
  }).Deno;
  return deno?.env?.get(name)?.trim() ?? '';
}

function publishableKey(deps: AtlasCrmHubSpotDependencies): string {
  const modern = envValue('SUPABASE_PUBLISHABLE_KEYS', deps);
  if (modern) {
    try {
      const parsed = JSON.parse(modern) as Record<string, unknown>;
      if (typeof parsed.default === 'string' && parsed.default.trim()) {
        return parsed.default.trim();
      }
    } catch {
      // Fall through to the legacy key.
    }
  }
  return envValue('SUPABASE_ANON_KEY', deps);
}

function configuredOrigins(deps: AtlasCrmHubSpotDependencies): Set<string> {
  const configured = envValue('ATLAS_ALLOWED_ORIGINS', deps);
  return new Set(
    (configured ? configured.split(',') : [...DEFAULT_ALLOWED_ORIGINS])
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function corsHeaders(
  req: Request,
  deps: AtlasCrmHubSpotDependencies
): HeadersInit | null {
  const origin = req.headers.get('Origin');
  if (!origin) return {};
  if (!configuredOrigins(deps).has(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    headers: { ...JSON_HEADERS, ...(corsHeaders(req, deps) ?? {}) }
  });
}

function bearerToken(req: Request): string | null {
  const authorization = req.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length).trim();
  return token || null;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function isOperation(value: unknown): value is AtlasCrmHubSpotOperation {
  return typeof value === 'string' &&
    (KNOWN_OPERATIONS as readonly string[]).includes(value);
}

async function authenticate(
  token: string,
  deps: AtlasCrmHubSpotDependencies
): Promise<string | null> {
  const supabaseUrl = envValue('SUPABASE_URL', deps);
  const apiKey = publishableKey(deps);
  if (!supabaseUrl || !apiKey) return null;

  const fetchImpl = deps.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: apiKey
      }
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
  context: AtlasAuthenticatedContext,
  permission: string,
  deps: AtlasCrmHubSpotDependencies
): Promise<boolean> {
  const supabaseUrl = envValue('SUPABASE_URL', deps);
  const apiKey = publishableKey(deps);
  if (!supabaseUrl || !apiKey) return false;
  const fetchImpl = deps.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/has_identity_permission`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${context.token}`,
        apikey: apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ o: context.organizationId, p: permission })
    });
  } catch {
    return false;
  }
  if (!response.ok) return false;

  try {
    return (await response.json()) === true;
  } catch {
    return false;
  }
}

async function hasAnyPermission(
  context: AtlasAuthenticatedContext,
  permissions: PermissionRequirement,
  deps: AtlasCrmHubSpotDependencies
): Promise<boolean> {
  for (const permission of permissions) {
    if (await hasPermission(context, permission, deps)) return true;
  }
  return false;
}

export async function handleAtlasCrmHubSpotRequest(
  req: Request,
  deps: AtlasCrmHubSpotDependencies = {}
): Promise<Response> {
  const cors = corsHeaders(req, deps);
  if (cors === null) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: JSON_HEADERS
    });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== 'POST') {
    return json(req, deps, 405, { error: 'Method not allowed' });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json(req, deps, 400, { error: 'Invalid JSON body' });
  }

  if (!isOperation(body.operation)) {
    return json(req, deps, 400, { error: 'Unknown operation' });
  }

  if (body.operation === 'oauth.callback') {
    return json(req, deps, 501, {
      error: 'HubSpot OAuth callback lifecycle is not implemented yet'
    });
  }

  const token = bearerToken(req);
  if (!token) return json(req, deps, 401, { error: 'Authentication required' });

  if (!isUuid(body.organizationId)) {
    return json(req, deps, 400, { error: 'Valid organizationId is required' });
  }

  const userId = await authenticate(token, deps);
  if (!userId) return json(req, deps, 401, { error: 'Invalid or expired ATLAS session' });

  const context: AtlasAuthenticatedContext = {
    token,
    userId,
    organizationId: body.organizationId
  };
  const permissions = OPERATION_PERMISSIONS[body.operation];
  if (!(await hasAnyPermission(context, permissions, deps))) {
    return json(req, deps, 403, { error: 'Permission denied' });
  }

  return json(req, deps, 501, {
    error: 'Operation lifecycle is not implemented yet',
    operation: body.operation
  });
}

const deno = (globalThis as unknown as {
  Deno?: { serve(handler: (req: Request) => Response | Promise<Response>): void };
}).Deno;

if (deno?.serve) {
  deno.serve((req) => handleAtlasCrmHubSpotRequest(req));
}
