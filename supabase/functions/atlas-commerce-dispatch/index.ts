import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import {
  CommerceIntegrationError,
  createDefaultCommerceIntegrationAdapters,
  type CommerceIntegrationTarget
} from '../../../packages/commerce/src/index.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const DISPATCH_KEY = Deno.env.get('ATLAS_COMMERCE_DISPATCH_KEY') || '';
const TARGETS: readonly CommerceIntegrationTarget[] = [
  'inventory',
  'accounting',
  'crm',
  'analytics'
];

function adminClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error('server_runtime_not_configured');
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      'x-content-type-options': 'nosniff'
    }
  });
}

function authorized(req: Request) {
  if (!DISPATCH_KEY) return false;
  return req.headers.get('x-atlas-dispatch-key') === DISPATCH_KEY;
}

async function seedDeliveries(admin: ReturnType<typeof createClient>) {
  const { data: events, error } = await admin
    .from('commerce_outbox_events')
    .select('id,tenant_id,org_id,event_type,status')
    .eq('event_type', 'commerce.order.completed.v1')
    .in('status', ['pending','partial','failed'])
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) throw new Error('outbox_read_failed');
  if (!events?.length) return;

  const rows = events.flatMap((event: any) =>
    TARGETS.map((target) => ({
      tenant_id: event.tenant_id,
      org_id: event.org_id,
      event_id: event.id,
      target_module: target,
      status: 'pending'
    }))
  );

  const { error: deliveryError } = await admin
    .from('commerce_integration_deliveries')
    .upsert(rows, {
      onConflict: 'event_id,target_module',
      ignoreDuplicates: true
    });
  if (deliveryError) throw new Error('delivery_seed_failed');
}

async function loadEvent(
  admin: ReturnType<typeof createClient>,
  eventId: string,
  orgId: string
) {
  const { data, error } = await admin
    .from('commerce_outbox_events')
    .select('id,event_type,payload,status')
    .eq('id', eventId)
    .eq('org_id', orgId)
    .maybeSingle();

  if (error) throw new Error('outbox_read_failed');
  if (!data) throw new Error('outbox_event_not_found');
  return data;
}

async function recordFailure(
  admin: ReturnType<typeof createClient>,
  delivery: any,
  reasonCode: string,
  retryable: boolean
) {
  const state = retryable
    ? (Number(delivery.attempt_count) >= 5 ? 'dead_lettered' : 'retrying')
    : 'failed';

  const { error: deliveryError } = await admin
    .from('commerce_integration_deliveries')
    .update({
      status: state,
      reason_code: reasonCode,
      updated_at: new Date().toISOString()
    })
    .eq('id', delivery.id)
    .eq('org_id', delivery.org_id);
  if (deliveryError) throw new Error('delivery_update_failed');

  const { error: exceptionError } = await admin
    .from('commerce_integration_exceptions')
    .upsert({
      tenant_id: delivery.tenant_id,
      org_id: delivery.org_id,
      event_id: delivery.event_id,
      delivery_id: delivery.id,
      target_module: delivery.target_module,
      reason_code: reasonCode,
      safe_details: { retryable },
      status: 'open',
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'delivery_id'
    });

  if (exceptionError) throw new Error('delivery_exception_write_failed');
}

async function refreshOutboxState(
  admin: ReturnType<typeof createClient>,
  eventId: string,
  orgId: string
) {
  const { data, error } = await admin
    .from('commerce_integration_deliveries')
    .select('status')
    .eq('event_id', eventId)
    .eq('org_id', orgId);

  if (error) throw new Error('delivery_read_failed');
  const states = (data || []).map((row: any) => String(row.status));
  if (states.length === 0) return;

  let status = 'partial';
  if (states.every((state) => state === 'fulfilled' || state === 'resolved')) {
    status = 'delivered';
  } else if (states.every((state) =>
    ['failed','dead_lettered','resolved'].includes(state)
  )) {
    status = 'failed';
  }

  const { error: updateError } = await admin
    .from('commerce_outbox_events')
    .update({
      status,
      delivered_at: status === 'delivered' ? new Date().toISOString() : null
    })
    .eq('id', eventId)
    .eq('org_id', orgId);
  if (updateError) throw new Error('outbox_update_failed');
}

async function dispatch() {
  const admin = adminClient();
  await seedDeliveries(admin);

  const { data: claimed, error: claimError } = await admin
    .rpc('commerce_claim_integration_deliveries', {
      p_limit: 25
    });

  if (claimError) throw new Error('delivery_claim_failed');

  const adapters = createDefaultCommerceIntegrationAdapters();
  let fulfilled = 0;
  let failed = 0;

  for (const delivery of claimed || []) {
    const target = String(delivery.target_module) as CommerceIntegrationTarget;
    if (!TARGETS.includes(target)) {
      await recordFailure(
        admin,
        delivery,
        'UNKNOWN_COMMERCE_INTEGRATION_TARGET',
        false
      );
      failed += 1;
      continue;
    }

    const event = await loadEvent(
      admin,
      String(delivery.event_id),
      String(delivery.org_id)
    );

    try {
      const result = await adapters[target].deliver({
        eventId: String(event.id),
        correlationId: String(event.id),
        target,
        eventType: String(event.event_type),
        payload: event.payload && typeof event.payload === 'object'
          ? event.payload as Record<string, unknown>
          : {}
      });

      const { error: updateError } = await admin
        .from('commerce_integration_deliveries')
        .update({
          status: 'fulfilled',
          reason_code: null,
          adapter_reference: result.adapterReference,
          delivered_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', delivery.id)
        .eq('org_id', delivery.org_id);

      if (updateError) throw new Error('delivery_update_failed');
      fulfilled += 1;
    } catch (error) {
      const known = error instanceof CommerceIntegrationError;
      await recordFailure(
        admin,
        delivery,
        known ? error.code : 'COMMERCE_INTEGRATION_DELIVERY_FAILED',
        known ? error.retryable : true
      );
      failed += 1;
    }

    await refreshOutboxState(
      admin,
      String(delivery.event_id),
      String(delivery.org_id)
    );
  }

  return { claimed: (claimed || []).length, fulfilled, failed };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }
  if (!DISPATCH_KEY) {
    return json({ ok: false, error: 'dispatch_runtime_not_configured' }, 503);
  }
  if (!authorized(req)) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  try {
    return json({ ok: true, ...(await dispatch()) });
  } catch (error) {
    console.error('atlas-commerce-dispatch failure', error instanceof Error ? error.message : 'unknown');
    return json({ ok: false, error: 'dispatch_failed' }, 500);
  }
});
