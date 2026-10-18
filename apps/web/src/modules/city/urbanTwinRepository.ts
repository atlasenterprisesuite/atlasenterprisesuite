import { atlasAuthorizedJson, getActiveAtlasOrganization } from '../../lib/atlasSession';

export type UrbanTwinEntityType = 'district' | 'site' | 'building' | 'floor' | 'space' | 'asset' | 'infrastructure';
export type UrbanTwinVerificationState = 'simulation' | 'unverified' | 'verified' | 'revoked';
export type UrbanTwinBindingState = 'unverified' | 'verified' | 'degraded' | 'revoked';

export type UrbanTwinEntity = {
  id: string;
  parent_id: string | null;
  entity_type: UrbanTwinEntityType;
  name: string;
  external_ref: string | null;
  source_kind: string;
  lifecycle_state: string;
  verification_state: UrbanTwinVerificationState;
  latitude: number | null;
  longitude: number | null;
  last_verified_at: string | null;
  updated_at: string;
};

export type UrbanTwinBinding = {
  id: string;
  entity_id: string;
  binding_type: string;
  adapter: string;
  external_ref: string;
  verification_state: UrbanTwinBindingState;
  last_verified_at: string | null;
  evidence_refs: unknown[];
  updated_at: string;
};

export type UrbanTwinObservation = {
  id: string;
  entity_id: string;
  binding_id: string | null;
  observation_type: string;
  provenance: 'simulation' | 'authenticated';
  metric_key: string;
  value: unknown;
  evidence_refs: unknown[];
  observed_at: string;
  received_at: string;
};

export type UrbanTwinSnapshot = {
  source: 'supabase_rls_live';
  organizationId: string;
  entities: UrbanTwinEntity[];
  bindings: UrbanTwinBinding[];
  observations: UrbanTwinObservation[];
  loadedAt: string;
};

function orgFilter(orgId: string) {
  return encodeURIComponent(`eq.${orgId}`);
}

export async function loadUrbanTwinSnapshot(): Promise<UrbanTwinSnapshot> {
  const organization = await getActiveAtlasOrganization();
  const filter = orgFilter(organization.id);

  const [entities, bindings, observations] = await Promise.all([
    atlasAuthorizedJson<UrbanTwinEntity[]>(
      `/rest/v1/atlas_urban_twin_entities?org_id=${filter}&select=id,parent_id,entity_type,name,external_ref,source_kind,lifecycle_state,verification_state,latitude,longitude,last_verified_at,updated_at&order=entity_type.asc,name.asc`
    ),
    atlasAuthorizedJson<UrbanTwinBinding[]>(
      `/rest/v1/atlas_urban_twin_bindings?org_id=${filter}&select=id,entity_id,binding_type,adapter,external_ref,verification_state,last_verified_at,evidence_refs,updated_at&order=updated_at.desc`
    ),
    atlasAuthorizedJson<UrbanTwinObservation[]>(
      `/rest/v1/atlas_urban_twin_observations?org_id=${filter}&select=id,entity_id,binding_id,observation_type,provenance,metric_key,value,evidence_refs,observed_at,received_at&order=observed_at.desc&limit=40`
    )
  ]);

  return {
    source: 'supabase_rls_live',
    organizationId: organization.id,
    entities,
    bindings,
    observations,
    loadedAt: new Date().toISOString()
  };
}

export function summarizeUrbanTwin(snapshot: UrbanTwinSnapshot) {
  return {
    entities: snapshot.entities.length,
    verifiedEntities: snapshot.entities.filter((item) => item.verification_state === 'verified').length,
    bindings: snapshot.bindings.length,
    verifiedBindings: snapshot.bindings.filter((item) => item.verification_state === 'verified').length,
    authenticatedObservations: snapshot.observations.filter((item) => item.provenance === 'authenticated').length,
    simulatedObservations: snapshot.observations.filter((item) => item.provenance === 'simulation').length
  };
}
