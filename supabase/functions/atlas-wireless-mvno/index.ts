import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import type { MvnoPermission } from '../_shared/mvno.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const PUBLISHABLE_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ||
  Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ||
  '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const VERSION = 1;

const OPERATIONS = [
  'readiness',
  'status',
  'provision',
  'activate',
  'suspend',
  'reconnect',
  'revoke'
] as const;

type Operation = (typeof OPERATIONS)[number];
type WirelessState = 'pending_provider' | 'configured_unverified';

type RequestContext = {
  userId: string;
  orgId: string;
  role: string;
};

const OPERATION_PERMISSION: Readonly<Record<Operation, MvnoPermission>> = {
  readiness: 'wireless.mvno.read',
  status: 'wireless.mvno.read',
  provision: 'wireless.mvno.provision',
  activate: 'wireless.mvno.activate',
  suspend: 'wireless.mvno.suspend',
  reconnect: 'wireless.mvno.reconnect',
  revoke: 'wireless.mvno.revoke'
};

const ALLOWED_ORIGINS = new Set([
  'https://atlasenterprisesuite.com',
  'https://www.atlasenterprisesuite.com'
]);

class WirelessError extends Error {
  constructor(
    readonly code: string,
    readonly status = 400,
    readonly details: Record<string, unknown> = {}
  ) {
    super(code);
  }
}

function clean(value: unknown, max = 200) {
  return String(value ?? '').trim().slice(0, max);
}

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, apikey, content-type, x-atlas-org-id',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-max-age': '86400',
    vary: 'Origin'
  };
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      ...corsHeaders(req.headers.get('origin'))
    }
  });
}

function normalizeError(error: unknown) {
  if (error instanceof WirelessError) {
    return { code: error.code, status: error.status, details: error.details };
  }

  const message = error instanceof Error ? error.message : 'internal_error';
  if (message === 'authentication_required' || message === 'invalid_session') {
    return { code: message, status: 401, details: {} };
  }
  if (message === 'active_organization_required' || message === 'authorization_denied') {
    return { code: message, status: 403, details: {} };
  }
  if (message === 'supabase_runtime_not_configured') {
    return { code: message, status: 503, details: {} };
  }
  return { code: 'internal_error', status: 500, details: {} };
}

function userClient(req: Request) {
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: req.headers.get('authorization') || ''
      }
    }
  });
}

async function resolveContext(req: Request): Promise<RequestContext> {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) throw new Error('supabase_runtime_not_configured');

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('authentication_required');

  const sb = userClient(req);
  const { data: authData, error: authError } = await sb.auth.getUser(token);
  if (authError || !authData.user) throw new Error('invalid_session');

  const requestedOrg = clean(req.headers.get('x-atlas-org-id'), 80);
  let membershipQuery = sb
    .from('organization_members')
    .select('org_id,role,status')
    .eq('user_id', authData.user.id)
    .eq('status', 'active');

  if (requestedOrg) membershipQuery = membershipQuery.eq('org_id', requestedOrg);

  const { data: memberships, error: membershipError } = await membershipQuery.limit(1);
  if (membershipError || !memberships?.[0]?.org_id) {
    throw new Error('active_organization_required');
  }

  return {
    userId: authData.user.id,
    orgId: String(memberships[0].org_id),
    role: String(memberships[0].role || 'member')
  };
}

async function requireOperationPermission(
  req: Request,
  ctx: RequestContext,
  operation: Operation
) {
  const permission = OPERATION_PERMISSION[operation];
  const sb = userClient(req);
  const { data, error } = await sb.rpc('has_identity_permission', {
    o: ctx.orgId,
    p: permission
  });
  if (error || data !== true) throw new Error('authorization_denied');
}

function adminClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function secretName(orgId: string, key: 'provider_id' | 'api_base_url' | 'api_token') {
  return `atlas_wireless:${orgId}:${key}`;
}

async function readServerSecret(
  admin: ReturnType<typeof createClient>,
  name: string
): Promise<string | null> {
  const { data, error } = await admin.rpc('atlas_get_server_secret', { p_name: name });
  if (error) throw new Error('server_secret_unavailable');
  return typeof data === 'string' && data.trim() ? data.trim() : null;
}

async function providerReadiness(ctx: RequestContext) {
  const admin = adminClient();
  if (!admin) {
    return {
      state: 'pending_provider' as WirelessState,
      blocker: 'server_secret_not_configured',
      provider_verified: false,
      activation_enabled: false,
      credentials: {
        provider_id_configured: false,
        api_base_url_configured: false,
        api_token_configured: false
      }
    };
  }

  try {
    const [providerId, apiBaseUrl, apiToken] = await Promise.all([
      readServerSecret(admin, secretName(ctx.orgId, 'provider_id')),
      readServerSecret(admin, secretName(ctx.orgId, 'api_base_url')),
      readServerSecret(admin, secretName(ctx.orgId, 'api_token'))
    ]);

    const credentials = {
      provider_id_configured: Boolean(providerId),
      api_base_url_configured: Boolean(apiBaseUrl),
      api_token_configured: Boolean(apiToken)
    };
    const configuredCount = Object.values(credentials).filter(Boolean).length;

    if (configuredCount === 0) {
      return {
        state: 'pending_provider' as WirelessState,
        blocker: 'provider_not_configured',
        provider_verified: false,
        activation_enabled: false,
        credentials
      };
    }

    return {
      state: 'configured_unverified' as WirelessState,
      blocker: configuredCount === 3
        ? 'provider_adapter_not_verified'
        : 'provider_configuration_incomplete',
      provider_verified: false,
      activation_enabled: false,
      credentials
    };
  } catch {
    return {
      state: 'pending_provider' as WirelessState,
      blocker: 'provider_configuration_unavailable',
      provider_verified: false,
      activation_enabled: false,
      credentials: {
        provider_id_configured: false,
        api_base_url_configured: false,
        api_token_configured: false
      }
    };
  }
}

async function auditBlockedOperation(
  ctx: RequestContext,
  operation: Operation,
  readiness: Awaited<ReturnType<typeof providerReadiness>>
) {
  const admin = adminClient();
  if (!admin) return;
  try {
    await admin.from('audit_logs').insert({
      org_id: ctx.orgId,
      user_id: ctx.userId,
      action: `wireless.mvno.${operation}.blocked`,
      table_name: 'wireless_mvno',
      record_id: null,
      new_data: {
        state: readiness.state,
        blocker: readiness.blocker,
        provider_verified: false
      }
    });
  } catch {
    // Audit failure must never turn a blocked carrier mutation into an allowed one.
  }
}

async function readinessResponse(req: Request, ctx: RequestContext) {
  await requireOperationPermission(req, ctx, 'readiness');
  const readiness = await providerReadiness(ctx);
  return json(req, {
    ok: true,
    service: 'atlas-wireless-mvno',
    version: VERSION,
    organization_id: ctx.orgId,
    role: ctx.role,
    ...readiness,
    capabilities: [],
    provider_secret_values_returned: false,
    checked_at: new Date().toISOString()
  });
}

async function blockedProviderOperation(req: Request, ctx: RequestContext, operation: Operation) {
  await requireOperationPermission(req, ctx, operation);

  const readiness = await providerReadiness(ctx);
  await auditBlockedOperation(ctx, operation, readiness);

  throw new WirelessError('provider_not_ready', 503, {
    operation,
    state: readiness.state,
    blocker: readiness.blocker
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(req.headers.get('origin'))
    });
  }

  const url = new URL(req.url);
  const operation = url.searchParams.get('api') as Operation | null;

  try {
    if (!operation || !OPERATIONS.includes(operation)) {
      throw new WirelessError('not_found', 404);
    }

    const ctx = await resolveContext(req);

    if (operation === 'readiness' && req.method === 'GET') {
      return await readinessResponse(req, ctx);
    }

    if (operation === 'status' && req.method === 'GET') {
      return await blockedProviderOperation(req, ctx, operation);
    }

    if (
      ['provision', 'activate', 'suspend', 'reconnect', 'revoke'].includes(operation) &&
      req.method === 'POST'
    ) {
      return await blockedProviderOperation(req, ctx, operation);
    }

    throw new WirelessError('method_not_allowed', 405);
  } catch (error) {
    const normalized = normalizeError(error);
    return json(
      req,
      { ok: false, error: normalized.code, ...normalized.details },
      normalized.status
    );
  }
});
