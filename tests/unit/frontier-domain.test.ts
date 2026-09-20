import { describe, expect, it } from 'vitest';
import {
  actionAvailability,
  ecologyActionAvailability,
  frontierCampaignProgress,
  frontierExplorerRank,
  frontierObjective,
  INITIAL_FRONTIER_ECOLOGY_STATE,
  INITIAL_FRONTIER_STATE,
  normalizeFrontierEcologyState,
  normalizeFrontierState
} from '../../apps/web/src/modules/frontier/domain';

describe('ATLAS FRONTIER domain', () => {
  it('starts fail-safe with no fabricated progress', () => {
    expect(INITIAL_FRONTIER_STATE.skyGridIntegrity).toBe(0);
    expect(INITIAL_FRONTIER_STATE.campaignStage).toBe(1);
    expect(INITIAL_FRONTIER_STATE.experience).toBe(0);
    expect(INITIAL_FRONTIER_ECOLOGY_STATE.ecosystemStability).toBe(0);
    expect(frontierObjective(INITIAL_FRONTIER_STATE)).toContain('Sample Aetherium');
  });

  it('gates core campaign actions by stage and resources', () => {
    expect(actionAvailability(INITIAL_FRONTIER_STATE, 'build_habitat').reason).toContain('Despertar');
    const shelterReady = { ...INITIAL_FRONTIER_STATE, campaignStage: 2 as const, alloy: 12, biofiber: 8 };
    expect(actionAvailability(shelterReady, 'build_habitat').enabled).toBe(true);
    const coreReady = { ...INITIAL_FRONTIER_STATE, campaignStage: 3 as const, aetherium: 20, alloy: 10, biofiber: 4 };
    expect(actionAvailability(coreReady, 'craft_power_core').enabled).toBe(true);
    const gridReady = { ...INITIAL_FRONTIER_STATE, campaignStage: 4 as const, powerCores: 1, aetherium: 8 };
    expect(actionAvailability(gridReady, 'restore_sky_grid').enabled).toBe(true);
  });

  it('gates Living Worlds actions behind stage five and explicit ecology resources', () => {
    expect(ecologyActionAvailability(INITIAL_FRONTIER_STATE, INITIAL_FRONTIER_ECOLOGY_STATE, 'collect_seed_pods').enabled).toBe(false);

    const livingState = { ...INITIAL_FRONTIER_STATE, campaignStage: 5 as const, biofiber: 8 };
    expect(ecologyActionAvailability(livingState, INITIAL_FRONTIER_ECOLOGY_STATE, 'collect_seed_pods').enabled).toBe(true);

    const seeded = { ...INITIAL_FRONTIER_ECOLOGY_STATE, seedPods: 2 };
    expect(ecologyActionAvailability(livingState, seeded, 'cultivate_plot').enabled).toBe(true);

    const powered = { ...INITIAL_FRONTIER_ECOLOGY_STATE, cultivatedPlots: 2, ecoEnergy: 40 };
    expect(ecologyActionAvailability(livingState, powered, 'restore_biome').enabled).toBe(true);
  });

  it('calculates campaign progress for Awakening and Living Worlds', () => {
    expect(frontierCampaignProgress({ ...INITIAL_FRONTIER_STATE, aetherium: 4, alloy: 3, biofiber: 3 })).toBe(100);

    const livingState = { ...INITIAL_FRONTIER_STATE, campaignStage: 5 as const };
    const livingEcology = {
      ...INITIAL_FRONTIER_ECOLOGY_STATE,
      seedPods: 2,
      cultivatedPlots: 2,
      ecoEnergy: 40,
      ecosystemStability: 25
    };
    expect(frontierCampaignProgress(livingState, livingEcology)).toBe(100);
    expect(frontierObjective(livingState, livingEcology)).toContain('Restore the first living biome');
    expect(frontierExplorerRank({ ...INITIAL_FRONTIER_STATE, experience: 250 })).toBe(3);
  });

  it('normalizes bounded frontier and ecology values', () => {
    const normalized = normalizeFrontierState({ skyGridIntegrity: 140, campaignStage: 99, experience: 50, revision: 3 });
    expect(normalized.skyGridIntegrity).toBe(100);
    expect(normalized.campaignStage).toBe(6);
    expect(normalized.experience).toBe(50);
    expect(normalized.revision).toBe(3);

    const ecology = normalizeFrontierEcologyState({ ecoEnergy: 140, ecosystemStability: 180, revision: 2 });
    expect(ecology.ecoEnergy).toBe(100);
    expect(ecology.ecosystemStability).toBe(100);
    expect(ecology.revision).toBe(2);
  });
});
