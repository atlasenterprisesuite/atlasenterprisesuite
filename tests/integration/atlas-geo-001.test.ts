import { describe, expect, it, vi } from 'vitest';
import { evaluatePosition, fetchArcGisReadOnly, spatial360State, validateGeoResponse } from '../../apps/web/src/modules/city/geo001';
describe('GEO-001 fail-closed contracts', () => {
  it('blocks revoked consent and invalid readings', () => {
    const reading = { latitude: 28.3791667, longitude: -81.4941667, accuracyMeters: 10, observedAt: '2026-10-26T16:00:00Z', source: 'gnss' as const };
    expect(evaluatePosition(reading, false, Date.parse(reading.observedAt)).status).toBe('blocked');
    expect(evaluatePosition({ ...reading, latitude: 91 }, true, Date.parse(reading.observedAt)).status).toBe('blocked');
    expect(evaluatePosition(reading, true, Date.parse(reading.observedAt) + 31000).status).toBe('stale');
    expect(evaluatePosition(reading, true, Date.parse(reading.observedAt)).status).toBe('available');
  });
  it('never upgrades missing provenance to verified', () => {
    expect(validateGeoResponse({ features: [] }, null).status).toBe('unverified');
    expect(validateGeoResponse({ features: [] }, { source: 'https://example.org', capturedAt: '2026-10-26', sha256: 'x', license: 'public' }).status).toBe('unverified');
  });
  it('requires authorized panorama coverage', () => {
    expect(spatial360State(false, true)).toBe('blocked');
    expect(spatial360State(true, false)).toBe('fallback');
  });
  it('rejects untrusted GIS endpoints before any request', async () => {
    const mock = vi.fn();
    await expect(fetchArcGisReadOnly('https://evil.example/arcgis/rest/services/x/query?f=json', mock as unknown as typeof fetch)).rejects.toThrow('untrusted_gis_endpoint');
    expect(mock).not.toHaveBeenCalled();
  });
  it('uses GET without credentials and rejects provider errors', async () => {
    const mock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: { message: 'denied' } }) });
    await expect(fetchArcGisReadOnly('https://ocgis4.ocfl.net/arcgis/rest/services/Example/MapServer/3/query?f=json', mock as unknown as typeof fetch)).rejects.toThrow('gis_provider_error');
    expect(mock.mock.calls[0][1]).toMatchObject({ method: 'GET', credentials: 'omit', redirect: 'error' });
  });
});
