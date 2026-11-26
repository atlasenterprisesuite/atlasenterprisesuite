import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../../lib/atlasSession';
import type { NoaaNormalizedResponse } from '../../../../../packages/analytics/src/noaa-active-alerts';

export type AtlasClimateNoaaResponse = NoaaNormalizedResponse & { ok: true; domain: 'climate' };

/**
 * Read-only, permission-gated lookup. The server owns NOAA credentials, provenance,
 * authorization checks and normalization. No device location is read implicitly.
 */
export async function readAtlasClimateNoaaAlerts(latitude: number, longitude: number): Promise<AtlasClimateNoaaResponse> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('invalid_coordinates');
  const organization = await getActiveAtlasOrganization();
  const params = new URLSearchParams({
    api: 'climate-noaa-alerts',
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4)
  });
  const response = await authorizedAtlasFetch('/functions/v1/atlas-platform-controls?' + params.toString(), {
    method: 'GET',
    headers: { 'x-atlas-org-id': organization.id }
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
