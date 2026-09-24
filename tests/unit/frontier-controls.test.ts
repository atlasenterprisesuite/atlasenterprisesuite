import { describe, expect, it } from 'vitest';
import {
  FRONTIER_CONTROLS,
  FRONTIER_MOVEMENT_KEYS,
  frontierGamepadState,
  frontierMovementSpeed,
  frontierMovementVector
} from '../../apps/web/src/modules/frontier/controls';

describe('ATLAS FRONTIER controls', () => {
  it('defines an original keyboard control set for the playable loop', () => {
    const ids = new Set(FRONTIER_CONTROLS.map((control) => control.id));
    for (const id of [
      'move_forward',
      'sprint',
      'extract',
      'craft_power_core',
      'build_mode',
      'restore_sky_grid',
      'inventory',
      'controls',
      'cancel'
    ]) {
      expect(ids.has(id as any)).toBe(true);
    }
  });

  it('normalizes keyboard movement', () => {
    expect(frontierMovementVector(new Set(['w', 'd']))).toEqual({ horizontal: 1, vertical: -1 });
    expect(frontierMovementVector(new Set(['arrowleft', 'arrowdown']))).toEqual({ horizontal: -1, vertical: 1 });
    expect(FRONTIER_MOVEMENT_KEYS.has('w')).toBe(true);
  });

  it('maps a standard gamepad without bypassing the governed action layer', () => {
    const buttons = Array.from({ length: 12 }, () => ({ pressed: false, value: 0 }));
    buttons[0] = { pressed: true, value: 1 };
    buttons[2] = { pressed: true, value: 1 };
    buttons[10] = { pressed: true, value: 1 };

    expect(frontierGamepadState({ axes: [0.6, -0.7], buttons })).toEqual({
      horizontal: 0.6,
      vertical: -0.7,
      sprint: true,
      extract: true,
      craftPowerCore: true,
      buildMode: false,
      restoreSkyGrid: false
    });
    expect(frontierGamepadState({ axes: [0.05, -0.05], buttons: [] }).horizontal).toBe(0);
  });

  it('only increases movement speed while sprint is held', () => {
    expect(frontierMovementSpeed(new Set())).toBe(4.2);
    expect(frontierMovementSpeed(new Set(['shift']))).toBe(6.8);
  });
});
