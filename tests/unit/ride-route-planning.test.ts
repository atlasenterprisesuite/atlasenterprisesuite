import { describe, expect, it } from 'vitest';
import { planRideStops, buildGoogleRouteRequest } from '../../apps/web/src/modules/ride/routePlanning';

const point = (label: string, lon: number) => ({ label, lat: 0, lon });
describe('independent Ride route pilot', () => {
  it('finds the shortest geometric ordering while fixing origin and destination', () => {
    const stops = [point('far', 3), point('near', 1), point('middle', 2)];
    const result = planRideStops(point('start', 0), point('end', 4), stops);
    expect(result.stops.map(p => p.label)).toEqual(['near', 'middle', 'far']);
    expect(result.distance_m).toBeLessThan(result.original_distance_m);
    expect(stops.map(p => p.label)).toEqual(['far', 'near', 'middle']);
    expect(result.basis).toBe('geodesic');
  });
  it('rejects blank, nonfinite, out-of-range coordinates and excessive stops', () => {
    for (const bad of [NaN, Infinity, 181]) {
      expect(() => planRideStops(point('start', bad), point('end', 4), [])).toThrow();
    }
    expect(() => planRideStops({ ...point('start', 0), lat: 91 }, point('end', 4), [])).toThrow();
    expect(() => planRideStops(point('', 0), point('end', 4), [])).toThrow();
    expect(() => planRideStops(point('start', 0), point('end', 4), Array.from({ length: 9 }, () => point('stop', 1)))).toThrow();
  });
  it('supports direct routes and zero-length legs without invented time estimates', () => {
    const result = planRideStops(point('start', 0), point('end', 0), []);
    expect(result.distance_m).toBe(0);
    expect(result.stops).toEqual([]);
    expect(result).not.toHaveProperty('duration_s');
  });
  it('exports a Google delivery model without credentials or dispatch side effects', () => {
    const model = buildGoogleRouteRequest(point('start', 0), point('end', 4), [point('stop', 1)]);
    expect(model.model.vehicles[0].startLocation).toEqual({ latitude: 0, longitude: 0 });
    expect(model.model.shipments[0].deliveries[0].arrivalLocation.longitude).toBe(1);
    expect(model.model.vehicles[0].costPerKilometer).toBe(1);
    expect(JSON.stringify(model)).not.toMatch(/token|apiKey|authorization/i);
  });
});
