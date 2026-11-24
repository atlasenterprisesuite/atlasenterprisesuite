import { describe, expect, it } from 'vitest';
import { DEFAULT_AUTOMATION_INPUT } from '../../apps/web/src/modules/advisory/enterpriseAutomationModel';
import {
  DEFAULT_SIX_DIMENSION_ASSUMPTIONS,
  evaluateSixDimensionPaths
} from '../../apps/web/src/modules/advisory/enterpriseSixDimensionModel';

describe('ATLAS six-dimensional enterprise scenario explorer', () => {
  it('reuses canonical process volumes and keeps sensitive operations outside the RPA pilot', () => {
    const result = evaluateSixDimensionPaths(DEFAULT_AUTOMATION_INPUT);
    expect(result.dimensions).toHaveLength(6);
    expect(result.paths).toHaveLength(3);
    expect(result.totalItems).toBe(15 * (30 + 1 + 1 + 5 + 50 + 10 + 10));
    expect(result.restrictedProcesses.map((p) => p.id)).toEqual(['ap', 'bank', 'close', 'people']);
    expect(result.paths[0].humanHours).toBeCloseTo(242.5);
    expect(result.paths[1].humanHours).toBeCloseTo(90.625);
    expect(result.paths[2].humanHours).toBeCloseTo(85.08625);
    expect(result.paths[2].projectedExceptions).toBeCloseTo(30.6);
    expect(result.recommendedId).toBe('governed-rpa');
    expect(result.executionStatus).toBe('simulation_only');
  });

  it('prefers zero-cost manual operation when no volume is supplied', () => {
    const result = evaluateSixDimensionPaths({ ...DEFAULT_AUTOMATION_INPUT, companies: 0 });
    expect(result.recommendedId).toBe('manual');
    expect(result.paths[2].projectedExceptions).toBe(0);
    expect(result.paths[2].humanHours).toBe(0);
  });

  it('does not recommend RPA when reviews outweigh projected time savings', () => {
    const result = evaluateSixDimensionPaths(DEFAULT_AUTOMATION_INPUT, {
      ...DEFAULT_SIX_DIMENSION_ASSUMPTIONS,
      rpaCoveragePercent: 100,
      rpaTimeReductionPercent: 0,
      exceptionRatePercent: 100,
      reviewMinutesPerException: 600
    });
    expect(result.paths[2].humanHours).toBeGreaterThan(result.paths[1].humanHours);
    expect(result.recommendedId).toBe('assisted');
  });

  it('rejects unsafe or non-finite assumptions, and never executes business actions', () => {
    expect(() => evaluateSixDimensionPaths(DEFAULT_AUTOMATION_INPUT, {
      ...DEFAULT_SIX_DIMENSION_ASSUMPTIONS,
      exceptionRatePercent: 101
    })).toThrow();
    expect(() => evaluateSixDimensionPaths(DEFAULT_AUTOMATION_INPUT, {
      ...DEFAULT_SIX_DIMENSION_ASSUMPTIONS,
      reviewMinutesPerException: Number.NaN
    })).toThrow();
  });
});
