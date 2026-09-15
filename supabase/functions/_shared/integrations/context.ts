export class IntegrationEdgeError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly details: Record<string, unknown> = {}
  ) {
    super(code);
    this.name = 'IntegrationEdgeError';
  }

  toJSON() {
    return { code: this.code, status: this.status, ...this.details };
  }
}

export function integrationError(
  code: string,
  status: number,
  details: Record<string, unknown> = {}
) {
  return new IntegrationEdgeError(code, status, details);
}

export type IntegrationRequestContext = {
  tenantId: string;
  organizationId: string;
  userId: string;
  role: string;
  permissions: string[];
  requestId: string;
  sessionId: string;
};

type ContextDeps = {
  supabaseUrl?: string;
  publishableKey?: string;
  fetchFn?: typeof fetch;
};

function runtimeValue(name: string) {
  const deno = (globalThis as any).Deno;
  return typeof deno?.env?.get === 'function' ? String(deno.env.get(name) || '') : '';
}

function bearerOf(req: Request) {
  const raw = req.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+/i.test(raw)) throw integrationError('authentication_required', 401);
  return raw;
}

async function readJson(response: Response, code: string) {
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw integrationError(code === 'identity_unavailable' ? 'authentication_required' : code, response.status);
    }
    throw integrationError(code, response.status >= 500 ? 502 : response.status);
  }
  try {
    return await response.json();
  } catch {
    throw integrationError(code, 502);
  }
}

export async function resolveIntegrationContext(
  req: Request,
  deps: ContextDeps = {}
): Promise<IntegrationRequestContext> {
  const supabaseUrl = (deps.supabaseUrl || runtimeValue('SUPABASE_URL')).replace(/\/$/, '');
  const publishableKey = deps.publishableKey
    || runtimeValue('SUPABASE_ANON_KEY')
    || runtimeValue('SUPABASE_PUBLISHABLE_KEY');
  const fetchFn = deps.fetchFn || fetch;

  if (!supabaseUrl || !publishableKey) throw integrationError('supabase_runtime_not_configured', 503);
  const bearer = bearerOf(req);
  const headers = {
    apikey: publishableKey,
    authorization: bearer,
    'content-type': 'application/json'
  };

  let userResponse: Response;
  try {
    userResponse = await fetchFn(`${supabaseUrl}/auth/v1/user`, { headers, cache: 'no-store' });
  } catch {
    throw integrationError('identity_unavailable', 502);
  }
  const user = await readJson(userResponse, 'identity_unavailable');
  if (!user?.id) throw integrationError('authentication_required', 401);

  let membershipsResponse: Response;
  try {
    membershipsResponse = await fetchFn(
      `${supabaseUrl}/rest/v1/organization_members?select=org_id,role,status&user_id=eq.${encodeURIComponent(user.id)}&status=eq.active`,
      { headers, cache: 'no-store' }
    );
  } catch {
    throw integrationError('identity_unavailable', 502);
  }
  const memberships = await readJson(membershipsResponse, 'identity_unavailable');
  if (!Array.isArray(memberships) || memberships.length === 0) {
    throw integrationError('active_organization_required', 403);
  }

  const requestedOrg = (req.headers.get('x-atlas-org-id') || '').trim();
  const membership = requestedOrg
    ? memberships.find((row: any) => String(row?.org_id || '') === requestedOrg)
    : memberships[0];
  if (!membership?.org_id) throw integrationError('organization_membership_required', 403);

  const role = String(membership.role || 'member');
  let permissionsResponse: Response;
  try {
    permissionsResponse = await fetchFn(
      `${supabaseUrl}/rest/v1/identity_role_permissions?select=permission_code&role=eq.${encodeURIComponent(role)}`,
      { headers, cache: 'no-store' }
    );
  } catch {
    throw integrationError('identity_unavailable', 502);
  }
  const permissionRows = await readJson(permissionsResponse, 'identity_unavailable');
  const permissions = [...new Set(
    (Array.isArray(permissionRows) ? permissionRows : [])
      .map((row: any) => String(row?.permission_code || ''))
      .filter(Boolean)
  )];

  const organizationId = String(membership.org_id);
  const requestId = (req.headers.get('x-request-id') || '').trim() || crypto.randomUUID();
  const sessionId = (req.headers.get('x-atlas-session-id') || '').trim() || requestId;
  return {
    tenantId: organizationId,
    organizationId,
    userId: String(user.id),
    role,
    permissions,
    requestId,
    sessionId
  };
}
