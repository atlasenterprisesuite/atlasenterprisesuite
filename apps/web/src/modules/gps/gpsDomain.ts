import type { GpsPoint, GpsRoute, GpsRouteStep } from './gpsApi';

export type GpsViewMode = 'street' | 'satellite' | 'terrain3d';

export type GpsCapabilityState = 'available' | 'external-gated' | 'blocked';

export const GPS_CAPABILITY_MATRIX: Array<{
  id: string;
  label: string;
  state: GpsCapabilityState;
  detail: string;
}> = [
  { id: 'street', label: 'Street map', state: 'external-gated', detail: 'OpenFreeMap/OpenStreetMap public infrastructure; no ATLAS SLA.' },
  { id: 'satellite', label: 'Satellite / aerial', state: 'available', detail: 'USGS The National Map imagery for the United States; public-data layer.' },
  { id: 'terrain3d', label: '3D terrain', state: 'external-gated', detail: 'Mapterhorn terrain rendered with MapLibre; no ATLAS SLA.' },
  { id: 'routing', label: 'Driving routes', state: 'external-gated', detail: 'OSRM adapter; public demo unless a governed ATLAS endpoint is configured.' },
  { id: 'turns', label: 'Turn-by-turn', state: 'available', detail: 'Derived from authenticated ATLAS GPS route responses.' },
  { id: 'lanes', label: 'Lane guidance', state: 'available', detail: 'Shown only when upstream intersections include lane evidence.' },
  { id: 'reroute', label: 'Automatic rerouting', state: 'available', detail: 'Client navigation logic reroutes only after measurable route deviation.' },
  { id: 'voice', label: 'Voice guidance', state: 'available', detail: 'Uses browser speech synthesis; no paid provider.' },
  { id: 'traffic', label: 'Live traffic', state: 'blocked', detail: 'Requires an authorized live traffic provider.' },
  { id: 'incidents', label: 'Live incidents', state: 'blocked', detail: 'Requires authoritative incident data.' },
  { id: 'streetview', label: 'Street-level imagery', state: 'blocked', detail: 'Requires an authorized street-level imagery provider.' },
  { id: 'transit', label: 'Transit realtime', state: 'blocked', detail: 'Requires GTFS/GTFS-RT or an OpenTripPlanner deployment.' },
  { id: 'offline', label: 'Offline world maps', state: 'blocked', detail: 'Requires self-hosted PMTiles or an offline-licensed dataset; public OSM tiles are not bulk-downloaded.' }
];

const EARTH_RADIUS_M = 6_371_000;

function toRadians(value: number) {
  return value * Math.PI / 180;
}

export function metersBetween(a: Pick<GpsPoint, 'lat' | 'lon'>, b: Pick<GpsPoint, 'lat' | 'lon'>) {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

function metersPerDegreeLongitude(latitude: number) {
  return 111_320 * Math.max(0.01, Math.cos(toRadians(latitude)));
}

function planarPointToSegmentMeters(
  point: Pick<GpsPoint, 'lat' | 'lon'>,
  start: [number, number],
  end: [number, number]
) {
  const midLat = (start[1] + end[1] + point.lat) / 3;
  const sx = start[0] * metersPerDegreeLongitude(midLat);
  const sy = start[1] * 110_540;
  const ex = end[0] * metersPerDegreeLongitude(midLat);
  const ey = end[1] * 110_540;
  const px = point.lon * metersPerDegreeLongitude(midLat);
  const py = point.lat * 110_540;
  const dx = ex - sx;
  const dy = ey - sy;
  if (dx === 0 && dy === 0) return Math.hypot(px - sx, py - sy);
  const t = Math.max(0, Math.min(1, ((px - sx) * dx + (py - sy) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (sx + t * dx), py - (sy + t * dy));
}

export function routeDeviationMeters(point: Pick<GpsPoint, 'lat' | 'lon'>, route: GpsRoute | null) {
  const coordinates = route?.geometry?.coordinates || [];
  if (coordinates.length < 2) return Number.POSITIVE_INFINITY;
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 1; index < coordinates.length; index += 1) {
    minimum = Math.min(minimum, planarPointToSegmentMeters(point, coordinates[index - 1], coordinates[index]));
  }
  return minimum;
}

export function routeProgress(point: Pick<GpsPoint, 'lat' | 'lon'>, route: GpsRoute | null) {
  const coordinates = route?.geometry?.coordinates || [];
  if (coordinates.length < 2) return { progress: 0, remaining_m: route?.distance_m || 0 };

  let total = 0;
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  const cumulative = [0];

  for (let index = 1; index < coordinates.length; index += 1) {
    const segment = metersBetween(
      { lat: coordinates[index - 1][1], lon: coordinates[index - 1][0] },
      { lat: coordinates[index][1], lon: coordinates[index][0] }
    );
    total += segment;
    cumulative.push(total);

    const distance = metersBetween(point, { lat: coordinates[index][1], lon: coordinates[index][0] });
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  }

  const progressed = cumulative[nearestIndex] || 0;
  const progress = total > 0 ? Math.max(0, Math.min(1, progressed / total)) : 0;
  return {
    progress,
    remaining_m: Math.max(0, (route?.distance_m || total) * (1 - progress))
  };
}

export function spokenInstruction(step: GpsRouteStep | null) {
  if (!step) return '';
  const road = step.name ? ` en ${step.name}` : '';
  const modifier = step.modifier ? ` ${step.modifier.replaceAll('_', ' ')}` : '';
  const exit = step.exit ? `, salida ${step.exit}` : '';
  const type = step.instruction_type || 'continue';
  const dictionary: Record<string, string> = {
    depart: 'Inicia la ruta',
    arrive: 'Has llegado a tu destino',
    turn: 'Gira',
    continue: 'Continúa',
    merge: 'Incorpórate',
    fork: 'Mantente',
    'on ramp': 'Toma la rampa',
    'off ramp': 'Toma la salida',
    roundabout: 'Entra en la rotonda',
    rotary: 'Entra en la rotonda',
    'new name': 'Continúa'
  };
  return `${dictionary[type] || 'Continúa'}${modifier}${road}${exit}`.trim();
}

export function formatDistance(meters: number) {
  const miles = meters / 1609.344;
  if (miles >= 0.2) return `${miles.toFixed(miles >= 10 ? 0 : 1)} mi`;
  return `${Math.round(meters * 3.28084)} ft`;
}

export function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
}
