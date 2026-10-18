import type { GpsPoint } from './gpsApi';

export type StreetCoverageStatus = 'pending' | 'located' | 'unlocated' | 'blocked';

export type StreetCoverageSegment = {
  id: string;
  label?: string;
  coordinates: Array<[number, number]>;
};

export type StreetCoverageProbe = {
  id: string;
  segmentId: string;
  segmentLabel: string | null;
  sequence: number;
  point: GpsPoint;
  status: StreetCoverageStatus;
  provider?: string | null;
  reason?: string | null;
};

export type StreetCoveragePlan = {
  spacingM: number;
  probes: StreetCoverageProbe[];
  segmentCount: number;
  totalEstimatedM: number;
};

const EARTH_RADIUS_M = 6_371_000;

function finiteCoordinate(value: number) {
  return Number.isFinite(value);
}

export function validStreetCoordinate(lon: number, lat: number) {
  return finiteCoordinate(lon) &&
    finiteCoordinate(lat) &&
    Math.abs(lon) <= 180 &&
    Math.abs(lat) <= 90;
}

export function streetDistanceM(a: [number, number], b: [number, number]) {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  if (!validStreetCoordinate(lon1, lat1) || !validStreetCoordinate(lon2, lat2)) return 0;

  const toRad = (value: number) => value * Math.PI / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);
  const sinPhi = Math.sin(deltaPhi / 2);
  const sinLambda = Math.sin(deltaLambda / 2);
  const h = sinPhi * sinPhi + Math.cos(phi1) * Math.cos(phi2) * sinLambda * sinLambda;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function interpolate(a: [number, number], b: [number, number], ratio: number): [number, number] {
  return [
    a[0] + (b[0] - a[0]) * ratio,
    a[1] + (b[1] - a[1]) * ratio
  ];
}

function pointKey(lon: number, lat: number) {
  return lon.toFixed(6) + ',' + lat.toFixed(6);
}

/**
 * Builds a deterministic street-by-street probe plan.
 *
 * The plan never invents imagery or a successful location. It only generates
 * coordinate probes along known road geometry. A consumer may mark a probe
 * `unlocated` and continue to the next probe until the end of every segment.
 */
export function buildStreetCoveragePlan(
  segments: StreetCoverageSegment[],
  spacingM = 25,
  maxProbes = 20_000
): StreetCoveragePlan {
  const safeSpacing = Math.min(250, Math.max(5, Number.isFinite(spacingM) ? spacingM : 25));
  const safeMax = Math.min(100_000, Math.max(1, Math.floor(maxProbes)));
  const probes: StreetCoverageProbe[] = [];
  const seen = new Set<string>();
  let totalEstimatedM = 0;

  for (const segment of segments) {
    if (!segment.id || segment.coordinates.length < 2) continue;
    let sequence = 0;

    for (let index = 0; index < segment.coordinates.length - 1; index += 1) {
      const start = segment.coordinates[index];
      const end = segment.coordinates[index + 1];
      if (!validStreetCoordinate(start[0], start[1]) || !validStreetCoordinate(end[0], end[1])) continue;

      const lengthM = streetDistanceM(start, end);
      totalEstimatedM += lengthM;
      const steps = Math.max(1, Math.ceil(lengthM / safeSpacing));

      for (let step = 0; step <= steps; step += 1) {
        if (probes.length >= safeMax) {
          return { spacingM: safeSpacing, probes, segmentCount: segments.length, totalEstimatedM };
        }

        // Avoid duplicating a vertex that was already emitted by the prior edge.
        if (index > 0 && step === 0) continue;
        const [lon, lat] = interpolate(start, end, step / steps);
        const key = segment.id + ':' + pointKey(lon, lat);
        if (seen.has(key)) continue;
        seen.add(key);

        probes.push({
          id: segment.id + ':' + sequence,
          segmentId: segment.id,
          segmentLabel: segment.label || null,
          sequence,
          point: {
            lat,
            lon,
            label: segment.label || 'Street coverage probe'
          },
          status: 'pending'
        });
        sequence += 1;
      }
    }
  }

  return {
    spacingM: safeSpacing,
    probes,
    segmentCount: segments.length,
    totalEstimatedM
  };
}

export function nextStreetCoverageProbe(
  plan: StreetCoveragePlan,
  afterProbeId?: string | null
): StreetCoverageProbe | null {
  let start = 0;
  if (afterProbeId) {
    const index = plan.probes.findIndex((probe) => probe.id === afterProbeId);
    if (index >= 0) start = index + 1;
  }
  for (let index = start; index < plan.probes.length; index += 1) {
    if (plan.probes[index].status === 'pending') return plan.probes[index];
  }
  return null;
}

export function resolveStreetCoverageProbe(
  plan: StreetCoveragePlan,
  probeId: string,
  status: Exclude<StreetCoverageStatus, 'pending'>,
  details: { provider?: string | null; reason?: string | null } = {}
): StreetCoveragePlan {
  return {
    ...plan,
    probes: plan.probes.map((probe) =>
      probe.id === probeId
        ? {
            ...probe,
            status,
            provider: details.provider ?? null,
            reason: details.reason ?? null
          }
        : probe
    )
  };
}

export function summarizeStreetCoverage(plan: StreetCoveragePlan) {
  const counts = {
    pending: 0,
    located: 0,
    unlocated: 0,
    blocked: 0
  };
  for (const probe of plan.probes) counts[probe.status] += 1;
  const resolved = counts.located + counts.unlocated + counts.blocked;
  return {
    ...counts,
    total: plan.probes.length,
    resolved,
    completionPct: plan.probes.length ? Math.round((resolved / plan.probes.length) * 10_000) / 100 : 0,
    complete: plan.probes.length > 0 && resolved === plan.probes.length
  };
}
