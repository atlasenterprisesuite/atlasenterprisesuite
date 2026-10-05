import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import type {
  NumberProvisioningResource,
  NumberProvisioningStore
} from './telephony-number-provisioning.ts';

type SupabaseAdmin = ReturnType<typeof createClient>;

function evidence(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function mapResource(row: Record<string, unknown>): NumberProvisioningResource {
  return {
    id: String(row.id || ''),
    organizationId: String(row.organization_id || ''),
    e164: String(row.e164 || ''),
    state: String(row.state || ''),
    upstreamProvider: String(row.upstream_provider || ''),
    externalResourceId:
      typeof row.external_resource_id === 'string' && row.external_resource_id
        ? row.external_resource_id
        : null,
    providerEvidence: evidence(row.provider_evidence),
    idempotencyKey:
      typeof row.idempotency_key === 'string' && row.idempotency_key
        ? row.idempotency_key
        : null,
    requestDigest:
      typeof row.request_digest === 'string' && row.request_digest
        ? row.request_digest
        : null,
    createdBy: typeof row.created_by === 'string' ? row.created_by : ''
  };
}

const RESOURCE_SELECT =
  'id,organization_id,e164,state,upstream_provider,external_resource_id,provider_evidence,idempotency_key,request_digest,created_by,assigned_service,verified_at';

export function createSupabaseNumberProvisioningStore(input: {
  admin: SupabaseAdmin;
  organizationId: string;
  areaCode: string;
}): NumberProvisioningStore {
  const { admin, organizationId, areaCode } = input;

  return {
    async findByIdempotencyKey(orgId, key) {
      if (orgId !== organizationId) throw new Error('scope_mismatch');
      const { data, error } = await admin
        .from('atlas_number_resources')
        .select(RESOURCE_SELECT)
        .eq('organization_id', organizationId)
        .eq('idempotency_key', key)
        .maybeSingle();
      if (error) throw error;
      return data ? mapResource(data as Record<string, unknown>) : null;
    },

    async findReusable(orgId) {
      if (orgId !== organizationId) throw new Error('scope_mismatch');
      const { data, error } = await admin
        .from('atlas_number_resources')
        .select(RESOURCE_SELECT)
        .eq('organization_id', organizationId)
        .eq('upstream_provider', 'telnyx')
        .like('e164', `+1${areaCode}%`)
        .in('state', ['verified', 'assigned', 'active'])
        .limit(20);
      if (error) throw error;

      const rows = Array.isArray(data) ? data : [];
      const reusable = rows.find((row) => {
        const service = (row as Record<string, unknown>).assigned_service;
        return service === null || service === 'communication';
      });
      return reusable ? mapResource(reusable as Record<string, unknown>) : null;
    },

    async createOrdered(resource) {
      const { data, error } = await admin
        .from('atlas_number_resources')
        .insert({
          organization_id: organizationId,
          e164: resource.e164,
          country_code: 'US',
          area_code: resource.e164.slice(2, 5),
          state: 'ordered',
          upstream_provider: 'telnyx',
          external_resource_id: null,
          provider_evidence: resource.providerEvidence,
          idempotency_key: resource.idempotencyKey,
          request_digest: resource.requestDigest,
          created_by: resource.createdBy
        })
        .select(RESOURCE_SELECT)
        .single();
      if (error || !data) throw error || new Error('number_resource_create_failed');
      return mapResource(data as Record<string, unknown>);
    },

    async updateResource(id, patch) {
      const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (patch.state !== undefined) dbPatch.state = patch.state;
      if (patch.providerEvidence !== undefined) dbPatch.provider_evidence = patch.providerEvidence;
      if (patch.externalResourceId !== undefined) dbPatch.external_resource_id = patch.externalResourceId;
      if (patch.idempotencyKey !== undefined) dbPatch.idempotency_key = patch.idempotencyKey;
      if (patch.requestDigest !== undefined) dbPatch.request_digest = patch.requestDigest;
      if (patch.createdBy !== undefined) dbPatch.created_by = patch.createdBy;

      const { data, error } = await admin
        .from('atlas_number_resources')
        .update(dbPatch)
        .eq('id', id)
        .eq('organization_id', organizationId)
        .select(RESOURCE_SELECT)
        .single();
      if (error || !data) throw error || new Error('number_resource_update_failed');
      return mapResource(data as Record<string, unknown>);
    }
  };
}

export async function loadTestProvisionedNumber(input: {
  admin: SupabaseAdmin;
  organizationId: string;
  resourceId: string;
}): Promise<NumberProvisioningResource | null> {
  const { data, error } = await input.admin
    .from('atlas_number_resources')
    .select(RESOURCE_SELECT)
    .eq('id', input.resourceId)
    .eq('organization_id', input.organizationId)
    .eq('upstream_provider', 'telnyx')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const resource = mapResource(data as Record<string, unknown>);
  if (!resource.idempotencyKey || !resource.createdBy) return null;
  if (typeof resource.providerEvidence.order_id !== 'string' || !resource.providerEvidence.order_id) {
    return null;
  }
  return resource;
}
