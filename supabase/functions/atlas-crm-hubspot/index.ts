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
  type HubSpotCrmOperationAdapter
} from '../_shared/hubspot-crm-operations.ts';
import { getServerSecret, setServerSecret } from '../_shared/server-secret-store.ts';
import {
  hubSpotHealthView,
  runHubSpotScheduledMonitor
} from '../_shared/hubspot-resilience.ts';
import {
  normalizeHubSpotWebhookEvents,
  verifyHubSpotV3Signature
} from '../_shared/hubspot-webhook.ts';

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
  'connection.health',
  'connection.disconnect',
  'crm.create',
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
  crmAdapter?: HubSpotCrmOperationAdapter;
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
  'oauth.configure': ['integrations.admin', 'integrations.manage'],
  'connection.configuration': ['integrations.read', 'integrations.admin', 'integrations.manage'],
  'connection.status': ['integrations.read', 'integrations.admin', 'integrations.manage'],
  'connection.health': ['integrations.read', 'integrations.admin', 'integrations.manage', 'crm.read', 'crm.admin'],
  'connection.disconnect': ['integrations.admin', 'integrations.manage'],
  'crm.create': ['crm.write', 'crm.admin'],
  'crm.list': ['crm.read', 'crm.admin'],
  'crm.search': ['crm.read', 'crm.admin'],
  'crm.get': ['crm.read', 'crm.admin'],
  'crm.associations': ['crm.read', 'crm.admin'],
  'crm.refresh': ['crm.sync', 'crm.admin']
};

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };
const CRM_INTEGRATION_RETURN_URL = 'https://www.atlasenterprisesuite.com/crm/integrations/hubspot';

const SERVER_SECRET_NAMES = {
  clientId: 'hubspot_oauth_client_id',
  clientSecret: 'hubspot_oauth_client_secret',
  redirectUri: 'hubspot_oauth_redirect_uri',
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

function canonicalRedirectUri(deps: AtlasCrmHubSpotDependencies): string {
  const supabaseUrl = env('SUPABASE_URL', deps).replace(/\/$/, '');
  return supabaseUrl ? `${supabaseUrl}/functions/v1/atlas-crm-hubspot` : '';
}

async function resolvedSecretDeps(
  deps: AtlasCrmHubSpotDependencies
): Promise<AtlasCrmHubSpotDependencies> {
  const base = (name: string) => env(name, deps);
  const supabaseUrl = base('SUPABASE_URL');
  const serviceRoleKey = base('SUPABASE_SERVICE_ROLE_KEY');
  const resolved = new Map<string, string>();

  const mapping: Array<[string, string]> = [
    ['HUBSPOT_CLIENT_ID', SERVER_SECRET_NAMES.clientId],
    ['HUBSPOT_CLIENT_SECRET', SERVER_SECRET_NAMES.clientSecret],
    ['HUBSPOT_REDIRECT_URI', SERVER_SECRET_NAMES.redirectUri],
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
      // Configuration state remains fail-closed when Vault is unavailable.
    }
  }

  if (!resolved.get('HUBSPOT_REDIRECT_URI')) {
    const fallback = canonicalRedirectUri(deps);
    if (fallback) resolved.set('HUBSPOT_REDIRECT_URI', fallback);
  }

  return {
    ...deps,
    env: (name) => resolved.get(name) ?? base(name)
  };
}

async function configureHubSpotOAuth(input: {
  clientId: unknown;
  clientSecret: unknown;
  deps: AtlasCrmHubSpotDependencies;
}): Promise<{ configured: true; redirectUri: string }> {
  if (typeof input.clientId !== 'string' || !input.clientId.trim()) {
    throw new Error('HubSpot OAuth client ID is required');
  }
  if (typeof input.clientSecret !== 'string' || input.clientSecret.trim().length < 8) {
    throw new Error('HubSpot OAuth client secret is required');
  }

  const supabaseUrl = env('SUPABASE_URL', input.deps);
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY', input.deps);
  const redirectUri = canonicalRedirectUri(input.deps);
  if (!supabaseUrl || !serviceRoleKey || !redirectUri) {
    throw new Error('ATLAS server secret storage is not configured');
  }

  const resolved = await resolvedSecretDeps(input.deps);
  const existingKey = env('ATLAS_INTEGRATION_CREDENTIAL_KEY', resolved);
  const credentialKey = existingKey || generatedCredentialKey();

  const writes = [
    [SERVER_SECRET_NAMES.clientId, input.clientId.trim(), 'HubSpot OAuth client ID'],
    [SERVER_SECRET_NAMES.clientSecret, input.clientSecret.trim(), 'HubSpot OAuth client secret'],
    [SERVER_SECRET_NAMES.redirectUri, redirectUri, 'ATLAS CRM HubSpot OAuth callback URI'],
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

  return { configured: true, redirectUri };
}


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


async function validateInternalMonitorToken(
  token: string,
  deps: AtlasCrmHubSpotDependencies
): Promise<boolean> {
  const supabaseUrl = env('SUPABASE_URL', deps);
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY', deps);
  if (!token.trim() || !supabaseUrl || !serviceRoleKey) return false;
  try {
    const response = await (deps.fetchImpl ?? fetch)(
      `${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/validate_atlas_hubspot_monitor_trigger`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_token: token })
      }
    );
    return response.ok && (await response.json()) === true;
  } catch {
    return false;
  }
}

function isHubSpotWebhookRequest(req: Request): boolean {
  return Boolean(
    req.headers.get('x-hubspot-signature-v3') ||
    req.headers.get('x-hubspot-request-timestamp')
  );
}

async function handleHubSpotWebhook(
  req: Request,
  deps: AtlasCrmHubSpotDependencies
): Promise<Response> {
  const secretDeps = await resolvedSecretDeps(deps);
  const clientSecret = env('HUBSPOT_CLIENT_SECRET', secretDeps);
  if (!clientSecret) return json(req, deps, 503, { error: 'HubSpot integration is not configured' });

  const rawBody = await req.text();
  const verified = await verifyHubSpotV3Signature({
    method: req.method,
    uri: req.url,
    rawBody,
    signature: req.headers.get('x-hubspot-signature-v3'),
    timestamp: req.headers.get('x-hubspot-request-timestamp'),
    clientSecret
  });
  if (!verified) return json(req, deps, 401, { error: 'Invalid HubSpot webhook signature' });

  let events;
  try {
    events = await normalizeHubSpotWebhookEvents(rawBody);
  } catch {
    return json(req, deps, 400, { error: 'Invalid HubSpot webhook payload' });
  }

  const connectionStore = store(secretDeps);
  if (
    !connectionStore ||
    !connectionStore.getConnectionByProviderAccountId ||
    !connectionStore.insertWebhookEvents
  ) {
    return json(req, deps, 503, { error: 'ATLAS webhook storage is not configured' });
  }

  let accepted = 0;
  let ignored = 0;
  let duplicates = 0;
  const now = new Date().toISOString();
  const grouped = new Map<string, {
    connection: Awaited<ReturnType<NonNullable<typeof connectionStore.getConnectionByProviderAccountId>>>;
    events: typeof events;
  }>();

  for (const event of events) {
    const connection = await connectionStore.getConnectionByProviderAccountId(event.providerAccountId);
    if (!connection || ['revoked', 'unconfigured'].includes(connection.state)) {
      ignored += 1;
      continue;
    }
    const existing = grouped.get(connection.org_id);
    if (existing) existing.events.push(event);
    else grouped.set(connection.org_id, { connection, events: [event] });
  }

  for (const [organizationId, group] of grouped) {
    const connection = group.connection;
    if (!connection) continue;
    const inserted = await connectionStore.insertWebhookEvents(group.events.map((event) => ({
      org_id: organizationId,
      provider: 'hubspot' as const,
      provider_account_id: event.providerAccountId,
      event_key: event.eventKey,
      provider_event_id: event.providerEventId,
      subscription_type: event.subscriptionType,
      provider_object_type: event.providerObjectType,
      provider_object_id: event.providerObjectId,
      property_name: event.propertyName,
      occurred_at: event.occurredAt,
      processed_at: now
    })));
    accepted += inserted;
    duplicates += group.events.length - inserted;

    const links = group.events
      .filter((event) => event.providerObjectType && event.providerObjectId)
      .map((event) => ({
        org_id: organizationId,
        provider: 'hubspot' as const,
        provider_account_id: event.providerAccountId,
        provider_object_type: event.providerObjectType!,
        provider_object_id: event.providerObjectId!,
        last_seen_at: now,
        source_updated_at: event.occurredAt,
        source_fingerprint: null
      }));
    if (links.length && connectionStore.upsertObjectLinks) {
      await connectionStore.upsertObjectLinks(links);
    }
    if (connectionStore.upsertHealth) {
      await connectionStore.upsertHealth(organizationId, { last_webhook_at: now });
    }
    await connectionStore.recordEvidence({
      org_id: organizationId,
      provider: 'hubspot',
      operation: 'webhook.receive',
      status: 'completed',
      records_observed: group.events.length,
      completed_at: now
    });
  }

  return json(req, deps, 200, { accepted, duplicates, ignored });
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

  if (req.method === 'POST' && isHubSpotWebhookRequest(req)) {
    return handleHubSpotWebhook(req, deps);
  }

  if (req.method === 'GET') {
    const url = new URL(req.url);
    if (url.searchParams.has('code') || url.searchParams.has('state')) {
      const secretDeps = await resolvedSecretDeps(deps);
      const result = await callback(req, secretDeps, url.searchParams.get('state'), url.searchParams.get('code'));
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

  if (body.operation === 'internal.monitor') {
    const token = req.headers.get('x-atlas-hubspot-monitor-token') ?? '';
    if (!(await validateInternalMonitorToken(token, deps))) {
      return json(req, deps, 403, { error: 'Internal monitor authorization failed' });
    }
    const secretDeps = await resolvedSecretDeps(deps);
    const connectionStore = store(secretDeps);
    if (!connectionStore) {
      return json(req, deps, 503, { error: 'ATLAS integration storage is not configured' });
    }
    try {
      const summary = await runHubSpotScheduledMonitor({
        store: connectionStore,
        lifecycle: lifecycle(connectionStore, secretDeps),
        adapter: deps.crmAdapter,
        now: deps.lifecycle?.now
      });
      return json(req, deps, 200, { ok: summary.failed === 0, summary });
    } catch {
      return json(req, deps, 500, { error: 'HubSpot resilience monitor failed' });
    }
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
      return json(req, deps, 200, await configureHubSpotOAuth({
        clientId: body.clientId,
        clientSecret: body.clientSecret,
        deps
      }));
    } catch (error) {
      return json(req, deps, 400, {
        error: error instanceof Error ? error.message : 'HubSpot OAuth configuration failed'
      });
    }
  }

  const secretDeps = await resolvedSecretDeps(deps);

  if (body.operation === 'connection.configuration') {
    return json(req, deps, 200, {
      configured: hubSpotConfigured(secretDeps),
      redirectUri: env('HUBSPOT_REDIRECT_URI', secretDeps) || canonicalRedirectUri(deps)
    });
  }

  const connectionStore = store(secretDeps);
  if (!connectionStore) {
    return json(req, deps, 503, { error: 'ATLAS integration storage is not configured' });
  }
  const lifecycleDeps = lifecycle(connectionStore, secretDeps);

  try {
    if (body.operation === 'oauth.prepare') {
      if (!hubSpotConfigured(secretDeps)) {
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
    if (body.operation === 'connection.health') {
      return json(req, deps, 200, {
        health: hubSpotHealthView(
          connectionStore.getHealth
            ? await connectionStore.getHealth(body.organizationId)
            : null
        )
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
      now: deps.lifecycle?.now,
      writesEnabled: env('HUBSPOT_CRM_WRITES_ENABLED', secretDeps).toLowerCase() === 'true'
    }
  });
  return json(req, secretDeps, result.status, result.body);
}

const deno = (globalThis as unknown as {
  Deno?: { serve(handler: (req: Request) => Response | Promise<Response>): void };
}).Deno;

if (deno?.serve) deno.serve((req) => handleAtlasCrmHubSpotRequest(req));
