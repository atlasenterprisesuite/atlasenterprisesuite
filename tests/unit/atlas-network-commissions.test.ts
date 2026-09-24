import { describe, expect, it } from 'vitest';
import { calculateCommissionAllocation, calculateCommissionPoolCapMinor, validateCommissionRules } from '../../packages/network/src';

const launchRules = [
  { component: 'direct', rateBps: 1200, qualified: true },
  { component: 'level2', rateBps: 300, qualified: true },
  { component: 'level3', rateBps: 150, qualified: true },
  { component: 'leadership', rateBps: 150, qualified: true },
  { component: 'campaign', rateBps: 200, qualified: true }
] as const;

describe('ATLAS Network commission engine', () => {
  it('uses the lower of 20% CNR or 35% contribution margin', () => {
    expect(calculateCommissionPoolCapMinor({ cnrMinor: 100_000, contributionMarginMinor: 40_000 })).toBe(14_000);
    expect(calculateCommissionPoolCapMinor({ cnrMinor: 100_000, contributionMarginMinor: 100_000 })).toBe(20_000);
  });

  it('rejects aggregate rules above 20 percent', () => {
    expect(() => validateCommissionRules([...launchRules, { component: 'campaign', rateBps: 1, qualified: true }])).toThrow();
  });

  it('constrains actual allocation to the margin-funded pool', () => {
    const allocation = calculateCommissionAllocation({ cnrMinor: 100_000, contributionMarginMinor: 40_000, rules: launchRules });
    expect(allocation.poolCapMinor).toBe(14_000);
    expect(allocation.allocatedMinor).toBe(14_000);
    expect(Object.values(allocation.components).reduce((sum, amount) => sum + amount, 0)).toBe(14_000);
  });

  it('does not redistribute unqualified components', () => {
    const rules = launchRules.map((rule) => rule.component === 'campaign' ? { ...rule, qualified: false } : rule);
    const allocation = calculateCommissionAllocation({ cnrMinor: 100_000, contributionMarginMinor: 100_000, rules });
    expect(allocation.components.campaign).toBe(0);
    expect(allocation.allocatedMinor).toBe(18_000);
    expect(allocation.retainedMinor).toBe(2_000);
  });
});
