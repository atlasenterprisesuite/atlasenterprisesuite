import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import { maskUsLineNumber, normalizeUsLineNumber } from '../_shared/atlas-wireless-line.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const ALLOWED_ORIGINS = new Set([
  'https://atlasenterprisesuite.com',
  'https://www.atlasenterprisesuite.com'
]);

class IntakeError extends Error {
  constructor(readonly code: string, readonly status: number) { super(code); }
}

function json(req: Request, result: unknown, status = 200): Response {
  const origin = req.headers.get('origin');
  return new Response(JSON.stringify(result), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      ...(origin && ALLOWED_ORIGINS.has(origin)
        ? { 'access-control-allow-origin': origin, vary: 'Origin' }
        : {})
    }
  });
}

function userClient(req: Request) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: req.headers.get('authorization') || '' } }
  });
}

async function authorize(req: Request) {
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    throw new IntakeError('service_not_configured', 503);
  }
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new IntakeError('authentication_required', 401);

  // Fail closed on missing organization: never infer a tenant for the caller.
  const orgId = req.headers.get('x-atlas-org-id') || '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orgId)) {
    throw new IntakeError('active_organization_required', 403);
  }

  const sb = userClient(req);
  const { data: identity, error: identityError } = await sb.auth.getUser(token);
  if (identityError || !identity.user) throw new IntakeError('invalid_session', 401);
  const userId = identity.user.id;

  const { data: membership, error: membershipError } = await sb
    .from('organization_members')
    .select('org_id')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (membershipError || !membership) throw new IntakeError('authorization_denied', 403);

  const { data: allowed, error: permissionError } = await sb.rpc('has_identity_permission', {
    o: orgId,
    p: 'wireless.mvno.read'
  });
  if (permissionError || allowed !== true) throw new IntakeError('authorization_denied', 403);

  return { orgId, userId };
}

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function publicClaim(row: { id: string; e164: string; status: string; created_at: string }) {
  return {
    id: row.id,
    masked_number: maskUsLineNumber(row.e164),
    status: row.status,
    created_at: row.created_at,
    carrier_verified: false,
    network_active: false
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') {
    if (!origin || !ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'authorization, apikey, content-type, x-atlas-org-id',
        'access-control-max-age': '600',
        vary: 'Origin'
      }
    });
  }

  try {
    const api = new URL(req.url).searchParams.get('api');
    if (api !== 'list' && api !== 'submit') throw new IntakeError('not_found', 404);
    const { orgId, userId } = await authorize(req);
    const admin = adminClient();

    if (api === 'list' && req.method === 'GET') {
      const { data, error } = await admin.from('atlas_wireless_line_claims')
        .select('id,e164,status,created_at')
        .eq('org_id', orgId)
        .eq('submitted_by', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw new IntakeError('claim_store_unavailable', 503);
      return json(req, { ok: true, claims: (data || []).map(publicClaim) });
    }

    if (api === 'submit' && req.method === 'POST') {
      const rawLength = Number(req.headers.get('content-length') || 0);
      if (rawLength > 1024) throw new IntakeError('invalid_request', 400);
      const raw = await req.text();
      if (raw.length > 1024) throw new IntakeError('invalid_request', 400);
      let input: Record<string, unknown>;
      try { input = JSON.parse(raw); } catch { throw new IntakeError('invalid_request', 400); }
      if (!input || typeof input !== 'object' || Array.isArray(input) || input.ownership_asserted !== true) {
        throw new IntakeError('ownership_assertion_required', 400);
      }

      let e164: string;
      try { e164 = normalizeUsLineNumber(input.number); }
      catch { throw new IntakeError('invalid_phone_number', 400); }

      // A self-attested request stays pending; it is never an ATLAS allocation.
      const { data, error } = await admin.from('atlas_wireless_line_claims')
        .insert({
          org_id: orgId,
          submitted_by: userId,
          e164,
          status: 'pending_verification',
          ownership_asserted_at: new Date().toISOString()
        })
        .select('id,e164,status,created_at')
        .single();

      if (error?.code === '23505') throw new IntakeError('line_claim_already_exists', 409);
      if (error || !data) throw new IntakeError('claim_store_unavailable', 503);

      return json(req, { ok: true, claim: publicClaim(data) }, 201);
    }
    throw new IntakeError('method_not_allowed', 405);
  } catch (error) {
    const known = error instanceof IntakeError ? error : new IntakeError('internal_error', 500);
    return json(req, { ok: false, error: known.code }, known.status);
  }
});
