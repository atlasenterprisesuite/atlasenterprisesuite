import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import { handleBioScan } from './bioscan.ts';

const URL = Deno.env.get('SUPABASE_URL')!;
const PUBLISHABLE_KEYS = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}');
const PUBLISHABLE = PUBLISHABLE_KEYS.default || Deno.env.get('SUPABASE_ANON_KEY') || '';
const SECRET_KEYS = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
const SECRET = SECRET_KEYS.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const VERSION = 2;

const URBAN_TWIN_ENTITY_TYPES = ['district','site','building','floor','space','asset','infrastructure'] as const;
const URBAN_TWIN_BINDING_TYPES = ['cleanscan','device','gps','work','sensor','network','facility'] as const;
type UrbanTwinEntityType = (typeof URBAN_TWIN_ENTITY_TYPES)[number];
type UrbanTwinContext = { sb: ReturnType<typeof createClient>; userId: string; orgId: string; role: string };
const URBAN_TWIN_PARENT_TYPES: Record<UrbanTwinEntityType, UrbanTwinEntityType[]> = {
  district: [],
  site: ['district'],
  building: ['district','site'],
  floor: ['building'],
  space: ['building','floor'],
  asset: ['site','building','floor','space'],
  infrastructure: ['district','site']
};
const URBAN_TWIN_ALLOWED_ORIGINS = new Set([
  'https://atlasenterprisesuite.com',
  'https://www.atlasenterprisesuite.com'
]);


const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const fail = (error: string, status = 400) => json({ ok: false, error }, status);

function userClient(req: Request) {
  const auth = req.headers.get('authorization') || '';
  return createClient(URL, PUBLISHABLE, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: auth } } });
}
function adminClient() {
  if (!SECRET) throw new Error('server_secret_not_configured');
  return createClient(URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function actor(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('authentication_required');
  const sb = userClient(req);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw new Error('invalid_session');
  return { sb, user: data.user };
}
async function permitted(sb: ReturnType<typeof createClient>, orgId: string, permission: string) {
  const { data, error } = await sb.rpc('has_identity_permission', { o: orgId, p: permission });
  if (error) throw new Error('permission_check_failed');
  return data === true;
}
async function audit(orgId: string | null, userId: string | null, action: string, table: string, recordId: string | null, payload: Record<string, unknown> = {}) {
  const admin = adminClient();
  await admin.from('audit_logs').insert({ org_id: orgId, user_id: userId, action, table_name: table, record_id: recordId, new_data: payload });
}
function validateEndpoint(endpoint: unknown) {
  if (endpoint == null || endpoint === '') return null;
  const u = new URL(String(endpoint));
  if (u.protocol !== 'https:' || u.username || u.password || u.pathname !== '/' || u.search || u.hash) throw new Error('invalid_provider_endpoint');
  return u.origin;
}
function validateIntegration(input: any) {
  const kinds = new Set(['oauth2','oidc','service_jwt','signed_token','password']);
  const states = new Set(['unconfigured','authorizing','connected','degraded','expired','revoked','error']);
  if (!kinds.has(input.auth_kind)) throw new Error('invalid_auth_kind');
  if (input.auth_kind === 'password' && !input.legacy_auth_exception) throw new Error('legacy_auth_not_approved');
  if (input.state && !states.has(input.state)) throw new Error('invalid_connection_state');
  if (input.state === 'connected' && !(input.authorized === true && input.provider_verified === true)) throw new Error('provider_verification_required');
  return { ...input, endpoint_origin: validateEndpoint(input.endpoint_origin) };
}

async function integrationUpsert(req: Request, body: any) {
  const { sb, user } = await actor(req);
  if (!body.org_id || !await permitted(sb, body.org_id, 'integrations.write')) return fail('permission_denied', 403);
  let v: any; try { v = validateIntegration(body); } catch (e) { return fail((e as Error).message, 422); }
  const row = {
    org_id: v.org_id, provider: String(v.provider || ''), connection_name: String(v.connection_name || 'default'), auth_kind: v.auth_kind,
    legacy_auth_exception: v.legacy_auth_exception || null, endpoint_origin: v.endpoint_origin, authorized: Boolean(v.authorized), provider_verified: Boolean(v.provider_verified),
    state: v.state || 'unconfigured', secret_ref: v.secret_ref ? String(v.secret_ref) : null, metadata: v.metadata && typeof v.metadata === 'object' ? v.metadata : {},
    created_by: user.id, updated_by: user.id
  };
  if (!row.provider) return fail('provider_required', 422);
  const { data, error } = await sb.from('atlas_integration_connections').upsert(row, { onConflict: 'org_id,provider,connection_name' }).select('id,org_id,provider,connection_name,auth_kind,endpoint_origin,authorized,provider_verified,state,metadata,created_at,updated_at').single();
  if (error) return fail(error.message, 400);
  await audit(row.org_id, user.id, 'integration.upsert', 'atlas_integration_connections', data.id, { provider: row.provider, state: row.state, authorized: row.authorized, provider_verified: row.provider_verified });
  return json({ ok: true, connection: data });
}

async function agentCreate(req: Request, body: any) {
  const { sb, user } = await actor(req);
  if (!body.org_id || !await permitted(sb, body.org_id, 'agents.write')) return fail('permission_denied', 403);
  const row = {
    org_id: body.org_id, agent_key: String(body.agent_key || ''), version_key: String(body.version_key || ''), parent_version_id: body.parent_version_id || null,
    status: 'draft', provider: String(body.provider || ''), model: String(body.model || ''), core_instructions: String(body.core_instructions || ''),
    permissions: Array.isArray(body.permissions) ? body.permissions.map(String) : [], tools: Array.isArray(body.tools) ? body.tools.map(String) : [], safety_rules: Array.isArray(body.safety_rules) ? body.safety_rules.map(String) : [],
    channel_instructions: body.channel_instructions && typeof body.channel_instructions === 'object' ? body.channel_instructions : {}, created_by: user.id
  };
  if (!row.agent_key || !row.version_key || !row.provider || !row.model || !row.core_instructions) return fail('agent_fields_required', 422);
  const { data, error } = await sb.from('atlas_agent_versions').insert(row).select('*').single();
  if (error) return fail(error.message, 400);
  await audit(row.org_id, user.id, 'agent.draft.created', 'atlas_agent_versions', data.id, { agent_key: row.agent_key, version_key: row.version_key, provider: row.provider, model: row.model });
  return json({ ok: true, version: data }, 201);
}

async function agentTransition(req: Request, body: any) {
  const { sb, user } = await actor(req);
  const { data: current, error: readError } = await sb.from('atlas_agent_versions').select('id,org_id,status,agent_key,version_key').eq('id', body.id).single();
  if (readError || !current) return fail('agent_version_not_found', 404);
  const target = String(body.status || '');
  if (target === 'published' && !await permitted(sb, current.org_id, 'agents.publish')) return fail('permission_denied', 403);
  if (target !== 'published' && !await permitted(sb, current.org_id, 'agents.write')) return fail('permission_denied', 403);
  const { data, error } = await sb.from('atlas_agent_versions').update({ status: target }).eq('id', current.id).select('*').single();
  if (error) return fail(error.message, 409);
  await audit(current.org_id, user.id, `agent.status.${target}`, 'atlas_agent_versions', current.id, { agent_key: current.agent_key, version_key: current.version_key, from: current.status, to: target });
  return json({ ok: true, version: data });
}

async function voiceCreate(req: Request, body: any) {
  const { sb, user } = await actor(req);
  if (!body.org_id || !await permitted(sb, body.org_id, 'voice.personal.create')) return fail('permission_denied', 403);
  const row = { org_id: body.org_id, owner_user_id: user.id, name: String(body.name || ''), language: String(body.language || ''), provider_kind: body.provider_kind || 'atlas', capabilities: body.capabilities && typeof body.capabilities === 'object' ? body.capabilities : {} };
  if (!row.name || !row.language) return fail('voice_fields_required', 422);
  const { data, error } = await sb.from('atlas_voice_profiles').insert(row).select('*').single();
  if (error) return fail(error.message, 400);
  await audit(row.org_id, user.id, 'voice.profile.created', 'atlas_voice_profiles', data.id, { provider_kind: row.provider_kind, language: row.language });
  return json({ ok: true, profile: data }, 201);
}

async function voiceRecordingState(req: Request, body: any) {
  const { sb, user } = await actor(req);
  const { data: profile, error } = await sb.from('atlas_voice_profiles').select('id,org_id,owner_user_id,status,capabilities').eq('id', body.id).single();
  if (error || !profile) return fail('voice_profile_not_found', 404);
  if (profile.owner_user_id !== user.id || !await permitted(sb, profile.org_id, 'voice.personal.record')) return fail('permission_denied', 403);
  const supported = Boolean(profile.capabilities?.recording ?? profile.capabilities?.audioExport ?? true);
  if (!supported) return fail('recording_unsupported', 409);
  if (body.consent_satisfied !== true) return fail('consent_required', 409);
  if (body.runtime_confirmed_recording !== true) return fail('runtime_confirmation_required', 409);
  const { data, error: updateError } = await sb.from('atlas_voice_profiles').update({ status: 'recording', updated_at: new Date().toISOString() }).eq('id', profile.id).select('*').single();
  if (updateError) return fail(updateError.message, 409);
  await audit(profile.org_id, user.id, 'voice.recording.confirmed', 'atlas_voice_profiles', profile.id, { previous_status: profile.status, runtime_confirmed: true, consent_satisfied: true });
  return json({ ok: true, profile: data });
}

async function voiceDelete(req: Request, body: any) {
  const { sb, user } = await actor(req);
  const { data: profile, error } = await sb.from('atlas_voice_profiles').select('id,org_id,owner_user_id,provider_ref,status').eq('id', body.id).single();
  if (error || !profile) return fail('voice_profile_not_found', 404);
  if (profile.owner_user_id !== user.id || !await permitted(sb, profile.org_id, 'voice.personal.delete')) return fail('permission_denied', 403);
  const externalCleanup = Boolean(profile.provider_ref);
  const { error: grantsError } = await sb.from('atlas_voice_permission_grants').delete().eq('profile_id', profile.id);
  if (grantsError) return fail(grantsError.message, 409);
  const { data, error: updateError } = await sb.from('atlas_voice_profiles').update({ status: 'deleted', external_cleanup_required: externalCleanup, updated_at: new Date().toISOString() }).eq('id', profile.id).select('id,org_id,status,external_cleanup_required,updated_at').single();
  if (updateError) return fail(updateError.message, 409);
  await audit(profile.org_id, user.id, 'voice.profile.deleted', 'atlas_voice_profiles', profile.id, { local_status: 'deleted', external_cleanup_required: externalCleanup });
  return json({ ok: true, profile: data });
}

async function transcriptCreate(req: Request, body: any) {
  const { sb, user } = await actor(req);
  const { data: profile, error } = await sb.from('atlas_voice_profiles').select('id,org_id,owner_user_id').eq('id', body.profile_id).single();
  if (error || !profile) return fail('voice_profile_not_found', 404);
  if (profile.owner_user_id !== user.id || !await permitted(sb, profile.org_id, 'voice.personal.record')) return fail('permission_denied', 403);
  const row = { org_id: profile.org_id, profile_id: profile.id, session_id: String(body.session_id || ''), source_kind: body.source_kind, source_id: String(body.source_id || ''), completeness: body.completeness, content: String(body.content || ''), recording_ref: body.recording_ref || null, source_started_at: body.source_started_at || null, source_ended_at: body.source_ended_at || null, created_by: user.id };
  if (!row.session_id || !row.source_id || !row.content) return fail('transcript_fields_required', 422);
  const { data, error: insertError } = await sb.from('atlas_voice_transcripts').insert(row).select('id,org_id,profile_id,session_id,source_kind,source_id,completeness,recording_ref,source_started_at,source_ended_at,generated_at').single();
  if (insertError) return fail(insertError.message, 400);
  await audit(profile.org_id, user.id, 'voice.transcript.created', 'atlas_voice_transcripts', data.id, { profile_id: profile.id, session_id: row.session_id, source_kind: row.source_kind, completeness: row.completeness });
  return json({ ok: true, transcript: data }, 201);
}


function urbanTwinCors(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin || !URBAN_TWIN_ALLOWED_ORIGINS.has(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, apikey, content-type, x-atlas-org-id',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-max-age': '86400',
    vary: 'Origin'
  };
}
function urbanTwinJson(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, ...urbanTwinCors(req) }
  });
}
function urbanTwinFail(req: Request, error: string, status = 400, details: Record<string, unknown> = {}) {
  return urbanTwinJson(req, { ok: false, error, ...details }, status);
}
function urbanTwinClean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}
function urbanTwinUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function urbanTwinEvidence(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => urbanTwinClean(item, 1000))
    .filter(Boolean)
    .filter((item) => !/(authorization:|bearer\s+|password\s*=|secret\s*=|service[_-]?role|sk-[a-z0-9_-]{8,})/i.test(item))
    .slice(0, 20);
}
async function urbanTwinContext(req: Request): Promise<UrbanTwinContext> {
  const { sb, user } = await actor(req);
  const requestedOrg = urbanTwinClean(req.headers.get('x-atlas-org-id'), 80);
  if (!requestedOrg || !urbanTwinUuid(requestedOrg)) throw new Error('invalid_organization');
  const { data, error } = await sb
    .from('organization_members')
    .select('org_id,role,status')
    .eq('org_id', requestedOrg)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (error || !data) throw new Error('organization_membership_required');
  return { sb, userId: user.id, orgId: requestedOrg, role: String(data.role || 'member') };
}
async function urbanTwinPermission(ctx: UrbanTwinContext, permission: string) {
  if (!await permitted(ctx.sb, ctx.orgId, permission)) throw new Error('permission_denied');
}
async function urbanTwinAudit(ctx: UrbanTwinContext, action: string, table: string, recordId: string | null, payload: Record<string, unknown>) {
  try { await audit(ctx.orgId, ctx.userId, action, table, recordId, payload); } catch { /* state is not promoted by audit failure */ }
}
async function urbanTwinEnsureParent(ctx: UrbanTwinContext, entityType: UrbanTwinEntityType, parentId: string | null) {
  if (!parentId) return null;
  if (!urbanTwinUuid(parentId)) throw new Error('invalid_parent_id');
  const allowed = URBAN_TWIN_PARENT_TYPES[entityType];
  if (!allowed.length) throw new Error('parent_not_allowed');
  const { data, error } = await adminClient()
    .from('atlas_urban_twin_entities')
    .select('id,entity_type')
    .eq('id', parentId)
    .eq('org_id', ctx.orgId)
    .maybeSingle();
  if (error || !data) throw new Error('parent_not_found');
  if (!allowed.includes(String(data.entity_type) as UrbanTwinEntityType)) throw new Error('invalid_parent_type');
  return data;
}
async function urbanTwinCapabilities(req: Request, ctx: UrbanTwinContext) {
  const [canManage, canVerify] = await Promise.all([
    permitted(ctx.sb, ctx.orgId, 'city.twin.manage'),
    permitted(ctx.sb, ctx.orgId, 'city.twin.verify')
  ]);
  return urbanTwinJson(req, { ok: true, service: 'atlas-platform-controls', domain: 'urban-twin', can_manage: canManage, can_verify: canVerify, role: ctx.role });
}
async function urbanTwinCreateEntity(req: Request, ctx: UrbanTwinContext, body: any) {
  await urbanTwinPermission(ctx, 'city.twin.manage');
  const entityType = urbanTwinClean(body.entity_type, 40) as UrbanTwinEntityType;
  const name = urbanTwinClean(body.name, 180);
  const parentId = urbanTwinClean(body.parent_id, 80) || null;
  const externalRef = urbanTwinClean(body.external_ref, 240) || null;
  const latRaw = body.latitude;
  const lngRaw = body.longitude;
  const latitude = latRaw === null || latRaw === undefined || latRaw === '' ? null : Number(latRaw);
  const longitude = lngRaw === null || lngRaw === undefined || lngRaw === '' ? null : Number(lngRaw);
  if (!URBAN_TWIN_ENTITY_TYPES.includes(entityType)) return urbanTwinFail(req, 'invalid_entity_type', 422);
  if (!name) return urbanTwinFail(req, 'entity_name_required', 422);
  if ((latitude === null) !== (longitude === null)) return urbanTwinFail(req, 'coordinate_pair_required', 422);
  if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) return urbanTwinFail(req, 'invalid_latitude', 422);
  if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) return urbanTwinFail(req, 'invalid_longitude', 422);
  await urbanTwinEnsureParent(ctx, entityType, parentId);
  const { data, error } = await adminClient()
    .from('atlas_urban_twin_entities')
    .insert({
      tenant_id: ctx.orgId, org_id: ctx.orgId, parent_id: parentId, entity_type: entityType,
      name, external_ref: externalRef, source_kind: 'manual', lifecycle_state: 'planned',
      verification_state: 'unverified', latitude, longitude, created_by: ctx.userId
    })
    .select('id,parent_id,entity_type,name,external_ref,source_kind,lifecycle_state,verification_state,latitude,longitude,created_at,updated_at')
    .single();
  if (error || !data) return urbanTwinFail(req, 'entity_create_failed', 503);
  await urbanTwinAudit(ctx, 'city.twin.entity.registered', 'atlas_urban_twin_entities', data.id, { entity_type: entityType, parent_id: parentId, coordinates_supplied: latitude !== null });
  return urbanTwinJson(req, { ok: true, entity: data }, 201);
}
async function urbanTwinCreateBinding(req: Request, ctx: UrbanTwinContext, body: any) {
  await urbanTwinPermission(ctx, 'city.twin.manage');
  const entityId = urbanTwinClean(body.entity_id, 80);
  const bindingType = urbanTwinClean(body.binding_type, 40);
  const adapter = urbanTwinClean(body.adapter, 120);
  const externalRef = urbanTwinClean(body.external_ref, 240);
  if (!urbanTwinUuid(entityId)) return urbanTwinFail(req, 'invalid_entity_id', 422);
  if (!URBAN_TWIN_BINDING_TYPES.includes(bindingType as typeof URBAN_TWIN_BINDING_TYPES[number])) return urbanTwinFail(req, 'invalid_binding_type', 422);
  if (!adapter || !externalRef) return urbanTwinFail(req, 'adapter_and_external_ref_required', 422);
  const admin = adminClient();
  const { data: entity } = await admin.from('atlas_urban_twin_entities').select('id').eq('id', entityId).eq('org_id', ctx.orgId).maybeSingle();
  if (!entity) return urbanTwinFail(req, 'entity_not_found', 404);
  const { data, error } = await admin
    .from('atlas_urban_twin_bindings')
    .insert({ tenant_id: ctx.orgId, org_id: ctx.orgId, entity_id: entityId, binding_type: bindingType, adapter, external_ref: externalRef, verification_state: 'unverified', created_by: ctx.userId })
    .select('id,entity_id,binding_type,adapter,external_ref,verification_state,evidence_refs,created_at,updated_at')
    .single();
  if (error || !data) return urbanTwinFail(req, String(error?.code || '') === '23505' ? 'binding_already_exists' : 'binding_create_failed', String(error?.code || '') === '23505' ? 409 : 503);
  await urbanTwinAudit(ctx, 'city.twin.binding.registered', 'atlas_urban_twin_bindings', data.id, { entity_id: entityId, binding_type: bindingType, adapter });
  return urbanTwinJson(req, { ok: true, binding: data }, 201);
}
async function urbanTwinVerify(req: Request, ctx: UrbanTwinContext, body: any) {
  await urbanTwinPermission(ctx, 'city.twin.verify');
  const targetType = urbanTwinClean(body.target_type, 20);
  const targetId = urbanTwinClean(body.target_id, 80);
  const evidence = urbanTwinEvidence(body.evidence_refs);
  if (!['entity','binding'].includes(targetType)) return urbanTwinFail(req, 'invalid_target_type', 422);
  if (!urbanTwinUuid(targetId)) return urbanTwinFail(req, 'invalid_target_id', 422);
  if (!evidence.length) return urbanTwinFail(req, 'verification_evidence_required', 422);
  const now = new Date().toISOString();
  const admin = adminClient();
  if (targetType === 'entity') {
    const { data, error } = await admin.from('atlas_urban_twin_entities')
      .update({ verification_state: 'verified', verification_evidence_refs: evidence, verified_by: ctx.userId, verified_at: now, last_verified_at: now })
      .eq('id', targetId).eq('org_id', ctx.orgId).neq('verification_state', 'revoked')
      .select('id,name,entity_type,verification_state,verified_at,last_verified_at').maybeSingle();
    if (error || !data) return urbanTwinFail(req, 'entity_verify_failed', 409);
    await urbanTwinAudit(ctx, 'city.twin.entity.verified', 'atlas_urban_twin_entities', targetId, { evidence_count: evidence.length, verification_method: 'manual_evidence_review' });
    return urbanTwinJson(req, { ok: true, target: data });
  }
  const { data, error } = await admin.from('atlas_urban_twin_bindings')
    .update({ verification_state: 'verified', evidence_refs: evidence, verified_by: ctx.userId, verified_at: now, last_verified_at: now })
    .eq('id', targetId).eq('org_id', ctx.orgId).neq('verification_state', 'revoked')
    .select('id,entity_id,binding_type,adapter,external_ref,verification_state,verified_at,last_verified_at').maybeSingle();
  if (error || !data) return urbanTwinFail(req, 'binding_verify_failed', 409);
  await urbanTwinAudit(ctx, 'city.twin.binding.verified', 'atlas_urban_twin_bindings', targetId, { evidence_count: evidence.length, verification_method: 'manual_evidence_review' });
  return urbanTwinJson(req, { ok: true, target: data });
}
async function handleUrbanTwin(req: Request, api: string) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: urbanTwinCors(req) });
  try {
    const ctx = await urbanTwinContext(req);
    if (req.method === 'GET' && api === 'urban-twin-capabilities') return await urbanTwinCapabilities(req, ctx);
    if (req.method !== 'POST') return urbanTwinFail(req, 'method_not_allowed', 405);
    let body: any = {};
    try { body = await req.json(); } catch { return urbanTwinFail(req, 'invalid_json', 400); }
    if (api === 'urban-twin-entity') return await urbanTwinCreateEntity(req, ctx, body);
    if (api === 'urban-twin-binding') return await urbanTwinCreateBinding(req, ctx, body);
    if (api === 'urban-twin-verify') return await urbanTwinVerify(req, ctx, body);
    return urbanTwinFail(req, 'not_found', 404);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'internal_error';
    const status = message.includes('auth') || message.includes('session') ? 401
      : message.includes('permission') || message.includes('membership') ? 403
      : message.startsWith('invalid_') ? 422
      : message.endsWith('_not_found') ? 404
      : 500;
    return urbanTwinFail(req, message, status);
  }
}

Deno.serve(async (req: Request) => {
  const u = new URL(req.url);
  const api = u.searchParams.get('api');
  if ((api || '').startsWith('bioscan-v1-')) return await handleBioScan(req, api || '', { actor, permitted, audit, adminClient });
  if ((api || '').startsWith('urban-twin-')) return await handleUrbanTwin(req, api || '');
  if (req.method === 'GET' && api === 'readiness') return json({ ok: true, service: 'atlas-platform-controls', version: VERSION, source_of_runtime_truth: 'supabase', github_required: false, domains: ['integrations','agents','voice','urban-twin','bioscan'], checked_at: new Date().toISOString() });
  if (req.method !== 'POST') return fail('method_not_allowed', 405);
  let body: any = {}; try { body = await req.json(); } catch { return fail('invalid_json', 400); }
  try {
    if (api === 'integration-upsert') return await integrationUpsert(req, body);
    if (api === 'agent-create') return await agentCreate(req, body);
    if (api === 'agent-transition') return await agentTransition(req, body);
    if (api === 'voice-create') return await voiceCreate(req, body);
    if (api === 'voice-recording-confirm') return await voiceRecordingState(req, body);
    if (api === 'voice-delete') return await voiceDelete(req, body);
    if (api === 'transcript-create') return await transcriptCreate(req, body);
    return fail('not_found', 404);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'internal_error';
    return fail(message, message.includes('auth') || message.includes('session') ? 401 : 500);
  }
});