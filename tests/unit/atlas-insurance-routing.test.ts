import { describe, expect, it } from 'vitest';
import { resolveAtlasIdentityTarget } from '../../apps/web/src/identity/IdentityPage';
import { resolveInsuranceReturnTo } from '../../apps/web/src/modules/insurance/insuranceApi';

describe('ATLAS Insurance routing boundaries', () => {
  it('allows insurance destinations through ATLAS Identity', () => {
    expect(resolveAtlasIdentityTarget('/insurance')).toBe('/insurance');
    expect(resolveAtlasIdentityTarget('/insurance/verify?scope=insurance_access')).toBe('/insurance/verify?scope=insurance_access');
  });

  it('keeps insurance return targets inside the Insurance module', () => {
    expect(resolveInsuranceReturnTo('/insurance')).toBe('/insurance');
    expect(resolveInsuranceReturnTo('/insurance/member/opaque-123')).toBe('/insurance/member/opaque-123');
    expect(resolveInsuranceReturnTo('https://evil.example')).toBe('/insurance');
    expect(resolveInsuranceReturnTo('//evil.example')).toBe('/insurance');
    expect(resolveInsuranceReturnTo('/finance')).toBe('/insurance');
    expect(resolveInsuranceReturnTo('/insurance\\evil')).toBe('/insurance');
  });
});
