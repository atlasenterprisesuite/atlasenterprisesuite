export type FrontierActionId =
  | 'extract_aetherium'
  | 'salvage_alloy'
  | 'harvest_biofiber'
  | 'craft_power_core'
  | 'build_habitat'
  | 'restore_sky_grid';

export type FrontierState = {
  aetherium: number;
  alloy: number;
  biofiber: number;
  powerCores: number;
  habitats: number;
  skyGridIntegrity: number;
  actionCount: number;
  stormMinutes: number;
  revision: number;
};

export type FrontierActionDefinition = {
  id: FrontierActionId;
  label: string;
  mode: 'Explore' | 'Craft' | 'Build' | 'Restore';
  description: string;
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
  revision: 0
});

export const FRONTIER_ACTIONS: readonly FrontierActionDefinition[] = [
  { id: 'extract_aetherium', label: 'Extract Aetherium', mode: 'Explore', description: 'Mine the luminous resource seam. +4 Aetherium.' },
  { id: 'salvage_alloy', label: 'Salvage Alloy', mode: 'Explore', description: 'Recover structural material. +3 Alloy.' },
  { id: 'harvest_biofiber', label: 'Harvest Biofiber', mode: 'Explore', description: 'Gather living construction fiber. +3 Biofiber.' },
  { id: 'craft_power_core', label: 'Craft Power Core', mode: 'Craft', description: 'Costs 20 Aetherium, 10 Alloy and 4 Biofiber.' },
  { id: 'build_habitat', label: 'Build Habitat', mode: 'Build', description: 'Costs 12 Alloy and 8 Biofiber.' },
  { id: 'restore_sky_grid', label: 'Restore Sky Grid', mode: 'Restore', description: 'Consumes 1 Power Core and 8 Aetherium. Restores 25%.' }
] as const;

function finiteNonNegative(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
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
    revision: finiteNonNegative(source.revision, 0)
  };
}

export function frontierObjective(state: FrontierState) {
  if (state.skyGridIntegrity >= 100) return 'Sky Grid stable · Expand the frontier';
  if (state.powerCores === 0 && state.aetherium < 20) return 'Collect 20 Aetherium · Build a Power Core';
  if (state.powerCores === 0 && state.alloy < 10) return 'Collect 10 Alloy · Build a Power Core';
  if (state.powerCores === 0 && state.biofiber < 4) return 'Collect 4 Biofiber · Build a Power Core';
  if (state.powerCores === 0) return 'Craft a Power Core';
  if (state.aetherium < 8) return 'Collect 8 Aetherium · Restore the Sky Grid';
  return 'Restore the Sky Grid';
}

export function actionAvailability(state: FrontierState, action: FrontierActionId): { enabled: boolean; reason?: string } {
  if (state.skyGridIntegrity >= 100 && action === 'restore_sky_grid') {
    return { enabled: false, reason: 'Sky Grid already stable' };
  }
  if (action === 'craft_power_core') {
    if (state.aetherium < 20) return { enabled: false, reason: 'Need 20 Aetherium' };
    if (state.alloy < 10) return { enabled: false, reason: 'Need 10 Alloy' };
    if (state.biofiber < 4) return { enabled: false, reason: 'Need 4 Biofiber' };
  }
  if (action === 'build_habitat') {
    if (state.alloy < 12) return { enabled: false, reason: 'Need 12 Alloy' };
    if (state.biofiber < 8) return { enabled: false, reason: 'Need 8 Biofiber' };
  }
  if (action === 'restore_sky_grid') {
    if (state.powerCores < 1) return { enabled: false, reason: 'Need 1 Power Core' };
    if (state.aetherium < 8) return { enabled: false, reason: 'Need 8 Aetherium' };
  }
  return { enabled: true };
}
