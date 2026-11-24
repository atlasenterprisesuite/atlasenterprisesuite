import { describe, expect, it } from 'vitest';
import { getVisibleDistrictSimulationPoints, SIMULATION_POINTS } from '../../apps/web/src/modules/city/districtSimulation';

const enabled = {
  mobility: true,
  infrastructure: true,
  buildings: true,
  network: true,
  community: true
} as const;

describe('Orlando pilot synthetic district overlays', () => {
  it('never emits simulated map markers in live mode', () => {
    expect(getVisibleDistrictSimulationPoints('live', enabled)).toEqual([]);
  });

  it('filters spatial markers by the corresponding operational controls', () => {
    expect(getVisibleDistrictSimulationPoints('simulation', enabled)).toHaveLength(6);
    const filtered = getVisibleDistrictSimulationPoints('simulation', {
      ...enabled,
      mobility: false,
      infrastructure: false
    });
    expect(filtered.some((point) => point.layer === 'mobility')).toBe(false);
    expect(filtered.some((point) => point.layer === 'infrastructure')).toBe(false);
    expect(filtered.some((point) => point.layer === 'core')).toBe(true);
  });

  it('keeps every location explicitly synthetic and within the Lake Eola pilot envelope', () => {
    expect(new Set(SIMULATION_POINTS.map((point) => point.id)).size).toBe(SIMULATION_POINTS.length);
    for (const point of SIMULATION_POINTS) {
      expect(point.kind).toMatch(/simulation/i);
      expect(point.coordinates[0]).toBeGreaterThan(-81.4);
      expect(point.coordinates[0]).toBeLessThan(-81.35);
      expect(point.coordinates[1]).toBeGreaterThan(28.53);
      expect(point.coordinates[1]).toBeLessThan(28.56);
    }
  });
});
