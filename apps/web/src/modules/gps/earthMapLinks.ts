/**
 * Public outbound links for the ATLAS GPS 4D selected point.
 *
 * This adapter does not embed, cache or proxy proprietary map data and does not
 * imply access to offline map packs, Street View or provider SDKs.
 * Opening a link is a user-initiated action performed by the UI.
 */
export type EarthMapPoint = { lat: number; lon: number };

export type EarthMapLinks = {
  googleMaps: string;
  appleMaps: string;
};

export function earthMapLinks(point: EarthMapPoint): EarthMapLinks | null {
  const { lat, lon } = point;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  // URLSearchParams handles encoding; only validated numeric coordinates are sent.
  const coordinates = `${lat},${lon}`;
  const google = new URL('https://www.google.com/maps/search/');
  google.searchParams.set('api', '1');
  google.searchParams.set('query', coordinates);

  const apple = new URL('https://maps.apple.com/');
  apple.searchParams.set('ll', coordinates);
  apple.searchParams.set('q', coordinates);

  return { googleMaps: google.toString(), appleMaps: apple.toString() };
}
