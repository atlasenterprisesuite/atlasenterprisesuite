import { describe, expect, it } from 'vitest';
import {
  assertAtlasPublicWirelessActivationAllowed,
  evaluateAtlasOwnedNetworkReadiness,
  type AtlasWirelessComponentReadiness
} from '../../supabase/functions/_shared/atlas-wireless-network';

const component = (
  layer: AtlasWirelessComponentReadiness['layer'],
  state: AtlasWirelessComponentReadiness['state'] = 'ready',
  evidenceRefs: readonly string[] = ['evidence://verified']
): AtlasWirelessComponentReadiness => ({
  layer,
  state,
  blocker: state === 'ready' ? null : `blocked:${layer}`,
  checkedAt: '2026-09-25T17:45:00.000Z',
  evidenceRefs
});

describe('ATLAS Wireless owned-network readiness', () => {
  it('allows a verified lab without claiming public mobile service', () => {
    const readiness = evaluateAtlasOwnedNetworkReadiness('atlas-owned', [
      component('core'),
      component('ran'),
      component('spectrum'),
      component('backhaul'),
      component('observability')
    ]);

    expect(readiness.serviceProvider).toBe('atlas-wireless');
    expect(readiness.labReady).toBe(true);
    expect(readiness.publicServiceReady).toBe(false);
    expect(readiness.blockers).toContain('missing:sim_esim');
    expect(readiness.blockers).toContain('missing:interconnect');
    expect(readiness.blockers).toContain('missing:emergency_services');
  });

  it('fails closed when spectrum is configured but unverified', () => {
    const readiness = evaluateAtlasOwnedNetworkReadiness('atlas-owned', [
      component('core'),
      component('ran'),
      component('spectrum', 'configured_unverified'),
      component('backhaul'),
      component('observability')
    ]);

    expect(readiness.labReady).toBe(false);
    expect(readiness.publicServiceReady).toBe(false);
    expect(readiness.blockers).toContain('blocked:spectrum');
  });

  it('requires evidence even when a component reports ready', () => {
    const readiness = evaluateAtlasOwnedNetworkReadiness('atlas-owned', [
      component('core'),
      component('ran'),
      component('spectrum', 'ready', []),
      component('backhaul'),
      component('observability')
    ]);

    expect(readiness.labReady).toBe(false);
    expect(readiness.blockers).toContain('evidence_required:spectrum');
  });

  it('permits public activation only when all required layers are verified', () => {
    const readiness = evaluateAtlasOwnedNetworkReadiness('atlas-owned', [
      component('core'),
      component('ran'),
      component('spectrum'),
      component('backhaul'),
      component('observability'),
      component('sim_esim'),
      component('interconnect'),
      component('emergency_services')
    ]);

    expect(readiness.labReady).toBe(true);
    expect(readiness.publicServiceReady).toBe(true);
    expect(() => assertAtlasPublicWirelessActivationAllowed(readiness)).not.toThrow();
  });

  it('blocks public activation when any required layer is missing', () => {
    const readiness = evaluateAtlasOwnedNetworkReadiness('hybrid', [
      component('core'),
      component('ran'),
      component('spectrum'),
      component('backhaul'),
      component('observability'),
      component('sim_esim'),
      component('interconnect')
    ]);

    expect(() => assertAtlasPublicWirelessActivationAllowed(readiness))
      .toThrow(/atlas_wireless_public_service_blocked:missing:emergency_services/);
  });
});
