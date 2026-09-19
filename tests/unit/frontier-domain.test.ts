import { describe, expect, it } from 'vitest';
import { actionAvailability, frontierObjective, INITIAL_FRONTIER_STATE, normalizeFrontierState } from '../../apps/web/src/modules/frontier/domain';

describe('ATLAS FRONTIER domain', () => {
  it('starts fail-safe with no fabricated progress', () => {
    expect(INITIAL_FRONTIER_STATE.skyGridIntegrity).toBe(0);
    expect(INITIAL_FRONTIER_STATE.revision).toBe(0);
    expect(frontierObjective(INITIAL_FRONTIER_STATE)).toContain('20 Aetherium');
  });

  it('gates crafting and restoration by explicit resources', () => {
    expect(actionAvailability(INITIAL_FRONTIER_STATE, 'craft_power_core').enabled).toBe(false);
    expect(actionAvailability({ ...INITIAL_FRONTIER_STATE, aetherium: 20, alloy: 10, biofiber: 4 }, 'craft_power_core').enabled).toBe(true);
    expect(actionAvailability({ ...INITIAL_FRONTIER_STATE, powerCores: 1, aetherium: 8 }, 'restore_sky_grid').enabled).toBe(true);
  });

  it('normalizes persisted state and caps integrity', () => {
    expect(normalizeFrontierState({ skyGridIntegrity: 140, revision: 3 }).skyGridIntegrity).toBe(100);
    expect(normalizeFrontierState({ revision: 3 }).revision).toBe(3);
  });
});
