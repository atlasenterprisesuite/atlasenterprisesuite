import type { UrbanTwinSnapshot, UrbanTwinObservation } from './urbanTwinRepository';

export type SpatialContextDecision =
  | { allowed: true; observation: UrbanTwinObservation }
  | { allowed: false; reason: 'organization_mismatch' | 'entity_unverified' | 'binding_unverified' | 'observation_not_authenticated' | 'observation_not_bound' | 'observation_not_found' };

/**
 * UI presentation gate only. Server-side RLS/RBAC and adapter authentication
 * remain mandatory; this function does not grant access to data or devices.
 */
export function resolveLiveSpatialObservation(
  snapshot: UrbanTwinSnapshot,
  activeOrganizationId: string,
  observationId: string
): SpatialContextDecision {
  if (!activeOrganizationId || snapshot.organizationId !== activeOrganizationId) {
    return { allowed: false, reason: 'organization_mismatch' };
  }
  const observation = snapshot.observations.find((item) => item.id === observationId);
  if (!observation) return { allowed: false, reason: 'observation_not_found' };
  if (observation.provenance !== 'authenticated') {
    return { allowed: false, reason: 'observation_not_authenticated' };
  }
  const entity = snapshot.entities.find((item) => item.id === observation.entity_id);
  if (!entity || entity.verification_state !== 'verified') {
    return { allowed: false, reason: 'entity_unverified' };
  }
  if (!observation.binding_id) return { allowed: false, reason: 'observation_not_bound' };
  const binding = snapshot.bindings.find((item) => item.id === observation.binding_id && item.entity_id === entity.id);
  if (!binding || binding.verification_state !== 'verified') {
    return { allowed: false, reason: 'binding_unverified' };
  }
  return { allowed: true, observation };
}
