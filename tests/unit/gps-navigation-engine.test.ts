import { describe, expect, it } from 'vitest';
import { AtlasNavigationEngine, bearingDegrees, distanceMeters } from '../../apps/web/src/modules/gps/navigationEngine';
import type { GpsRoute } from '../../apps/web/src/modules/gps/gpsApi';

const route: GpsRoute = {
  id: 'test-route',
  distance_m: 1950,
  duration_s: 180,
  geometry: {
    type: 'LineString',
    coordinates: [
      [-81.5000, 28.0000],
      [-81.4900, 28.0000],
      [-81.4800, 28.0000]
    ]
  },
  steps: [
    {
      id: 's1',
      distance_m: 900,
      duration_s: 80,
      name: 'First Rd',
      instruction_type: 'continue',
      modifier: 'straight',
      location: [-81.4990, 28.0000],
      exit: null,
      lanes: []
    },
    {
      id: 's2',
      distance_m: 900,
      duration_s: 80,
      name: 'Second Rd',
      instruction_type: 'turn',
      modifier: 'right',
      location: [-81.4890, 28.0000],
      exit: null,
      lanes: []
    },
    {
      id: 's3',
      distance_m: 150,
      duration_s: 20,
      name: 'Destination',
      instruction_type: 'arrive',
      modifier: '',
      location: [-81.4800, 28.0000],
      exit: null,
      lanes: []
    }
  ]
};

describe('AtlasNavigationEngine', () => {
  it('snaps a high-confidence GPS fix to the active route', () => {
    const engine = new AtlasNavigationEngine();
    const observation = engine.update({
      lat: 28.00008,
      lon: -81.494,
      accuracy_m: 5,
      heading_deg: 90,
      speed_mps: 12,
      timestamp: 1000
    }, route, 0);

    expect(observation.source).toBe('route-snap');
    expect(observation.off_route_m).toBeLessThan(20);
    expect(observation.display.lat).toBeCloseTo(28.0, 4);
    expect(observation.confidence).toBeGreaterThan(0.9);
  });

  it('does not snap poor GPS accuracy to the route', () => {
    const engine = new AtlasNavigationEngine();
    const observation = engine.update({
      lat: 28.00008,
      lon: -81.494,
      accuracy_m: 120,
      heading_deg: null,
      speed_mps: null,
      timestamp: 1000
    }, route, 0);

    expect(observation.source).toBe('gps');
    expect(observation.confidence).toBeLessThan(0.3);
  });

  it('requires repeated off-route evidence before suggesting reroute', () => {
    const engine = new AtlasNavigationEngine({ reroute_confirmations: 3, reroute_threshold_m: 70 });
    const sample = {
      lat: 28.0020,
      lon: -81.494,
      accuracy_m: 5,
      heading_deg: 90,
      speed_mps: 10,
      timestamp: 1000
    };

    expect(engine.update(sample, route, 0).reroute_suggested).toBe(false);
    expect(engine.update({ ...sample, timestamp: 2000 }, route, 0).reroute_suggested).toBe(false);
    expect(engine.update({ ...sample, timestamp: 3000 }, route, 0).reroute_suggested).toBe(true);
  });

  it('advances maneuver state from along-route progress rather than one proximity hit', () => {
    const engine = new AtlasNavigationEngine();
    const observation = engine.update({
      lat: 28.00001,
      lon: -81.487,
      accuracy_m: 4,
      heading_deg: 90,
      speed_mps: 14,
      timestamp: 1000
    }, route, 0);

    expect(observation.route_progress).toBeGreaterThan(0.5);
    expect(observation.step_index).toBeGreaterThanOrEqual(1);
    expect(observation.remaining_m).toBeLessThan(route.distance_m);
  });

  it('derives course from movement when the device has no heading', () => {
    const engine = new AtlasNavigationEngine();
    engine.update({
      lat: 28.0,
      lon: -81.499,
      accuracy_m: 5,
      heading_deg: null,
      speed_mps: 8,
      timestamp: 1000
    }, route, 0);
    const observation = engine.update({
      lat: 28.0,
      lon: -81.498,
      accuracy_m: 5,
      heading_deg: null,
      speed_mps: 8,
      timestamp: 2000
    }, route, 0);

    expect(observation.course_deg).not.toBeNull();
    expect(observation.course_deg as number).toBeGreaterThan(70);
    expect(observation.course_deg as number).toBeLessThan(110);
  });

  it('exposes deterministic geodesic primitives', () => {
    expect(distanceMeters({ lat: 28, lon: -81.5 }, { lat: 28, lon: -81.49 })).toBeGreaterThan(900);
    expect(bearingDegrees({ lat: 28, lon: -81.5 }, { lat: 28, lon: -81.49 })).toBeGreaterThan(80);
    expect(bearingDegrees({ lat: 28, lon: -81.5 }, { lat: 28, lon: -81.49 })).toBeLessThan(100);
  });
});
