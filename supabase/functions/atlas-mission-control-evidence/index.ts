import { createClient } from 'npm:@supabase/supabase-js@2';

// This endpoint is deliberately fail-closed until a trustworthy, tenant-scoped
// evidence source and release-gate verifier are integrated and tested.
const url = Deno.env.get('SUPABASE_URL') || '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
const origins = new Set(['https://atlasenterprisesuite.com', 'https://www.atlasenterprisesuite.com', 'http://localhost:5173', 'http://127.0.0.1:5173']);
function respond(req: Request, status: number, payload: Record<string, unknown>) {
  const origin = req.headers.get('origin') || '';
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'vary': 'Origin',
      'x-content-type-options': 'nosniff',
      ...(origins.has(origin) ? { 'access-control-allow-origin': origin } : {}),
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'authorization, apikey, content-type'
    }
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return respond(req, 204, {});
  if (req.method !== 'GET') return respond(req, 405, { error: 'method_not_allowed' });
  const match = /^Bearer\s+([^\s]+)$/i.exec(req.headers.get('authorization') || '');
  if (!match) return respond(req, 401, { error: 'authentication_required' });
  if (!url || !anonKey) return respond(req, 503, { error: 'identity_service_unavailable' });

  try {
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${match[1]}` } }
    });
    const { data: auth, error: authError } = await client.auth.getUser(match[1]);
    if (authError || !auth.user) return respond(req, 401, { error: 'invalid_session' });

    // Never accept org_id, role or capabilities from the caller.
    // Require a server-queried active membership, then restrict to admins.
    const { data: memberships, error: membershipError } = await client
      .from('organization_members')
      .select('org_id,role,status')
      .eq('user_id', auth.user.id)
      .eq('status', 'active')
      .limit(2);
    if (membershipError) return respond(req, 503, { error: 'membership_verification_unavailable' });
    if (!memberships?.length || memberships.length !== 1 ||
        !['owner', 'admin'].includes(String(memberships[0].role))) {
      return respond(req, 403, { error: 'evidence_access_denied' });
    }

    // No GitHub evidence is fetched or asserted here. Do not return verified=true
    // until permission-scoped provenance, freshness, CI and E2E are independently proven.
    return respond(req, 503, {
      verified: false,
      authorization: 'granted',
      observed_at: null,
      gates: [],
      error: 'trusted_evidence_source_not_configured'
    });
  } catch {
    return respond(req, 503, { error: 'authorization_verification_unavailable' });
  }
});
