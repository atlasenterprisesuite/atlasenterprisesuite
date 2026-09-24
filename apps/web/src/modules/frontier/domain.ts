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

export type FrontierExpansionActionId =
  | 'capture_storm_charge'
  | 'reinforce_storm_shelter'
  | 'master_ion_storm'
  | 'found_settlement'
  | 'connect_settlements'
  | 'establish_civilization'
  | 'fabricate_orbital_frame'
  | 'launch_orbital_station'
  | 'open_orbital_horizon'
  | 'establish_network_link'
  | 'run_trade_route'
  | 'activate_frontier_network'
  | 'synthesize_world_seed'
  | 'generate_frontier_world'
  | 'restore_generated_world';

export type FrontierSurvivalActionId =
  | 'scan_environment'
  | 'recharge_suit'
  | 'deploy_shield'
  | 'stabilize_temperature'
  | 'endure_hazard'
  | 'recover_at_habitat';

export type FrontierHazard = 'clear' | 'ion_storm' | 'thermal_front' | 'anomaly';

export type FrontierCampaignStage = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

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

export type FrontierExpansionState = {
  stormCharge: number;
  shelterIntegrity: number;
  stormMastery: number;
  settlements: number;
  civicLinks: number;
  civilizationIndex: number;
  orbitalFrames: number;
  orbitalStations: number;
  orbitalReach: number;
  networkLinks: number;
  tradeVolume: number;
  networkIntegrity: number;
  worldSeeds: number;
  worldsGenerated: number;
  infiniteMastery: number;
  endlessCycles: number;
  campaignComplete: boolean;
  revision: number;
};

export type FrontierSurvivalState = {
  health: number;
  suitEnergy: number;
  shieldIntegrity: number;
  thermalStability: number;
  exposure: number;
  activeHazard: FrontierHazard;
  hazardIntensity: number;
  hazardTurns: number;
  survivedEvents: number;
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

export type FrontierExpansionActionDefinition = {
  id: FrontierExpansionActionId;
  stage: 6 | 7 | 8 | 9 | 10;
  label: string;
  mode: 'Survive' | 'Build' | 'Civilize' | 'Orbit' | 'Network' | 'Infinite';
  description: string;
};

export type FrontierSurvivalActionDefinition = {
  id: FrontierSurvivalActionId;
  label: string;
  mode: 'Scan' | 'Energy' | 'Shield' | 'Thermal' | 'Survive' | 'Recover';
  description: string;
};

export type FrontierCampaignDefinition = {
  stage: FrontierCampaignStage;
  title: string;
  summary: string;
  productionState: 'playable';
};

export type FrontierLevelDefinition = {
  level: number;
  stage: FrontierCampaignStage;
  title: string;
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

export const INITIAL_FRONTIER_EXPANSION_STATE: FrontierExpansionState = Object.freeze({
  stormCharge: 0,
  shelterIntegrity: 0,
  stormMastery: 0,
  settlements: 0,
  civicLinks: 0,
  civilizationIndex: 0,
  orbitalFrames: 0,
  orbitalStations: 0,
  orbitalReach: 0,
  networkLinks: 0,
  tradeVolume: 0,
  networkIntegrity: 0,
  worldSeeds: 0,
  worldsGenerated: 0,
  infiniteMastery: 0,
  endlessCycles: 0,
  campaignComplete: false,
  revision: 0
});

export const INITIAL_FRONTIER_SURVIVAL_STATE: FrontierSurvivalState = Object.freeze({
  health: 100,
  suitEnergy: 100,
  shieldIntegrity: 0,
  thermalStability: 50,
  exposure: 0,
  activeHazard: 'clear',
  hazardIntensity: 0,
  hazardTurns: 0,
  survivedEvents: 0,
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

export const FRONTIER_EXPANSION_ACTIONS: readonly FrontierExpansionActionDefinition[] = [
  { id: 'capture_storm_charge', stage: 6, label: 'Capture Storm Charge', mode: 'Survive', description: 'Harvest ion energy from the active storm. +25 charge.' },
  { id: 'reinforce_storm_shelter', stage: 6, label: 'Reinforce Shelter', mode: 'Build', description: 'Costs 8 Alloy and 4 Biofiber. +25 shelter integrity.' },
  { id: 'master_ion_storm', stage: 6, label: 'Stabilize Ion Storm', mode: 'Survive', description: 'Requires 50 charge and 50% shelter integrity.' },

  { id: 'found_settlement', stage: 7, label: 'Found Settlement', mode: 'Civilize', description: 'Costs 16 Alloy and 8 Biofiber. Build two settlements.' },
  { id: 'connect_settlements', stage: 7, label: 'Connect Settlements', mode: 'Civilize', description: 'Requires two settlements. Establish a civic link.' },
  { id: 'establish_civilization', stage: 7, label: 'Establish Civilization', mode: 'Civilize', description: 'Requires two settlements and one civic link.' },

  { id: 'fabricate_orbital_frame', stage: 8, label: 'Fabricate Orbital Frame', mode: 'Orbit', description: 'Costs 16 Aetherium and 24 Alloy.' },
  { id: 'launch_orbital_station', stage: 8, label: 'Launch Orbital Station', mode: 'Orbit', description: 'Consumes one frame and one Power Core.' },
  { id: 'open_orbital_horizon', stage: 8, label: 'Open Orbital Horizon', mode: 'Orbit', description: 'Requires an orbital station. Establish planetary orbit.' },

  { id: 'establish_network_link', stage: 9, label: 'Establish Network Link', mode: 'Network', description: 'Costs 8 Aetherium and 8 Alloy. Build two interworld links.' },
  { id: 'run_trade_route', stage: 9, label: 'Run Trade Route', mode: 'Network', description: 'Requires two links. +25 trade volume.' },
  { id: 'activate_frontier_network', stage: 9, label: 'Activate Frontier Network', mode: 'Network', description: 'Requires two links and 50 trade volume.' },

  { id: 'synthesize_world_seed', stage: 10, label: 'Synthesize World Seed', mode: 'Infinite', description: 'Costs 20 Aetherium and 6 Biofiber.' },
  { id: 'generate_frontier_world', stage: 10, label: 'Generate Frontier World', mode: 'Infinite', description: 'Consumes one World Seed and creates a new frontier world.' },
  { id: 'restore_generated_world', stage: 10, label: 'Restore Generated World', mode: 'Infinite', description: 'Restore the newest generated world and complete an endless cycle.' }
] as const;

export const FRONTIER_SURVIVAL_ACTIONS: readonly FrontierSurvivalActionDefinition[] = [
  { id: 'scan_environment', label: 'Scan Environment', mode: 'Scan', description: 'Spend 5 suit energy to reveal the next governed environmental hazard.' },
  { id: 'recharge_suit', label: 'Recharge Suit', mode: 'Energy', description: 'Consume 4 Aetherium to restore 25 suit energy.' },
  { id: 'deploy_shield', label: 'Deploy Shield', mode: 'Shield', description: 'Spend 10 suit energy to add 25 shield integrity.' },
  { id: 'stabilize_temperature', label: 'Thermal Stabilization', mode: 'Thermal', description: 'Spend 10 suit energy to add 25 thermal stability.' },
  { id: 'endure_hazard', label: 'Endure Hazard', mode: 'Survive', description: 'Advance the active hazard one turn. Protection reduces damage and exposure.' },
  { id: 'recover_at_habitat', label: 'Recover at Habitat', mode: 'Recover', description: 'Consume 4 Biofiber at a built Habitat to restore health and reduce exposure.' }
] as const;

export const FRONTIER_CAMPAIGN: readonly FrontierCampaignDefinition[] = [
  { stage: 1, title: 'Despertar', summary: 'Explore the crash zone and learn the three resource families.', productionState: 'playable' },
  { stage: 2, title: 'Primer refugio', summary: 'Gather structural material and build a self-sustaining habitat.', productionState: 'playable' },
  { stage: 3, title: 'Power Core', summary: 'Manufacture a stable core from Aetherium, Alloy and Biofiber.', productionState: 'playable' },
  { stage: 4, title: 'Sky Grid', summary: 'Restore the first sector of the planetary energy network.', productionState: 'playable' },
  { stage: 5, title: 'Mundos vivos', summary: 'Recover seed stock, cultivate living plots, generate bio-energy and restore the first biome.', productionState: 'playable' },
  { stage: 6, title: 'Tormenta iónica', summary: 'Capture storm energy, reinforce shelter and master the first ion storm.', productionState: 'playable' },
  { stage: 7, title: 'Civilización', summary: 'Found settlements, connect them and establish a civilization.', productionState: 'playable' },
  { stage: 8, title: 'Horizonte orbital', summary: 'Fabricate an orbital frame, launch a station and reach orbit.', productionState: 'playable' },
  { stage: 9, title: 'Frontier Network', summary: 'Connect worlds, move trade and activate the frontier network.', productionState: 'playable' },
  { stage: 10, title: 'Atlas infinito', summary: 'Synthesize world seeds, generate new worlds and repeat restoration indefinitely.', productionState: 'playable' }
] as const;

const LEVEL_TITLES = [
  ['Crash Wake', 'Aetherium Sample', 'Alloy Salvage', 'Biofiber Harvest'],
  ['Foundation', 'Habitat Frame', 'Environmental Seal', 'Habitat Online'],
  ['Resource Calibration', 'Core Frame', 'Core Assembly', 'Stable Ignition'],
  ['Grid Trace', 'Relay Charge', 'Sector Reconnect', 'First Sector Online'],
  ['Seed Recovery', 'Living Plot', 'Bio-Energy', 'First Biome Restored'],
  ['Storm Scan', 'Charge Capture', 'Shelter Reinforcement', 'Storm Mastery'],
  ['Outpost Charter', 'Second Settlement', 'Civic Link', 'Civilization Online'],
  ['Orbital Materials', 'Frame Fabrication', 'Station Launch', 'Orbital Horizon'],
  ['First Link', 'Second Link', 'Trade Route', 'Network Online'],
  ['World Seed', 'World Generation', 'Restoration Cycle', 'Atlas Infinite']
] as const;

export const FRONTIER_LEVELS: readonly FrontierLevelDefinition[] = LEVEL_TITLES.flatMap((titles, stageIndex) =>
  titles.map((title, index) => ({
    level: stageIndex * 4 + index + 1,
    stage: (stageIndex + 1) as FrontierCampaignStage,
    title
  }))
);

function finiteNonNegative(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function boundedPercent(value: unknown) {
  return Math.min(100, finiteNonNegative(value, 0));
}

function campaignStage(value: unknown): FrontierCampaignStage {
  const parsed = finiteNonNegative(value, 1);
  return Math.min(10, Math.max(1, parsed)) as FrontierCampaignStage;
}

export function normalizeFrontierState(value: unknown): FrontierState {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    aetherium: finiteNonNegative(source.aetherium, 0),
    alloy: finiteNonNegative(source.alloy, 0),
    biofiber: finiteNonNegative(source.biofiber, 0),
    powerCores: finiteNonNegative(source.powerCores, 0),
    habitats: finiteNonNegative(source.habitats, 0),
    skyGridIntegrity: boundedPercent(source.skyGridIntegrity),
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
    ecoEnergy: boundedPercent(source.ecoEnergy),
    ecosystemStability: boundedPercent(source.ecosystemStability),
    restoredBiomes: finiteNonNegative(source.restoredBiomes, 0),
    revision: finiteNonNegative(source.revision, 0)
  };
}

export function normalizeFrontierExpansionState(value: unknown): FrontierExpansionState {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    stormCharge: boundedPercent(source.stormCharge),
    shelterIntegrity: boundedPercent(source.shelterIntegrity),
    stormMastery: boundedPercent(source.stormMastery),
    settlements: finiteNonNegative(source.settlements, 0),
    civicLinks: finiteNonNegative(source.civicLinks, 0),
    civilizationIndex: boundedPercent(source.civilizationIndex),
    orbitalFrames: finiteNonNegative(source.orbitalFrames, 0),
    orbitalStations: finiteNonNegative(source.orbitalStations, 0),
    orbitalReach: boundedPercent(source.orbitalReach),
    networkLinks: finiteNonNegative(source.networkLinks, 0),
    tradeVolume: boundedPercent(source.tradeVolume),
    networkIntegrity: boundedPercent(source.networkIntegrity),
    worldSeeds: finiteNonNegative(source.worldSeeds, 0),
    worldsGenerated: finiteNonNegative(source.worldsGenerated, 0),
    infiniteMastery: boundedPercent(source.infiniteMastery),
    endlessCycles: finiteNonNegative(source.endlessCycles, 0),
    campaignComplete: source.campaignComplete === true,
    revision: finiteNonNegative(source.revision, 0)
  };
}


export function normalizeFrontierSurvivalState(value: unknown): FrontierSurvivalState {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const hazard = String(source.activeHazard ?? 'clear');
  const activeHazard: FrontierHazard =
    hazard === 'ion_storm' || hazard === 'thermal_front' || hazard === 'anomaly' ? hazard : 'clear';
  return {
    health: boundedPercent(source.health ?? 100),
    suitEnergy: boundedPercent(source.suitEnergy ?? 100),
    shieldIntegrity: boundedPercent(source.shieldIntegrity),
    thermalStability: boundedPercent(source.thermalStability ?? 50),
    exposure: boundedPercent(source.exposure),
    activeHazard,
    hazardIntensity: boundedPercent(source.hazardIntensity),
    hazardTurns: finiteNonNegative(source.hazardTurns, 0),
    survivedEvents: finiteNonNegative(source.survivedEvents, 0),
    revision: finiteNonNegative(source.revision, 0)
  };
}

export function frontierObjective(
  state: FrontierState,
  ecology: FrontierEcologyState = INITIAL_FRONTIER_ECOLOGY_STATE,
  expansion: FrontierExpansionState = INITIAL_FRONTIER_EXPANSION_STATE
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
  if (state.campaignStage === 6) {
    if (expansion.stormCharge < 50) return 'Capture 50 ion storm charge';
    if (expansion.shelterIntegrity < 50) return 'Reinforce shelter to 50%';
    return 'Stabilize the first ion storm';
  }
  if (state.campaignStage === 7) {
    if (expansion.settlements < 2) return 'Found two settlements';
    if (expansion.civicLinks < 1) return 'Connect the settlements';
    return 'Establish the first civilization';
  }
  if (state.campaignStage === 8) {
    if (expansion.orbitalFrames < 1) return 'Fabricate an orbital frame';
    if (expansion.orbitalStations < 1) return 'Launch an orbital station';
    return 'Open the orbital horizon';
  }
  if (state.campaignStage === 9) {
    if (expansion.networkLinks < 2) return 'Establish two frontier links';
    if (expansion.tradeVolume < 50) return 'Run trade routes to 50 volume';
    return 'Activate the Frontier Network';
  }
  if (expansion.campaignComplete) return `Atlas infinito online · Endless cycle ${expansion.endlessCycles + 1}`;
  if (expansion.worldSeeds < 1) return 'Synthesize a World Seed';
  if (expansion.worldsGenerated <= expansion.endlessCycles) return 'Generate a new frontier world';
  return 'Restore the generated world';
}

export function frontierCampaignProgress(
  state: FrontierState,
  ecology: FrontierEcologyState = INITIAL_FRONTIER_ECOLOGY_STATE,
  expansion: FrontierExpansionState = INITIAL_FRONTIER_EXPANSION_STATE
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
  if (state.campaignStage === 6) {
    return Math.round(((Math.min(1, expansion.stormCharge / 50) + Math.min(1, expansion.shelterIntegrity / 50) + Math.min(1, expansion.stormMastery / 25)) / 3) * 100);
  }
  if (state.campaignStage === 7) {
    return Math.round(((Math.min(1, expansion.settlements / 2) + Math.min(1, expansion.civicLinks) + Math.min(1, expansion.civilizationIndex / 25)) / 3) * 100);
  }
  if (state.campaignStage === 8) {
    return Math.round(((Math.min(1, expansion.orbitalFrames) + Math.min(1, expansion.orbitalStations) + Math.min(1, expansion.orbitalReach / 25)) / 3) * 100);
  }
  if (state.campaignStage === 9) {
    return Math.round(((Math.min(1, expansion.networkLinks / 2) + Math.min(1, expansion.tradeVolume / 50) + Math.min(1, expansion.networkIntegrity / 25)) / 3) * 100);
  }
  if (expansion.campaignComplete) return 100;
  return Math.round(((Math.min(1, expansion.worldSeeds) + Math.min(1, Math.max(0, expansion.worldsGenerated - expansion.endlessCycles)) + Math.min(1, expansion.infiniteMastery / 25)) / 3) * 100);
}

export function frontierCurrentLevel(
  state: FrontierState,
  ecology: FrontierEcologyState = INITIAL_FRONTIER_ECOLOGY_STATE,
  expansion: FrontierExpansionState = INITIAL_FRONTIER_EXPANSION_STATE
) {
  const progress = frontierCampaignProgress(state, ecology, expansion);
  const step = expansion.campaignComplete && state.campaignStage === 10
    ? 3
    : Math.min(3, Math.floor(progress / 25));
  const level = Math.min(40, (state.campaignStage - 1) * 4 + step + 1);
  return FRONTIER_LEVELS[level - 1];
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

export function expansionActionAvailability(
  state: FrontierState,
  expansion: FrontierExpansionState,
  action: FrontierExpansionActionId
): { enabled: boolean; reason?: string } {
  const definition = FRONTIER_EXPANSION_ACTIONS.find((item) => item.id === action);
  if (!definition) return { enabled: false, reason: 'Unknown expansion action' };
  if (state.campaignStage !== definition.stage) return { enabled: false, reason: `Available in phase ${definition.stage}` };

  if (action === 'capture_storm_charge' && expansion.stormCharge >= 100) return { enabled: false, reason: 'Storm charge storage full' };
  if (action === 'reinforce_storm_shelter') {
    if (state.alloy < 8) return { enabled: false, reason: 'Need 8 Alloy' };
    if (state.biofiber < 4) return { enabled: false, reason: 'Need 4 Biofiber' };
    if (expansion.shelterIntegrity >= 100) return { enabled: false, reason: 'Shelter fully reinforced' };
  }
  if (action === 'master_ion_storm') {
    if (expansion.stormCharge < 50) return { enabled: false, reason: 'Need 50 Storm Charge' };
    if (expansion.shelterIntegrity < 50) return { enabled: false, reason: 'Need 50% Shelter Integrity' };
  }

  if (action === 'found_settlement') {
    if (state.alloy < 16) return { enabled: false, reason: 'Need 16 Alloy' };
    if (state.biofiber < 8) return { enabled: false, reason: 'Need 8 Biofiber' };
  }
  if (action === 'connect_settlements' && expansion.settlements < 2) return { enabled: false, reason: 'Need 2 settlements' };
  if (action === 'establish_civilization') {
    if (expansion.settlements < 2) return { enabled: false, reason: 'Need 2 settlements' };
    if (expansion.civicLinks < 1) return { enabled: false, reason: 'Need 1 civic link' };
  }

  if (action === 'fabricate_orbital_frame') {
    if (state.aetherium < 16) return { enabled: false, reason: 'Need 16 Aetherium' };
    if (state.alloy < 24) return { enabled: false, reason: 'Need 24 Alloy' };
  }
  if (action === 'launch_orbital_station') {
    if (expansion.orbitalFrames < 1) return { enabled: false, reason: 'Need 1 orbital frame' };
    if (state.powerCores < 1) return { enabled: false, reason: 'Need 1 Power Core' };
  }
  if (action === 'open_orbital_horizon' && expansion.orbitalStations < 1) return { enabled: false, reason: 'Launch an orbital station first' };

  if (action === 'establish_network_link') {
    if (state.aetherium < 8) return { enabled: false, reason: 'Need 8 Aetherium' };
    if (state.alloy < 8) return { enabled: false, reason: 'Need 8 Alloy' };
  }
  if (action === 'run_trade_route' && expansion.networkLinks < 2) return { enabled: false, reason: 'Need 2 network links' };
  if (action === 'activate_frontier_network') {
    if (expansion.networkLinks < 2) return { enabled: false, reason: 'Need 2 network links' };
    if (expansion.tradeVolume < 50) return { enabled: false, reason: 'Need 50 trade volume' };
  }

  if (action === 'synthesize_world_seed') {
    if (state.aetherium < 20) return { enabled: false, reason: 'Need 20 Aetherium' };
    if (state.biofiber < 6) return { enabled: false, reason: 'Need 6 Biofiber' };
  }
  if (action === 'generate_frontier_world' && expansion.worldSeeds < 1) return { enabled: false, reason: 'Need 1 World Seed' };
  if (action === 'restore_generated_world' && expansion.worldsGenerated <= expansion.endlessCycles) {
    return { enabled: false, reason: 'Generate a new frontier world first' };
  }

  return { enabled: true };
}


export function survivalActionAvailability(
  state: FrontierState,
  survival: FrontierSurvivalState,
  action: FrontierSurvivalActionId
): { enabled: boolean; reason?: string } {
  if (action === 'scan_environment') {
    if (survival.activeHazard !== 'clear') return { enabled: false, reason: 'Resolve the active hazard first' };
    if (survival.suitEnergy < 5) return { enabled: false, reason: 'Need 5 suit energy' };
  }
  if (action === 'recharge_suit') {
    if (state.aetherium < 4) return { enabled: false, reason: 'Need 4 Aetherium' };
    if (survival.suitEnergy >= 100) return { enabled: false, reason: 'Suit energy full' };
  }
  if (action === 'deploy_shield') {
    if (survival.suitEnergy < 10) return { enabled: false, reason: 'Need 10 suit energy' };
    if (survival.shieldIntegrity >= 100) return { enabled: false, reason: 'Shield integrity full' };
  }
  if (action === 'stabilize_temperature') {
    if (survival.suitEnergy < 10) return { enabled: false, reason: 'Need 10 suit energy' };
    if (survival.thermalStability >= 100) return { enabled: false, reason: 'Thermal stability full' };
  }
  if (action === 'endure_hazard') {
    if (survival.activeHazard === 'clear' || survival.hazardTurns < 1) return { enabled: false, reason: 'No active hazard' };
    if (survival.health <= 0) return { enabled: false, reason: 'Recover at a Habitat first' };
    if (survival.suitEnergy < 5) return { enabled: false, reason: 'Need 5 suit energy' };
  }
  if (action === 'recover_at_habitat') {
    if (state.habitats < 1) return { enabled: false, reason: 'Build a Habitat first' };
    if (state.biofiber < 4) return { enabled: false, reason: 'Need 4 Biofiber' };
    if (survival.health >= 100 && survival.exposure === 0) return { enabled: false, reason: 'Recovery not required' };
  }
  return { enabled: true };
}
