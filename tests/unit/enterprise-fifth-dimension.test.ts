import { describe, expect, it } from 'vitest';
import { DEFAULT_AUTOMATION_INPUT } from '../../apps/web/src/modules/advisory/enterpriseAutomationModel';
import {
  DEFAULT_FIFTH_DIMENSION_ASSUMPTIONS,
  evaluateFifthDimensionFutures
} from '../../apps/web/src/modules/advisory/enterpriseFifthDimensionModel';
import { DEFAULT_SIX_DIMENSION_ASSUMPTIONS } from '../../apps/web/src/modules/advisory/enterpriseSixDimensionModel';

describe('ATLAS 5D / 6D unified business futures', () => {
  it('compares three non-probabilistic demand futures using the existing 6D evaluation', () => {
    const result = evaluateFifthDimensionFutures(DEFAULT_AUTOMATION_INPUT);
    expect(result.futures.map((s) => s.id)).toEqual(['lean', 'baseline', 'surge']);
    expect(result.futures[0].input.companies).toBe(15);
    expect(result.futures[0].input.bankAccountsPerCompany).toBe(1);
    expect(result.futures[0].input.employeesPerCompany).toBe(5);
    expect(result.futures[0].input.documentsPerCompany).toBe(22.5);
    expect(result.futures[1].evaluation.paths[2].humanHours).toBeCloseTo(85.08625);
    expect(result.futures[1].evaluation.paths[2].projectedExceptions).toBeCloseTo(30.6);
    expect(result.futures[2].input.documentsPerCompany).toBe(37.5);
    expect(result.futures[0].evaluation.totalItems).toBeLessThan(result.futures[1].evaluation.totalItems);
    expect(result.futures[2].evaluation.totalItems).toBeGreaterThan(result.futures[1].evaluation.totalItems);
    expect(result.robustPathId).toMatch(/^(manual|assisted|governed-rpa)$/);
    expect(result.executionStatus).toBe('simulation_only');
  });

  it('preserves controls in every simulated future, with no execution eligibility implied', () => {
    const result = evaluateFifthDimensionFutures(DEFAULT_AUTOMATION_INPUT);
    for (const future of result.futures) {
      expect(future.evaluation.restrictedProcesses.map((p) => p.id)).toEqual(['ap', 'bank', 'close', 'people']);
      expect(future.evaluation.paths).toHaveLength(3);
      expect(future.evaluation.executionStatus).toBe('simulation_only');
    }
  });

  it('returns identical modeled paths at zero variation with original RPA assumptions', () => {
    const result = evaluateFifthDimensionFutures(DEFAULT_AUTOMATION_INPUT, {
      demandShiftPercent: 0, exceptionShiftPercent: 0, productivityShiftPercent: 0
    }, DEFAULT_SIX_DIMENSION_ASSUMPTIONS);
    expect(result.futures[0].evaluation.paths).toEqual(result.futures[1].evaluation.paths);
    expect(result.futures[2].evaluation.paths).toEqual(result.futures[1].evaluation.paths);
    expect(result.robustPathId).toBe('governed-rpa');
  });

  it('cannot model invalid percentages or input values as a valid future', () => {
    expect(() => evaluateFifthDimensionFutures(DEFAULT_AUTOMATION_INPUT, {
      ...DEFAULT_FIFTH_DIMENSION_ASSUMPTIONS, demandShiftPercent: 101
    })).toThrow();
    expect(() => evaluateFifthDimensionFutures(DEFAULT_AUTOMATION_INPUT, {
      ...DEFAULT_FIFTH_DIMENSION_ASSUMPTIONS, exceptionShiftPercent: Number.NaN
    })).toThrow();
    expect(() => evaluateFifthDimensionFutures({ ...DEFAULT_AUTOMATION_INPUT, companies: -1 })).toThrow();
  });

  it('recommends no paid tooling when all companies are absent', () => {
    const result = evaluateFifthDimensionFutures({ ...DEFAULT_AUTOMATION_INPUT, companies: 0 });
    expect(result.robustPathId).toBe('manual');
    for (const future of result.futures) expect(future.evaluation.totalItems).toBe(0);
  });

  it('does not prefer RPA in the extreme modeled exception review case', () => {
    const result = evaluateFifthDimensionFutures(DEFAULT_AUTOMATION_INPUT, DEFAULT_FIFTH_DIMENSION_ASSUMPTIONS, {
      ...DEFAULT_SIX_DIMENSION_ASSUMPTIONS,
      rpaTimeReductionPercent: 0,
      exceptionRatePercent: 100,
      reviewMinutesPerException: 100
    });
    expect(result.robustPathId).toBe('assisted');
  });
});
