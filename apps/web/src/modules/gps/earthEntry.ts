export type SharedGpsPoint = { lat: number; lon: number; label: string };
/** Explicit, validated entry only; never infer coordinates from absent URL fields. */
export function readSharedGpsPoint(search: string): SharedGpsPoint | null {
  const p = new URLSearchParams(search);
  if (p.getAll('lat').length !== 1 || p.getAll('lon').length !== 1) return null;
  const rawLat = p.get('lat') ?? '', rawLon = p.get('lon') ?? '';
  const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
  if (!decimal.test(rawLat) || !decimal.test(rawLon)) return null;
  const lat = Number(rawLat), lon = Number(rawLon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const label = (p.get('label') ?? '').replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0,160) || 'Destino compartido';
  return {lat,lon,label};
}
/** Internal navigation state, not a URL or a provider request. */
export function readTravelDestination(state: unknown): string {
  if (!state || typeof state !== 'object' || !Object.prototype.hasOwnProperty.call(state,'travelDestination')) return '';
  const raw = (state as Record<string, unknown>).travelDestination;
  if (typeof raw !== 'string' || /[\x00-\x1f\x7f]/.test(raw)) return '';
  const destination = raw.trim();
  return destination.length <= 160 ? destination : '';
}
