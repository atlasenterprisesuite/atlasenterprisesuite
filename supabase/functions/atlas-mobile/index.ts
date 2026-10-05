const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://ggmanzcgtlrvqfoccgsh.supabase.co';
const PUBLISHABLE_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const ALLOWED_ORIGINS = new Set([
  'https://atlasenterprisesuite.com',
  'https://www.atlasenterprisesuite.com'
]);

const ALLOWED_AUDIT_EVENTS = new Set([
  'mobile.runtime.observed',
  'mobile.permission.observed',
  'mobile.settings.viewed',
  'mobile.identity.diagnostics.viewed',
  'mobile.support.bundle.generated',
  'mobile.billing.status.viewed'
]);

const FORBIDDEN_AUDIT_KEYS = new Set([
  'authorization',
  'token',
  'password',
  'cookie',
  'api_key',
  'secret',
  'message_content'
]);

function responseHeaders(extra: Record<string, string> = {}) {
  return {
    'cache-control':'no-store',
    'x-content-type-options':'nosniff',
    'referrer-policy':'no-referrer',
    ...extra
  };
}

function corsHeaders(origin: string | null) {
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers':'authorization, apikey, content-type, x-atlas-org-id',
    'access-control-allow-methods':'GET, POST, OPTIONS',
    'access-control-max-age':'86400',
    vary:'Origin'
  };
}

function json(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: responseHeaders({
      'content-type':'application/json; charset=utf-8',
      ...corsHeaders(origin)
    })
  });
}

function fail(code: string, status: number, details: Record<string, unknown> = {}) {
  return Object.assign(new Error(code), { code, status, ...details });
}

function safeUuid(value: unknown) {
  const text = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

type MobileContext = {
  userId: string;
  orgId: string;
  role: string;
  bearer: string;
};

async function resolveMobileContext(req: Request): Promise<MobileContext> {
  const bearer = req.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+/i.test(bearer)) throw fail('authentication_required', 401);
  if (!PUBLISHABLE_KEY) throw fail('identity_not_configured', 503);

  const callerHeaders = {
    apikey: PUBLISHABLE_KEY,
    authorization: bearer,
    'content-type':'application/json'
  };

  let userResponse: Response;
  try {
    userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: callerHeaders,
      cache:'no-store'
    });
  } catch {
    throw fail('identity_unavailable', 502);
  }

  if (!userResponse.ok) throw fail('authentication_required', 401);
  const user = await readJson(userResponse);
  if (!user?.id) throw fail('authentication_required', 401);

  const requestedOrgRaw = String(req.headers.get('x-atlas-org-id') || '').trim();
  const requestedOrg = requestedOrgRaw ? safeUuid(requestedOrgRaw) : null;
  if (requestedOrgRaw && !requestedOrg) throw fail('invalid_input', 400, { field:'organization_id' });

  let membershipResponse: Response;
  try {
    membershipResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/organization_members?select=org_id,role,status&user_id=eq.${encodeURIComponent(user.id)}&status=eq.active`,
      { headers: callerHeaders, cache:'no-store' }
    );
  } catch {
    throw fail('identity_unavailable', 502);
  }

  if (!membershipResponse.ok) throw fail('identity_unavailable', 502);
  const memberships = await readJson(membershipResponse);
  const membership = requestedOrg
    ? (Array.isArray(memberships) ? memberships.find((row: any) => row?.org_id === requestedOrg) : null)
    : (Array.isArray(memberships) ? memberships[0] : null);

  if (!membership) throw fail('organization_membership_required', 403);

  return {
    userId: String(user.id),
    orgId: String(membership.org_id),
    role: String(membership.role || 'member'),
    bearer
  };
}

function mobileStatus(ctx: MobileContext) {
  return {
    ok: true,
    authenticated: true,
    organization_id: ctx.orgId,
    role: ctx.role,
    runtime_policy: {
      browser: {
        state: 'unverified',
        last_verified_at: null,
        source: 'browser'
      },
      native_bridge: {
        state: 'unsupported_runtime',
        last_verified_at: null,
        source: 'native_bridge'
      }
    },
    feature_states: {
      permissions: { state: 'unverified', last_verified_at: null },
      billing: { state: 'unverified', last_verified_at: null },
      diagnostics: { state: 'unverified', last_verified_at: null },
      audit: { state: 'unverified', last_verified_at: null },
      native_bridge: { state: 'unsupported_runtime', last_verified_at: null }
    }
  };
}

function sanitizeAuditMetadata(value: unknown, depth = 0): unknown {
  if (depth > 3) return '[redacted-depth]';
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.slice(0, 500);
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => sanitizeAuditMetadata(item, depth + 1));
  if (!value || typeof value !== 'object') return null;

  const output: Record<string, unknown> = {};
  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
    const key = rawKey.trim().toLowerCase();
    if (!key || FORBIDDEN_AUDIT_KEYS.has(key)) continue;
    output[rawKey.slice(0, 80)] = sanitizeAuditMetadata(rawValue, depth + 1);
  }
  return output;
}

async function persistAuditEvent(ctx: MobileContext, eventType: string, metadata: unknown) {
  if (!SERVICE_ROLE_KEY) throw fail('audit_storage_not_configured', 503);

  const response = await fetch(`${SUPABASE_URL}/rest/v1/atlas_mobile_audit_events`, {
    method:'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      authorization: 'Bearer ' + SERVICE_ROLE_KEY,
      'content-type':'application/json',
      Prefer:'return=minimal'
    },
    body: JSON.stringify({
      organization_id: ctx.orgId,
      actor_user_id: ctx.userId,
      event_type: eventType,
      metadata: sanitizeAuditMetadata(metadata),
      created_at: new Date().toISOString()
    }),
    cache:'no-store'
  });

  if (!response.ok) throw fail('audit_storage_unavailable', 503);
}

function errorResponse(error: any, origin: string | null) {
  const code = String(error?.code || error?.message || 'mobile_gateway_error');
  const status = Number(error?.status || 500);

  if (code === 'authentication_required') return json({ ok:false, error: 'authentication_required' }, 401, origin);
  if (code === 'organization_membership_required') return json({ ok:false, error: 'organization_membership_required' }, 403, origin);
  if (code === 'audit_event_not_allowed') return json({ ok:false, error: 'audit_event_not_allowed' }, 400, origin);

  return json({ ok:false, error: code }, Number.isFinite(status) ? status : 500, origin);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') {
    return new Response(null, { status:204, headers: responseHeaders(corsHeaders(origin)) });
  }

  try {
    const url = new URL(req.url);
    const api = url.searchParams.get('api') || 'status';

    if (api === 'status') {
      if (req.method !== 'GET') return json({ ok:false, error:'method_not_allowed' }, 405, origin);
      const ctx = await resolveMobileContext(req);
      return json(mobileStatus(ctx), 200, origin);
    }

    if (api === 'audit') {
      if (req.method !== 'POST') return json({ ok:false, error:'method_not_allowed' }, 405, origin);
      const ctx = await resolveMobileContext(req);
      const body = await req.json().catch(() => ({}));
      const eventType = String(body?.event_type || '').trim();
      if (!ALLOWED_AUDIT_EVENTS.has(eventType)) throw fail('audit_event_not_allowed', 400);
      await persistAuditEvent(ctx, eventType, body?.metadata || {});
      return json({ ok:true, accepted:true, event_type:eventType }, 202, origin);
    }

    return json({ ok:false, error:'not_found' }, 404, origin);
  } catch (error) {
    return errorResponse(error, origin);
  }
});
