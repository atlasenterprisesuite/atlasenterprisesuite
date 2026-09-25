import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import {
  evaluateAtlasOwnedNetworkReadiness,
  type AtlasWirelessComponentReadiness,
  type AtlasWirelessEvidenceRef,
  type AtlasWirelessNetworkMode
} from '../_shared/atlas-wireless-network.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const PUBLISHABLE_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ||
  Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ||
  '';

const ALLOWED_ORIGINS = new Set([
  'https://atlasenterprisesuite.com',
  'https://www.atlasenterprisesuite.com'
]);

type RequestContext = {
  userId: string;
  orgId: string;
  role: string;
};

class NetworkError extends Error {
  constructor(readonly code: string, readonly status = 400) {
    super(code);
  }
}

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, apikey, content-type, x-atlas-org-id',
    'access-control-allow-methods': 'GET, OPTIONS',
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
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) throw new NetworkError('supabase_runtime_not_configured', 503);

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new NetworkError('authentication_required', 401);

  const sb = userClient(req);
  const { data: authData, error: authError } = await sb.auth.getUser(token);
  if (authError || !authData.user) throw new NetworkError('invalid_session', 401);

  const requestedOrg = (req.headers.get('x-atlas-org-id') || '').trim();
  let query = sb
    .from('organization_members')
    .select('org_id,role,status')
    .eq('user_id', authData.user.id)
    .eq('status', 'active');

  if (requestedOrg) query = query.eq('org_id', requestedOrg);

  const { data, error } = await query.limit(1);
  if (error || !data?.[0]?.org_id) throw new NetworkError('active_organization_required', 403);

  return {
    userId: authData.user.id,
    orgId: String(data[0].org_id),
    role: String(data[0].role || 'member')
  };
}

async function requireReadPermission(req: Request, ctx: RequestContext) {
  const sb = userClient(req);
  const { data, error } = await sb.rpc('has_identity_permission', {
    o: ctx.orgId,
    p: 'wireless.network.read'
  });
  if (error || data !== true) throw new NetworkError('authorization_denied', 403);
}

function normalizeEvidence(orgId: string, value: unknown): AtlasWirelessEvidenceRef[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const source = item as Record<string, unknown>;
    const organizationId = String(source.organizationId || '');
    const reference = String(source.reference || '').trim();
    if (organizationId !== orgId || !reference) return [];
    return [{ organizationId, reference }];
  });
}

function normalizeComponent(
  orgId: string,
  row: Record<string, unknown>
): AtlasWirelessComponentReadiness {
  return {
    organizationId: orgId,
    layer: String(row.layer) as AtlasWirelessComponentReadiness['layer'],
    state: String(row.state) as AtlasWirelessComponentReadiness['state'],
    blocker: row.blocker == null ? null : String(row.blocker),
    checkedAt: row.checked_at ? String(row.checked_at) : '',
    evidenceRefs: normalizeEvidence(orgId, row.evidence_refs)
  };
}

async function readInventory(req: Request, ctx: RequestContext) {
  const sb = userClient(req);
  const [profile, components, ranSites, spectrum, backhaul] = await Promise.all([
    sb.from('wireless_network_profiles')
      .select('org_id,network_mode,wholesale_provider_ready,updated_at')
      .eq('org_id', ctx.orgId)
      .maybeSingle(),
    sb.from('wireless_network_components')
      .select('org_id,layer,state,blocker,checked_at,evidence_refs,updated_at')
      .eq('org_id', ctx.orgId)
      .order('layer'),
    sb.from('wireless_ran_sites')
      .select('id,org_id,name,latitude,longitude,radio_technology,spectrum_access,state,evidence_refs,updated_at')
      .eq('org_id', ctx.orgId)
      .order('name'),
    sb.from('wireless_spectrum_authorizations')
      .select('id,org_id,access_model,authority,authorization_reference,sas_provider,state,evidence_refs,updated_at')
      .eq('org_id', ctx.orgId)
      .order('updated_at', { ascending: false }),
    sb.from('wireless_backhaul_links')
      .select('id,org_id,provider,medium,redundant,state,evidence_refs,updated_at')
      .eq('org_id', ctx.orgId)
      .order('updated_at', { ascending: false })
  ]);

  for (const result of [profile, components, ranSites, spectrum, backhaul]) {
    if (result.error) throw new NetworkError('network_inventory_unavailable', 503);
  }

  const profileRow = profile.data;
  const mode = (profileRow?.network_mode || 'atlas-owned') as AtlasWirelessNetworkMode;
  const normalizedComponents = (components.data || []).map((row) =>
    normalizeComponent(ctx.orgId, row as Record<string, unknown>)
  );

  const readiness = evaluateAtlasOwnedNetworkReadiness(
    ctx.orgId,
    mode,
    normalizedComponents,
    {
      wholesaleProviderReady: profileRow?.wholesale_provider_ready === true
    }
  );

  const profileConfigured = Boolean(profileRow);
  const blockers = profileConfigured
    ? readiness.blockers
    : ['network_profile_not_configured', ...readiness.blockers];

  return {
    organization_id: ctx.orgId,
    role: ctx.role,
    service_provider: 'atlas-wireless',
    profile_configured: profileConfigured,
    network_mode: mode,
    lab_ready: profileConfigured && readiness.labReady,
    technical_public_ready: profileConfigured && readiness.technicalPublicReady,
    blockers,
    components: normalizedComponents,
    inventory: {
      ran_sites: ranSites.data || [],
      spectrum_authorizations: spectrum.data || [],
      backhaul_links: backhaul.data || []
    },
    checked_at: new Date().toISOString()
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(req.headers.get('origin'))
    });
  }

  try {
    if (req.method !== 'GET') throw new NetworkError('method_not_allowed', 405);

    const operation = new URL(req.url).searchParams.get('api') || 'readiness';
    if (!['readiness', 'inventory'].includes(operation)) {
      throw new NetworkError('not_found', 404);
    }

    const ctx = await resolveContext(req);
    await requireReadPermission(req, ctx);
    const state = await readInventory(req, ctx);

    if (operation === 'readiness') {
      return json(req, {
        ok: true,
        service: 'atlas-wireless-network',
        organization_id: state.organization_id,
        role: state.role,
        service_provider: state.service_provider,
        profile_configured: state.profile_configured,
        network_mode: state.network_mode,
        lab_ready: state.lab_ready,
        technical_public_ready: state.technical_public_ready,
        blockers: state.blockers,
        components: state.components,
        checked_at: state.checked_at
      });
    }

    return json(req, {
      ok: true,
      service: 'atlas-wireless-network',
      ...state
    });
  } catch (error) {
    const status = error instanceof NetworkError ? error.status : 500;
    const code = error instanceof NetworkError ? error.code : 'internal_error';
    return json(req, { ok: false, error: code }, status);
  }
});
