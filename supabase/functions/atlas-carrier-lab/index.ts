import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import { runCarrierLab, type CarrierLabRequest } from '../_shared/carrier-lab.ts';

const URL = Deno.env.get('SUPABASE_URL') || '';
const KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
const ORIGINS = new Set(['https://atlasenterprisesuite.com', 'https://www.atlasenterprisesuite.com']);

function reply(req: Request, body: unknown, status = 200) {
  const origin = req.headers.get('origin');
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...(origin && ORIGINS.has(origin) ? {
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'authorization, apikey, content-type, x-atlas-org-id',
        vary: 'Origin'
      } : {})
    }
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return reply(req, {}, 204);
  if (req.method !== 'POST') return reply(req, { error: 'method_not_allowed' }, 405);
  if (!URL || !KEY) return reply(req, { error: 'runtime_not_configured' }, 503);
  const bearer = req.headers.get('authorization') || '';
  const token = bearer.replace(/^Bearer\s+/i, '');
  if (!token || token === bearer) return reply(req, { error: 'authentication_required' }, 401);
  const sb = createClient(URL, KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: bearer } }
  });
  const { data: auth, error: authError } = await sb.auth.getUser(token);
  if (authError || !auth.user) return reply(req, { error: 'invalid_session' }, 401);
  const orgId = (req.headers.get('x-atlas-org-id') || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(orgId)) return reply(req, { error: 'organization_required' }, 403);
  const { data: member, error: memberError } = await sb.from('organization_members')
    .select('org_id').eq('org_id', orgId).eq('user_id', auth.user.id).eq('status', 'active').maybeSingle();
  if (memberError || !member) return reply(req, { error: 'active_membership_required' }, 403);
  const { data: allowed, error: permissionError } = await sb.rpc('has_identity_permission', {
    o: orgId, p: 'wireless.mvno.admin'
  });
  if (permissionError || allowed !== true) return reply(req, { error: 'authorization_denied' }, 403);
  let payload: Partial<CarrierLabRequest>;
  try {
    const raw = await req.text();
    if (raw.length > 2048) return reply(req, { error: 'payload_too_large' }, 413);
    payload = JSON.parse(raw) as Partial<CarrierLabRequest>;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return reply(req, { error: 'invalid_payload' }, 400);
    }
  } catch {
    return reply(req, { error: 'invalid_json' }, 400);
  }
  try {
    const report = runCarrierLab({
      organizationId: orgId,
      actorId: auth.user.id,
      count: payload.count as number,
      seed: payload.seed as number,
      channel: payload.channel as CarrierLabRequest['channel'],
      scenario: payload.scenario as CarrierLabRequest['scenario']
    });
    // No side effects, carrier mutations, number allocation or live media.
    return reply(req, { ok: true, ...report });
  } catch {
    return reply(req, { error: 'invalid_lab_request' }, 400);
  }
});
