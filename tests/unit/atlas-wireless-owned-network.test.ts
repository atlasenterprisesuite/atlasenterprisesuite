import { describe, expect, it } from 'vitest';
import {
  assertAtlasPublicWirelessActivationAllowed,
  evaluateAtlasOwnedNetworkReadiness,
  type AtlasWirelessComponentReadiness,
  type AtlasWirelessLaunchAuthorization
} from '../../supabase/functions/_shared/atlas-wireless-network';

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG = '22222222-2222-4222-8222-222222222222';
const NOW = Date.parse('2026-09-25T17:45:00.000Z');

const evidence = (organizationId = ORG, reference = 'evidence://verified') => ([
  { organizationId, reference }
] as const);

const component = (
  layer: AtlasWirelessComponentReadiness['layer'],
  state: AtlasWirelessComponentReadiness['state'] = 'ready',
  evidenceRefs: AtlasWirelessComponentReadiness['evidenceRefs'] = evidence(),
  checkedAt = '2026-09-25T17:45:00.000Z',
  organizationId = ORG
): AtlasWirelessComponentReadiness => ({
  organizationId,
  layer,
  state,
  blocker: state === 'ready' ? null : `blocked:${layer}`,
  checkedAt,
  evidenceRefs
});

const allTechnicalComponents = () => [
  component('core'),
  component('ran'),
  component('spectrum'),
  component('backhaul'),
  component('observability'),
  component('sim_esim'),
  component('interconnect'),
  component('emergency_services')
] as const;

const authorization = (
  overrides: Partial<AtlasWirelessLaunchAuthorization> = {}
): AtlasWirelessLaunchAuthorization => ({
  organizationId: ORG,
  commercialAuthorized: true,
  regulatoryAuthorized: true,
  billingAndTaxReady: true,
  stagingVerified: true,
  endToEndVerified: true,
  checkedAt: '2026-09-25T17:45:00.000Z',
  evidenceRefs: evidence(),
  ...overrides
});

describe('ATLAS Wireless owned-network readiness', () => {
  it('allows a verified lab without claiming public mobile service', () => {
    const readiness = evaluateAtlasOwnedNetworkReadiness(ORG, 'atlas-owned', [
      component('core'),
      component('ran'),
      component('spectrum'),
      component('backhaul'),
      component('observability')
    ], { nowMs: NOW });

    expect(readiness.organizationId).toBe(ORG);
    expect(readiness.serviceProvider).toBe('atlas-wireless');
    expect(readiness.labReady).toBe(true);
    expect(readiness.technicalPublicReady).toBe(false);
    expect(readiness.blockers).toContain('missing:sim_esim');
    expect(readiness.blockers).toContain('missing:interconnect');
    expect(readiness.blockers).toContain('missing:emergency_services');
  });

  it('fails closed when spectrum is configured but unverified', () => {
    const readiness = evaluateAtlasOwnedNetworkReadiness(ORG, 'atlas-owned', [
      component('core'),
      component('ran'),
      component('spectrum', 'configured_unverified'),
      component('backhaul'),
      component('observability')
    ], { nowMs: NOW });

    expect(readiness.labReady).toBe(false);
    expect(readiness.technicalPublicReady).toBe(false);
    expect(readiness.blockers).toContain('blocked:spectrum');
  });

  it('requires nonblank same-organization evidence', () => {
    const blank = evaluateAtlasOwnedNetworkReadiness(ORG, 'atlas-owned', [
      component('core'),
      component('ran'),
      component('spectrum', 'ready', evidence(ORG, '   ')),
      component('backhaul'),
      component('observability')
    ], { nowMs: NOW });

    const wrongOrg = evaluateAtlasOwnedNetworkReadiness(ORG, 'atlas-owned', [
      component('core'),
      component('ran'),
      component('spectrum', 'ready', evidence(OTHER_ORG)),
      component('backhaul'),
      component('observability')
    ], { nowMs: NOW });

    expect(blank.blockers).toContain('evidence_required:spectrum');
    expect(wrongOrg.blockers).toContain('evidence_required:spectrum');
  });

  it('rejects stale component verification', () => {
    const readiness = evaluateAtlasOwnedNetworkReadiness(ORG, 'atlas-owned', [
      component('core'),
      component('ran'),
      component('spectrum', 'ready', evidence(), '2026-09-25T17:00:00.000Z'),
      component('backhaul'),
      component('observability')
    ], { nowMs: NOW });

    expect(readiness.labReady).toBe(false);
    expect(readiness.blockers).toContain('stale_verification:spectrum');
  });

  it('fails closed on duplicate or cross-organization layers', () => {
    const duplicate = evaluateAtlasOwnedNetworkReadiness(ORG, 'atlas-owned', [
      component('core'),
      component('ran', 'offline'),
      component('ran'),
      component('spectrum'),
      component('backhaul'),
      component('observability')
    ], { nowMs: NOW });

    const crossOrg = evaluateAtlasOwnedNetworkReadiness(ORG, 'atlas-owned', [
      component('core'),
      component('ran', 'ready', evidence(OTHER_ORG), undefined, OTHER_ORG),
      component('spectrum'),
      component('backhaul'),
      component('observability')
    ], { nowMs: NOW });

    expect(duplicate.labReady).toBe(false);
    expect(duplicate.blockers).toContain('duplicate_layer:ran');
    expect(crossOrg.labReady).toBe(false);
    expect(crossOrg.blockers).toContain('organization_mismatch:ran');
  });

  it('keeps hybrid and wholesale modes behind verified MVNO readiness', () => {
    const hybrid = evaluateAtlasOwnedNetworkReadiness(
      ORG,
      'hybrid',
      allTechnicalComponents(),
      { nowMs: NOW }
    );
    const wholesale = evaluateAtlasOwnedNetworkReadiness(
      ORG,
      'wholesale-fallback',
      allTechnicalComponents(),
      { nowMs: NOW }
    );
    const verifiedHybrid = evaluateAtlasOwnedNetworkReadiness(
      ORG,
      'hybrid',
      allTechnicalComponents(),
      { nowMs: NOW, wholesaleProviderReady: true }
    );

    expect(hybrid.technicalPublicReady).toBe(false);
    expect(wholesale.technicalPublicReady).toBe(false);
    expect(hybrid.blockers).toContain('mvno_provider_readiness_required');
    expect(wholesale.blockers).toContain('mvno_provider_readiness_required');
    expect(verifiedHybrid.technicalPublicReady).toBe(true);
  });

  it('recomputes readiness and requires explicit commercial/regulatory launch authorization', () => {
    expect(() => assertAtlasPublicWirelessActivationAllowed(
      ORG,
      'atlas-owned',
      allTechnicalComponents(),
      authorization(),
      { nowMs: NOW }
    )).not.toThrow();

    expect(() => assertAtlasPublicWirelessActivationAllowed(
      ORG,
      'atlas-owned',
      allTechnicalComponents(),
      authorization({ regulatoryAuthorized: false }),
      { nowMs: NOW }
    )).toThrow(/regulatory_authorization_required/);

    expect(() => assertAtlasPublicWirelessActivationAllowed(
      ORG,
      'atlas-owned',
      allTechnicalComponents().filter((item) => item.layer !== 'emergency_services'),
      authorization(),
      { nowMs: NOW }
    )).toThrow(/missing:emergency_services/);
  });

  it('rejects forged launch authorization scope, stale evidence and wholesale bypass', () => {
    expect(() => assertAtlasPublicWirelessActivationAllowed(
      ORG,
      'atlas-owned',
      allTechnicalComponents(),
      authorization({ organizationId: OTHER_ORG }),
      { nowMs: NOW }
    )).toThrow(/launch_authorization_organization_mismatch/);

    expect(() => assertAtlasPublicWirelessActivationAllowed(
      ORG,
      'atlas-owned',
      allTechnicalComponents(),
      authorization({ checkedAt: '2026-09-25T17:00:00.000Z' }),
      { nowMs: NOW }
    )).toThrow(/launch_authorization_stale/);

    expect(() => assertAtlasPublicWirelessActivationAllowed(
      ORG,
      'wholesale-fallback',
      allTechnicalComponents(),
      authorization(),
      { nowMs: NOW, wholesaleProviderReady: false }
    )).toThrow(/mvno_provider_readiness_required/);
  });
});
