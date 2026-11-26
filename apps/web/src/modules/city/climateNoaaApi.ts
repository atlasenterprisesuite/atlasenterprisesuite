import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../../lib/atlasSession';
import type { NoaaNormalizedResponse } from '../../../../../packages/analytics/src/noaa-active-alerts';

export type AtlasClimateNoaaResponse = NoaaNormalizedResponse & { ok: true; domain: 'climate' };

/**
 * Read-only, permission-gated lookup. The server resolves verified site coordinates, controls NOAA requests, provenance,
 * authorization checks and normalization. No device location is read implicitly.
 */
export async function readAtlasClimateNoaaAlerts(siteId: string): Promise<AtlasClimateNoaaResponse> {
  if (typeof siteId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(siteId)) {
    throw new Error('invalid_site_id');
  }
  const organization = await getActiveAtlasOrganization();
  // Private POST body sends only a site ID; the server validates its tenant and verified coordinates.
  const response = await authorizedAtlasFetch('/functions/v1/atlas-platform-controls?api=climate-noaa-alerts', {
    method: 'POST',
    headers: { 'x-atlas-org-id': organization.id },
    body: JSON.stringify({ site_id: siteId })
  });
  const raw: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = raw !== null && typeof raw === 'object' && 'error' in raw
      ? String(raw.error)
      : 'climate_noaa_lookup_failed';
    throw new Error(error);
  }
  if (!raw || typeof raw !== 'object' || !('ok' in raw) || raw.ok !== true ||
      !('domain' in raw) || raw.domain !== 'climate' ||
      !('mayPublishAlert' in raw) || raw.mayPublishAlert !== false ||
      !('alerts' in raw) || !Array.isArray(raw.alerts)) {
    throw new Error('invalid_climate_provider_response');
  }
  return raw as AtlasClimateNoaaResponse;
}
