import { describe, expect, it } from 'vitest';
import {
  actionAvailability,
  frontierCampaignProgress,
  frontierExplorerRank,
  frontierObjective,
  INITIAL_FRONTIER_STATE,
  normalizeFrontierState
} from '../../apps/web/src/modules/frontier/domain';

describe('ATLAS FRONTIER domain', () => {
  it('starts fail-safe with no fabricated progress', () => {
    expect(INITIAL_FRONTIER_STATE.skyGridIntegrity).toBe(0);
    expect(INITIAL_FRONTIER_STATE.campaignStage).toBe(1);
    expect(INITIAL_FRONTIER_STATE.experience).toBe(0);
    expect(frontierObjective(INITIAL_FRONTIER_STATE)).toContain('Sample Aetherium');
  });

  it('gates campaign actions by stage and resources', () => {
    expect(actionAvailability(INITIAL_FRONTIER_STATE, 'build_habitat').reason).toContain('Despertar');
    const shelterReady = { ...INITIAL_FRONTIER_STATE, campaignStage: 2 as const, alloy: 12, biofiber: 8 };
    expect(actionAvailability(shelterReady, 'build_habitat').enabled).toBe(true);
    const coreReady = { ...INITIAL_FRONTIER_STATE, campaignStage: 3 as const, aetherium: 20, alloy: 10, biofiber: 4 };
    expect(actionAvailability(coreReady, 'craft_power_core').enabled).toBe(true);
    const gridReady = { ...INITIAL_FRONTIER_STATE, campaignStage: 4 as const, powerCores: 1, aetherium: 8 };
    expect(actionAvailability(gridReady, 'restore_sky_grid').enabled).toBe(true);
  });

  it('calculates campaign progress and explorer rank', () => {
    expect(frontierCampaignProgress({ ...INITIAL_FRONTIER_STATE, aetherium: 4, alloy: 3, biofiber: 3 })).toBe(100);
    expect(frontierExplorerRank({ ...INITIAL_FRONTIER_STATE, experience: 250 })).toBe(3);
  });

  it('normalizes persisted state and caps bounded values', () => {
    const normalized = normalizeFrontierState({ skyGridIntegrity: 140, campaignStage: 99, experience: 50, revision: 3 });
    expect(normalized.skyGridIntegrity).toBe(100);
    expect(normalized.campaignStage).toBe(5);
    expect(normalized.experience).toBe(50);
    expect(normalized.revision).toBe(3);
  });
});
