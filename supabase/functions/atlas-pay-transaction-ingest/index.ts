// ATLAS Financial OS — internal, signed read-only evidence intake.
// Deployment is separately gated. This function must be verify_jwt=true.
// This is NOT a native financial-provider webhook: a trusted adapter MUST
// verify the provider-specific delivery before producing ATLAS's HMAC envelope.
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import { verifySignedTransactionEnvelope } from '../_shared/pay-transaction-signature.ts';

const MAX_BODY_BYTES = 65536;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer'
    }
  });
}

async function readBoundedBody(req: Request): Promise<string | null> {
  const contentLength = Number(req.headers.get('content-length') ?? '0');
  if (contentLength > MAX_BODY_BYTES || !req.body) return null;
  const reader = req.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      parts.push(value);
    }
    const bytes = new Uint8Array(total);
    let cursor = 0;
    for (const chunk of parts) {
      bytes.set(chunk, cursor);
      cursor += chunk.length;
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return respond(405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
  if (Deno.env.get('ATLAS_PAY_TRANSACTION_INGEST_ENABLED') !== 'true') {
    return respond(503, { ok: false, code: 'INGEST_NOT_AUTHORIZED' });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const secret = Deno.env.get('ATLAS_PAY_TRANSACTION_HMAC_SECRET') ?? '';
  const orgId = Deno.env.get('ATLAS_PAY_TRANSACTION_ORG_ID') ?? '';
  const connectionId = Deno.env.get('ATLAS_PAY_TRANSACTION_PROVIDER_CONNECTION_ID') ?? '';
  if (!url || !serviceKey || secret.length < 32 || !uuid.test(orgId) || !uuid.test(connectionId)) {
    return respond(503, { ok: false, code: 'PROVIDER_NOT_CONFIGURED' });
  }

  const rawBody = await readBoundedBody(req);
  if (rawBody === null) return respond(413, { ok: false, code: 'INVALID_BODY' });

  const verified = await verifySignedTransactionEnvelope({
    rawBody,
    timestamp: req.headers.get('x-atlas-event-timestamp') ?? '',
    signature: req.headers.get('x-atlas-event-signature') ?? '',
    secret,
    nowUnixSeconds: Math.floor(Date.now() / 1000)
  });
  if (!verified.ok) return respond(401, { ok: false, code: 'EVENT_NOT_AUTHENTICATED' });

  // Source of org/provider scope is authenticated server configuration only.
  // The signed body may identify the account but cannot select an organization.
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const event = verified.event;
  const { data, error } = await admin.rpc('atlas_pay_record_transaction_event', {
    p_org_id: orgId,
    p_account_id: event.account_id,
    p_provider_connection_id: connectionId,
    p_provider_event_id: event.provider_event_id,
    p_transaction_reference: event.transaction_reference,
    p_event_kind: event.event_kind,
    p_amount_minor: event.amount_minor_text,
    p_currency: event.currency,
    p_observed_at: event.observed_at,
    p_payload_sha256: verified.payloadSha256
  });
  if (error) {
    return respond(error.code === '23505' ? 409 : 503, {
      ok: false,
      code: error.code === '23505' ? 'CONFLICTING_EVENT_ID' : 'STORAGE_GATE_NOT_READY'
    });
  }
  const receipt = Array.isArray(data) ? data[0] : null;
  if (!receipt?.receipt_id || !['inserted', 'duplicate'].includes(receipt.receipt_state)) {
    return respond(503, { ok: false, code: 'RECEIPT_NOT_VERIFIED' });
  }
  return respond(200, { ok: true, receipt_id: receipt.receipt_id, state: receipt.receipt_state });
});
