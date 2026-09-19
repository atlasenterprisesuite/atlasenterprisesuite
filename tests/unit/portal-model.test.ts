import { describe, expect, it } from 'vitest';
import { ATLAS_MODULES } from '../../apps/web/src/modules/registry';
import { buildPortalDestinations } from '../../apps/web/src/modules/galaxy/portalModel';

describe('ATLAS Portals model', () => {
  it('derives portal destinations from the canonical module registry', () => {
    const destinations = buildPortalDestinations({ modules: ATLAS_MODULES, hasIdentity: true });
    expect(destinations.find((item) => item.id === 'finance')?.route).toBe('/finance');
    expect(destinations.find((item) => item.id === 'payroll')?.status).toBe('partial');
    expect(destinations.find((item) => item.id === 'crm')?.status).toBe('external-gated');
  });

  it('does not create a recursive Galaxy portal', () => {
    const destinations = buildPortalDestinations({ modules: ATLAS_MODULES, hasIdentity: true });
    expect(destinations.some((item) => item.id === 'galaxy')).toBe(false);
  });

  it('fails closed for authenticated destinations when identity is absent', () => {
    const destinations = buildPortalDestinations({ modules: ATLAS_MODULES, hasIdentity: false });
    const crm = destinations.find((item) => item.id === 'crm');
    expect(crm?.status).toBe('blocked');
    expect(crm?.statusLabel).toBe('Identity required');
    expect(crm?.navigable).toBe(false);
  });

  it('contains no fabricated production telemetry', () => {
    const serialized = JSON.stringify(buildPortalDestinations({ modules: ATLAS_MODULES, hasIdentity: true }));
    for (const forbidden of ['99.99%', '$42.8M', '1,420', '256-bit', 'approvalCount']) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
