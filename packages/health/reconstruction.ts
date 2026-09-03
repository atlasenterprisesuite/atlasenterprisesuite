import type { VulnerabilityProfile, VulnerabilityResult } from './types';

const clamp = (value: number) => Math.min(100, Math.max(0, value));

export function calculateVulnerability(profile: VulnerabilityProfile): VulnerabilityResult {
  const factors = {
    seed: [profile.seedScore, 0.1],
    visibilityGap: [100 - profile.visibilityScore, 0.08],
    reservoir: [profile.reservoirScore, 0.12],
    niche: [profile.nicheScore, 0.08],
    adaptation: [profile.adaptationScore, 0.11],
    repairabilityGap: [100 - profile.repairabilityScore, 0.08],
    accessGap: [100 - profile.therapeuticAccessScore, 0.08],
    relapse: [profile.relapseRiskScore, 0.14],
    sentinelDependency: [profile.sentinelFitnessDependency, 0.05],
    surveillanceCost: [profile.surveillanceCostScore, 0.05],
    selectionHistory: [profile.selectionHistoryScore, 0.07],
    delegationBurden: [profile.delegationBurdenScore, 0.04]
  } as const;

  const contributionsByFactor = Object.fromEntries(
    Object.entries(factors).map(([factor, [score, weight]]) => [factor, clamp(score) * weight])
  );

  const reconstructionRisk = Math.round(
    Object.values(contributionsByFactor).reduce((total, contribution) => total + contribution, 0)
  );

  return { reconstructionRisk: clamp(reconstructionRisk), contributionsByFactor, formulaVersion: 'v1' };
}
