/**
 * ATLAS Persona Sandbox verified webhook. Must be deployed with verify_jwt=false
 * because Persona cannot supply an ATLAS user JWT. HMAC must pass before DB access.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import { resolvePersonaInquiryEvent, verifyPersonaWebhookSignature } from '../../../packages/compliance/persona.ts';

function json(status: number, errorOrResult: Record<string, unknown>) {
  return new Response(JSON.stringify(errorOrResult), {
    status,headers:{
      'content-type':'application/json; charset=utf-8','cache-control':'no-store',
      'x-content-type-options':'nosniff','referrer-policy':'no-referrer'
    }
  });
}
function configured() {
  const url = Deno.env.get('SUPABASE_URL') || '';
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const webhookSecret = Deno.env.get('PERSONA_WEBHOOK_SECRET') || '';
  if (Deno.env.get('PERSONA_MODE') !== 'sandbox' || !url || !secret || !webhookSecret) {
    throw new Error('persona_sandbox_not_configured');
  }
  return {url,secret,webhookSecret};
}
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405,{ok:false,error:'method_not_allowed'});
  try {
    const cfg=configured();
    if (Number(req.headers.get('content-length') || 0) > 262144) {
      return json(413,{ok:false,error:'request_too_large'});
    }
    const rawBody=await req.text();
    if (!await verifyPersonaWebhookSignature({
      rawBody, signatureHeader:req.headers.get('Persona-Signature'),
      webhookSecret:cfg.webhookSecret
    })) return json(401,{ok:false,error:'invalid_signature'});

    let incoming: unknown;
    try {incoming=JSON.parse(rawBody);} catch {return json(422,{ok:false,error:'invalid_event'});}
    const root=incoming as {data?:{attributes?:{payload?:{data?:{id?:unknown}}}}};
    const personaId=root?.data?.attributes?.payload?.data?.id;
    if (typeof personaId !== 'string' || !/^inq_[A-Za-z0-9]+$/.test(personaId)) {
      return json(422,{ok:false,error:'invalid_event'});
    }
    const admin=createClient(cfg.url,cfg.secret,{
      auth:{persistSession:false,autoRefreshToken:false}
    });
    const {data:record,error:readError}=await admin.from('atlas_persona_inquiries')
      .select('provider_inquiry_id,reference_id,template_id')
      .eq('provider_inquiry_id',personaId).eq('environment','sandbox')
      .maybeSingle();
    if (readError) return json(503,{ok:false,error:'persona_store_unavailable'});
    // Unknown inquiries must NEVER be imported or associated to a new ATLAS user.
    if (!record) return json(409,{ok:false,error:'unknown_inquiry'});

    let event;
    try {
      event=resolvePersonaInquiryEvent({
        rawBody,expectedInquiryId:record.provider_inquiry_id,
        expectedReferenceId:record.reference_id,expectedTemplateId:record.template_id
      });
    } catch {
      return json(422,{ok:false,error:'persona_binding_mismatch'});
    }
    const {data,error}=await admin.rpc('atlas_persona_record_signed_event',{
      p_provider_inquiry_id:event.inquiryId,p_reference_id:event.referenceId,
      p_template_id:event.templateId,p_provider_event_id:event.eventId,
      p_event_name:event.eventName,p_decision:event.decision,p_occurred_at:event.occurredAt
    });
    if (error || !data || typeof data.outcome !== 'string') {
      return json(503,{ok:false,error:'persona_store_unavailable'});
    }
    return json(200,{ok:true,outcome:data.outcome});
  } catch {
    return json(503,{ok:false,error:'persona_sandbox_unavailable'});
  }
});
