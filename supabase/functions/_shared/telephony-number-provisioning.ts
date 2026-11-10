import { digestLogicalMutation } from './telephony-idempotency.ts';
import {
  searchTelnyxAvailableNumbers,
  type TelephonyFetch,
  type TelnyxVoiceConfig
} from './telephony-telnyx.ts';

export type NumberProvisioningResource = {
  id: string;
  organizationId: string;
  e164: string;
  state: string;
  upstreamProvider: string;
  externalResourceId: string | null;
  providerEvidence: Record<string, unknown>;
  idempotencyKey: string | null;
  requestDigest: string | null;
  createdBy: string;
};

export interface NumberProvisioningStore {
  findByIdempotencyKey(
    organizationId: string,
    key: string
  ): Promise<NumberProvisioningResource | null>;
  findReusable(organizationId: string): Promise<NumberProvisioningResource | null>;
  createOrdered(
    input: Omit<NumberProvisioningResource, 'id'>
  ): Promise<NumberProvisioningResource>;
  updateResource(
    id: string,
    patch: Partial<NumberProvisioningResource>
  ): Promise<NumberProvisioningResource>;
}

export type ProvisionTelnyxTestNumberInput = {
  organizationId: string;
  actorUserId: string;
  idempotencyKey: string;
  environment: string;
  testScope: boolean;
  countryCode: string;
  areaCode: string;
  config: TelnyxVoiceConfig;
};

export type ProvisioningResult =
  | { status: 'blocked'; blocker: string; resourceId?: string }
  | { status: 'reused'; resourceId: string; e164: string }
  | { status: 'reused_idempotency'; resourceId: string; e164: string }
  | { status: 'ordered'; resourceId: string; e164: string; providerOrderId: string }
  | { status: 'reconciliation_required'; resourceId: string; e164: string; blocker: string };

export type CleanupResult =
  | { status: 'blocked'; blocker: string; cleanupJobId?: string }
  | { status: 'cleanup_pending'; cleanupJobId: string }
  | { status: 'released'; cleanupJobId: string }
  | { status: 'reconciliation_required'; blocker: string; cleanupJobId?: string };

type ProvisioningDeps = {
  writeEnabled: boolean;
  store: NumberProvisioningStore;
  fetchImpl?: TelephonyFetch;
};

function requestId(response: Response): string | null {
  return response.headers.get('x-request-id') || response.headers.get('telnyx-request-id');
}

function normalizedProvisioningRequest(input: ProvisionTelnyxTestNumberInput) {
  return {
    countryCode: input.countryCode.trim().toUpperCase(),
    areaCode: input.areaCode.trim()
  };
}

async function updateEvidence(
  store: NumberProvisioningStore,
  resource: NumberProvisioningResource,
  evidence: Record<string, unknown>,
  patch: Partial<NumberProvisioningResource> = {}
) {
  return store.updateResource(resource.id, {
    ...patch,
    providerEvidence: {
      ...resource.providerEvidence,
      ...evidence
    }
  });
}

export async function provisionTelnyxTestNumber(
  input: ProvisionTelnyxTestNumberInput,
  deps: ProvisioningDeps
): Promise<ProvisioningResult> {
  if (!deps.writeEnabled) return { status: 'blocked', blocker: 'write_gate_disabled' };
  if (input.environment !== 'test') return { status: 'blocked', blocker: 'test_environment_required' };
  if (input.testScope !== true) return { status: 'blocked', blocker: 'test_scope_required' };
  if (input.countryCode.trim().toUpperCase() !== 'US') {
    return { status: 'blocked', blocker: 'test_country_not_supported' };
  }
  if (!/^\d{3}$/.test(input.areaCode.trim())) {
    return { status: 'blocked', blocker: 'test_area_code_invalid' };
  }
  const idempotencyKey = input.idempotencyKey.trim();
  if (idempotencyKey.length < 8 || idempotencyKey.length > 160) {
    return { status: 'blocked', blocker: 'idempotency_key_invalid' };
  }

  const normalized = normalizedProvisioningRequest(input);
  const digest = await digestLogicalMutation(normalized);

  let existing: NumberProvisioningResource | null;
  try {
    existing = await deps.store.findByIdempotencyKey(input.organizationId, idempotencyKey);
  } catch {
    return { status: 'blocked', blocker: 'idempotency_lookup_failed' };
  }

  if (existing) {
    if (!existing.requestDigest || existing.requestDigest !== digest) {
      return { status: 'blocked', blocker: 'idempotency_conflict', resourceId: existing.id };
    }
    if (existing.providerEvidence.submission_state === 'ambiguous') {
      return {
        status: 'reconciliation_required',
        resourceId: existing.id,
        e164: existing.e164,
        blocker: 'provider_order_outcome_ambiguous'
      };
    }
    return { status: 'reused_idempotency', resourceId: existing.id, e164: existing.e164 };
  }

  let reusable: NumberProvisioningResource | null;
  try {
    reusable = await deps.store.findReusable(input.organizationId);
  } catch {
    return { status: 'blocked', blocker: 'local_inventory_lookup_failed' };
  }
  if (reusable) {
    return { status: 'reused', resourceId: reusable.id, e164: reusable.e164 };
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  const discovery = await searchTelnyxAvailableNumbers(
    input.config,
    { countryCode: normalized.countryCode, areaCode: normalized.areaCode, limit: 5 },
    fetchImpl
  );
  if (discovery.status === 'lookup_error') {
    return { status: 'blocked', blocker: discovery.blocker };
  }
  if (discovery.status === 'no_matches') {
    return { status: 'blocked', blocker: 'provider_no_matches' };
  }

  const candidate = discovery.candidates.find((item) => item.reservable);
  if (!candidate) return { status: 'blocked', blocker: 'provider_no_reservable_match' };

  let resource = await deps.store.createOrdered({
    organizationId: input.organizationId,
    e164: candidate.phoneNumber,
    state: 'ordered',
    upstreamProvider: 'telnyx',
    externalResourceId: null,
    providerEvidence: {
      submission_state: 'attempting',
      discovery_request_id: discovery.requestId,
      observed_at: new Date().toISOString()
    },
    idempotencyKey,
    requestDigest: digest,
    createdBy: input.actorUserId
  });

  let response: Response;
  try {
    response = await fetchImpl('https://api.telnyx.com/v2/number_orders', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${input.config.apiKey}`,
        accept: 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        phone_numbers: [{ phone_number: candidate.phoneNumber }],
        connection_id: input.config.connectionId
      }),
      cache: 'no-store'
    });
  } catch {
    resource = await updateEvidence(deps.store, resource, {
      submission_state: 'ambiguous',
      reconciliation_reason: 'provider_transport_ambiguous',
      observed_at: new Date().toISOString()
    });
    return {
      status: 'reconciliation_required',
      resourceId: resource.id,
      e164: resource.e164,
      blocker: 'provider_order_outcome_ambiguous'
    };
  }

  const providerRequestId = requestId(response);
  if (response.status >= 500) {
    resource = await updateEvidence(deps.store, resource, {
      submission_state: 'ambiguous',
      reconciliation_reason: 'provider_http_ambiguous',
      status_code: response.status,
      request_id: providerRequestId
    });
    return {
      status: 'reconciliation_required',
      resourceId: resource.id,
      e164: resource.e164,
      blocker: 'provider_order_outcome_ambiguous'
    };
  }

  if (!response.ok) {
    await updateEvidence(
      deps.store,
      resource,
      {
        submission_state: 'rejected',
        status_code: response.status,
        request_id: providerRequestId
      },
      { state: 'unavailable' }
    );
    return { status: 'blocked', blocker: 'provider_order_rejected', resourceId: resource.id };
  }

  const body = await response.json().catch(() => null) as { data?: Record<string, unknown> } | null;
  const orderId = typeof body?.data?.id === 'string' ? body.data.id.trim() : '';
  if (!orderId) {
    resource = await updateEvidence(deps.store, resource, {
      submission_state: 'ambiguous',
      reconciliation_reason: 'provider_response_missing_order_id',
      request_id: providerRequestId,
      status_code: response.status
    });
    return {
      status: 'reconciliation_required',
      resourceId: resource.id,
      e164: resource.e164,
      blocker: 'provider_order_response_invalid'
    };
  }

  resource = await updateEvidence(deps.store, resource, {
    submission_state: 'accepted',
    order_id: orderId,
    order_status: typeof body?.data?.status === 'string' ? body.data.status : null,
    request_id: providerRequestId,
    status_code: response.status
  });

  return {
    status: 'ordered',
    resourceId: resource.id,
    e164: resource.e164,
    providerOrderId: orderId
  };
}

function operationContainsTarget(value: unknown, target: string): boolean {
  if (typeof value === 'string') return value === target;
  if (Array.isArray(value)) return value.some((item) => operationContainsTarget(item, target));
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return [record.phone_number, record.phoneNumber, record.number, record.phone_numbers]
    .some((item) => operationContainsTarget(item, target));
}

async function parseCleanupResponse(
  response: Response,
  resource: NumberProvisioningResource,
  store: NumberProvisioningStore,
  knownJobId?: string
): Promise<CleanupResult> {
  const providerRequestId = requestId(response);
  if (response.status >= 500) {
    await updateEvidence(store, resource, {
      cleanup_state: 'ambiguous',
      cleanup_request_id: providerRequestId,
      cleanup_status_code: response.status
    });
    return {
      status: 'reconciliation_required',
      blocker: 'cleanup_provider_outcome_ambiguous',
      ...(knownJobId ? { cleanupJobId: knownJobId } : {})
    };
  }
  if (!response.ok) {
    await updateEvidence(store, resource, {
      cleanup_state: 'rejected',
      cleanup_request_id: providerRequestId,
      cleanup_status_code: response.status
    });
    return {
      status: 'blocked',
      blocker: 'cleanup_provider_rejected',
      ...(knownJobId ? { cleanupJobId: knownJobId } : {})
    };
  }

  const body = await response.json().catch(() => null) as { data?: Record<string, unknown> } | null;
  const data = body?.data;
  const jobId = typeof data?.id === 'string' && data.id.trim()
    ? data.id.trim()
    : knownJobId || '';
  const status = typeof data?.status === 'string' ? data.status : '';

  if (!jobId || !status) {
    await updateEvidence(store, resource, {
      cleanup_state: 'ambiguous',
      cleanup_request_id: providerRequestId,
      cleanup_status_code: response.status
    });
    return {
      status: 'reconciliation_required',
      blocker: 'cleanup_provider_response_invalid',
      ...(jobId ? { cleanupJobId: jobId } : {})
    };
  }

  if (status === 'pending' || status === 'in_progress') {
    await updateEvidence(store, resource, {
      cleanup_state: status,
      cleanup_job_id: jobId,
      cleanup_request_id: providerRequestId
    });
    return { status: 'cleanup_pending', cleanupJobId: jobId };
  }

  if (status === 'completed') {
    const successful = operationContainsTarget(data?.successful_operations, resource.e164);
    if (!successful) {
      await updateEvidence(store, resource, {
        cleanup_state: 'completed_unverified',
        cleanup_job_id: jobId,
        cleanup_request_id: providerRequestId
      });
      return {
        status: 'reconciliation_required',
        blocker: 'cleanup_target_not_confirmed',
        cleanupJobId: jobId
      };
    }

    await updateEvidence(
      store,
      resource,
      {
        cleanup_state: 'completed',
        cleanup_job_id: jobId,
        cleanup_request_id: providerRequestId,
        cleanup_verified_at: new Date().toISOString()
      },
      { state: 'released' }
    );
    return { status: 'released', cleanupJobId: jobId };
  }

  if (status === 'failed' || status === 'expired') {
    await updateEvidence(store, resource, {
      cleanup_state: status,
      cleanup_job_id: jobId,
      cleanup_request_id: providerRequestId
    });
    return { status: 'blocked', blocker: `cleanup_job_${status}`, cleanupJobId: jobId };
  }

  await updateEvidence(store, resource, {
    cleanup_state: 'unknown',
    cleanup_job_id: jobId,
    cleanup_request_id: providerRequestId,
    cleanup_provider_status: status
  });
  return {
    status: 'reconciliation_required',
    blocker: 'cleanup_job_status_unknown',
    cleanupJobId: jobId
  };
}

export async function cleanupTelnyxTestNumber(
  input: {
    resource: NumberProvisioningResource;
    config: TelnyxVoiceConfig;
    cleanupJobId: string | null;
  },
  deps: ProvisioningDeps
): Promise<CleanupResult> {
  if (!deps.writeEnabled) return { status: 'blocked', blocker: 'write_gate_disabled' };
  if (input.resource.upstreamProvider !== 'telnyx') {
    return { status: 'blocked', blocker: 'cleanup_provider_mismatch' };
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  let response: Response;
  try {
    if (input.cleanupJobId) {
      response = await fetchImpl(
        `https://api.telnyx.com/v2/phone_numbers/jobs/${encodeURIComponent(input.cleanupJobId)}`,
        {
          headers: {
            authorization: `Bearer ${input.config.apiKey}`,
            accept: 'application/json'
          },
          cache: 'no-store'
        }
      );
    } else {
      response = await fetchImpl('https://api.telnyx.com/v2/phone_numbers/jobs/delete_phone_numbers', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${input.config.apiKey}`,
          accept: 'application/json',
          'content-type': 'application/json'
        },
        body: JSON.stringify({ phone_numbers: [input.resource.e164] }),
        cache: 'no-store'
      });
    }
  } catch {
    await updateEvidence(deps.store, input.resource, {
      cleanup_state: 'ambiguous',
      cleanup_reconciliation_reason: 'provider_transport_ambiguous'
    });
    return {
      status: 'reconciliation_required',
      blocker: 'cleanup_provider_outcome_ambiguous',
      ...(input.cleanupJobId ? { cleanupJobId: input.cleanupJobId } : {})
    };
  }

  return parseCleanupResponse(
    response,
    input.resource,
    deps.store,
    input.cleanupJobId || undefined
  );
}
