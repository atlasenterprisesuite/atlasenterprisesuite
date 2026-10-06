import type { GpsPoint } from '../gps/gpsApi';
import { metersBetween } from '../gps/gpsDomain';

export function validateRidePoints(origin: GpsPoint, destination: GpsPoint, stops: GpsPoint[]) {
  if (stops.length > 8) throw new Error('El piloto admite hasta 8 paradas.');
  for (const p of [origin, ...stops, destination]) {
    if (!p.label.trim() || !Number.isFinite(p.lat) || !Number.isFinite(p.lon) ||
      Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180) {
      throw new Error('Cada punto necesita nombre y coordenadas válidas.');
    }
  }
}

function distance(points: GpsPoint[]) {
  return points.slice(1).reduce((sum, p, i) => sum + metersBetween(points[i], p), 0);
}

// Exact Held–Karp ordering for a bounded pilot. Geodesic distances are NOT road distances.
export function planRideStops(origin: GpsPoint, destination: GpsPoint, stops: GpsPoint[]) {
  validateRidePoints(origin, destination, stops);
  const n = stops.length;
  const entries = new Map<string, { cost: number; order: number[] }>();
  for (let i = 0; i < n; i++) entries.set(`${1 << i}:${i}`, { cost: metersBetween(origin, stops[i]), order: [i] });
  for (let mask = 1; mask < (1 << n); mask++) {
    for (let last = 0; last < n; last++) {
      const entry = entries.get(`${mask}:${last}`);
      if (!entry) continue;
      for (let next = 0; next < n; next++) {
        if (mask & (1 << next)) continue;
        const key = `${mask | (1 << next)}:${next}`;
        const cost = entry.cost + metersBetween(stops[last], stops[next]);
        if (!entries.has(key) || cost < entries.get(key)!.cost) entries.set(key, { cost, order: [...entry.order, next] });
      }
    }
  }
  let order: number[] = [];
  let best = Infinity;
  for (let last = 0; last < n; last++) {
    const entry = entries.get(`${(1 << n) - 1}:${last}`)!;
    const cost = entry.cost + metersBetween(stops[last], destination);
    if (cost < best) { best = cost; order = entry.order; }
  }
  const sorted = order.map(i => ({ ...stops[i] }));
  return {
    basis: 'geodesic' as const,
    stops: sorted,
    distance_m: distance([origin, ...sorted, destination]),
    original_distance_m: distance([origin, ...stops, destination])
  };
}

// Portable request preparation only; no Google call, account activation or billing.
export function buildGoogleRouteRequest(origin: GpsPoint, destination: GpsPoint, stops: GpsPoint[]) {
  validateRidePoints(origin, destination, stops);
  const location = (p: GpsPoint) => ({ latitude: p.lat, longitude: p.lon });
  return {
    timeout: '10s',
    model: {
      shipments: stops.map((p, i) => ({ label: `stop-${i + 1}`, deliveries: [{ arrivalLocation: location(p) }] })),
      vehicles: [{ label: 'pilot-vehicle', startLocation: location(origin), endLocation: location(destination), costPerKilometer: 1 }]
    }
  };
}
