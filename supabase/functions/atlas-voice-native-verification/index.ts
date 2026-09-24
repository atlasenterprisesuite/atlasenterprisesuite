const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://ggmanzcgtlrvqfoccgsh.supabase.co';
const PUBLISHABLE_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const ALLOWED_ORIGINS = new Set(['https://atlasenterprisesuite.com','https://www.atlasenterprisesuite.com']);

function baseHeaders(extra: Record<string,string> = {}) {
  return {'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer',...extra};
}
function cors(origin: string | null) {
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, apikey, content-type, x-atlas-org-id',
    'access-control-allow-methods': 'POST, OPTIONS',
    vary: 'Origin'
  };
}
function json(data: unknown, status = 200, extra: Record<string,string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: baseHeaders({'content-type':'application/json; charset=utf-8',...extra})
  });
}
function containsAudioEvidence(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsAudioEvidence);
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.toLowerCase();
    if (['audio','audio_bytes','raw_audio','blob','sample_data'].includes(normalized)) return true;
    if (containsAudioEvidence(nested)) return true;
  }
  return false;
}
function uuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||''));
}
async function resolveContext(req: Request) {
  const bearer = req.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+/i.test(bearer)) throw Object.assign(new Error('authentication_required'),{status:401});
  if (!PUBLISHABLE_KEY) throw Object.assign(new Error('identity_not_configured'),{status:503});
  const authHeaders = {apikey:PUBLISHABLE_KEY,authorization:bearer,'content-type':'application/json'};
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:authHeaders,cache:'no-store'});
  if (!userResponse.ok) throw Object.assign(new Error('authentication_required'),{status:401});
  const user = await userResponse.json();
  if (!user?.id) throw Object.assign(new Error('authentication_required'),{status:401});

  const requestedOrg = String(req.headers.get('x-atlas-org-id') || '').trim();
  const membershipsResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/organization_members?select=org_id,role,status&user_id=eq.${encodeURIComponent(user.id)}&status=eq.active`,
    {headers:authHeaders,cache:'no-store'}
  );
  if (!membershipsResponse.ok) throw Object.assign(new Error('identity_unavailable'),{status:502});
  const memberships = await membershipsResponse.json();
  const membership = requestedOrg
    ? (Array.isArray(memberships) ? memberships.find((row:any)=>row.org_id===requestedOrg) : null)
    : (Array.isArray(memberships) ? memberships[0] : null);
  if (!membership) throw Object.assign(new Error('organization_membership_required'),{status:403});

  const permissionsResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/identity_role_permissions?select=permission_code&role=eq.${encodeURIComponent(membership.role)}`,
    {headers:authHeaders,cache:'no-store'}
  );
  if (!permissionsResponse.ok) throw Object.assign(new Error('identity_unavailable'),{status:502});
  const permissions = (await permissionsResponse.json()).map((row:any)=>String(row.permission_code||''));
  if (!permissions.includes('voice.apple.use') && !permissions.includes('*')) {
    throw Object.assign(new Error('permission_denied'),{status:403});
  }
  return {userId:String(user.id),orgId:String(membership.org_id),role:String(membership.role)};
}
function adminHeaders() {
  if (!SERVICE_ROLE_KEY) throw Object.assign(new Error('storage_not_configured'),{status:503});
  return {
    apikey:SERVICE_ROLE_KEY,
    authorization:`Bearer ${SERVICE_ROLE_KEY}`,
    'content-type':'application/json',
    Prefer:'return=representation'
  };
}
async function verifyOptionalProfile(ctx: {userId:string;orgId:string}, profileId: string | null) {
  if (!profileId) return null;
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/atlas_voice_profiles?id=eq.${encodeURIComponent(profileId)}&org_id=eq.${encodeURIComponent(ctx.orgId)}&owner_user_id=eq.${encodeURIComponent(ctx.userId)}&select=id`,
    {headers:adminHeaders(),cache:'no-store'}
  );
  if (!response.ok) throw Object.assign(new Error('voice_storage_unavailable'),{status:502});
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows.length) throw Object.assign(new Error('voice_profile_not_found'),{status:404});
  return profileId;
}
async function handler(req: Request) {
  if (req.method !== 'POST') return json({ok:false,error:'method_not_allowed'},405);
  const ctx = await resolveContext(req);
  const body = await req.json().catch(()=>null);
  if (!body || typeof body !== 'object') return json({ok:false,error:'invalid_input'},400);
  if (containsAudioEvidence(body)) return json({ok:false,error:'evidence_contains_audio'},400);

  const platform = String((body as any).platform || '').toLowerCase();
  const osVersion = String((body as any).osVersion || (body as any).os_version || '').trim();
  const authorization = String((body as any).authorization || '').trim();
  const personalVoiceCount = Number((body as any).personalVoiceCount ?? (body as any).personal_voice_count ?? 0);
  const localPlaybackVerified = (body as any).localPlaybackVerified === true || (body as any).local_playback_verified === true;
  const profileCandidate = (body as any).profile_id ? String((body as any).profile_id) : null;
  const profileId = profileCandidate && uuid(profileCandidate) ? profileCandidate : null;

  if (!['ios','macos'].includes(platform)) return json({ok:false,error:'invalid_platform'},400);
  if (!osVersion || osVersion.length > 80) return json({ok:false,error:'invalid_os_version'},400);
  if (!['authorized','denied','notDetermined','unsupported'].includes(authorization)) return json({ok:false,error:'invalid_authorization'},400);
  if (!Number.isInteger(personalVoiceCount) || personalVoiceCount < 0 || personalVoiceCount > 100) {
    return json({ok:false,error:'invalid_voice_count'},400);
  }
  if (profileCandidate && !profileId) return json({ok:false,error:'invalid_profile_id'},400);
  await verifyOptionalProfile(ctx,profileId);

  const capabilities = {
    localPlayback: true,
    audioExport: false,
    realtimeStream: false,
    telephony: false,
    serverSynthesis: false
  };
  const verification = {
    org_id: ctx.orgId,
    owner_user_id: ctx.userId,
    profile_id: profileId,
    platform,
    os_version: osVersion,
    device_model: String((body as any).deviceModel || (body as any).device_model || '').slice(0,160) || null,
    app_build: String((body as any).appBuild || (body as any).app_build || '').slice(0,120) || null,
    authorization_status: authorization,
    personal_voice_count: personalVoiceCount,
    local_playback_verified: localPlaybackVerified,
    verification_state:'device_reported',
    capabilities,
    metadata: {
      source:'atlas_native_bridge',
      user_confirmed_playback:localPlaybackVerified
    },
    verified_at: localPlaybackVerified ? new Date().toISOString() : null
  };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/atlas_voice_native_verifications`,{
    method:'POST',headers:adminHeaders(),body:JSON.stringify(verification),cache:'no-store'
  });
  if (!response.ok) throw Object.assign(new Error('voice_storage_unavailable'),{status:502});
  const rows = await response.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  return json({
    ok:true,
    verification_id:row?.id || null,
    state:'device_reported',
    local_playback_verified:localPlaybackVerified,
    physical_device_verified:false,
    capabilities
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null,{status:204,headers:baseHeaders(cors(origin))});
  try {
    const response = await handler(req);
    const next = new Headers(response.headers);
    for (const [key,value] of Object.entries(cors(origin))) next.set(key,value);
    return new Response(response.body,{status:response.status,headers:next});
  } catch (error:any) {
    console.error('atlas_voice_native_verification_error',{code:error?.message||'internal_error'});
    const response = json({ok:false,error:error?.message||'internal_error'},Number(error?.status||500));
    const next = new Headers(response.headers);
    for (const [key,value] of Object.entries(cors(origin))) next.set(key,value);
    return new Response(response.body,{status:response.status,headers:next});
  }
});
