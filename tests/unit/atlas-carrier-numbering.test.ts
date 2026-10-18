import { describe, expect, it } from 'vitest';
import {
  assertAtlasNumberProvisioningAllowed,
  canProvisionAtlasNumber,
  type AtlasNumberingAuthorization
} from '../../supabase/functions/_shared/atlas-carrier-numbering';

function authorization(
  overrides: Partial<AtlasNumberingAuthorization> = {}
): AtlasNumberingAuthorization {
  return {
    organizationId: 'org-1',
    mode: 'direct',
    state: 'not_started',
    authorityReference: null,
    ocn: null,
    spid: null,
    facilitiesReady: false,
    e911Ready: false,
    robocallMitigationReady: false,
    checkedAt: '2026-09-27T00:00:00Z',
    ...overrides
  };
}

describe('ATLAS Carrier numbering gate', () => {
  it('blocks direct number provisioning before numbering authority is ready', () => {
    expect(canProvisionAtlasNumber(authorization())).toBe(false);
    expect(() => assertAtlasNumberProvisioningAllowed(authorization()))
      .toThrow('atlas_numbering_not_authorized');
  });

  it('requires every direct-numbering compliance gate', () => {
    const base = authorization({
      state: 'nanpa_ready',
      facilitiesReady: true,
      e911Ready: true,
      robocallMitigationReady: true
    });
    expect(canProvisionAtlasNumber(base)).toBe(true);
    expect(canProvisionAtlasNumber({ ...base, e911Ready: false })).toBe(false);
    expect(canProvisionAtlasNumber({ ...base, facilitiesReady: false })).toBe(false);
    expect(canProvisionAtlasNumber({ ...base, robocallMitigationReady: false })).toBe(false);
  });

  it('allows partner-backed provisioning only after the partner path and E911 are verified', () => {
    expect(canProvisionAtlasNumber(authorization({
      mode: 'partner',
      state: 'partner_path',
      e911Ready: true
    }))).toBe(true);

    expect(canProvisionAtlasNumber(authorization({
      mode: 'partner',
      state: 'partner_path',
      e911Ready: false
    }))).toBe(false);
  });
});
