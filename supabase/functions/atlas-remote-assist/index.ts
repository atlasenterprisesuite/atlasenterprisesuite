import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

const URL = Deno.env.get('SUPABASE_URL') || '';
const PUBLISHABLE = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const MAX_REQUEST_BYTES = 2048;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA256 = /^[a-f0-9]{64}$/;
const PRIVILEGED_ROLES = ['owner', 'admin', 'platform_admin'];
const OPERATIONS = ['create', 'join', 'approve', 'answer', 'activate', 'status', 'stop'];
const ALLOWED_ORIGINS = new Set([
  'https://atlasenterprisesuite.com',
  'https://www.atlasenterprisesuite.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);

class RemoteAssistError extends Error {
  constructor(readonly code: string, readonly status: number) { super(code); }
}

function headers(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    ...(ALLOWED_ORIGINS.has(origin) ? { 'access-control-allow-origin': origin } : {}),
    'access-control-allow-headers': 'authorization, apikey, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    'vary': 'Origin'
  };
}
function reply(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: headers(req) });
}
function adminClient() {
  if (!URL || !SERVICE_ROLE) throw new RemoteAssistError('remote_assist_server_unconfigured', 503);
  return createClient(URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });
}
async function authenticatedActor(req: Request, orgId: string) {
  if (!URL || !PUBLISHABLE) throw new RemoteAssistError('auth_not_configured', 503);
  const authorization = req.headers.get('authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  if (!token) throw new RemoteAssistError('authentication_required', 401);
  const sb = createClient(URL, PUBLISHABLE, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw new RemoteAssistError('session_invalid', 401);
  const { data: membership, error: memberError } = await sb.from('organization_members')
    .select('org_id,role,status')
    .eq('user_id', data.user.id)
    .eq('org_id', orgId)
    .eq('status', 'active')
    .maybeSingle();
  if (memberError || !membership || !PRIVILEGED_ROLES.includes(String(membership.role))) {
    throw new RemoteAssistError('remote_assist_membership_denied', 403);
  }
  return data.user.id;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(req) });
  if (req.method !== 'POST') return reply(req, { ok: false, error: 'method_not_allowed' }, 405);
  try {
    const requestSize = Number(req.headers.get('content-length') || 0);
    if (requestSize > MAX_REQUEST_BYTES) throw new RemoteAssistError('request_too_large', 413);
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) {
      throw new RemoteAssistError('request_too_large', 413);
    }
    let input: Record<string, unknown>;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      input = parsed;
    } catch {
      throw new RemoteAssistError('invalid_json', 400);
    }
    const action = typeof input.action === 'string' ? input.action : '';
    const orgId = typeof input.organization_id === 'string' ? input.organization_id : '';
    const sessionId = typeof input.session_id === 'string' ? input.session_id : '';
    const digest = typeof input.digest === 'string' ? input.digest : null;
    if (!OPERATIONS.includes(action) || !UUID.test(orgId) || !UUID.test(sessionId)) {
      throw new RemoteAssistError('invalid_remote_assist_request', 422);
    }
    if (digest !== null && !SHA256.test(digest)) {
      throw new RemoteAssistError('invalid_sdp_digest', 422);
    }
    if (['create', 'join', 'answer', 'activate'].includes(action) && !digest) {
      throw new RemoteAssistError('digest_required', 422);
    }
    const actorId = await authenticatedActor(req, orgId);
    const { data, error } = await adminClient().rpc('atlas_remote_assist_event', {
      p_action: action,
      p_org_id: orgId,
      p_actor_id: actorId,
      p_session_id: sessionId,
      p_digest: digest
    });
    if (error || !data || typeof data !== 'object') {
      // Do not expose database metadata, session hashes or other participant details.
      throw new RemoteAssistError('remote_assist_operation_denied_or_unavailable', 403);
    }
    return reply(req, {
      ok: true, room: data, actor_id: actorId,
      role: data.host_user_id === actorId ? 'host' : data.viewer_user_id === actorId ? 'viewer' : null
    });
  } catch (cause) {
    const status = cause instanceof RemoteAssistError ? cause.status : 500;
    const code = cause instanceof RemoteAssistError ? cause.code : 'remote_assist_unavailable';
    return reply(req, { ok: false, error: code }, status);
  }
});
