/**
 * ATLAS 777 — server-initiated Persona sandbox enrollment.
 * No independent auth, no browser-generated inquiry, no production provider fallback.
 * Deploy only after RLS/RPC and data-protection review.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

const ORIGINS = new Set(['https://atlasenterprisesuite.com', 'https://www.atlasenterprisesuite.com']);
const PROVIDER_HOSTS = new Set(['inquiry.withpersona.com', 'withpersona.com', 'go.perso.na']);
const VERSION = '2026-09-29';
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function respond(body: Record<string, unknown>, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status, headers: {
      'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
      'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer',
      ...(origin && ORIGINS.has(origin) ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {})
    }
  });
}
function validPersonaUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && PROVIDER_HOSTS.has(url.hostname) && !url.username && !url.password
      ? url.toString() : null;
  } catch { return null; }
}
function configured() {
  const url = Deno.env.get('SUPABASE_URL') || '';
  const publishable = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
  const adminKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const apiKey = Deno.env.get('PERSONA_API_KEY') || '';
  const templateId = Deno.env.get('PERSONA_TEMPLATE_ID') || '';
  if (!url || !publishable || !adminKey || Deno.env.get('PERSONA_MODE') !== 'sandbox' ||
      !apiKey.startsWith('persona_sandbox_') || !/^itmpl_[A-Za-z0-9]+$/.test(templateId)) {
    throw new Error('persona_sandbox_not_configured');
  }
  return { url, publishable, adminKey, apiKey, templateId };
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') {
    if (!origin || !ORIGINS.has(origin)) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: {
      'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'authorization, apikey, content-type, x-atlas-org-id',
      'access-control-max-age': '600', vary: 'Origin'
    } });
  }
  if (req.method !== 'POST') return respond({ ok: false, error: 'method_not_allowed' }, 405, origin);
  try {
    if (origin && !ORIGINS.has(origin)) return respond({ ok: false, error: 'origin_denied' }, 403, origin);
    const settings = configured();
    const auth = req.headers.get('authorization') || '';
    if (!/^Bearer\s+\S+$/i.test(auth)) return respond({ok:false,error:'authentication_required'},401,origin);
    const orgId = req.headers.get('x-atlas-org-id')?.trim() || '';
    if (!uuid(orgId)) return respond({ok:false,error:'organization_required'},400,origin);

    // Consent must be an explicit user action; the client cannot set a provider template.
    const input = await req.text();
    if (new TextEncoder().encode(input).byteLength > 2048) {
      return respond({ok:false,error:'invalid_request'},413,origin);
    }
    let consent: unknown;
    try { consent = JSON.parse(input); } catch { return respond({ok:false,error:'invalid_request'},400,origin); }
    if (!consent || typeof consent !== 'object' || (consent as Record<string, unknown>).consent !== true) {
      return respond({ok:false,error:'consent_required'},400,origin);
    }

    const userClient = createClient(settings.url, settings.publishable, {
      auth: { persistSession:false, autoRefreshToken:false },
      global: { headers: { Authorization:auth } }
    });
    const token = auth.replace(/^Bearer\s+/i, '');
    const { data: identity, error: identityError } = await userClient.auth.getUser(token);
    if (identityError || !identity.user?.id) return respond({ok:false,error:'invalid_session'},401,origin);
    const admin = createClient(settings.url, settings.adminKey, {
      auth: { persistSession:false, autoRefreshToken:false }
    });

    // RPC rechecks canonical organization_members + identity grants in one DB transaction.
    const { data: reservation, error: reserveError } = await admin.rpc('atlas_persona_reserve_inquiry', {
      p_organization_id:orgId,p_actor_user_id:identity.user.id,p_template_id:settings.templateId
    });
    if (reserveError) {
      const denied = /persona_authorization_denied/.test(reserveError.message);
      return respond({ok:false,error:denied?'authorization_denied':'persona_store_unavailable'},denied?403:503,origin);
    }
    if (!reservation || typeof reservation.id !== 'string' || typeof reservation.reference_id !== 'string') {
      return respond({ok:false,error:'persona_store_unavailable'},503,origin);
    }
    if (reservation.status !== 'reserved' || reservation.provider_inquiry_id) {
      return respond({ok:false,error:'inquiry_already_in_progress'},409,origin);
    }

    const provider = await fetch('https://api.withpersona.com/api/v1/inquiries', {
      method:'POST', signal:AbortSignal.timeout(8000), cache:'no-store',
      headers:{
        'Authorization': 'Bearer ' + settings.apiKey,
        'Persona-Version':VERSION,
        'Idempotency-Key':reservation.id,
        'Content-Type':'application/json',
        'Accept':'application/json'
      },
      body:JSON.stringify({ data: { attributes: {
        'inquiry-template-id':settings.templateId,
        'reference-id':reservation.reference_id
      } } })
    });
    if (!provider.ok) return respond({ok:false,error:'persona_provider_unavailable'},503,origin);
    const providerResult = await provider.json();
    const inquiry = providerResult?.data;
    const personaId = inquiry?.id;
    const providerReferenceId = inquiry?.attributes?.['reference-id'];
    const providerTemplateId = inquiry?.relationships?.['inquiry-template']?.data?.id;
    const link = validPersonaUrl(providerResult?.meta?.['one-time-link']);
    if (inquiry?.type !== 'inquiry' || typeof personaId !== 'string' ||
        !/^inq_[A-Za-z0-9]+$/.test(personaId) || providerReferenceId !== reservation.reference_id ||
        providerTemplateId !== settings.templateId || !link) {
      return respond({ok:false,error:'persona_provider_response_invalid'},502,origin);
    }

    const {data: attached,error: attachError}=await admin.rpc('atlas_persona_attach_inquiry',{
      p_local_id:reservation.id,p_organization_id:orgId,p_actor_user_id:identity.user.id,
      p_reference_id:reservation.reference_id,p_template_id:settings.templateId,
      p_provider_inquiry_id:personaId
    });
    if (attachError || attached?.provider_inquiry_id !== personaId) {
      return respond({ok:false,error:'persona_store_unavailable'},503,origin);
    }
    // One-time URL is confidential: no logs, no DB storage, no caching.
    return respond({ok:true,inquiry_id:personaId,verification_url:link,status:'pending'},201,origin);
  } catch {
    return respond({ok:false,error:'persona_sandbox_unavailable'},503,origin);
  }
});
