import { describe, expect, it } from 'vitest';
import { resolveLiveSpatialObservation } from './spatialContextGate';
import type { UrbanTwinSnapshot } from './urbanTwinRepository';

const snapshot: UrbanTwinSnapshot = {
  source: 'supabase_rls_live', organizationId: 'org-a', loadedAt: '2026-11-06T00:00:00Z',
  entities: [{ id: 'entity', parent_id: null, entity_type: 'building', name: 'Test', external_ref: null, source_kind: 'test', lifecycle_state: 'active', verification_state: 'verified', latitude: null, longitude: null, last_verified_at: null, updated_at: '' }],
  bindings: [{ id: 'binding', entity_id: 'entity', binding_type: 'sensor', adapter: 'test', external_ref: 'x', verification_state: 'verified', last_verified_at: null, evidence_refs: [], updated_at: '' }],
  observations: [{ id: 'observation', entity_id: 'entity', binding_id: 'binding', observation_type: 'status', provenance: 'authenticated', metric_key: 'status', value: 'ok', evidence_refs: [], observed_at: '', received_at: '' }]
};

describe('Spatial Context live presentation gate', () => {
  it('allows an authenticated observation with verified entity and binding', () => {
    expect(resolveLiveSpatialObservation(snapshot, 'org-a', 'observation').allowed).toBe(true);
  });
  it('fails closed across organizations', () => {
    expect(resolveLiveSpatialObservation(snapshot, 'org-b', 'observation')).toEqual({ allowed: false, reason: 'organization_mismatch' });
  });
  it('rejects simulated observations', () => {
    const input = { ...snapshot, observations: [{ ...snapshot.observations[0], provenance: 'simulation' as const }] };
    expect(resolveLiveSpatialObservation(input, 'org-a', 'observation').allowed).toBe(false);
  });
  it('rejects revoked entities and bindings', () => {
    expect(resolveLiveSpatialObservation({ ...snapshot, entities: [{ ...snapshot.entities[0], verification_state: 'revoked' }] }, 'org-a', 'observation').allowed).toBe(false);
    expect(resolveLiveSpatialObservation({ ...snapshot, bindings: [{ ...snapshot.bindings[0], verification_state: 'revoked' }] }, 'org-a', 'observation').allowed).toBe(false);
  });
  it('rejects mismatched binding entity and missing observations', () => {
    expect(resolveLiveSpatialObservation({ ...snapshot, bindings: [{ ...snapshot.bindings[0], entity_id: 'other' }] }, 'org-a', 'observation').allowed).toBe(false);
    expect(resolveLiveSpatialObservation(snapshot, 'org-a', 'missing').allowed).toBe(false);
  });
});
