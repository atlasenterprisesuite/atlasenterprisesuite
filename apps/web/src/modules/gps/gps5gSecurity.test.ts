import { describe, expect, it } from 'vitest';
import { authorizeGpsSession, chooseRenderQuality, validateGeoAsset, validatePosition } from './gps5gSecurity';

const request = { tenantId: 'alpha', actorTenantId: 'alpha', locationConsent: true, permissionActive: true, costApproved: false };
describe('GPS 5G fail-closed contract', () => {
  it('denies missing consent and revoked permissions', () => {
    expect(() => authorizeGpsSession({ ...request, locationConsent: false })).toThrow();
    expect(() => authorizeGpsSession({ ...request, permissionActive: false })).toThrow();
  });
  it('denies cross-tenant access and paid providers without approval', () => {
    expect(() => authorizeGpsSession({ ...request, actorTenantId: 'beta' })).toThrow();
    expect(() => authorizeGpsSession({ ...request, paidProvider: true })).toThrow();
  });
  it('rejects invalid coordinates and misleading accuracy', () => {
    expect(() => validatePosition({ lat: 91, lon: 0, accuracyM: 5 })).toThrow();
    expect(() => validatePosition({ lat: 28, lon: -81, accuracyM: -1 })).toThrow();
  });
  it('rejects unlicensed verified geometry', () => {
    expect(() => validateGeoAsset({ status: 'verified', sourceUrl: 'https://example.com', license: '' })).toThrow();
  });
  it('falls back when offline or connection details are unavailable', () => {
    expect(chooseRenderQuality({ online: false, effectiveType: '4g' })).toBe('offline-2d');
    expect(chooseRenderQuality({ online: true })).toBe('standard-2d');
  });
});