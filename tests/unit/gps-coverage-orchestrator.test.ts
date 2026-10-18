import { describe, expect, it } from 'vitest';
import {
  advanceCoverageSector,
  attachStreetSegments,
  coverageCheckpoint,
  createCoverageOrchestratorState,
  currentCoverageProbe,
  resolveCoverageProbe,
  selectCoverageSector
} from '../../apps/web/src/modules/gps/coverageOrchestrator';

describe('ATLAS GPS coverage orchestrator', () => {
  const bounds = {
    south: 28.50,
    west: -81.40,
    north: 28.52,
    east: -81.38
  };

  const streets = [
    {
      id: 'osm-way-1',
      label: 'Test Street',
      coordinates: [
        [-81.399, 28.501] as [number, number],
        [-81.399, 28.503] as [number, number]
      ]
    }
  ];

  it('selects a sector, attaches real street geometry and progresses probe by probe', () => {
    let state = createCoverageOrchestratorState({
      coverageKey: 'orlando-test',
      label: 'Orlando Test',
      bounds,
      targetSectorKm: 1
    });

    const selected = selectCoverageSector(state);
    state = selected.state;
    expect(selected.sector?.status).toBe('in-progress');

    state = attachStreetSegments(state, selected.sector!.id, streets, 25);
    const first = currentCoverageProbe(state);
    expect(first).not.toBeNull();

    state = resolveCoverageProbe(state, first!.id, 'unlocated', {
      provider: 'atlas-open-road-graph',
      reason: 'no_verified_location_at_probe'
    });

    const next = currentCoverageProbe(state);
    expect(next).not.toBeNull();
    expect(next!.id).not.toBe(first!.id);
  });

  it('closes a sector only after every generated probe reaches a terminal state', () => {
    let state = createCoverageOrchestratorState({
      coverageKey: 'single-sector',
      label: 'Single Sector',
      bounds: {
        south: 28.50,
        west: -81.40,
        north: 28.501,
        east: -81.399
      },
      targetSectorKm: 10
    });

    const selected = selectCoverageSector(state);
    state = attachStreetSegments(selected.state, selected.sector!.id, streets, 80);

    while (true) {
      const probe = currentCoverageProbe(state);
      if (!probe) break;
      state = resolveCoverageProbe(state, probe.id, 'located', {
        provider: 'test-provider'
      });
    }

    expect(
      state.grid.sectors.find((sector) => sector.id === selected.sector!.id)?.status
    ).toBe('complete');

    const checkpoint = coverageCheckpoint(state);
    expect(checkpoint.last_sector_id).toBe(selected.sector!.id);

    state = advanceCoverageSector(state);
    expect(state.activeSectorId).toBeNull();
  });

  it('marks a sector blocked when no road geometry is returned', () => {
    let state = createCoverageOrchestratorState({
      coverageKey: 'empty',
      label: 'Empty Sector',
      bounds,
      targetSectorKm: 1
    });

    const selected = selectCoverageSector(state);
    state = attachStreetSegments(selected.state, selected.sector!.id, []);
    expect(
      state.grid.sectors.find((sector) => sector.id === selected.sector!.id)?.status
    ).toBe('blocked');
  });

  it('produces a persistence checkpoint without claiming imagery verification', () => {
    const state = createCoverageOrchestratorState({
      coverageKey: 'checkpoint',
      label: 'Checkpoint',
      bounds,
      targetSectorKm: 1
    });
    const checkpoint = coverageCheckpoint(state);

    expect(checkpoint.coverage_key).toBe('checkpoint');
    expect(checkpoint.status).toBe('pending');
    expect(checkpoint.state.grid).toBeDefined();
    expect(checkpoint.metadata.grid_summary).toBeDefined();
  });
});
