import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import {
  classifyIdempotentReplay,
  digestLogicalMutation,
  normalizeCallMutationInput
} from '../_shared/telephony-idempotency.ts';
import {
  isE164,
  probeTelnyxVoice,
  searchTelnyxAvailableNumbers,
  type TelnyxVoiceConfig
} from '../_shared/telephony-telnyx.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const PUBLISHABLE_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ||
  Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ||
  '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const VERSION = 4;

const ALLOWED_ORIGINS = new Set([
  'https://atlasenterprisesuite.com',
  'https://www.atlasenterprisesuite.com'
]);

type RequestContext = {
  userId: string;
  orgId: string;
  role: string;
};

class TelephonyError extends Error {
  constructor(
    readonly code: string,
    readonly status = 400,
    readonly details: Record<string, unknown> = {}
  ) {
    super(code);
  }
}

function clean(value: unknown, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

function corsHeaders(origin: string | null): Record<string, string> {
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
      ...corsHeaders(req.headers.get('origin'))
    }
  });
}

function userClient(req: Request) {
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: req.headers.get('authorization') || '' } }
  });
}

function adminClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function resolveContext(req: Request): Promise<RequestContext> {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) {
    throw new TelephonyError('supabase_runtime_not_configured', 503);
  }

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new TelephonyError('authentication_required', 401);

  const sb = userClient(req);
  const { data: authData, error: authError } = await sb.auth.getUser(token);
  if (authError || !authData.user) throw new TelephonyError('invalid_session', 401);

  const requestedOrg = clean(req.headers.get('x-atlas-org-id'), 80);
  let query = sb
    .from('organization_members')
    .select('org_id,role,status')
    .eq('user_id', authData.user.id)
    .eq('status', 'active');

  if (requestedOrg) query = query.eq('org_id', requestedOrg);

  const { data, error } = await query.limit(1);
  if (error || !data?.[0]?.org_id) {
    throw new TelephonyError('active_organization_required', 403);
  }

  return {
    userId: authData.user.id,
    orgId: String(data[0].org_id),
    role: String(data[0].role || 'member')
  };
}

async function requirePermission(req: Request, ctx: RequestContext, permission: string) {
  const sb = userClient(req);
  const { data, error } = await sb.rpc('has_identity_permission', {
    o: ctx.orgId,
    p: permission
  });
  if (error || data !== true) throw new TelephonyError('authorization_denied', 403);
}

async function readServerSecret(
  admin: ReturnType<typeof createClient>,
  name: string
): Promise<string | null> {
  const { data, error } = await admin.rpc('atlas_get_server_secret', { p_name: name });
  if (error) throw new TelephonyError('server_secret_unavailable', 503);
  return typeof data === 'string' && data.trim() ? data.trim() : null;
}

function secretName(orgId: string, key: string) {
  return `atlas_telephony:${orgId}:${key}`;
}

async function loadConfig(ctx: RequestContext): Promise<{
  provider: string | null;
  config: TelnyxVoiceConfig | null;
  configured: Record<string, boolean>;
}> {
  const admin = adminClient();
  if (!admin) {
    return {
      provider: null,
      config: null,
      configured: {
        provider: false,
        api_key: false,
        connection_id: false,
        from_number: false,
        webhook_url: false,
        public_key: false
      }
    };
  }

  const [provider, apiKey, connectionId, fromNumber, webhookUrl, publicKey] = await Promise.all([
    readServerSecret(admin, secretName(ctx.orgId, 'provider')),
    readServerSecret(admin, secretName(ctx.orgId, 'api_key')),
    readServerSecret(admin, secretName(ctx.orgId, 'connection_id')),
    readServerSecret(admin, secretName(ctx.orgId, 'from_number')),
    readServerSecret(admin, secretName(ctx.orgId, 'webhook_url')),
    readServerSecret(admin, secretName(ctx.orgId, 'public_key'))
  ]);

  const configured = {
    provider: Boolean(provider),
    api_key: Boolean(apiKey),
    connection_id: Boolean(connectionId),
    from_number: Boolean(fromNumber),
    webhook_url: Boolean(webhookUrl),
    public_key: Boolean(publicKey)
  };

  if (!provider || !apiKey || !connectionId || !fromNumber || !webhookUrl || !publicKey) {
    return { provider, config: null, configured };
  }

  return {
    provider,
    config: {
      apiKey,
      connectionId,
      fromNumber,
      webhookUrl,
      publicKey
    },
    configured
  };
}

async function persistReadiness(
  ctx: RequestContext,
  provider: string,
  readiness: Awaited<ReturnType<typeof probeTelnyxVoice>>
) {
  const admin = adminClient();
  if (!admin) return;

  await admin.from('atlas_telephony_providers').upsert(
    {
      organization_id: ctx.orgId,
      provider,
      state: readiness.verified ? 'verified' : 'degraded',
      capabilities: {
        inbound: false,
        outbound: readiness.verified,
        sms: false,
        recording: false,
        realtime_audio: false,
        transfer: false,
        emergency_calling: false
      },
      last_verified_at: readiness.verified ? new Date().toISOString() : null,
      last_probe_code: readiness.blocker || String(readiness.statusCode || ''),
      last_probe_evidence: {
        status_code: readiness.statusCode,
        request_id: readiness.requestId,
        blocker: readiness.blocker
      },
      updated_at: new Date().toISOString()
    },
    { onConflict: 'organization_id,provider' }
  );
}

async function getReadiness(ctx: RequestContext) {
  const loaded = await loadConfig(ctx);
  if (!loaded.provider || !loaded.config) {
    return {
      provider: loaded.provider,
      state: 'not_configured',
      verified: false,
      blocker: 'provider_configuration_incomplete',
      credentials: loaded.configured
    };
  }

  if (loaded.provider !== 'telnyx') {
    return {
      provider: loaded.provider,
      state: 'not_configured',
      verified: false,
      blocker: 'provider_adapter_not_supported',
      credentials: loaded.configured
    };
  }

  const readiness = await probeTelnyxVoice(loaded.config);
  await persistReadiness(ctx, loaded.provider, readiness);

  return {
    provider: loaded.provider,
    ...readiness,
    credentials: loaded.configured
  };
}

async function audit(
  ctx: RequestContext,
  action: string,
  recordId: string | null,
  data: Record<string, unknown>
) {
  const admin = adminClient();
  if (!admin) return;
  try {
    await admin.from('audit_logs').insert({
      org_id: ctx.orgId,
      user_id: ctx.userId,
      action,
      table_name: 'atlas_call_sessions',
      record_id: recordId,
      new_data: data
    });
  } catch {
    // Fail-closed calling does not depend on audit write success.
  }
}

async function searchNumbers(req: Request, ctx: RequestContext, url: URL) {
  await requirePermission(req, ctx, 'communication.telephony.read');

  const countryCode = clean(url.searchParams.get('country_code'), 2).toUpperCase();
  const areaCode = clean(url.searchParams.get('area_code'), 8);
  const rawLimit = clean(url.searchParams.get('limit'), 4);

  if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) {
    throw new TelephonyError('number_search_country_invalid', 400);
  }
  if (areaCode && !/^\d{2,6}$/.test(areaCode)) {
    throw new TelephonyError('number_search_area_invalid', 400);
  }

  let limit = 10;
  if (rawLimit) {
    const parsed = Number(rawLimit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) {
      throw new TelephonyError('number_search_limit_invalid', 400);
    }
    limit = parsed;
  }

  const loaded = await loadConfig(ctx);
  if (loaded.provider !== 'telnyx' || !loaded.config) {
    throw new TelephonyError('provider_not_ready', 503, {
      blocker: 'provider_configuration_incomplete'
    });
  }

  const readiness = await probeTelnyxVoice(loaded.config);
  await persistReadiness(ctx, loaded.provider, readiness);
  if (!readiness.verified) {
    throw new TelephonyError('provider_not_ready', 503, {
      blocker: readiness.blocker
    });
  }

  const result = await searchTelnyxAvailableNumbers(loaded.config, {
    ...(countryCode ? { countryCode } : {}),
    ...(areaCode ? { areaCode } : {}),
    limit
  });

  if (result.status === 'lookup_error') {
    return json(req, {
      ok: false,
      provider: 'telnyx',
      ownership: 'discovered_only',
      ...result,
      provider_secret_values_returned: false
    }, result.statusCode === 429 ? 503 : 502);
  }

  return json(req, {
    ok: true,
    provider: 'telnyx',
    ownership: 'discovered_only',
    ...result,
    provider_secret_values_returned: false,
    checked_at: new Date().toISOString()
  });
}

async function findCallByIdempotency(
  admin: ReturnType<typeof createClient>,
  orgId: string,
  idempotencyKey: string
) {
  const { data, error } = await admin
    .from('atlas_call_sessions')
    .select('id,state,provider_call_id,provider_evidence,idempotency_key,request_digest,reconciliation_required,reconciliation_reason,created_at,updated_at')
    .eq('organization_id', orgId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (error) throw new TelephonyError('call_idempotency_lookup_failed', 503);
  return data || null;
}

function respondToCallReplay(req: Request, existing: Record<string, unknown>, requestDigest: string) {
  const classification = classifyIdempotentReplay({
    existing: {
      requestDigest: String(existing.request_digest || ''),
      reconciliationRequired: existing.reconciliation_required === true
    },
    requestDigest
  });

  if (classification === 'conflict') {
    throw new TelephonyError('idempotency_conflict', 409);
  }
  if (classification === 'reconciliation_required') {
    throw new TelephonyError('provider_outcome_ambiguous', 409, {
      call_session_id: existing.id,
      state: existing.state,
      reconciliation_required: true,
      reconciliation_reason: existing.reconciliation_reason || 'provider_outcome_ambiguous'
    });
  }

  const evidence = existing.provider_evidence && typeof existing.provider_evidence === 'object'
    ? existing.provider_evidence as Record<string, unknown>
    : {};

  return json(req, {
    ok: true,
    call_session_id: existing.id,
    state: existing.state,
    provider: 'telnyx',
    provider_request_id: evidence.request_id || null,
    replayed: true,
    reconciliation_required: false
  }, ['completed', 'failed', 'canceled', 'blocked'].includes(String(existing.state)) ? 200 : 202);
}

async function assertVerifiedCallerNumber(
  admin: ReturnType<typeof createClient>,
  ctx: RequestContext,
  fromNumber: string
) {
  const { data, error } = await admin
    .from('atlas_number_resources')
    .select('id,e164,state,upstream_provider,external_resource_id,provider_evidence,verified_at')
    .eq('organization_id', ctx.orgId)
    .eq('e164', fromNumber)
    .eq('state', 'active')
    .eq('upstream_provider', 'telnyx')
    .maybeSingle();

  const evidence = data?.provider_evidence && typeof data.provider_evidence === 'object'
    ? data.provider_evidence as Record<string, unknown>
    : {};
  const externalResourceId = clean(data?.external_resource_id, 200);
  const evidenceProviderId = clean(evidence.provider_resource_id, 200);

  if (
    error ||
    !data?.id ||
    !data.verified_at ||
    !externalResourceId ||
    evidenceProviderId !== externalResourceId ||
    !clean(evidence.observed_at, 100) ||
    !clean(evidence.verification_method, 100) ||
    !clean(evidence.evidence_digest, 200)
  ) {
    throw new TelephonyError('caller_number_not_verified', 409);
  }
}

async function originate(req: Request, ctx: RequestContext) {
  await requirePermission(req, ctx, 'communication.telephony.call');

  const input = await req.json().catch(() => ({}));
  const idempotencyKey = clean(input?.idempotency_key, 160);
  if (!idempotencyKey) throw new TelephonyError('idempotency_key_required', 400);
  if (idempotencyKey.length < 8 || idempotencyKey.length > 160) {
    throw new TelephonyError('idempotency_key_invalid', 400);
  }

  const normalized = normalizeCallMutationInput(input as Record<string, unknown>);
  const { to, purpose, consentReference } = normalized;
  if (!isE164(to)) throw new TelephonyError('destination_invalid', 400);
  if (!purpose) throw new TelephonyError('purpose_required', 400);
  if (!consentReference) throw new TelephonyError('consent_reference_required', 400);

  const requestDigest = await digestLogicalMutation(normalized);
  const admin = adminClient();
  if (!admin) throw new TelephonyError('supabase_runtime_not_configured', 503);

  const existing = await findCallByIdempotency(admin, ctx.orgId, idempotencyKey);
  if (existing) return respondToCallReplay(req, existing as Record<string, unknown>, requestDigest);

  const loaded = await loadConfig(ctx);
  if (loaded.provider !== 'telnyx' || !loaded.config) {
    await audit(ctx, 'communication.telephony.call.blocked', null, {
      blocker: 'provider_not_configured'
    });
    throw new TelephonyError('provider_not_ready', 503);
  }

  const readiness = await probeTelnyxVoice(loaded.config);
  await persistReadiness(ctx, loaded.provider, readiness);
  if (!readiness.verified) {
    await audit(ctx, 'communication.telephony.call.blocked', null, {
      blocker: readiness.blocker,
      provider_status: readiness.statusCode
    });
    throw new TelephonyError('provider_not_ready', 503, {
      blocker: readiness.blocker
    });
  }

  await assertVerifiedCallerNumber(admin, ctx, loaded.config.fromNumber);

  const { data: providerRow, error: providerError } = await admin
    .from('atlas_telephony_providers')
    .select('id')
    .eq('organization_id', ctx.orgId)
    .eq('provider', 'telnyx')
    .single();

  if (providerError || !providerRow?.id) {
    throw new TelephonyError('provider_state_unavailable', 503);
  }

  let session: { id: string } | null = null;
  const { data: insertedSession, error: sessionError } = await admin
    .from('atlas_call_sessions')
    .insert({
      organization_id: ctx.orgId,
      actor_user_id: ctx.userId,
      provider_id: providerRow.id,
      direction: 'outbound',
      source_address: loaded.config.fromNumber,
      destination_address: to,
      purpose,
      state: 'queued',
      consent_reference: consentReference,
      recording_enabled: false,
      idempotency_key: idempotencyKey,
      request_digest: requestDigest,
      reconciliation_required: false,
      provider_evidence: {
        submission_state: 'not_submitted'
      }
    })
    .select('id')
    .single();

  if (sessionError || !insertedSession?.id) {
    if ((sessionError as { code?: string } | null)?.code === '23505') {
      const raced = await findCallByIdempotency(admin, ctx.orgId, idempotencyKey);
      if (raced) return respondToCallReplay(req, raced as Record<string, unknown>, requestDigest);
    }
    throw new TelephonyError('call_session_create_failed', 500);
  }
  session = insertedSession;

  const clientState = btoa(
    JSON.stringify({ session_id: session.id, org_id: ctx.orgId })
  );

  const webhookUrl = new URL(loaded.config.webhookUrl);
  webhookUrl.searchParams.set('org_id', ctx.orgId);

  await admin
    .from('atlas_call_sessions')
    .update({
      provider_evidence: {
        submission_state: 'attempting',
        submitted_at: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    })
    .eq('id', session.id)
    .eq('organization_id', ctx.orgId);

  let response: Response;
  try {
    response = await fetch('https://api.telnyx.com/v2/calls', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${loaded.config.apiKey}`,
        accept: 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        connection_id: loaded.config.connectionId,
        from: loaded.config.fromNumber,
        to,
        webhook_url: webhookUrl.toString(),
        webhook_url_method: 'POST',
        client_state: clientState
      }),
      cache: 'no-store'
    });
  } catch {
    await admin
      .from('atlas_call_sessions')
      .update({
        reconciliation_required: true,
        reconciliation_reason: 'provider_transport_ambiguous',
        provider_evidence: {
          submission_state: 'ambiguous',
          observed_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', session.id)
      .eq('organization_id', ctx.orgId);

    await audit(ctx, 'communication.telephony.call.reconciliation_required', session.id, {
      blocker: 'provider_transport_ambiguous'
    });
    throw new TelephonyError('provider_outcome_ambiguous', 502, {
      call_session_id: session.id,
      reconciliation_required: true
    });
  }

  const providerBody = await response.json().catch(() => ({}));
  const providerRequestId =
    response.headers.get('x-request-id') ||
    response.headers.get('telnyx-request-id');

  if (response.status >= 500) {
    await admin
      .from('atlas_call_sessions')
      .update({
        reconciliation_required: true,
        reconciliation_reason: 'provider_http_ambiguous',
        provider_evidence: {
          submission_state: 'ambiguous',
          status_code: response.status,
          request_id: providerRequestId
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', session.id)
      .eq('organization_id', ctx.orgId);
    throw new TelephonyError('provider_outcome_ambiguous', 502, {
      call_session_id: session.id,
      reconciliation_required: true
    });
  }

  if (!response.ok) {
    await admin
      .from('atlas_call_sessions')
      .update({
        state: 'failed',
        reconciliation_required: false,
        reconciliation_reason: null,
        provider_evidence: {
          submission_state: 'rejected',
          status_code: response.status,
          request_id: providerRequestId
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', session.id)
      .eq('organization_id', ctx.orgId);

    await audit(ctx, 'communication.telephony.call.failed', session.id, {
      provider_status: response.status,
      request_id: providerRequestId
    });

    throw new TelephonyError('provider_call_rejected', 502);
  }

  const data = providerBody?.data || {};
  const providerCallId = clean(data.call_control_id, 200);

  await admin
    .from('atlas_call_sessions')
    .update({
      provider_call_id: providerCallId || null,
      state: 'dialing',
      reconciliation_required: false,
      reconciliation_reason: null,
      provider_evidence: {
        submission_state: 'accepted',
        request_id: providerRequestId,
        call_leg_id: clean(data.call_leg_id, 200),
        call_session_id: clean(data.call_session_id, 200)
      },
      updated_at: new Date().toISOString()
    })
    .eq('id', session.id)
    .eq('organization_id', ctx.orgId);

  await audit(ctx, 'communication.telephony.call.queued', session.id, {
    provider: 'telnyx',
    request_id: providerRequestId
  });

  return json(req, {
    ok: true,
    call_session_id: session.id,
    state: 'dialing',
    provider: 'telnyx',
    provider_request_id: providerRequestId,
    replayed: false,
    reconciliation_required: false
  }, 202);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(req.headers.get('origin'))
    });
  }

  const url = new URL(req.url);
  const operation = url.searchParams.get('api');

  try {
    const ctx = await resolveContext(req);

    if (operation === 'readiness' && req.method === 'GET') {
      await requirePermission(req, ctx, 'communication.telephony.read');
      const readiness = await getReadiness(ctx);
      return json(req, {
        ok: true,
        service: 'atlas-communication-telephony',
        version: VERSION,
        organization_id: ctx.orgId,
        role: ctx.role,
        ...readiness,
        provider_secret_values_returned: false,
        checked_at: new Date().toISOString()
      });
    }

    if (operation === 'number-search' && req.method === 'GET') {
      return await searchNumbers(req, ctx, url);
    }

    if (operation === 'call' && req.method === 'POST') {
      return await originate(req, ctx);
    }

    throw new TelephonyError('not_found', 404);
  } catch (error) {
    if (error instanceof TelephonyError) {
      return json(req, { ok: false, error: error.code, ...error.details }, error.status);
    }
    return json(req, { ok: false, error: 'internal_error' }, 500);
  }
});
