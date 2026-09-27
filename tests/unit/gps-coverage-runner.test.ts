import { describe, expect, it } from 'vitest';
import { restoreCoverageOrchestrator } from '../../apps/web/src/modules/gps/coverageRunner';

describe('ATLAS GPS coverage runner persistence', () => {
  it('restores a resumable orchestrator from a saved run', () => {
    const restored = restoreCoverageOrchestrator({
      id: 'run-1',
      coverage_key: 'orlando-grid',
      label: 'Orlando Grid',
      scope: 'region',
      status: 'in-progress',
      progress_pct: 25,
      last_probe_id: 'probe-9',
      last_sector_id: 'orlando-grid:r0:c1',
      metadata: {},
      created_at: '2026-09-27T00:00:00Z',
      updated_at: '2026-09-27T00:00:00Z',
      state: {
        grid: {
          id: 'orlando-grid',
          bounds: { south: 28.5, west: -81.4, north: 28.6, east: -81.3 },
          targetSectorKm: 2,
          rows: 1,
          columns: 1,
          sectors: [{
            id: 'orlando-grid:r0:c1',
            row: 0,
            column: 1,
            bounds: { south: 28.5, west: -81.4, north: 28.6, east: -81.3 },
            center: { lat: 28.55, lon: -81.35 },
            status: 'in-progress',
            completedStreetSegments: 0,
            totalStreetSegments: 10
          }]
        },
        activeStreetPlan: null
      }
    });

    expect(restored?.coverageKey).toBe('orlando-grid');
    expect(restored?.activeSectorId).toBe('orlando-grid:r0:c1');
    expect(restored?.lastProbeId).toBe('probe-9');
  });

  it('rejects malformed saved state instead of fabricating coverage', () => {
    const restored = restoreCoverageOrchestrator({
      id: 'bad',
      coverage_key: 'bad',
      label: 'Bad',
      scope: 'region',
      status: 'pending',
      progress_pct: 0,
      last_probe_id: null,
      last_sector_id: null,
      metadata: {},
      created_at: '',
      updated_at: '',
      state: {}
    });
    expect(restored).toBeNull();
  });
});
