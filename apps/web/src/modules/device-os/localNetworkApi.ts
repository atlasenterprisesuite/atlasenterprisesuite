import {
  authorizedAtlasFetch,
  getActiveAtlasOrganization
} from '../../lib/atlasSession';
import {
  normalizeLocalEndpointOrigin,
  normalizeProbePath,
  type AtlasLocalEndpoint
} from './localNetworkAccess';

type LocalNetworkEventType =
  | 'probe_requested'
  | 'probe_succeeded'
  | 'probe_failed'
  | 'blocked_by_atlas'
  | 'permission_denied';

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body
      ? String((body as { message?: unknown }).message || '')
      : '';
    throw new Error(message || `local_network_policy_request_failed_${response.status}`);
  }
  return body as T;
}

export async function listLocalNetworkEndpoints(): Promise<AtlasLocalEndpoint[]> {
  const organization = await getActiveAtlasOrganization();
  const org = encodeURIComponent(`eq.${organization.id}`);
  const response = await authorizedAtlasFetch(
    `/rest/v1/atlas_local_network_endpoints?org_id=${org}&select=id,org_id,label,origin,address_space,probe_path,enabled,created_at&order=created_at.asc`,
    { method: 'GET' }
  );
  return parseJson<AtlasLocalEndpoint[]>(response);
}

export async function createLocalNetworkEndpoint(input: {
  label: string;
  origin: string;
  probePath?: string;
}): Promise<AtlasLocalEndpoint> {
  const organization = await getActiveAtlasOrganization();
  const normalized = normalizeLocalEndpointOrigin(input.origin);
  const response = await authorizedAtlasFetch('/rest/v1/atlas_local_network_endpoints', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      org_id: organization.id,
      label: input.label.trim(),
      origin: normalized.origin,
      address_space: normalized.addressSpace,
      probe_path: normalizeProbePath(input.probePath ?? '/'),
      enabled: true
    })
  });
  const rows = await parseJson<AtlasLocalEndpoint[]>(response);
  if (!rows[0]) throw new Error('local_network_endpoint_not_returned');
  return rows[0];
}

export async function setLocalNetworkEndpointEnabled(
  endpointId: string,
  enabled: boolean
): Promise<void> {
  const organization = await getActiveAtlasOrganization();
  const id = encodeURIComponent(`eq.${endpointId}`);
  const org = encodeURIComponent(`eq.${organization.id}`);
  const response = await authorizedAtlasFetch(
    `/rest/v1/atlas_local_network_endpoints?id=${id}&org_id=${org}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        enabled,
        updated_by: undefined
      })
    }
  );
  if (!response.ok) throw new Error(`local_network_endpoint_update_failed_${response.status}`);
}

export async function recordLocalNetworkEvent(input: {
  endpoint: AtlasLocalEndpoint;
  eventType: LocalNetworkEventType;
  success?: boolean | null;
  httpStatus?: number | null;
  errorCode?: string | null;
}): Promise<void> {
  const organization = await getActiveAtlasOrganization();
  if (input.endpoint.org_id !== organization.id) throw new Error('local_network_scope_mismatch');

  const response = await authorizedAtlasFetch('/rest/v1/atlas_local_network_events', {
    method: 'POST',
    body: JSON.stringify({
      org_id: organization.id,
      endpoint_id: input.endpoint.id,
      event_type: input.eventType,
      origin: input.endpoint.origin,
      success: input.success ?? null,
      http_status: input.httpStatus ?? null,
      error_code: input.errorCode ?? null
    })
  });
  if (!response.ok) throw new Error(`local_network_audit_failed_${response.status}`);
}
