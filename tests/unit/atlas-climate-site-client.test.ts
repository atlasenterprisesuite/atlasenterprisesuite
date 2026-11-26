import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readAtlasClimateNoaaAlerts } from '../../apps/web/src/modules/city/climateNoaaApi';
import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../../apps/web/src/lib/atlasSession';

vi.mock('../../apps/web/src/lib/atlasSession', () => ({
  authorizedAtlasFetch: vi.fn(),
  getActiveAtlasOrganization: vi.fn()
}));

const siteId = '10000000-0000-4000-8000-000000000001';
const orgId = '20000000-0000-4000-8000-000000000002';
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' }
});

beforeEach(() => {
  vi.mocked(authorizedAtlasFetch).mockReset();
  vi.mocked(getActiveAtlasOrganization).mockReset();
  vi.mocked(getActiveAtlasOrganization).mockResolvedValue({ id: orgId, role: 'staff' });
});

describe('ATLAS climate verified-site client contract', () => {
  it('sends only the verified site ID in authenticated POST JSON, never raw coordinates', async () => {
    vi.mocked(authorizedAtlasFetch).mockResolvedValue(response({
      ok: true, domain: 'climate', source: 'NOAA/NWS', status: 'complete',
      mayPublishAlert: false, alerts: [],
      fetchedAt: '2026-11-26T14:00:00Z', providerCount: 0,
      rejectedCount: 0, unprocessedCount: 0, truncated: false,
      requestedPoint: { latitude: 28.5, longitude: -81.3 }
    }));
    const result = await readAtlasClimateNoaaAlerts(siteId);
    expect(result.ok).toBe(true);
    expect(authorizedAtlasFetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(authorizedAtlasFetch).mock.calls[0];
    expect(url).toBe('/functions/v1/atlas-platform-controls?api=climate-noaa-alerts');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'x-atlas-org-id': orgId });
    expect(JSON.parse(String(init?.body))).toEqual({ site_id: siteId });
  });

  it('rejects malformed site IDs before any organization or provider request', async () => {
    await expect(readAtlasClimateNoaaAlerts('https://example.test/evil')).rejects.toThrow('invalid_site_id');
    expect(getActiveAtlasOrganization).not.toHaveBeenCalled();
    expect(authorizedAtlasFetch).not.toHaveBeenCalled();
  });

  it('fails closed when the server is unavailable or denies the site', async () => {
    vi.mocked(authorizedAtlasFetch).mockResolvedValue(response({ ok: false, error: 'climate_site_not_verified' }, 403));
    await expect(readAtlasClimateNoaaAlerts(siteId)).rejects.toThrow('climate_site_not_verified');
  });

  it('never accepts an HTTP 200 response claiming emergency-publication capability', async () => {
    vi.mocked(authorizedAtlasFetch).mockResolvedValue(response({
      ok: true, domain: 'climate', mayPublishAlert: true, alerts: [], status: 'complete'
    }));
    await expect(readAtlasClimateNoaaAlerts(siteId)).rejects.toThrow('invalid_climate_provider_response');
  });
});
