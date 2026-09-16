import { describe, expect, it } from 'vitest';
import {
  HospitalityScopeError,
  assertHospitalityScope,
  canAccessHospitalityScope
} from '../../packages/hospitality/scope';

describe('Hospitality property scope', () => {
  it('allows an explicitly authorized property in the same organization', () => {
    expect(canAccessHospitalityScope(
      { organizationId: 'org-a', propertyIds: ['p-1'] },
      { organizationId: 'org-a', propertyId: 'p-1' }
    )).toBe(true);
  });

  it('denies a different property even inside the same organization', () => {
    expect(canAccessHospitalityScope(
      { organizationId: 'org-a', propertyIds: ['p-1'] },
      { organizationId: 'org-a', propertyId: 'p-2' }
    )).toBe(false);
  });

  it('denies cross-organization scope', () => {
    expect(canAccessHospitalityScope(
      { organizationId: 'org-a', propertyIds: ['p-1'] },
      { organizationId: 'org-b', propertyId: 'p-1' }
    )).toBe(false);
  });

  it('fails closed when property scope is incomplete', () => {
    expect(canAccessHospitalityScope(
      { organizationId: 'org-a', propertyIds: [] },
      { organizationId: 'org-a', propertyId: '' }
    )).toBe(false);
    expect(() => assertHospitalityScope(
      { organizationId: 'org-a', propertyIds: ['p-1'] },
      { organizationId: 'org-a', propertyId: 'p-2' }
    )).toThrow(HospitalityScopeError);
  });
});
