import type { VulnerabilityInput, VulnerabilityResult } from '../types';

const keys: (keyof VulnerabilityInput)[] = [
  'seedScore', 'visibilityScore', 'reservoirScore', 'nicheScore', 'adaptationScore', 'repairabilityScore',
  'therapeuticAccessScore', 'relapseRiskScore', 'sentinelFitnessDependency', 'surveillanceCostScore',
  'selectionHistoryScore', 'delegationBurdenScore'
];

function assertRange(profile: VulnerabilityInput) {
  for (const key of keys) {
    const value = profile[key];
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new RangeError(`${key} must be between 0 and 100`);
    }
  }
}

export function calculateVulnerability(profile: VulnerabilityInput): VulnerabilityResult {
  assertRange(profile);
  const contributions = {
    seed: profile.seedScore * 0.12,
    visibilityGap: (100 - profile.visibilityScore) * 0.08,
    reservoir: profile.reservoirScore * 0.12,
    niche: profile.nicheScore * 0.10,
    adaptation: profile.adaptationScore * 0.10,
    repairabilityGap: (100 - profile.repairabilityScore) * 0.07,
    therapeuticAccessGap: (100 - profile.therapeuticAccessScore) * 0.08,
    relapse: profile.relapseRiskScore * 0.12,
    sentinelFitness: profile.sentinelFitnessDependency * 0.05,
    surveillanceCost: profile.surveillanceCostScore * 0.04,
    selectionHistory: profile.selectionHistoryScore * 0.07,
    delegationBurden: profile.delegationBurdenScore * 0.05
  };
  const reconstructionRisk = Math.round(Object.values(contributions).reduce((sum, value) => sum + value, 0) * 10) / 10;
  return { researchOnly: true, reconstructionRisk, contributions, formulaVersion: 'atlas-rve-v1' };
}
