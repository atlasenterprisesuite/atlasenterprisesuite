import { describe, expect, it } from 'vitest';
import { assertHospitalityScope, canAccessHospitalityScope } from '../../packages/hospitality/scope';

describe('Hospitality scope', () => {
  const actor = { organizationId: 'org-1', propertyIds: ['property-1'] as const };

  it('allows the authorized property', () => {
    expect(canAccessHospitalityScope(actor, { organizationId: 'org-1', propertyId: 'property-1' })).toBe(true);
  });

  it('denies another property by default', () => {
    expect(canAccessHospitalityScope(actor, { organizationId: 'org-1', propertyId: 'property-2' })).toBe(false);
  });

  it('denies another organization and throws from the assertion helper', () => {
    const resource = { organizationId: 'org-2', propertyId: 'property-1' };
    expect(canAccessHospitalityScope(actor, resource)).toBe(false);
    expect(() => assertHospitalityScope(actor, resource)).toThrow(/scope/i);
  });

  it('fails closed when scope provenance is blank', () => {
    expect(canAccessHospitalityScope({ organizationId: '', propertyIds: [] }, { organizationId: '', propertyId: '' })).toBe(false);
  });
});
