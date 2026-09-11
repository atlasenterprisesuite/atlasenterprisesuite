import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

const URL = Deno.env.get('SUPABASE_URL') || '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const PROVIDER_ID = Deno.env.get('ATLAS_HOSPITALITY_PROVIDER_ID') || '';
const PROVIDER_ENDPOINT = Deno.env.get('ATLAS_HOSPITALITY_PROVIDER_ENDPOINT') || '';
const PROVIDER_TOKEN = Deno.env.get('ATLAS_HOSPITALITY_PROVIDER_TOKEN') || '';
const VERSION = 1;

const headers = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer'
};

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const fail = (error: string, status = 400, details: Record<string, unknown> = {}) =>
  json({ ok: false, error, ...details }, status);
const clean = (value: unknown, max = 500) => String(value ?? '').trim().slice(0, max);

function userClient(req: Request) {
  const auth = req.headers.get('authorization') || '';
  return createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: auth } }
  });
}

function adminClient() {
  if (!SERVICE_ROLE) throw new Error('server_secret_not_configured');
  return createClient(URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function context(req: Request) {
  if (!URL || !ANON) throw new Error('supabase_runtime_not_configured');
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('authentication_required');

  const sb = userClient(req);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw new Error('invalid_session');

  const { data: members, error: memberError } = await sb
    .from('organization_members')
    .select('org_id,role,status')
    .eq('user_id', data.user.id)
    .eq('status', 'active')
    .limit(1);

  if (memberError || !members?.[0]) throw new Error('active_organization_required');

  return {
    sb,
    user: data.user,
    orgId: String(members[0].org_id),
    role: String(members[0].role || 'member')
  };
}

function providerState() {
  if (!PROVIDER_ID || !PROVIDER_ENDPOINT || !PROVIDER_TOKEN) return 'not_configured' as const;
  return 'configured_unverified' as const;
}

async function audit(
  orgId: string,
  userId: string,
  action: string,
  recordId: string | null,
  payload: Record<string, unknown>
) {
  if (!SERVICE_ROLE) return;
  await adminClient().from('audit_logs').insert({
    org_id: orgId,
    user_id: userId,
    action,
    table_name: 'hospitality_room_access',
    record_id: recordId,
    new_data: payload
  });
}

function normalizeRequest(body: any) {
  return {
    property_id: clean(body?.property_id, 120),
    room_id: clean(body?.room_id, 120),
    assignment_reference: clean(body?.assignment_reference, 160),
    starts_at: clean(body?.starts_at, 80),
    expires_at: clean(body?.expires_at, 80),
    reason: clean(body?.reason, 40)
  };
}

function validateRequest(request: ReturnType<typeof normalizeRequest>) {
  const errors: string[] = [];
  if (!request.property_id) errors.push('property_required');
  if (!request.room_id) errors.push('room_required');
  if (!request.assignment_reference) errors.push('assignment_reference_required');
  if (!['guest_checkin', 'replacement', 'staff_authorized'].includes(request.reason)) errors.push('invalid_reason');

  const startsAt = Date.parse(request.starts_at);
  const expiresAt = Date.parse(request.expires_at);
  if (!Number.isFinite(startsAt)) errors.push('valid_start_required');
  if (!Number.isFinite(expiresAt)) errors.push('valid_expiry_required');
  if (Number.isFinite(startsAt) && Number.isFinite(expiresAt) && expiresAt <= startsAt) {
    errors.push('expiry_must_follow_start');
  }
  return errors;
}

async function readiness(req: Request) {
  const ctx = await context(req);
  return json({
    ok: true,
    service: 'atlas-hospitality-access',
    version: VERSION,
    organization_id: ctx.orgId,
    role: ctx.role,
    provider: {
      id: PROVIDER_ID || null,
      state: providerState()
    },
    issuance_enabled: false,
    blocker: providerState() === 'not_configured'
      ? 'authorized_provider_adapter_not_configured'
      : 'provider_readiness_not_verified',
    checked_at: new Date().toISOString()
  });
}

async function issue(req: Request, body: any) {
  const ctx = await context(req);
  if (!['owner', 'admin', 'platform_admin'].includes(ctx.role)) {
    return fail('hospitality_access_admin_required', 403);
  }

  const request = normalizeRequest(body);
  const errors = validateRequest(request);
  if (errors.length) return fail('invalid_room_access_request', 422, { errors });

  if (providerState() !== 'configured_unverified') {
    await audit(ctx.orgId, ctx.user.id, 'hospitality.room_access.issue_blocked', null, {
      property_id: request.property_id,
      room_id: request.room_id,
      reason: request.reason,
      blocker: 'authorized_provider_adapter_not_configured'
    });
    return fail('authorized_provider_adapter_not_configured', 503);
  }

  const upstream = await fetch(PROVIDER_ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${PROVIDER_TOKEN}`,
      'content-type': 'application/json',
      'user-agent': 'ATLAS-Hospitality/1.0'
    },
    body: JSON.stringify({
      organization_id: ctx.orgId,
      requested_by: ctx.user.id,
      provider_id: PROVIDER_ID,
      operation: 'issue_room_credential',
      request
    })
  }).catch(() => null);

  if (!upstream) {
    await audit(ctx.orgId, ctx.user.id, 'hospitality.room_access.issue_failed', null, {
      property_id: request.property_id,
      room_id: request.room_id,
      provider_id: PROVIDER_ID,
      failure: 'provider_unreachable'
    });
    return fail('provider_unreachable', 502);
  }

  const providerData = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    await audit(ctx.orgId, ctx.user.id, 'hospitality.room_access.issue_failed', null, {
      property_id: request.property_id,
      room_id: request.room_id,
      provider_id: PROVIDER_ID,
      provider_status: upstream.status
    });
    return fail('provider_issue_failed', 502, { provider_status: upstream.status });
  }

  const credentialId = clean(providerData?.credential_id || providerData?.id, 200);
  if (!credentialId) return fail('provider_response_missing_credential_id', 502);

  await audit(ctx.orgId, ctx.user.id, 'hospitality.room_access.issued', credentialId, {
    property_id: request.property_id,
    room_id: request.room_id,
    assignment_reference: request.assignment_reference,
    starts_at: request.starts_at,
    expires_at: request.expires_at,
    reason: request.reason,
    provider_id: PROVIDER_ID
  });

  // ATLAS intentionally returns only the provider credential identifier.
  // Raw key material, NFC/RFID payloads, master keys, secrets and encoder commands
  // must remain inside the authorized provider adapter and never reach the browser.
  return json({
    ok: true,
    credential_id: credentialId,
    provider_id: PROVIDER_ID,
    state: 'issued'
  }, 201);
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const api = url.searchParams.get('api');

  try {
    if (req.method === 'GET' && api === 'readiness') return await readiness(req);
    if (req.method === 'POST' && api === 'issue') {
      let body: any;
      try {
        body = await req.json();
      } catch {
        return fail('invalid_json', 400);
      }
      return await issue(req, body);
    }
    return fail('not_found', 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'internal_error';
    const status = ['authentication_required', 'invalid_session'].includes(message)
      ? 401
      : message.includes('required')
        ? 403
        : 500;
    return fail(message, status);
  }
});
