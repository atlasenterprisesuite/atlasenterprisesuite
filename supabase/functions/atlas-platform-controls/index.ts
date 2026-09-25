import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

const URL = Deno.env.get('SUPABASE_URL')!;
const PUBLISHABLE_KEYS = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}');
const PUBLISHABLE = PUBLISHABLE_KEYS.default || Deno.env.get('SUPABASE_ANON_KEY') || '';
const SECRET_KEYS = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
const SECRET = SECRET_KEYS.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const VERSION = 2;

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

const WIRELESS_ALLOWED_ORIGINS = new Set([
  'https://atlasenterprisesuite.com',
  'https://www.atlasenterprisesuite.com'
]);
const WIRELESS_MUTATIONS = new Set([
  'wireless-mvno-provision',
  'wireless-mvno-activate',
  'wireless-mvno-suspend',
  'wireless-mvno-reconnect',
  'wireless-mvno-revoke'
]);

function wirelessCors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  if (!origin || !WIRELESS_ALLOWED_ORIGINS.has(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, apikey, content-type, x-atlas-org-id',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-max-age': '86400',
    vary: 'Origin'
  };
}

function wirelessJson(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, ...wirelessCors(req) }
  });
}

function wirelessClean(value: unknown, max = 200) {
  return String(value ?? '').trim().slice(0, max);
}

async function wirelessContext(req: Request) {
  const { sb, user } = await actor(req);
  const requestedOrg = wirelessClean(req.headers.get('x-atlas-org-id'), 80);
  let query = sb
    .from('organization_members')
    .select('org_id,role,status')
    .eq('user_id', user.id)
    .eq('status', 'active');
  if (requestedOrg) query = query.eq('org_id', requestedOrg);

  const { data, error } = await query.limit(1);
  if (error || !data?.[0]?.org_id) throw new Error('active_organization_required');
  return {
    sb,
    user,
    orgId: String(data[0].org_id),
    role: String(data[0].role || 'member')
  };
}

function wirelessSecretName(orgId: string, key: 'provider_id' | 'api_base_url' | 'api_token') {
  return `atlas_wireless:${orgId}:${key}`;
}

async function wirelessServerSecret(name: string) {
  const admin = adminClient();
  const { data, error } = await admin.rpc('atlas_get_server_secret', { p_name: name });
  if (error) throw new Error('server_secret_unavailable');
  return typeof data === 'string' && data.trim() ? data.trim() : null;
}

async function wirelessProviderReadiness(orgId: string) {
  try {
    const [providerId, apiBaseUrl, apiToken] = await Promise.all([
      wirelessServerSecret(wirelessSecretName(orgId, 'provider_id')),
      wirelessServerSecret(wirelessSecretName(orgId, 'api_base_url')),
      wirelessServerSecret(wirelessSecretName(orgId, 'api_token'))
    ]);
    const credentials = {
      provider_id_configured: Boolean(providerId),
      api_base_url_configured: Boolean(apiBaseUrl),
      api_token_configured: Boolean(apiToken)
    };
    const configuredCount = Object.values(credentials).filter(Boolean).length;
    return {
      state: configuredCount === 0 ? 'pending_provider' : 'configured_unverified',
      blocker: configuredCount === 0
        ? 'provider_not_configured'
        : configuredCount === 3
          ? 'provider_adapter_not_verified'
          : 'provider_configuration_incomplete',
      provider_verified: false,
      activation_enabled: false,
      credentials
    };
  } catch {
    return {
      state: 'pending_provider',
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

async function wirelessReadiness(req: Request) {
  try {
    const ctx = await wirelessContext(req);
    const readiness = await wirelessProviderReadiness(ctx.orgId);
    return wirelessJson(req, {
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
  } catch (e) {
    const message = e instanceof Error ? e.message : 'internal_error';
    const status =
      message === 'authentication_required' || message === 'invalid_session' ? 401 :
      message === 'active_organization_required' ? 403 : 503;
    return wirelessJson(req, { ok: false, error: message }, status);
  }
}

async function wirelessBlockedOperation(req: Request, api: string) {
  try {
    const ctx = await wirelessContext(req);
    const operation = api.replace(/^wireless-mvno-/, '');
    if (operation !== 'status' && !await permitted(ctx.sb, ctx.orgId, 'integrations.write')) {
      return wirelessJson(req, { ok: false, error: 'permission_denied' }, 403);
    }
    const readiness = await wirelessProviderReadiness(ctx.orgId);
    try {
      await audit(ctx.orgId, ctx.user.id, `wireless.mvno.${operation}.blocked`, 'wireless_mvno', null, {
        state: readiness.state,
        blocker: readiness.blocker,
        provider_verified: false
      });
    } catch {
      // Audit failure never converts a blocked carrier mutation into an allowed one.
    }
    return wirelessJson(req, {
      ok: false,
      error: 'provider_not_ready',
      operation,
      state: readiness.state,
      blocker: readiness.blocker
    }, 503);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'internal_error';
    const status =
      message === 'authentication_required' || message === 'invalid_session' ? 401 :
      message === 'active_organization_required' ? 403 : 503;
    return wirelessJson(req, { ok: false, error: message }, status);
  }
}

Deno.serve(async (req: Request) => {
  const u = new URL(req.url);
  const api = u.searchParams.get('api');

  if (req.method === 'OPTIONS' && api?.startsWith('wireless-mvno-')) {
    return new Response(null, { status: 204, headers: wirelessCors(req) });
  }
  if (req.method === 'GET' && api === 'readiness') return json({ ok: true, service: 'atlas-platform-controls', version: VERSION, source_of_runtime_truth: 'supabase', github_required: false, domains: ['integrations','agents','voice','wireless'], checked_at: new Date().toISOString() });
  if (req.method === 'GET' && api === 'wireless-mvno-readiness') return await wirelessReadiness(req);
  if (req.method === 'GET' && api === 'wireless-mvno-status') return await wirelessBlockedOperation(req, api);
  if (req.method === 'POST' && api && WIRELESS_MUTATIONS.has(api)) return await wirelessBlockedOperation(req, api);
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