import {
  completeSalesforceConnection,
  disconnectSalesforceConnection,
  getSalesforceConnectionStatus,
  inventorySalesforceConnection,
  listSalesforceCandidates,
  prepareSalesforceConnection,
  selectCanonicalSalesforceConnection,
  SalesforceLifecycleError,
  type SalesforceLifecycleDependencies
} from '../_shared/salesforce-connection-lifecycle.ts';
import {
  SupabaseSalesforceConnectionStore,
  type SalesforceConnectionRow,
  type SalesforceConnectionStore
} from '../_shared/salesforce-connection-store.ts';
import {
  executeSalesforceCrmOperation,
  type SalesforceCrmOperation,
  type SalesforceCrmOperationAdapter
} from '../_shared/salesforce-crm-operations.ts';
import { getServerSecret, setServerSecret } from '../_shared/server-secret-store.ts';
import { normalizeSalesforceLoginBaseUrl } from '../_shared/salesforce-oauth.ts';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://www.atlasenterprisesuite.com',
  'https://atlasenterprisesuite.com'
] as const;

const OPERATIONS = [
  'oauth.prepare',
  'oauth.callback',
  'oauth.configure',
  'connection.configuration',
  'connection.status',
  'connection.verify',
  'connection.disconnect',
  'crm.list',
  'crm.search',
  'crm.get',
  'crm.associations',
  'org.inventory',
  'org.candidates',
  'org.selectCanonical'
] as const;

export type AtlasCrmSalesforceOperation = (typeof OPERATIONS)[number];

export type AtlasCrmSalesforceDependencies = {
  fetchImpl?: typeof fetch;
  env?: (name: string) => string | undefined;
  connectionStore?: SalesforceConnectionStore;
  crmAdapter?: SalesforceCrmOperationAdapter;
  lifecycle?: Partial<
    Pick<
      SalesforceLifecycleDependencies,
      'adapter' | 'now' | 'randomBytes' | 'credentialKey' | 'keyVersion'
    >
  >;
};

type AuthContext = { token: string; userId: string; organizationId: string };

const PERMISSIONS: Record<
  Exclude<AtlasCrmSalesforceOperation, 'oauth.callback'>,
  readonly string[]
> = {
  'oauth.prepare': ['integrations.admin', 'integrations.manage'],
  'oauth.configure': ['integrations.admin', 'integrations.manage'],
  'connection.configuration': ['integrations.read', 'integrations.admin', 'integrations.manage'],
  'connection.status': ['integrations.read', 'integrations.admin', 'integrations.manage'],
  'connection.verify': ['crm.sync', 'crm.admin', 'integrations.admin', 'integrations.manage'],
  'connection.disconnect': ['integrations.admin', 'integrations.manage'],
  'crm.list': ['crm.read', 'crm.admin'],
  'crm.search': ['crm.read', 'crm.admin'],
  'crm.get': ['crm.read', 'crm.admin'],
  'crm.associations': ['crm.read', 'crm.admin'],
  'org.inventory': ['crm.sync', 'crm.admin', 'integrations.admin', 'integrations.manage'],
  'org.candidates': ['integrations.read', 'integrations.admin', 'integrations.manage', 'crm.admin'],
  'org.selectCanonical': ['integrations.admin', 'integrations.manage']
};

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };
const CRM_INTEGRATION_RETURN_URL =
  'https://www.atlasenterprisesuite.com/crm/integrations/salesforce';

const SERVER_SECRET_NAMES = {
  clientId: 'salesforce_oauth_client_id',
  clientSecret: 'salesforce_oauth_client_secret',
  redirectUri: 'salesforce_oauth_redirect_uri',
  loginBaseUrl: 'salesforce_oauth_login_base_url',
  credentialKey: 'atlas_integration_credential_key'
} as const;

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function generatedCredentialKey(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

function env(name: string, deps: AtlasCrmSalesforceDependencies): string {
  const injected = deps.env?.(name);
  if (injected !== undefined) return injected.trim();
  const deno = (globalThis as unknown as {
    Deno?: { env?: { get(name: string): string | undefined } };
  }).Deno;
  return deno?.env?.get(name)?.trim() ?? '';
}

function publishableKey(deps: AtlasCrmSalesforceDependencies): string {
  const modern = env('SUPABASE_PUBLISHABLE_KEYS', deps);
  if (modern) {
    try {
      const parsed = JSON.parse(modern) as Record<string, unknown>;
      if (typeof parsed.default === 'string' && parsed.default.trim()) return parsed.default.trim();
    } catch {
      // Fall back to legacy anon key.
    }
  }
  return env('SUPABASE_ANON_KEY', deps);
}

function canonicalRedirectUri(deps: AtlasCrmSalesforceDependencies): string {
  const supabaseUrl = env('SUPABASE_URL', deps).replace(/\/$/, '');
  return supabaseUrl ? `${supabaseUrl}/functions/v1/atlas-crm-salesforce` : '';
}

function configuredLoginBaseUrl(environment: unknown): string {
  if (environment === undefined || environment === null || environment === '' || environment === 'production') {
    return 'https://login.salesforce.com';
  }
  if (environment === 'sandbox') return 'https://test.salesforce.com';
  throw new Error('Salesforce environment must be production or sandbox');
}

function salesforceEnvironmentForLoginBaseUrl(value: string): 'production' | 'sandbox' {
  const normalized = normalizeSalesforceLoginBaseUrl(value);
  return new URL(normalized).hostname === 'test.salesforce.com' ? 'sandbox' : 'production';
}

async function resolvedSecretDeps(
  deps: AtlasCrmSalesforceDependencies
): Promise<AtlasCrmSalesforceDependencies> {
  const base = (name: string) => env(name, deps);
  const supabaseUrl = base('SUPABASE_URL');
  const serviceRoleKey = base('SUPABASE_SERVICE_ROLE_KEY');
  const resolved = new Map<string, string>();
  const mapping: Array<[string, string]> = [
    ['SALESFORCE_CLIENT_ID', SERVER_SECRET_NAMES.clientId],
    ['SALESFORCE_CLIENT_SECRET', SERVER_SECRET_NAMES.clientSecret],
    ['SALESFORCE_REDIRECT_URI', SERVER_SECRET_NAMES.redirectUri],
    ['SALESFORCE_LOGIN_BASE_URL', SERVER_SECRET_NAMES.loginBaseUrl],
    ['ATLAS_INTEGRATION_CREDENTIAL_KEY', SERVER_SECRET_NAMES.credentialKey]
  ];

  for (const [envName, secretName] of mapping) {
    const direct = base(envName);
    if (direct) {
      resolved.set(envName, direct);
      continue;
    }
    if (!supabaseUrl || !serviceRoleKey) continue;
    try {
      const value = await getServerSecret({
        supabaseUrl,
        serviceRoleKey,
        name: secretName,
        fetchImpl: deps.fetchImpl
      });
      if (value) resolved.set(envName, value);
    } catch {
      // Configuration remains fail-closed when Vault is unavailable.
    }
  }

  if (!resolved.get('SALESFORCE_REDIRECT_URI')) {
    const fallback = canonicalRedirectUri(deps);
    if (fallback) resolved.set('SALESFORCE_REDIRECT_URI', fallback);
  }
  if (!resolved.get('SALESFORCE_LOGIN_BASE_URL')) {
    resolved.set('SALESFORCE_LOGIN_BASE_URL', 'https://login.salesforce.com');
  }

  return {
    ...deps,
    env: (name) => resolved.get(name) ?? base(name)
  };
}

async function configureSalesforceOAuth(input: {
  clientId: unknown;
  clientSecret: unknown;
  environment: unknown;
  deps: AtlasCrmSalesforceDependencies;
}): Promise<{ configured: true; redirectUri: string; environment: 'production' | 'sandbox' }> {
  if (typeof input.clientId !== 'string' || !input.clientId.trim()) {
    throw new Error('Salesforce OAuth client ID is required');
  }
  if (typeof input.clientSecret !== 'string' || input.clientSecret.trim().length < 8) {
    throw new Error('Salesforce OAuth client secret is required');
  }

  const supabaseUrl = env('SUPABASE_URL', input.deps);
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY', input.deps);
  const redirectUri = canonicalRedirectUri(input.deps);
  if (!supabaseUrl || !serviceRoleKey || !redirectUri) {
    throw new Error('ATLAS server secret storage is not configured');
  }

  const loginBaseUrl = configuredLoginBaseUrl(input.environment);
  const environment = salesforceEnvironmentForLoginBaseUrl(loginBaseUrl);
  const resolved = await resolvedSecretDeps(input.deps);
  const existingKey = env('ATLAS_INTEGRATION_CREDENTIAL_KEY', resolved);
  const credentialKey = existingKey || generatedCredentialKey();

  const writes = [
    [SERVER_SECRET_NAMES.clientId, input.clientId.trim(), 'Salesforce OAuth client ID'],
    [SERVER_SECRET_NAMES.clientSecret, input.clientSecret.trim(), 'Salesforce OAuth client secret'],
    [SERVER_SECRET_NAMES.redirectUri, redirectUri, 'ATLAS CRM Salesforce OAuth callback URI'],
    [SERVER_SECRET_NAMES.loginBaseUrl, loginBaseUrl, 'Salesforce OAuth login environment'],
    [SERVER_SECRET_NAMES.credentialKey, credentialKey, 'ATLAS CRM credential encryption key']
  ] as const;

  for (const [name, secret, description] of writes) {
    await setServerSecret({
      supabaseUrl,
      serviceRoleKey,
      name,
      secret,
      description,
      fetchImpl: input.deps.fetchImpl
    });
  }

  return { configured: true, redirectUri, environment };
}

function salesforceConfigured(deps: AtlasCrmSalesforceDependencies): boolean {
  return Boolean(
    env('SALESFORCE_CLIENT_ID', deps) &&
      env('SALESFORCE_CLIENT_SECRET', deps) &&
      env('SALESFORCE_REDIRECT_URI', deps) &&
      env('SALESFORCE_LOGIN_BASE_URL', deps) &&
      (deps.lifecycle?.credentialKey || env('ATLAS_INTEGRATION_CREDENTIAL_KEY', deps))
  );
}

function cors(req: Request, deps: AtlasCrmSalesforceDependencies): HeadersInit | null {
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
  deps: AtlasCrmSalesforceDependencies,
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

function isOperation(value: unknown): value is AtlasCrmSalesforceOperation {
  return typeof value === 'string' && (OPERATIONS as readonly string[]).includes(value);
}

async function authenticatedUser(
  token: string,
  deps: AtlasCrmSalesforceDependencies
): Promise<string | null> {
  const supabaseUrl = env('SUPABASE_URL', deps);
  const apiKey = publishableKey(deps);
  if (!supabaseUrl || !apiKey) return null;
  try {
    const response = await (deps.fetchImpl ?? fetch)(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: apiKey }
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { id?: unknown };
    return typeof body.id === 'string' && body.id.trim() ? body.id : null;
  } catch {
    return null;
  }
}

async function hasPermission(
  context: AuthContext,
  permission: string,
  deps: AtlasCrmSalesforceDependencies
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
  deps: AtlasCrmSalesforceDependencies
): Promise<boolean> {
  for (const permission of permissions) {
    if (await hasPermission(context, permission, deps)) return true;
  }
  return false;
}

function store(deps: AtlasCrmSalesforceDependencies): SalesforceConnectionStore | null {
  if (deps.connectionStore) return deps.connectionStore;
  const supabaseUrl = env('SUPABASE_URL', deps);
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY', deps);
  if (!supabaseUrl || !serviceRoleKey) return null;
  return new SupabaseSalesforceConnectionStore({
    supabaseUrl,
    serviceRoleKey,
    fetchImpl: deps.fetchImpl
  });
}

function lifecycle(
  connectionStore: SalesforceConnectionStore,
  deps: AtlasCrmSalesforceDependencies
): SalesforceLifecycleDependencies {
  return {
    store: connectionStore,
    clientId: env('SALESFORCE_CLIENT_ID', deps),
    clientSecret: env('SALESFORCE_CLIENT_SECRET', deps),
    redirectUri: env('SALESFORCE_REDIRECT_URI', deps),
    loginBaseUrl: env('SALESFORCE_LOGIN_BASE_URL', deps),
    apiVersion: env('SALESFORCE_API_VERSION', deps) || 'v68.0',
    credentialKey:
      deps.lifecycle?.credentialKey ?? env('ATLAS_INTEGRATION_CREDENTIAL_KEY', deps),
    keyVersion:
      deps.lifecycle?.keyVersion ?? (env('ATLAS_INTEGRATION_CREDENTIAL_KEY_VERSION', deps) || 'v1'),
    fetchImpl: deps.fetchImpl,
    ...(deps.lifecycle?.adapter ? { adapter: deps.lifecycle.adapter } : {}),
    ...(deps.lifecycle?.now ? { now: deps.lifecycle.now } : {}),
    ...(deps.lifecycle?.randomBytes ? { randomBytes: deps.lifecycle.randomBytes } : {})
  };
}

function safeCandidate(row: SalesforceConnectionRow) {
  return {
    id: row.id,
    state: row.state,
    providerAccountId: row.provider_account_id,
    providerAccountLabel: row.provider_account_label,
    instanceUrl: row.endpoint_origin,
    grantedScopes: [...row.granted_scopes],
    lastVerifiedAt: row.last_verified_at,
    lastSuccessAt: row.last_success_at,
    safeErrorCode: row.last_error_code,
    metadata: {
      canonical: row.metadata?.canonical === true,
      classification: row.metadata?.classification ?? 'unknown',
      userId: row.metadata?.userId ?? null,
      username: row.metadata?.username ?? null,
      organizationType: row.metadata?.organizationType ?? null,
      instanceName: row.metadata?.instanceName ?? null,
      isSandbox: row.metadata?.isSandbox ?? null,
      apiVersion: row.metadata?.apiVersion ?? null,
      recordCounts: row.metadata?.recordCounts ?? null,
      inventoryProbedAt: row.metadata?.inventoryProbedAt ?? null
    }
  };
}

function lifecycleError(
  req: Request,
  deps: AtlasCrmSalesforceDependencies,
  error: unknown
): Response {
  if (error instanceof SalesforceLifecycleError) {
    return json(req, deps, error.status, {
      error: 'Salesforce connection lifecycle failed',
      code: error.code
    });
  }
  return json(req, deps, 500, { error: 'Salesforce connection operation failed' });
}

async function callback(
  req: Request,
  deps: AtlasCrmSalesforceDependencies,
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
  if (!salesforceConfigured(deps)) {
    return json(req, deps, 503, { error: 'Salesforce integration is not configured' });
  }
  try {
    return json(req, deps, 200, await completeSalesforceConnection({
      state,
      code,
      deps: lifecycle(connectionStore, deps)
    }));
  } catch (error) {
    return lifecycleError(req, deps, error);
  }
}

export async function handleAtlasCrmSalesforceRequest(
  req: Request,
  deps: AtlasCrmSalesforceDependencies = {}
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
      const secretDeps = await resolvedSecretDeps(deps);
      const result = await callback(
        req,
        secretDeps,
        url.searchParams.get('state'),
        url.searchParams.get('code')
      );
      const returnUrl = new URL(CRM_INTEGRATION_RETURN_URL);
      returnUrl.searchParams.set('oauth', result.ok ? 'connected' : 'error');
      if (!result.ok) {
        try {
          const body = await result.clone().json() as { code?: unknown };
          if (typeof body.code === 'string' && body.code) returnUrl.searchParams.set('code', body.code);
        } catch {
          // Keep provider response details out of browser redirects.
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
  if (body.operation === 'oauth.callback') {
    const secretDeps = await resolvedSecretDeps(deps);
    return callback(req, secretDeps, body.state, body.code);
  }

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

  if (body.operation === 'oauth.configure') {
    try {
      return json(req, deps, 200, await configureSalesforceOAuth({
        clientId: body.clientId,
        clientSecret: body.clientSecret,
        environment: body.environment,
        deps
      }));
    } catch (error) {
      return json(req, deps, 400, {
        error: error instanceof Error ? error.message : 'Salesforce OAuth configuration failed'
      });
    }
  }

  const secretDeps = await resolvedSecretDeps(deps);

  if (body.operation === 'connection.configuration') {
    const loginBaseUrl = env('SALESFORCE_LOGIN_BASE_URL', secretDeps);
    return json(req, deps, 200, {
      configured: salesforceConfigured(secretDeps),
      redirectUri: env('SALESFORCE_REDIRECT_URI', secretDeps) || canonicalRedirectUri(deps),
      environment: salesforceEnvironmentForLoginBaseUrl(loginBaseUrl),
      apiVersion: env('SALESFORCE_API_VERSION', secretDeps) || 'v68.0'
    });
  }

  const connectionStore = store(secretDeps);
  if (!connectionStore) {
    return json(req, deps, 503, { error: 'ATLAS integration storage is not configured' });
  }
  const lifecycleDeps = lifecycle(connectionStore, secretDeps);

  try {
    if (body.operation === 'oauth.prepare') {
      if (!salesforceConfigured(secretDeps)) {
        return json(req, deps, 503, { error: 'Salesforce integration is not configured' });
      }
      return json(req, deps, 200, {
        provider: 'salesforce',
        ...(await prepareSalesforceConnection({
          organizationId: body.organizationId,
          userId,
          deps: lifecycleDeps
        }))
      });
    }

    if (body.operation === 'connection.status') {
      return json(req, deps, 200, await getSalesforceConnectionStatus({
        organizationId: body.organizationId,
        deps: lifecycleDeps
      }));
    }

    if (body.operation === 'org.candidates') {
      const candidates = await listSalesforceCandidates({
        organizationId: body.organizationId,
        deps: lifecycleDeps
      });
      return json(req, deps, 200, { candidates: candidates.map(safeCandidate) });
    }

    if (body.operation === 'org.inventory' || body.operation === 'connection.verify') {
      const connectionId =
        typeof body.connectionId === 'string' && body.connectionId.trim()
          ? body.connectionId.trim()
          : undefined;
      return json(req, deps, 200, await inventorySalesforceConnection({
        organizationId: body.organizationId,
        actorUserId: userId,
        connectionId,
        deps: lifecycleDeps
      }));
    }

    if (body.operation === 'org.selectCanonical') {
      if (typeof body.connectionId !== 'string' || !body.connectionId.trim()) {
        return json(req, deps, 400, { error: 'Salesforce connectionId is required' });
      }
      const selected = await selectCanonicalSalesforceConnection({
        organizationId: body.organizationId,
        actorUserId: userId,
        connectionId: body.connectionId.trim(),
        deps: lifecycleDeps
      });
      return json(req, deps, 200, {
        connection: selected.connection,
        candidates: selected.candidates.map(safeCandidate)
      });
    }

    if (body.operation === 'connection.disconnect') {
      const connectionId =
        typeof body.connectionId === 'string' && body.connectionId.trim()
          ? body.connectionId.trim()
          : undefined;
      return json(req, deps, 200, {
        connection: await disconnectSalesforceConnection({
          organizationId: body.organizationId,
          actorUserId: userId,
          connectionId,
          deps: lifecycleDeps
        })
      });
    }
  } catch (error) {
    return lifecycleError(req, secretDeps, error);
  }

  const result = await executeSalesforceCrmOperation({
    operation: body.operation as SalesforceCrmOperation,
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
  return json(req, secretDeps, result.status, result.body);
}

const deno = (globalThis as unknown as {
  Deno?: { serve(handler: (req: Request) => Response | Promise<Response>): void };
}).Deno;

if (deno?.serve) deno.serve((req) => handleAtlasCrmSalesforceRequest(req));
