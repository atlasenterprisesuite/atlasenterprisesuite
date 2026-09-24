import { describe, expect, it } from 'vitest';
import {
  actionAvailability,
  ecologyActionAvailability,
  expansionActionAvailability,
  survivalActionAvailability,
  FRONTIER_LEVELS,
  frontierCampaignProgress,
  frontierCurrentLevel,
  frontierExplorerRank,
  frontierObjective,
  INITIAL_FRONTIER_ECOLOGY_STATE,
  INITIAL_FRONTIER_EXPANSION_STATE,
  INITIAL_FRONTIER_SURVIVAL_STATE,
  INITIAL_FRONTIER_STATE,
  normalizeFrontierEcologyState,
  normalizeFrontierExpansionState,
  normalizeFrontierSurvivalState,
  normalizeFrontierState
} from '../../apps/web/src/modules/frontier/domain';

describe('ATLAS FRONTIER domain', () => {
  it('starts fail-safe with no fabricated progress', () => {
    expect(INITIAL_FRONTIER_STATE.skyGridIntegrity).toBe(0);
    expect(INITIAL_FRONTIER_STATE.campaignStage).toBe(1);
    expect(INITIAL_FRONTIER_STATE.experience).toBe(0);
    expect(INITIAL_FRONTIER_ECOLOGY_STATE.ecosystemStability).toBe(0);
    expect(INITIAL_FRONTIER_EXPANSION_STATE.campaignComplete).toBe(false);
    expect(frontierObjective(INITIAL_FRONTIER_STATE)).toContain('Sample Aetherium');
  });

  it('defines exactly forty campaign levels across ten phases', () => {
    expect(FRONTIER_LEVELS).toHaveLength(40);
    expect(FRONTIER_LEVELS[0]).toMatchObject({ level: 1, stage: 1 });
    expect(FRONTIER_LEVELS[39]).toMatchObject({ level: 40, stage: 10, title: 'Atlas Infinite' });
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

  it('enforces exact phase gates for stages six through ten', () => {
    const stormState = { ...INITIAL_FRONTIER_STATE, campaignStage: 6 as const, alloy: 8, biofiber: 4 };
    expect(expansionActionAvailability(stormState, INITIAL_FRONTIER_EXPANSION_STATE, 'capture_storm_charge').enabled).toBe(true);
    expect(expansionActionAvailability(stormState, INITIAL_FRONTIER_EXPANSION_STATE, 'found_settlement').enabled).toBe(false);

    const stormReady = { ...INITIAL_FRONTIER_EXPANSION_STATE, stormCharge: 50, shelterIntegrity: 50 };
    expect(expansionActionAvailability(stormState, stormReady, 'master_ion_storm').enabled).toBe(true);

    const infiniteState = { ...INITIAL_FRONTIER_STATE, campaignStage: 10 as const, aetherium: 20, biofiber: 6 };
    expect(expansionActionAvailability(infiniteState, INITIAL_FRONTIER_EXPANSION_STATE, 'synthesize_world_seed').enabled).toBe(true);
    expect(expansionActionAvailability(infiniteState, INITIAL_FRONTIER_EXPANSION_STATE, 'restore_generated_world').enabled).toBe(false);
  });

  it('gates survival actions by governed hazard and protection state', () => {
    expect(survivalActionAvailability(INITIAL_FRONTIER_STATE, INITIAL_FRONTIER_SURVIVAL_STATE, 'scan_environment').enabled).toBe(true);

    const hazard = {
      ...INITIAL_FRONTIER_SURVIVAL_STATE,
      suitEnergy: 40,
      activeHazard: 'ion_storm' as const,
      hazardIntensity: 55,
      hazardTurns: 3
    };
    expect(survivalActionAvailability(INITIAL_FRONTIER_STATE, hazard, 'scan_environment').enabled).toBe(false);
    expect(survivalActionAvailability(INITIAL_FRONTIER_STATE, hazard, 'endure_hazard').enabled).toBe(true);

    const injured = { ...INITIAL_FRONTIER_SURVIVAL_STATE, health: 0, exposure: 70 };
    const habitatRun = { ...INITIAL_FRONTIER_STATE, habitats: 1, biofiber: 4 };
    expect(survivalActionAvailability(habitatRun, injured, 'recover_at_habitat').enabled).toBe(true);
  });

  it('calculates campaign progress through level forty and endless mode', () => {
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

    const infiniteState = { ...INITIAL_FRONTIER_STATE, campaignStage: 10 as const };
    const completeExpansion = {
      ...INITIAL_FRONTIER_EXPANSION_STATE,
      infiniteMastery: 25,
      endlessCycles: 1,
      campaignComplete: true
    };
    expect(frontierCampaignProgress(infiniteState, INITIAL_FRONTIER_ECOLOGY_STATE, completeExpansion)).toBe(100);
    expect(frontierCurrentLevel(infiniteState, INITIAL_FRONTIER_ECOLOGY_STATE, completeExpansion).level).toBe(40);
    expect(frontierExplorerRank({ ...INITIAL_FRONTIER_STATE, experience: 250 })).toBe(3);
  });

  it('normalizes bounded frontier, ecology and expansion values', () => {
    const normalized = normalizeFrontierState({ skyGridIntegrity: 140, campaignStage: 99, experience: 50, revision: 3 });
    expect(normalized.skyGridIntegrity).toBe(100);
    expect(normalized.campaignStage).toBe(10);
    expect(normalized.experience).toBe(50);
    expect(normalized.revision).toBe(3);

    const ecology = normalizeFrontierEcologyState({ ecoEnergy: 140, ecosystemStability: 180, revision: 2 });
    expect(ecology.ecoEnergy).toBe(100);
    expect(ecology.ecosystemStability).toBe(100);

    const expansion = normalizeFrontierExpansionState({ stormCharge: 140, tradeVolume: 250, campaignComplete: true, revision: 4 });
    expect(expansion.stormCharge).toBe(100);
    expect(expansion.tradeVolume).toBe(100);
    expect(expansion.campaignComplete).toBe(true);
    expect(expansion.revision).toBe(4);

    const survival = normalizeFrontierSurvivalState({ health: 150, suitEnergy: -2, activeHazard: 'unknown', hazardIntensity: 140, revision: 5 });
    expect(survival.health).toBe(100);
    expect(survival.suitEnergy).toBe(0);
    expect(survival.activeHazard).toBe('clear');
    expect(survival.hazardIntensity).toBe(100);
    expect(survival.revision).toBe(5);
  });
});
