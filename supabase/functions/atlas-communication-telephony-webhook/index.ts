import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import {
  shouldApplyProviderState,
  type AtlasCallState
} from '../_shared/telephony-call-state.ts';
import { verifyTelnyxWebhook } from '../_shared/telephony-webhook.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

function adminClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer'
    }
  });
}

async function readServerSecret(
  admin: ReturnType<typeof createClient>,
  name: string
): Promise<string | null> {
  const { data, error } = await admin.rpc('atlas_get_server_secret', { p_name: name });
  if (error) throw new Error('server_secret_unavailable');
  return typeof data === 'string' && data.trim() ? data.trim() : null;
}

function decodeClientState(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    return JSON.parse(atob(value));
  } catch {
    return null;
  }
}

function stateForEvent(eventType: string): AtlasCallState | null {
  if (eventType === 'call.initiated') return 'dialing';
  if (eventType === 'call.answered') return 'connected';
  if (eventType === 'call.hangup') return 'completed';
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const admin = adminClient();
  if (!admin) return json({ ok: false, error: 'runtime_not_configured' }, 503);

  const url = new URL(req.url);
  const orgId = (url.searchParams.get('org_id') || '').trim();
  if (!orgId) return json({ ok: false, error: 'organization_required' }, 400);

  const rawBody = await req.text();
  const publicKey = await readServerSecret(
    admin,
    `atlas_telephony:${orgId}:public_key`
  ).catch(() => null);

  if (!publicKey) return json({ ok: false, error: 'webhook_verification_not_configured' }, 503);

  try {
    await verifyTelnyxWebhook({
      rawBody,
      headers: req.headers,
      publicKeyBase64: publicKey
    });
  } catch {
    return json({ ok: false, error: 'webhook_signature_invalid' }, 401);
  }

  let envelope: any;
  try {
    envelope = JSON.parse(rawBody);
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const event = envelope?.data || {};
  const payload = event?.payload || {};
  const eventId = String(event?.id || '').trim();
  const eventType = String(event?.event_type || '').trim();
  const clientState = decodeClientState(payload?.client_state);
  const sessionId = String(clientState?.session_id || '').trim();
  const state = stateForEvent(eventType);
  const occurredAtRaw = String(event?.occurred_at || '').trim();
  const occurredAtMs = Date.parse(occurredAtRaw);
  const occurredAt = occurredAtRaw && Number.isFinite(occurredAtMs)
    ? new Date(occurredAtMs).toISOString()
    : null;

  if (!eventId || !eventType || !sessionId) {
    return json({ ok: false, error: 'webhook_event_incomplete' }, 400);
  }

  if (String(clientState?.org_id || '') !== orgId) {
    return json({ ok: false, error: 'organization_mismatch' }, 403);
  }

  const { data: session, error: sessionError } = await admin
    .from('atlas_call_sessions')
    .select('id,organization_id,state,provider_state_at,provider_state_event_id')
    .eq('id', sessionId)
    .eq('organization_id', orgId)
    .single();

  if (sessionError || !session?.id) {
    return json({ ok: false, error: 'call_session_not_found' }, 404);
  }

  const { error: eventError } = await admin
    .from('atlas_call_events')
    .insert({
      organization_id: orgId,
      call_session_id: sessionId,
      provider_event_id: eventId,
      event_type: eventType,
      call_state: state,
      provider_occurred_at: occurredAt,
      evidence: {
        call_control_id: payload?.call_control_id || null,
        call_leg_id: payload?.call_leg_id || null,
        hangup_cause: payload?.hangup_cause || null,
        hangup_source: payload?.hangup_source || null,
        occurred_at_invalid: Boolean(occurredAtRaw && !occurredAt)
      }
    });

  const duplicate = String(eventError?.code || '') === '23505';
  if (eventError && !duplicate) {
    return json({ ok: false, error: 'event_persist_failed' }, 500);
  }

  if (state && shouldApplyProviderState({
    currentState: String(session.state) as AtlasCallState,
    currentProviderStateAt: session.provider_state_at || null,
    incomingState: state,
    incomingOccurredAt: occurredAt
  })) {
    const { error: reconcileError } = await admin.rpc('atlas_apply_call_provider_state', {
      p_organization_id: orgId,
      p_call_session_id: sessionId,
      p_event_id: eventId,
      p_state: state,
      p_occurred_at: occurredAt,
      p_provider_call_id: payload?.call_control_id || null
    });

    if (reconcileError) {
      return json({ ok: false, error: 'state_reconcile_failed' }, 500);
    }
  }

  return json({ ok: true, duplicate });
});
