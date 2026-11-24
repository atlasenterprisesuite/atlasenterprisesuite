import { describe, expect, it } from 'vitest';
import { mayManageIdentityShield, type IdentityShieldContext } from '../../apps/web/src/identity/identityShieldPolicy';

const valid: IdentityShieldContext = {
  authenticated: true, activeOrganizationId: 'org-a', requestedOrganizationId: 'org-a',
  permissions: ['identity.shield.manage'], assuranceLevel: 'aal2', providerVerified: true,
};
describe('ATLAS Identity Shield P0 deny-by-default policy', () => {
  it('allows verified AAL2 and exact tenant permission', () => {
    expect(mayManageIdentityShield(valid)).toBe(true);
  });
  it.each([
    { authenticated: false },
    { activeOrganizationId: null },
    { requestedOrganizationId: 'org-b' },
    { requestedOrganizationId: null },
    { permissions: [] },
    { assuranceLevel: 'aal1' },
    { assuranceLevel: null },
    { providerVerified: false },
  ] as Partial<IdentityShieldContext>[])('denies invalid privileged context %j', (override) => {
    expect(mayManageIdentityShield({ ...valid, ...override })).toBe(false);
  });
});
