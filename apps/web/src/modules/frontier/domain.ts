export type FrontierActionId =
  | 'extract_aetherium'
  | 'salvage_alloy'
  | 'harvest_biofiber'
  | 'craft_power_core'
  | 'build_habitat'
  | 'restore_sky_grid';

export type FrontierEcologyActionId =
  | 'collect_seed_pods'
  | 'cultivate_plot'
  | 'generate_eco_energy'
  | 'restore_biome';

export type FrontierCampaignStage = 1 | 2 | 3 | 4 | 5 | 6;

export type FrontierState = {
  aetherium: number;
  alloy: number;
  biofiber: number;
  powerCores: number;
  habitats: number;
  skyGridIntegrity: number;
  actionCount: number;
  stormMinutes: number;
  campaignStage: FrontierCampaignStage;
  experience: number;
  revision: number;
};

export type FrontierEcologyState = {
  seedPods: number;
  cultivatedPlots: number;
  ecoEnergy: number;
  ecosystemStability: number;
  restoredBiomes: number;
  revision: number;
};

export type FrontierActionDefinition = {
  id: FrontierActionId;
  label: string;
  mode: 'Explore' | 'Craft' | 'Build' | 'Restore';
  description: string;
};

export type FrontierEcologyActionDefinition = {
  id: FrontierEcologyActionId;
  label: string;
  mode: 'Explore' | 'Cultivate' | 'Energy' | 'Restore';
  description: string;
};

export type FrontierCampaignDefinition = {
  stage: FrontierCampaignStage;
  title: string;
  summary: string;
  productionState: 'playable' | 'next';
};

export const INITIAL_FRONTIER_STATE: FrontierState = Object.freeze({
  aetherium: 0,
  alloy: 0,
  biofiber: 0,
  powerCores: 0,
  habitats: 0,
  skyGridIntegrity: 0,
  actionCount: 0,
  stormMinutes: 12,
  campaignStage: 1,
  experience: 0,
  revision: 0
});

export const INITIAL_FRONTIER_ECOLOGY_STATE: FrontierEcologyState = Object.freeze({
  seedPods: 0,
  cultivatedPlots: 0,
  ecoEnergy: 0,
  ecosystemStability: 0,
  restoredBiomes: 0,
  revision: 0
});

export const FRONTIER_ACTIONS: readonly FrontierActionDefinition[] = [
  { id: 'extract_aetherium', label: 'Extract Aetherium', mode: 'Explore', description: 'Mine the luminous resource seam. +4 Aetherium.' },
  { id: 'salvage_alloy', label: 'Salvage Alloy', mode: 'Explore', description: 'Recover structural material. +3 Alloy.' },
  { id: 'harvest_biofiber', label: 'Harvest Biofiber', mode: 'Explore', description: 'Gather living construction fiber. +3 Biofiber.' },
  { id: 'build_habitat', label: 'Build Habitat', mode: 'Build', description: 'Costs 12 Alloy and 8 Biofiber.' },
  { id: 'craft_power_core', label: 'Craft Power Core', mode: 'Craft', description: 'Costs 20 Aetherium, 10 Alloy and 4 Biofiber.' },
  { id: 'restore_sky_grid', label: 'Restore Sky Grid', mode: 'Restore', description: 'Consumes 1 Power Core and 8 Aetherium. Restores 25%.' }
] as const;

export const FRONTIER_ECOLOGY_ACTIONS: readonly FrontierEcologyActionDefinition[] = [
  { id: 'collect_seed_pods', label: 'Recover Seed Pods', mode: 'Explore', description: 'Recover viable native seed pods. +2 Seed Pods.' },
  { id: 'cultivate_plot', label: 'Cultivate Plot', mode: 'Cultivate', description: 'Consumes 2 Seed Pods and 2 Biofiber.' },
  { id: 'generate_eco_energy', label: 'Generate Bio-Energy', mode: 'Energy', description: 'Requires a cultivated plot. +20 Eco Energy.' },
  { id: 'restore_biome', label: 'Restore Biome', mode: 'Restore', description: 'Consumes 40 Eco Energy and 4 Biofiber. Restores 25% ecosystem stability.' }
] as const;

export const FRONTIER_CAMPAIGN: readonly FrontierCampaignDefinition[] = [
  { stage: 1, title: 'Despertar', summary: 'Explore the crash zone and learn the three resource families.', productionState: 'playable' },
  { stage: 2, title: 'Primer refugio', summary: 'Gather structural material and build a self-sustaining habitat.', productionState: 'playable' },
  { stage: 3, title: 'Power Core', summary: 'Manufacture a stable core from Aetherium, Alloy and Biofiber.', productionState: 'playable' },
  { stage: 4, title: 'Sky Grid', summary: 'Restore the first sector of the planetary energy network.', productionState: 'playable' },
  { stage: 5, title: 'Mundos vivos', summary: 'Recover seed stock, cultivate living plots, generate bio-energy and restore the first biome.', productionState: 'playable' },
  { stage: 6, title: 'Tormenta iónica', summary: 'Advanced weather survival and storm engineering arrive in the next production phase.', productionState: 'next' }
] as const;

function finiteNonNegative(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function campaignStage(value: unknown): FrontierCampaignStage {
  const parsed = finiteNonNegative(value, 1);
  return Math.min(6, Math.max(1, parsed)) as FrontierCampaignStage;
}

export function normalizeFrontierState(value: unknown): FrontierState {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    aetherium: finiteNonNegative(source.aetherium, 0),
    alloy: finiteNonNegative(source.alloy, 0),
    biofiber: finiteNonNegative(source.biofiber, 0),
    powerCores: finiteNonNegative(source.powerCores, 0),
    habitats: finiteNonNegative(source.habitats, 0),
    skyGridIntegrity: Math.min(100, finiteNonNegative(source.skyGridIntegrity, 0)),
    actionCount: finiteNonNegative(source.actionCount, 0),
    stormMinutes: finiteNonNegative(source.stormMinutes, 12),
    campaignStage: campaignStage(source.campaignStage),
    experience: finiteNonNegative(source.experience, 0),
    revision: finiteNonNegative(source.revision, 0)
  };
}

export function normalizeFrontierEcologyState(value: unknown): FrontierEcologyState {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    seedPods: finiteNonNegative(source.seedPods, 0),
    cultivatedPlots: finiteNonNegative(source.cultivatedPlots, 0),
    ecoEnergy: Math.min(100, finiteNonNegative(source.ecoEnergy, 0)),
    ecosystemStability: Math.min(100, finiteNonNegative(source.ecosystemStability, 0)),
    restoredBiomes: finiteNonNegative(source.restoredBiomes, 0),
    revision: finiteNonNegative(source.revision, 0)
  };
}

export function frontierObjective(
  state: FrontierState,
  ecology: FrontierEcologyState = INITIAL_FRONTIER_ECOLOGY_STATE
) {
  if (state.campaignStage === 1) return 'Sample Aetherium, Alloy and Biofiber';
  if (state.campaignStage === 2) return 'Build your first habitat';
  if (state.campaignStage === 3) return 'Craft a Power Core';
  if (state.campaignStage === 4) return 'Restore the first Sky Grid sector';
  if (state.campaignStage === 5) {
    if (ecology.seedPods < 2) return 'Recover native seed pods';
    if (ecology.cultivatedPlots < 2) return 'Cultivate two living plots';
    if (ecology.ecoEnergy < 40) return 'Generate 40 Eco Energy';
    return 'Restore the first living biome';
  }
  return 'Mundos vivos complete · Tormenta iónica is the next production phase';
}

export function frontierCampaignProgress(
  state: FrontierState,
  ecology: FrontierEcologyState = INITIAL_FRONTIER_ECOLOGY_STATE
) {
  if (state.campaignStage === 1) {
    const progress = (
      Math.min(1, state.aetherium / 4) +
      Math.min(1, state.alloy / 3) +
      Math.min(1, state.biofiber / 3)
    ) / 3;
    return Math.round(progress * 100);
  }
  if (state.campaignStage === 2) return state.habitats > 0 ? 100 : Math.min(99, Math.round(((state.alloy / 12) + (state.biofiber / 8)) * 50));
  if (state.campaignStage === 3) {
    if (state.powerCores > 0) return 100;
    return Math.min(99, Math.round(((state.aetherium / 20) + (state.alloy / 10) + (state.biofiber / 4)) * (100 / 3)));
  }
  if (state.campaignStage === 4) return Math.min(100, Math.round((state.skyGridIntegrity / 25) * 100));
  if (state.campaignStage === 5) {
    const progress = (
      Math.min(1, ecology.seedPods / 2) +
      Math.min(1, ecology.cultivatedPlots / 2) +
      Math.min(1, ecology.ecoEnergy / 40) +
      Math.min(1, ecology.ecosystemStability / 25)
    ) / 4;
    return Math.round(progress * 100);
  }
  return 100;
}

export function frontierExplorerRank(state: FrontierState) {
  return Math.min(40, Math.floor(state.experience / 100) + 1);
}

export function actionAvailability(state: FrontierState, action: FrontierActionId): { enabled: boolean; reason?: string } {
  if (state.skyGridIntegrity >= 100 && action === 'restore_sky_grid') {
    return { enabled: false, reason: 'Sky Grid already stable' };
  }
  if (action === 'build_habitat') {
    if (state.campaignStage < 2) return { enabled: false, reason: 'Complete Despertar first' };
    if (state.alloy < 12) return { enabled: false, reason: 'Need 12 Alloy' };
    if (state.biofiber < 8) return { enabled: false, reason: 'Need 8 Biofiber' };
  }
  if (action === 'craft_power_core') {
    if (state.campaignStage < 3) return { enabled: false, reason: 'Build the first habitat first' };
    if (state.aetherium < 20) return { enabled: false, reason: 'Need 20 Aetherium' };
    if (state.alloy < 10) return { enabled: false, reason: 'Need 10 Alloy' };
    if (state.biofiber < 4) return { enabled: false, reason: 'Need 4 Biofiber' };
  }
  if (action === 'restore_sky_grid') {
    if (state.campaignStage < 4) return { enabled: false, reason: 'Craft the Power Core first' };
    if (state.powerCores < 1) return { enabled: false, reason: 'Need 1 Power Core' };
    if (state.aetherium < 8) return { enabled: false, reason: 'Need 8 Aetherium' };
  }
  return { enabled: true };
}

export function ecologyActionAvailability(
  state: FrontierState,
  ecology: FrontierEcologyState,
  action: FrontierEcologyActionId
): { enabled: boolean; reason?: string } {
  if (state.campaignStage < 5) return { enabled: false, reason: 'Restore the first Sky Grid sector first' };
  if (action === 'cultivate_plot') {
    if (ecology.seedPods < 2) return { enabled: false, reason: 'Need 2 Seed Pods' };
    if (state.biofiber < 2) return { enabled: false, reason: 'Need 2 Biofiber' };
  }
  if (action === 'generate_eco_energy') {
    if (ecology.cultivatedPlots < 1) return { enabled: false, reason: 'Cultivate a living plot first' };
    if (ecology.ecoEnergy >= 100) return { enabled: false, reason: 'Eco Energy storage full' };
  }
  if (action === 'restore_biome') {
    if (ecology.cultivatedPlots < 2) return { enabled: false, reason: 'Need 2 cultivated plots' };
    if (ecology.ecoEnergy < 40) return { enabled: false, reason: 'Need 40 Eco Energy' };
    if (state.biofiber < 4) return { enabled: false, reason: 'Need 4 Biofiber' };
    if (ecology.ecosystemStability >= 100) return { enabled: false, reason: 'Ecosystem already stable' };
  }
  return { enabled: true };
}
