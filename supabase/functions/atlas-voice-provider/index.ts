import {
  customVoiceAccessState,
  extensionForVoiceMime,
  normalizeVoiceMimeType,
  openAICustomVoiceCapabilities,
  providerErrorState
} from './provider-core.mjs';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://ggmanzcgtlrvqfoccgsh.supabase.co';
const PUBLISHABLE_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const OPENAI_BASE = 'https://api.openai.com/v1';
const OPENAI_CONSENTS_URL = 'https://api.openai.com/v1/audio/voice_consents';
const OPENAI_VOICES_URL = 'https://api.openai.com/v1/audio/voices';
const OPENAI_SPEECH_URL = 'https://api.openai.com/v1/audio/speech';
const ALLOWED_ORIGINS = new Set(['https://atlasenterprisesuite.com','https://www.atlasenterprisesuite.com']);

function headers(extra: Record<string,string> = {}) {
  return {'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer',...extra};
}
function cors(origin: string | null) {
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers':'authorization, apikey, content-type, x-atlas-org-id',
    'access-control-allow-methods':'GET, POST, OPTIONS',
    'access-control-max-age':'86400',
    vary:'Origin'
  };
}
function json(data: unknown, status = 200, extra: Record<string,string> = {}) {
  return new Response(JSON.stringify(data), {status, headers: headers({'content-type':'application/json; charset=utf-8',...extra})});
}
function safeId(value: unknown) {
  const text = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null;
}
async function readJson(response: Response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : {}; } catch { return {message:text}; }
}
function adminHeaders(extra: Record<string,string> = {}) {
  if (!SERVICE_ROLE_KEY) throw Object.assign(new Error('storage_not_configured'),{status:503});
  return {apikey:SERVICE_ROLE_KEY,authorization:`Bearer ${SERVICE_ROLE_KEY}`,'content-type':'application/json',...extra};
}
async function context(req: Request, permission: string) {
  const bearer = req.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+/i.test(bearer)) throw Object.assign(new Error('authentication_required'),{status:401});
  if (!PUBLISHABLE_KEY) throw Object.assign(new Error('identity_not_configured'),{status:503});
  const userHeaders = {apikey:PUBLISHABLE_KEY,authorization:bearer,'content-type':'application/json'};
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:userHeaders,cache:'no-store'});
  if (!userResponse.ok) throw Object.assign(new Error('authentication_required'),{status:401});
  const user = await userResponse.json();
  if (!user?.id) throw Object.assign(new Error('authentication_required'),{status:401});

  const requestedOrg = String(req.headers.get('x-atlas-org-id') || '').trim();
  const membershipResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/organization_members?select=org_id,role,status&user_id=eq.${encodeURIComponent(user.id)}&status=eq.active`,
    {headers:userHeaders,cache:'no-store'}
  );
  if (!membershipResponse.ok) throw Object.assign(new Error('identity_unavailable'),{status:502});
  const memberships = await membershipResponse.json();
  const membership = requestedOrg
    ? (Array.isArray(memberships) ? memberships.find((row:any)=>row.org_id===requestedOrg) : null)
    : (Array.isArray(memberships) ? memberships[0] : null);
  if (!membership) throw Object.assign(new Error('organization_membership_required'),{status:403});

  const permissionResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/identity_role_permissions?select=permission_code&role=eq.${encodeURIComponent(membership.role)}`,
    {headers:userHeaders,cache:'no-store'}
  );
  if (!permissionResponse.ok) throw Object.assign(new Error('identity_unavailable'),{status:502});
  const permissions = (await permissionResponse.json()).map((row:any)=>String(row.permission_code||''));
  if (!permissions.includes(permission) && !permissions.includes('*')) {
    throw Object.assign(new Error('permission_denied'),{status:403,permission});
  }
  return {userId:String(user.id),orgId:String(membership.org_id),role:String(membership.role),bearer};
}
async function providerAccess() {
  if (!OPENAI_API_KEY) return {configured:false,readable:false,writable:false,state:'provider_not_configured',read_status:0,write_status:0};
  const auth = {authorization:`Bearer ${OPENAI_API_KEY}`};
  let readStatus = 0, writeStatus = 0;
  try {
    const read = await fetch(`${OPENAI_BASE}/audio/consent_phrases`,{headers:auth,cache:'no-store'});
    readStatus = read.status;
    const probe = new FormData();
    probe.set('name','atlas_access_probe');
    probe.set('language','en');
    const write = await fetch(OPENAI_CONSENTS_URL,{method:'POST',headers:auth,body:probe,cache:'no-store'});
    writeStatus = write.status;
  } catch {
    return {configured:true,readable:false,writable:false,state:'provider_unreachable',read_status:readStatus,write_status:writeStatus};
  }
  return {...customVoiceAccessState(readStatus,writeStatus),read_status:readStatus,write_status:writeStatus};
}
async function serviceRows(path: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{headers:adminHeaders(),cache:'no-store'});
  if (!response.ok) throw Object.assign(new Error('voice_storage_unavailable'),{status:502});
  return response.json();
}
async function servicePatch(path: string, body: unknown) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{
    method:'PATCH',headers:adminHeaders({Prefer:'return=representation'}),body:JSON.stringify(body),cache:'no-store'
  });
  if (!response.ok) throw Object.assign(new Error('voice_storage_unavailable'),{status:502});
  return response.json();
}
async function servicePost(path: string, body: unknown) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{
    method:'POST',headers:adminHeaders({Prefer:'return=representation'}),body:JSON.stringify(body),cache:'no-store'
  });
  if (!response.ok) throw Object.assign(new Error('voice_storage_unavailable'),{status:502});
  return response.json();
}
async function ownedProfile(ctx: any, profileId: string) {
  const rows = await serviceRows(
    `atlas_voice_profiles?id=eq.${encodeURIComponent(profileId)}&org_id=eq.${encodeURIComponent(ctx.orgId)}&owner_user_id=eq.${encodeURIComponent(ctx.userId)}&select=*`
  );
  const profile = Array.isArray(rows) ? rows[0] : null;
  if (!profile || profile.status === 'deleted') throw Object.assign(new Error('voice_profile_not_found'),{status:404});
  return profile;
}
async function ownedSample(ctx: any, profileId: string, sampleId: string) {
  const rows = await serviceRows(
    `atlas_voice_samples?id=eq.${encodeURIComponent(sampleId)}&profile_id=eq.${encodeURIComponent(profileId)}&org_id=eq.${encodeURIComponent(ctx.orgId)}&owner_user_id=eq.${encodeURIComponent(ctx.userId)}&status=eq.accepted&select=*`
  );
  const sample = Array.isArray(rows) ? rows[0] : null;
  if (!sample?.storage_path) throw Object.assign(new Error('voice_sample_not_found'),{status:404});
  return sample;
}
async function activeConsent(ctx: any, profileId: string) {
  const rows = await serviceRows(
    `atlas_voice_consents?profile_id=eq.${encodeURIComponent(profileId)}&org_id=eq.${encodeURIComponent(ctx.orgId)}&owner_user_id=eq.${encodeURIComponent(ctx.userId)}&revoked_at=is.null&select=*&order=accepted_at.desc&limit=1`
  );
  const consent = Array.isArray(rows) ? rows[0] : null;
  if (!consent) throw Object.assign(new Error('voice_consent_required'),{status:409});
  return consent;
}
function encodedStoragePath(path: string) {
  return path.split('/').map((part)=>encodeURIComponent(part)).join('/');
}
async function sampleBlob(sample: any) {
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/authenticated/atlas-voice-samples/${encodedStoragePath(sample.storage_path)}`,
    {headers:{apikey:SERVICE_ROLE_KEY,authorization:`Bearer ${SERVICE_ROLE_KEY}`},cache:'no-store'}
  );
  if (!response.ok) throw Object.assign(new Error('voice_sample_download_failed'),{status:502});
  return response.blob();
}
async function openAIJson(response: Response) {
  const body = await readJson(response);
  if (!response.ok) {
    const error:any = new Error(providerErrorState(response.status));
    error.status = response.status === 429 ? 429 : 503;
    error.providerStatus = response.status;
    error.providerRequestId = response.headers.get('x-request-id');
    throw error;
  }
  return body;
}
async function createProviderConsent(req: Request) {
  const ctx = await context(req,'voice.personal.generate');
  const body = await req.json().catch(()=>({}));
  const profileId = safeId(body?.profile_id), sampleId = safeId(body?.sample_id);
  if (!profileId || !sampleId) return json({ok:false,error:'invalid_input'},400);
  const access = await providerAccess();
  if (access.state !== 'ready') return json({ok:false,error:'provider_not_ready',provider:'openai_custom_voice',access},503);

  const [profile,sample,consent] = await Promise.all([
    ownedProfile(ctx,profileId),
    ownedSample(ctx,profileId,sampleId),
    activeConsent(ctx,profileId)
  ]);
  if (sample.phrase_id !== 'challenge') return json({ok:false,error:'provider_consent_sample_required'},409);
  const blob = await sampleBlob(sample);
  const mime = normalizeVoiceMimeType(sample.mime_type || blob.type || 'audio/webm');
  const ext = extensionForVoiceMime(mime);
  const form = new FormData();
  form.set('name',`atlas_${profile.id.slice(0,8)}_consent`);
  form.set('language',String(profile.language||'en').split('-')[0].toLowerCase());
  form.set('recording',new File([blob],`consent.${ext}`,{type:mime}));
  const response = await fetch(OPENAI_CONSENTS_URL,{
    method:'POST',headers:{authorization:`Bearer ${OPENAI_API_KEY}`},body:form,cache:'no-store'
  });
  const provider = await openAIJson(response);
  if (!provider?.id) throw Object.assign(new Error('provider_invalid_response'),{status:502});
  await servicePatch(`atlas_voice_consents?id=eq.${encodeURIComponent(consent.id)}`,{
    provider_kind:'openai_custom_voice',
    provider_consent_ref:String(provider.id),
    provider_state:'ready',
    provider_error_code:null,
    provider_verified_at:new Date().toISOString()
  });
  await servicePost('atlas_voice_audit_events',{
    org_id:ctx.orgId,profile_id:profile.id,actor_user_id:ctx.userId,event_type:'voice.provider.consent.created',
    metadata:{provider:'openai_custom_voice',provider_request_id:response.headers.get('x-request-id')||null}
  });
  return json({ok:true,provider:'openai_custom_voice',consent_id:String(provider.id),state:'ready'});
}
async function createProviderVoice(req: Request) {
  const ctx = await context(req,'voice.personal.generate');
  const body = await req.json().catch(()=>({}));
  const profileId = safeId(body?.profile_id), sampleId = safeId(body?.sample_id);
  if (!profileId || !sampleId) return json({ok:false,error:'invalid_input'},400);
  const access = await providerAccess();
  if (access.state !== 'ready') return json({ok:false,error:'provider_not_ready',provider:'openai_custom_voice',access},503);

  const [profile,sample,consent] = await Promise.all([
    ownedProfile(ctx,profileId),
    ownedSample(ctx,profileId,sampleId),
    activeConsent(ctx,profileId)
  ]);
  if (!consent.provider_consent_ref || consent.provider_state !== 'ready') return json({ok:false,error:'provider_consent_required'},409);
  if (sample.phrase_id === 'challenge') return json({ok:false,error:'provider_reference_sample_required'},409);

  const blob = await sampleBlob(sample);
  const mime = normalizeVoiceMimeType(sample.mime_type || blob.type || 'audio/webm');
  const ext = extensionForVoiceMime(mime);
  const form = new FormData();
  form.set('name',String(profile.name||'ATLAS Personal Voice').slice(0,80));
  form.set('consent',String(consent.provider_consent_ref));
  form.set('audio_sample',new File([blob],`sample.${ext}`,{type:mime}));
  const response = await fetch(OPENAI_VOICES_URL,{
    method:'POST',headers:{authorization:`Bearer ${OPENAI_API_KEY}`},body:form,cache:'no-store'
  });
  const provider = await openAIJson(response);
  if (!provider?.id) throw Object.assign(new Error('provider_invalid_response'),{status:502});
  const now = new Date().toISOString();
  await servicePatch(`atlas_voice_profiles?id=eq.${encodeURIComponent(profile.id)}`,{
    provider_backend:'openai_custom_voice',
    provider_ref:String(provider.id),
    provider_state:'ready',
    provider_verified_at:now,
    provider_metadata:{provider:'openai_custom_voice'},
    capabilities:openAICustomVoiceCapabilities,
    status:'ready'
  });
  await servicePost('atlas_voice_generation_jobs',{
    org_id:ctx.orgId,profile_id:profile.id,owner_user_id:ctx.userId,provider_kind:'atlas',
    provider_backend:'openai_custom_voice',provider_job_ref:String(provider.id),status:'ready',
    metadata:{provider_request_id:response.headers.get('x-request-id')||null},completed_at:now
  });
  await servicePost('atlas_voice_audit_events',{
    org_id:ctx.orgId,profile_id:profile.id,actor_user_id:ctx.userId,event_type:'voice.provider.voice.created',
    metadata:{provider:'openai_custom_voice',provider_request_id:response.headers.get('x-request-id')||null}
  });
  return json({ok:true,provider:'openai_custom_voice',voice_id:String(provider.id),state:'ready',capabilities:openAICustomVoiceCapabilities});
}
async function synthesize(req: Request) {
  const ctx = await context(req,'voice.personal.use');
  const body = await req.json().catch(()=>({}));
  const profileId = safeId(body?.profile_id);
  const input = String(body?.text||'').trim();
  if (!profileId || !input || input.length > 4096) return json({ok:false,error:'invalid_input'},400);
  const profile = await ownedProfile(ctx,profileId);
  if (profile.provider_backend !== 'openai_custom_voice' || profile.provider_state !== 'ready' || !profile.provider_ref) {
    return json({ok:false,error:'provider_not_ready'},503);
  }
  const format = ['mp3','opus','aac','flac','wav','pcm'].includes(String(body?.format||'')) ? String(body.format) : 'mp3';
  const payload = {
    model: 'gpt-4o-mini-tts',
    voice: { id: profile.provider_ref },
    input,
    language: String(profile.language||'en').split('-')[0].toLowerCase(),
    response_format: format
  };
  const response = await fetch(OPENAI_SPEECH_URL,{
    method:'POST',
    headers:{authorization:`Bearer ${OPENAI_API_KEY}`,'content-type':'application/json'},
    body:JSON.stringify(payload),cache:'no-store'
  });
  if (!response.ok) {
    const providerBody = await readJson(response);
    return json({ok:false,error:providerErrorState(response.status),provider_status:response.status,provider_error:providerBody?.error?.code||null},503);
  }
  const contentType = response.headers.get('content-type') || (format === 'wav' ? 'audio/wav' : 'audio/mpeg');
  return new Response(response.body,{
    status:200,
    headers:headers({
      'content-type':contentType,
      'x-atlas-ai-voice':'synthetic-custom',
      'x-atlas-ai-disclosure':'AI-generated voice',
      'x-atlas-provider':'openai_custom_voice'
    })
  });
}
async function consentPhrases(req: Request) {
  await context(req,'voice.personal.generate');
  if (!OPENAI_API_KEY) return json({ok:false,error:'provider_not_configured'},503);
  const response = await fetch(`${OPENAI_BASE}/audio/consent_phrases`,{headers:{authorization:`Bearer ${OPENAI_API_KEY}`},cache:'no-store'});
  const body = await readJson(response);
  if (!response.ok) return json({ok:false,error:providerErrorState(response.status),provider_status:response.status},503);
  return json({ok:true,provider:'openai_custom_voice',phrases:body});
}
async function status(req: Request) {
  await context(req,'voice.personal.read');
  const access = await providerAccess();
  return json({ok:true,provider:'openai_custom_voice',...access,capabilities:openAICustomVoiceCapabilities});
}

async function handler(req: Request) {
  const url = new URL(req.url);
  const api = url.searchParams.get('api') || 'status';
  if (req.method === 'GET' && api === 'status') return status(req);
  if (req.method === 'GET' && api === 'consent-phrases') return consentPhrases(req);
  if (req.method === 'POST' && api === 'create-consent') return createProviderConsent(req);
  if (req.method === 'POST' && api === 'create-voice') return createProviderVoice(req);
  if (req.method === 'POST' && api === 'speech') return synthesize(req);
  return json({ok:false,error:'not_found'},404);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null,{status:204,headers:headers(cors(origin))});
  try {
    const response = await handler(req);
    const next = new Headers(response.headers);
    for (const [key,value] of Object.entries(cors(origin))) next.set(key,value);
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers:next});
  } catch (error:any) {
    console.error('atlas_voice_provider_error',{code:error?.message||'internal_error'});
    const statusCode = Number(error?.status || 500);
    const response = json({ok:false,error:error?.message||'internal_error',permission:error?.permission||null},statusCode);
    const next = new Headers(response.headers);
    for (const [key,value] of Object.entries(cors(origin))) next.set(key,value);
    return new Response(response.body,{status:response.status,headers:next});
  }
});
