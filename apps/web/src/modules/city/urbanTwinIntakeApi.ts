import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../../lib/atlasSession';
import type { UrbanTwinEntityType } from './urbanTwinRepository';

export type UrbanTwinIntakeCapabilities = {
  ok: true;
  service: 'atlas-platform-controls';
  can_manage: boolean;
  can_verify: boolean;
  role: string;
};

type EntityInput = {
  entity_type: UrbanTwinEntityType;
  name: string;
  parent_id?: string | null;
  external_ref?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type BindingInput = {
  entity_id: string;
  binding_type: 'cleanscan' | 'device' | 'gps' | 'work' | 'sensor' | 'network' | 'facility';
  adapter: string;
  external_ref: string;
};

type VerifyInput = {
  target_type: 'entity' | 'binding';
  target_id: string;
  evidence_refs: string[];
};

async function request<T>(api: string, method: 'GET' | 'POST', body?: unknown): Promise<T> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch(`/functions/v1/atlas-platform-controls?api=${encodeURIComponent(`urban-twin-${api}`)}`, {
    method,
    headers: { 'x-atlas-org-id': organization.id },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const data = await response.json().catch(() => ({ error: 'invalid_response' }));
  if (!response.ok) {
    throw Object.assign(new Error(String(data?.error || `request_failed_${response.status}`)), {
      status: response.status,
      data
    });
  }
  return data as T;
}

export function getUrbanTwinIntakeCapabilities() {
  return request<UrbanTwinIntakeCapabilities>('capabilities', 'GET');
}

export function registerUrbanTwinEntity(input: EntityInput) {
  return request<{ ok: true; entity: { id: string; verification_state: 'unverified' } }>('entity', 'POST', input);
}

export function registerUrbanTwinBinding(input: BindingInput) {
  return request<{ ok: true; binding: { id: string; verification_state: 'unverified' } }>('binding', 'POST', input);
}

export function verifyUrbanTwinTarget(input: VerifyInput) {
  return request<{ ok: true; target: { id: string; verification_state: 'verified' } }>('verify', 'POST', input);
}
