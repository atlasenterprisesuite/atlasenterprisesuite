import { describe, expect, it } from 'vitest';
import {
  buildCoverageGrid,
  nextCoverageSector,
  normalizeCoverageBounds,
  summarizeCoverageGrid,
  updateCoverageSector
} from '../../apps/web/src/modules/gps/globalCoverage';

describe('ATLAS GPS hierarchical coverage grid', () => {
  it('normalizes and bounds coordinates safely', () => {
    expect(normalizeCoverageBounds({
      south: 92,
      north: -92,
      west: 190,
      east: -190
    })).toEqual({
      south: -85,
      north: 85,
      west: -180,
      east: 180
    });
  });

  it('splits a bounded region into deterministic resumable sectors', () => {
    const grid = buildCoverageGrid('orlando-test', {
      south: 28.45,
      west: -81.50,
      north: 28.60,
      east: -81.30
    }, 2, 500);

    expect(grid.sectors.length).toBeGreaterThan(1);
    expect(grid.sectors.length).toBeLessThanOrEqual(500);
    expect(grid.sectors[0].id).toBe('orlando-test:r0:c0');
    expect(nextCoverageSector(grid)?.status).toBe('pending');
  });

  it('resumes an in-progress sector before starting a new one', () => {
    let grid = buildCoverageGrid('resume', {
      south: 28.50,
      west: -81.40,
      north: 28.54,
      east: -81.36
    }, 1);

    const second = grid.sectors[1];
    grid = updateCoverageSector(grid, second.id, {
      status: 'in-progress',
      completedStreetSegments: 3,
      totalStreetSegments: 10
    });

    expect(nextCoverageSector(grid)?.id).toBe(second.id);
  });

  it('does not declare regional coverage complete while sectors remain pending', () => {
    let grid = buildCoverageGrid('status', {
      south: 28.50,
      west: -81.40,
      north: 28.52,
      east: -81.38
    }, 1);

    for (const sector of grid.sectors.slice(0, -1)) {
      grid = updateCoverageSector(grid, sector.id, { status: 'complete' });
    }
    expect(summarizeCoverageGrid(grid).complete).toBe(false);

    const last = grid.sectors.at(-1)!;
    grid = updateCoverageSector(grid, last.id, { status: 'blocked' });
    const summary = summarizeCoverageGrid(grid);
    expect(summary.complete).toBe(true);
    expect(summary.completionPct).toBe(100);
    expect(summary.blocked).toBe(1);
  });

  it('caps sector count for large requested areas', () => {
    const grid = buildCoverageGrid('world-safe', {
      south: -85,
      west: -180,
      north: 85,
      east: 180
    }, 0.25, 1000);

    expect(grid.sectors.length).toBeLessThanOrEqual(1000);
  });
});
