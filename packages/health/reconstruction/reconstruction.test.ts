import { describe, expect, it } from 'vitest';
import { calculateVulnerability } from './index';
import type { VulnerabilityInput } from '../types';

const profile: VulnerabilityInput = {
  seedScore: 80,
  visibilityScore: 35,
  reservoirScore: 85,
  nicheScore: 70,
  adaptationScore: 65,
  repairabilityScore: 40,
  therapeuticAccessScore: 45,
  relapseRiskScore: 75,
  sentinelFitnessDependency: 55,
  surveillanceCostScore: 30,
  selectionHistoryScore: 60,
  delegationBurdenScore: 25
};

describe('Reconstruction Vulnerability Engine', () => {
  it('returns a deterministic research-only score plus transparent contributions', () => {
    const first = calculateVulnerability(profile);
    const second = calculateVulnerability(profile);

    expect(first).toEqual(second);
    expect(first.researchOnly).toBe(true);
    expect(first.reconstructionRisk).toBeGreaterThanOrEqual(0);
    expect(first.reconstructionRisk).toBeLessThanOrEqual(100);
    expect(Object.keys(first.contributions)).toEqual(expect.arrayContaining(['seed', 'reservoir', 'niche', 'adaptation', 'relapse']));
  });

  it('rejects scores outside 0-100 rather than silently normalizing them', () => {
    expect(() => calculateVulnerability({ ...profile, seedScore: 101 })).toThrow(/0 and 100/);
  });
});
