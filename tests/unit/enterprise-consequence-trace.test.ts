import { describe, expect, it } from 'vitest';
import { DEFAULT_AUTOMATION_INPUT } from '../../apps/web/src/modules/advisory/enterpriseAutomationModel';
import { evaluateFifthDimensionFutures } from '../../apps/web/src/modules/advisory/enterpriseFifthDimensionModel';
import { buildConsequenceTrace } from '../../apps/web/src/modules/advisory/enterpriseConsequenceTrace';

describe('ATLAS decision-to-consequence trace · simulation only', () => {
  const futures = evaluateFifthDimensionFutures(DEFAULT_AUTOMATION_INPUT);

  it('uses canonical 5D and 6D calculation without inventing outcomes', () => {
    const trace = buildConsequenceTrace(futures, 'baseline', 'governed-rpa');
    const baseline = futures.futures.find((item) => item.id === 'baseline');
    const expected = baseline?.evaluation.paths.find((item) => item.id === 'governed-rpa');
    expect(trace?.futureLabel).toBe('Current plan');
    expect(trace?.path).toEqual(expected);
    expect(trace?.differenceFromManual).toBeCloseTo(expected?.monthlyCostDifferenceFromManual ?? 0);
    expect(trace?.executionStatus).toBe('simulation_only');
    expect(trace?.humanApprovalRequired).toBe(true);
    expect(trace?.restrictedProcesses).toEqual(['ap', 'bank', 'close', 'people']);
  });

  it('changes the consequence when a future or operating path changes', () => {
    const lean = buildConsequenceTrace(futures, 'lean', 'governed-rpa');
    const surge = buildConsequenceTrace(futures, 'surge', 'governed-rpa');
    const manual = buildConsequenceTrace(futures, 'surge', 'manual');
    expect(lean?.path.operatingCost).not.toBe(surge?.path.operatingCost);
    expect(manual?.path.projectedExceptions).toBeNull();
    expect(manual?.differenceFromManual).toBe(0);
  });

  it('fails closed when the selected future or path is missing', () => {
    expect(buildConsequenceTrace(futures, 'unknown' as never, 'manual')).toBeNull();
    expect(buildConsequenceTrace(futures, 'baseline', 'unknown' as never)).toBeNull();
  });

  it('never presents non-simulation evidence as an approved execution', () => {
    const altered = { ...futures, executionStatus: 'live' as never };
    expect(buildConsequenceTrace(altered, 'baseline', 'manual')).toBeNull();
  });
});
