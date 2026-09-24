import type { GpsRoute } from './gpsApi';

export type NavigationLocationSample = {
  lat: number;
  lon: number;
  accuracy_m: number | null;
  heading_deg: number | null;
  speed_mps: number | null;
  timestamp: number;
};

export type NavigationEngineObservation = {
  raw: NavigationLocationSample;
  filtered: NavigationLocationSample;
  display: { lat: number; lon: number };
  source: 'gps' | 'route-snap';
  confidence: number;
  course_deg: number | null;
  off_route_m: number;
  route_progress: number;
  remaining_m: number;
  along_route_m: number;
  step_index: number;
  reroute_suggested: boolean;
  arrived: boolean;
};

type ProjectedPoint = {
  lat: number;
  lon: number;
  distance_m: number;
  along_route_m: number;
  route_length_m: number;
  segment_index: number;
};

export type NavigationEngineOptions = {
  snap_threshold_m?: number;
  reroute_threshold_m?: number;
  reroute_confirmations?: number;
  max_snap_accuracy_m?: number;
  arrival_threshold_m?: number;
};

const EARTH_RADIUS_M = 6_371_000;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function radians(value: number) {
  return value * Math.PI / 180;
}

function degrees(value: number) {
  return value * 180 / Math.PI;
}

export function distanceMeters(
  a: Pick<NavigationLocationSample, 'lat' | 'lon'>,
  b: Pick<NavigationLocationSample, 'lat' | 'lon'>
) {
  const dLat = radians(b.lat - a.lat);
  const dLon = radians(b.lon - a.lon);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function bearingDegrees(
  a: Pick<NavigationLocationSample, 'lat' | 'lon'>,
  b: Pick<NavigationLocationSample, 'lat' | 'lon'>
) {
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const dLon = radians(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2)
    - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (degrees(Math.atan2(y, x)) + 360) % 360;
}

function metersPerDegreeLongitude(latitude: number) {
  return 111_320 * Math.max(0.01, Math.cos(radians(latitude)));
}

function projectToSegment(
  point: Pick<NavigationLocationSample, 'lat' | 'lon'>,
  start: [number, number],
  end: [number, number]
) {
  const meanLat = (point.lat + start[1] + end[1]) / 3;
  const mx = metersPerDegreeLongitude(meanLat);
  const my = 110_540;
  const sx = start[0] * mx;
  const sy = start[1] * my;
  const ex = end[0] * mx;
  const ey = end[1] * my;
  const px = point.lon * mx;
  const py = point.lat * my;
  const dx = ex - sx;
  const dy = ey - sy;
  const denominator = dx * dx + dy * dy;
  const t = denominator === 0 ? 0 : clamp(((px - sx) * dx + (py - sy) * dy) / denominator, 0, 1);
  const x = sx + t * dx;
  const y = sy + t * dy;
  return {
    t,
    lon: x / mx,
    lat: y / my,
    distance_m: Math.hypot(px - x, py - y)
  };
}

function projectToRoute(
  point: Pick<NavigationLocationSample, 'lat' | 'lon'>,
  route: GpsRoute
): ProjectedPoint | null {
  const coordinates = route.geometry?.coordinates || [];
  if (coordinates.length < 2) return null;

  let routeLength = 0;
  const cumulative = [0];
  for (let index = 1; index < coordinates.length; index += 1) {
    routeLength += distanceMeters(
      { lat: coordinates[index - 1][1], lon: coordinates[index - 1][0] },
      { lat: coordinates[index][1], lon: coordinates[index][0] }
    );
    cumulative.push(routeLength);
  }

  let best: ProjectedPoint | null = null;
  for (let index = 1; index < coordinates.length; index += 1) {
    const start = coordinates[index - 1];
    const end = coordinates[index];
    const projection = projectToSegment(point, start, end);
    const segmentLength = Math.max(0, cumulative[index] - cumulative[index - 1]);
    const along = cumulative[index - 1] + segmentLength * projection.t;
    if (!best || projection.distance_m < best.distance_m) {
      best = {
        lat: projection.lat,
        lon: projection.lon,
        distance_m: projection.distance_m,
        along_route_m: along,
        route_length_m: routeLength,
        segment_index: index - 1
      };
    }
  }
  return best;
}

function confidenceForAccuracy(accuracy: number | null) {
  if (accuracy === null || !Number.isFinite(accuracy)) return 0.45;
  if (accuracy <= 5) return 1;
  if (accuracy <= 10) return 0.94;
  if (accuracy <= 20) return 0.82;
  if (accuracy <= 40) return 0.65;
  if (accuracy <= 80) return 0.42;
  return 0.2;
}

function smoothSample(
  previous: NavigationLocationSample | null,
  sample: NavigationLocationSample
): NavigationLocationSample {
  if (!previous) return sample;
  const elapsed = Math.max(0.1, (sample.timestamp - previous.timestamp) / 1000);
  const accuracy = sample.accuracy_m ?? 30;
  const speed = Math.max(0, sample.speed_mps ?? 0);
  const movement = distanceMeters(previous, sample);

  if (movement > Math.max(160, speed * elapsed * 4 + accuracy * 3)) {
    return sample;
  }

  const accuracyWeight = clamp(1 - accuracy / 120, 0.15, 0.8);
  const motionWeight = clamp(speed / 24, 0, 0.28);
  const timeWeight = clamp(elapsed / 8, 0, 0.18);
  const alpha = clamp(0.18 + accuracyWeight * 0.45 + motionWeight + timeWeight, 0.18, 0.86);

  return {
    ...sample,
    lat: previous.lat + (sample.lat - previous.lat) * alpha,
    lon: previous.lon + (sample.lon - previous.lon) * alpha
  };
}

function stepIndexForProgress(route: GpsRoute, alongRouteM: number, currentStepIndex: number) {
  const steps = route.steps || [];
  if (!steps.length) return 0;
  let nextIndex = clamp(currentStepIndex, 0, steps.length - 1);

  for (let index = nextIndex; index < steps.length - 1; index += 1) {
    const location = steps[index]?.location;
    if (!location) continue;
    const projected = projectToRoute({ lat: location[1], lon: location[0] }, route);
    if (!projected) continue;
    if (alongRouteM > projected.along_route_m + 18) nextIndex = index + 1;
    else break;
  }
  return nextIndex;
}

export class AtlasNavigationEngine {
  private readonly snapThresholdM: number;
  private readonly rerouteThresholdM: number;
  private readonly rerouteConfirmationsRequired: number;
  private readonly maxSnapAccuracyM: number;
  private readonly arrivalThresholdM: number;
  private filtered: NavigationLocationSample | null = null;
  private previousFiltered: NavigationLocationSample | null = null;
  private offRouteConfirmations = 0;

  constructor(options: NavigationEngineOptions = {}) {
    this.snapThresholdM = options.snap_threshold_m ?? 45;
    this.rerouteThresholdM = options.reroute_threshold_m ?? 85;
    this.rerouteConfirmationsRequired = options.reroute_confirmations ?? 3;
    this.maxSnapAccuracyM = options.max_snap_accuracy_m ?? 70;
    this.arrivalThresholdM = options.arrival_threshold_m ?? 28;
  }

  reset() {
    this.filtered = null;
    this.previousFiltered = null;
    this.offRouteConfirmations = 0;
  }

  update(
    sample: NavigationLocationSample,
    route: GpsRoute,
    currentStepIndex: number
  ): NavigationEngineObservation {
    const prior = this.filtered;
    const filtered = smoothSample(prior, sample);
    this.previousFiltered = prior;
    this.filtered = filtered;

    const projection = projectToRoute(filtered, route);
    const accuracy = filtered.accuracy_m ?? 35;
    const dynamicSnapThreshold = Math.max(this.snapThresholdM, Math.min(75, accuracy * 0.8));
    const maySnap = accuracy <= this.maxSnapAccuracyM
      && projection !== null
      && projection.distance_m <= dynamicSnapThreshold;

    const display = maySnap && projection
      ? { lat: projection.lat, lon: projection.lon }
      : { lat: filtered.lat, lon: filtered.lon };

    const geometryLength = projection?.route_length_m || Math.max(1, route.distance_m || 1);
    const alongRouteM = projection?.along_route_m || 0;
    const progress = clamp(alongRouteM / geometryLength, 0, 1);
    const remaining = Math.max(0, (route.distance_m || geometryLength) * (1 - progress));
    const offRoute = projection?.distance_m ?? Number.POSITIVE_INFINITY;

    const rerouteThreshold = Math.max(this.rerouteThresholdM, accuracy * 1.5);
    const eligibleForReroute = accuracy <= 100 && Number.isFinite(offRoute) && offRoute > rerouteThreshold;
    this.offRouteConfirmations = eligibleForReroute ? this.offRouteConfirmations + 1 : 0;

    const movementCourse = this.previousFiltered
      && distanceMeters(this.previousFiltered, filtered) >= 3
      ? bearingDegrees(this.previousFiltered, filtered)
      : null;
    const course = filtered.heading_deg !== null && Number.isFinite(filtered.heading_deg)
      ? filtered.heading_deg
      : movementCourse;

    const coordinates = route.geometry?.coordinates || [];
    const routeEnd = coordinates.length
      ? { lon: coordinates[coordinates.length - 1][0], lat: coordinates[coordinates.length - 1][1] }
      : null;
    const distanceToEnd = routeEnd ? distanceMeters(filtered, routeEnd) : Number.POSITIVE_INFINITY;
    const arrived = distanceToEnd <= Math.max(this.arrivalThresholdM, Math.min(60, accuracy))
      || progress >= 0.998;

    return {
      raw: sample,
      filtered,
      display,
      source: maySnap ? 'route-snap' : 'gps',
      confidence: confidenceForAccuracy(accuracy),
      course_deg: course,
      off_route_m: offRoute,
      route_progress: progress,
      remaining_m: remaining,
      along_route_m: alongRouteM,
      step_index: stepIndexForProgress(route, alongRouteM, currentStepIndex),
      reroute_suggested: this.offRouteConfirmations >= this.rerouteConfirmationsRequired,
      arrived
    };
  }
}
