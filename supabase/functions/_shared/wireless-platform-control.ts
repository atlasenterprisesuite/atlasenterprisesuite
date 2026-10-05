import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import type { MvnoPermission } from './mvno.ts';
import {
  evaluateAtlasOwnedNetworkReadiness,
  type AtlasWirelessComponentReadiness,
  type AtlasWirelessEvidenceRef,
  type AtlasWirelessNetworkMode
} from './atlas-wireless-network.ts';

const URL = Deno.env.get('SUPABASE_URL') || '';
const PUBLISHABLE_KEYS = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}');
const PUBLISHABLE = PUBLISHABLE_KEYS.default || Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
const SECRET_KEYS = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
const SECRET = SECRET_KEYS.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const VERSION = 1;

const MVNO_OPERATIONS = [
  'wireless-mvno-readiness',
  'wireless-mvno-status',
  'wireless-mvno-provision',
  'wireless-mvno-activate',
  'wireless-mvno-suspend',
  'wireless-mvno-reconnect',
  'wireless-mvno-revoke'
] as const;

type MvnoOperation = (typeof MVNO_OPERATIONS)[number];
type MvnoState = 'pending_provider' | 'configured_unverified';
type WirelessContext = { userId: string; orgId: string; role: string };

type NetworkOperation = 'wireless-network-readiness' | 'wireless-network-inventory';

const OPERATION_PERMISSION: Readonly<Record<MvnoOperation, MvnoPermission>> = {
  'wireless-mvno-readiness': 'wireless.mvno.read',
  'wireless-mvno-status': 'wireless.mvno.read',
  'wireless-mvno-provision': 'wireless.mvno.provision',
  'wireless-mvno-activate': 'wireless.mvno.activate',
  'wireless-mvno-suspend': 'wireless.mvno.suspend',
  'wireless-mvno-reconnect': 'wireless.mvno.reconnect',
  'wireless-mvno-revoke': 'wireless.mvno.revoke'
};

const ALLOWED_ORIGINS = new Set([
  'https://atlasenterprisesuite.com',
  'https://www.atlasenterprisesuite.com'
]);

class WirelessControlError extends Error {
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

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
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
      ...corsHeaders(req)
    }
  });
}

function userClient(req: Request) {
  if (!URL || !PUBLISHABLE) throw new WirelessControlError('supabase_runtime_not_configured', 503);
  return createClient(URL, PUBLISHABLE, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: req.headers.get('authorization') || '' } }
  });
}

function adminClient() {
  if (!URL || !SECRET) return null;
  return createClient(URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function resolveContext(req: Request): Promise<WirelessContext> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new WirelessControlError('authentication_required', 401);

  const sb = userClient(req);
  const { data: authData, error: authError } = await sb.auth.getUser(token);
  if (authError || !authData.user) throw new WirelessControlError('invalid_session', 401);

  const requestedOrg = clean(req.headers.get('x-atlas-org-id'), 80);
  let query = sb
    .from('organization_members')
    .select('org_id,role,status')
    .eq('user_id', authData.user.id)
    .eq('status', 'active');
  if (requestedOrg) query = query.eq('org_id', requestedOrg);

  const { data, error } = await query.limit(1);
  if (error || !data?.[0]?.org_id) throw new WirelessControlError('active_organization_required', 403);

  return {
    userId: authData.user.id,
    orgId: String(data[0].org_id),
    role: String(data[0].role || 'member')
  };
}

async function requirePermission(req: Request, ctx: WirelessContext, permission: string) {
  const sb = userClient(req);
  const { data, error } = await sb.rpc('has_identity_permission', { o: ctx.orgId, p: permission });
  if (error || data !== true) throw new WirelessControlError('authorization_denied', 403);
}

function secretName(orgId: string, key: 'provider_id' | 'api_base_url' | 'api_token') {
  return `atlas_wireless:${orgId}:${key}`;
}

async function readServerSecret(admin: ReturnType<typeof createClient>, name: string): Promise<string | null> {
  const { data, error } = await admin.rpc('atlas_get_server_secret', { p_name: name });
  if (error) throw new Error('server_secret_unavailable');
  return typeof data === 'string' && data.trim() ? data.trim() : null;
}

async function providerReadiness(ctx: WirelessContext) {
  const admin = adminClient();
  const emptyCredentials = {
    provider_id_configured: false,
    api_base_url_configured: false,
    api_token_configured: false
  };

  if (!admin) {
    return {
      state: 'pending_provider' as MvnoState,
      blocker: 'server_secret_not_configured',
      provider_verified: false,
      activation_enabled: false,
      credentials: emptyCredentials
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
        state: 'pending_provider' as MvnoState,
        blocker: 'provider_not_configured',
        provider_verified: false,
        activation_enabled: false,
        credentials
      };
    }
    return {
      state: 'configured_unverified' as MvnoState,
      blocker: configuredCount === 3 ? 'provider_adapter_not_verified' : 'provider_configuration_incomplete',
      provider_verified: false,
      activation_enabled: false,
      credentials
    };
  } catch {
    return {
      state: 'pending_provider' as MvnoState,
      blocker: 'provider_configuration_unavailable',
      provider_verified: false,
      activation_enabled: false,
      credentials: emptyCredentials
    };
  }
}

async function auditBlockedOperation(ctx: WirelessContext, operation: MvnoOperation, readiness: Awaited<ReturnType<typeof providerReadiness>>) {
  const admin = adminClient();
  if (!admin) return;
  try {
    await admin.from('audit_logs').insert({
      org_id: ctx.orgId,
      user_id: ctx.userId,
      action: `wireless.mvno.${operation.replace('wireless-mvno-', '')}.blocked`,
      table_name: 'wireless_mvno',
      record_id: null,
      new_data: { state: readiness.state, blocker: readiness.blocker, provider_verified: false }
    });
  } catch {
    // Audit failure must never turn a blocked carrier mutation into an allowed operation.
  }
}

async function handleMvno(req: Request, api: MvnoOperation) {
  const ctx = await resolveContext(req);
  await requirePermission(req, ctx, OPERATION_PERMISSION[api]);
  const readiness = await providerReadiness(ctx);

  if (api === 'wireless-mvno-readiness' && req.method === 'GET') {
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

  if (api === 'wireless-mvno-status' && req.method === 'GET') {
    await auditBlockedOperation(ctx, api, readiness);
    throw new WirelessControlError('provider_not_ready', 503, {
      operation: 'status', state: readiness.state, blocker: readiness.blocker
    });
  }

  if (api !== 'wireless-mvno-readiness' && req.method === 'POST') {
    await auditBlockedOperation(ctx, api, readiness);
    throw new WirelessControlError('provider_not_ready', 503, {
      operation: api.replace('wireless-mvno-', ''), state: readiness.state, blocker: readiness.blocker
    });
  }

  throw new WirelessControlError('method_not_allowed', 405);
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

function normalizeComponent(orgId: string, row: Record<string, unknown>): AtlasWirelessComponentReadiness {
  return {
    organizationId: orgId,
    layer: String(row.layer) as AtlasWirelessComponentReadiness['layer'],
    state: String(row.state) as AtlasWirelessComponentReadiness['state'],
    blocker: row.blocker == null ? null : String(row.blocker),
    checkedAt: row.checked_at ? String(row.checked_at) : '',
    evidenceRefs: normalizeEvidence(orgId, row.evidence_refs)
  };
}

async function readNetworkInventory(req: Request, ctx: WirelessContext) {
  const sb = userClient(req);
  const [profile, components, ranSites, spectrum, backhaul] = await Promise.all([
    sb.from('wireless_network_profiles').select('org_id,network_mode,wholesale_provider_ready,updated_at').eq('org_id', ctx.orgId).maybeSingle(),
    sb.from('wireless_network_components').select('org_id,layer,state,blocker,checked_at,evidence_refs,updated_at').eq('org_id', ctx.orgId).order('layer'),
    sb.from('wireless_ran_sites').select('id,org_id,name,latitude,longitude,radio_technology,spectrum_access,state,evidence_refs,updated_at').eq('org_id', ctx.orgId).order('name'),
    sb.from('wireless_spectrum_authorizations').select('id,org_id,access_model,authority,authorization_reference,sas_provider,state,evidence_refs,updated_at').eq('org_id', ctx.orgId).order('updated_at', { ascending: false }),
    sb.from('wireless_backhaul_links').select('id,org_id,provider,medium,redundant,state,evidence_refs,updated_at').eq('org_id', ctx.orgId).order('updated_at', { ascending: false })
  ]);
  for (const result of [profile, components, ranSites, spectrum, backhaul]) {
    if (result.error) throw new WirelessControlError('network_inventory_unavailable', 503);
  }

  const profileRow = profile.data;
  const mode = (profileRow?.network_mode || 'atlas-owned') as AtlasWirelessNetworkMode;
  const normalizedComponents = (components.data || []).map((row) => normalizeComponent(ctx.orgId, row as Record<string, unknown>));
  const readiness = evaluateAtlasOwnedNetworkReadiness(ctx.orgId, mode, normalizedComponents, {
    wholesaleProviderReady: profileRow?.wholesale_provider_ready === true
  });
  const profileConfigured = Boolean(profileRow);
  const blockers = profileConfigured ? readiness.blockers : ['network_profile_not_configured', ...readiness.blockers];

  return {
    organization_id: ctx.orgId,
    role: ctx.role,
    service_provider: 'atlas-wireless' as const,
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

async function handleNetwork(req: Request, api: NetworkOperation) {
  if (req.method !== 'GET') throw new WirelessControlError('method_not_allowed', 405);
  const ctx = await resolveContext(req);
  await requirePermission(req, ctx, 'wireless.network.read');
  const state = await readNetworkInventory(req, ctx);
  if (api === 'wireless-network-readiness') {
    const { inventory: _inventory, ...readiness } = state;
    return json(req, { ok: true, service: 'atlas-wireless-network', ...readiness });
  }
  return json(req, { ok: true, service: 'atlas-wireless-network', ...state });
}

export function isWirelessPlatformApi(api: string): boolean {
  return MVNO_OPERATIONS.includes(api as MvnoOperation) || api === 'wireless-network-readiness' || api === 'wireless-network-inventory';
}

export async function handleWirelessPlatformRequest(req: Request, api: string): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  try {
    if (MVNO_OPERATIONS.includes(api as MvnoOperation)) return await handleMvno(req, api as MvnoOperation);
    if (api === 'wireless-network-readiness' || api === 'wireless-network-inventory') return await handleNetwork(req, api);
    throw new WirelessControlError('not_found', 404);
  } catch (error) {
    if (error instanceof WirelessControlError) {
      return json(req, { ok: false, error: error.code, ...error.details }, error.status);
    }
    return json(req, { ok: false, error: 'internal_error' }, 500);
  }
}
