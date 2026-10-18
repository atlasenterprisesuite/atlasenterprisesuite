import { describe, expect, it } from 'vitest';
import { calculateAutomationScenario, DEFAULT_AUTOMATION_INPUT } from '../../apps/web/src/modules/advisory/enterpriseAutomationModel';

describe('enterprise automation planning scenario', () => {
  it('calculates the example for 15 companies without counting capacity twice', () => {
    const result = calculateAutomationScenario(DEFAULT_AUTOMATION_INPUT);
    expect(result.rows.find((row) => row.id === 'ap')?.volume).toBe(225);
    expect(result.manualHours).toBe(242.5);
    expect(result.assistedHours).toBeCloseTo(90.625);
    expect(result.savedHours).toBeCloseTo(151.875);
    expect(result.firstYearNet).toBe(15675);
    expect(result.paybackMonths).toBeCloseTo(15000 / 2556.25);
  });

  it('allows a service company scenario with no inventory and reports unreachable payback', () => {
    const result = calculateAutomationScenario({ ...DEFAULT_AUTOMATION_INPUT, companies: 1, inventoryMovesPerCompany: 0, monthlyPlatformCost: 10000 });
    expect(result.rows.find((row) => row.id === 'inventory')?.savedHours).toBe(0);
    expect(result.paybackMonths).toBeNull();
    expect(result.firstYearNet).toBeLessThan(0);
  });

  it('rejects invalid estimates rather than producing a misleading financial result', () => {
    expect(() => calculateAutomationScenario({ ...DEFAULT_AUTOMATION_INPUT, hourlyCost: Number.NaN })).toThrow();
    expect(() => calculateAutomationScenario({ ...DEFAULT_AUTOMATION_INPUT, companies: -1 })).toThrow();
  });
});
