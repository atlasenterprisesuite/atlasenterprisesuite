import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../../lib/atlasSession';

export type GpsPoint = {
  lat: number;
  lon: number;
  label: string;
  category?: string;
};

export type GpsSavedPlace = {
  id: string;
  label: string;
  category: string | null;
  latitude: number;
  longitude: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type GpsRouteStep = {
  id: string;
  distance_m: number;
  duration_s: number;
  name: string;
  instruction_type: string;
  modifier: string;
  location: [number, number] | null;
  exit: number | null;
  lanes: Array<{ valid: boolean; active: boolean; indications: string[] }>;
};

export type GpsRoute = {
  id: string;
  distance_m: number;
  duration_s: number;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  steps: GpsRouteStep[];
};

async function request<T>(operation: string, payload: Record<string, unknown> = {}): Promise<T> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/functions/v1/atlas-gps', {
    method: 'POST',
    headers: { 'x-atlas-org-id': organization.id },
    body: JSON.stringify({
      operation,
      organization_id: organization.id,
      ...payload
    })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok !== true) {
    throw new Error(String(body?.error || `gps_request_failed_${response.status}`));
  }
  return body as T;
}

export async function getGpsCapabilities() {
  return request<{ ok: true; capabilities: Record<string, any> }>('capabilities');
}

export async function searchGpsPlaces(query: string, language = 'es') {
  return request<{ ok: true; source: string; results: Array<{
    id: string;
    lat: number;
    lon: number;
    label: string;
    category: string;
    type: string;
    importance: number;
    boundingbox: number[] | null;
  }> }>('search', { query, language });
}

export async function calculateGpsRoute(from: GpsPoint, to: GpsPoint) {
  return request<{ ok: true; source: string; profile: 'driving'; routes: GpsRoute[] }>('route', {
    from_lat: from.lat,
    from_lon: from.lon,
    to_lat: to.lat,
    to_lon: to.lon
  });
}

export async function listGpsSavedPlaces() {
  return request<{ ok: true; places: GpsSavedPlace[] }>('saved.list');
}

export async function saveGpsPlace(place: GpsPoint) {
  return request<{ ok: true; place: GpsSavedPlace }>('saved.save', {
    label: place.label,
    category: place.category || null,
    latitude: place.lat,
    longitude: place.lon
  });
}

export async function deleteGpsPlace(id: string) {
  return request<{ ok: true; deleted: true }>('saved.delete', { id });
}
