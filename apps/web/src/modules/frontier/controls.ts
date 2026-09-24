export type FrontierControlId =
  | 'move_forward'
  | 'move_backward'
  | 'move_left'
  | 'move_right'
  | 'sprint'
  | 'extract'
  | 'craft_power_core'
  | 'build_mode'
  | 'rotate_left'
  | 'rotate_right'
  | 'restore_sky_grid'
  | 'inventory'
  | 'controls'
  | 'cancel';

export type FrontierControl = {
  id: FrontierControlId;
  label: string;
  keys: readonly string[];
  group: 'Movement' | 'Interaction' | 'Build' | 'Interface';
};

export type FrontierGamepadLike = {
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value?: number }[];
};

export type FrontierGamepadState = {
  horizontal: number;
  vertical: number;
  sprint: boolean;
  extract: boolean;
  craftPowerCore: boolean;
  buildMode: boolean;
  restoreSkyGrid: boolean;
};

export const FRONTIER_GAMEPAD_DEADZONE = 0.18;

export const FRONTIER_CONTROLS: readonly FrontierControl[] = [
  { id: 'move_forward', label: 'Move forward', keys: ['W', '↑', 'Left Stick ↑'], group: 'Movement' },
  { id: 'move_backward', label: 'Move backward', keys: ['S', '↓', 'Left Stick ↓'], group: 'Movement' },
  { id: 'move_left', label: 'Move left', keys: ['A', '←', 'Left Stick ←'], group: 'Movement' },
  { id: 'move_right', label: 'Move right', keys: ['D', '→', 'Left Stick →'], group: 'Movement' },
  { id: 'sprint', label: 'Sprint', keys: ['Shift', 'L3'], group: 'Movement' },
  { id: 'extract', label: 'Hold to extract', keys: ['E', 'A'], group: 'Interaction' },
  { id: 'craft_power_core', label: 'Craft Power Core', keys: ['C', 'X'], group: 'Interaction' },
  { id: 'restore_sky_grid', label: 'Restore Sky Grid', keys: ['G', 'Y'], group: 'Interaction' },
  { id: 'build_mode', label: 'Toggle build mode', keys: ['B', 'B'], group: 'Build' },
  { id: 'rotate_left', label: 'Rotate blueprint left', keys: ['Q'], group: 'Build' },
  { id: 'rotate_right', label: 'Rotate blueprint right', keys: ['R'], group: 'Build' },
  { id: 'inventory', label: 'Inventory', keys: ['I'], group: 'Interface' },
  { id: 'controls', label: 'Controls', keys: ['H'], group: 'Interface' },
  { id: 'cancel', label: 'Close / cancel', keys: ['Esc'], group: 'Interface' }
] as const;

export const FRONTIER_MOVEMENT_KEYS = new Set([
  'w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'
]);

export function frontierMovementVector(keys: ReadonlySet<string>) {
  const horizontal =
    Number(keys.has('d') || keys.has('arrowright')) -
    Number(keys.has('a') || keys.has('arrowleft'));
  const vertical =
    Number(keys.has('s') || keys.has('arrowdown')) -
    Number(keys.has('w') || keys.has('arrowup'));
  return { horizontal, vertical };
}

export function frontierMovementSpeed(keys: ReadonlySet<string>) {
  return keys.has('shift') ? 6.8 : 4.2;
}

export function frontierGamepadState(
  gamepad: FrontierGamepadLike | null | undefined,
  deadzone = FRONTIER_GAMEPAD_DEADZONE
): FrontierGamepadState {
  if (!gamepad) {
    return {
      horizontal: 0,
      vertical: 0,
      sprint: false,
      extract: false,
      craftPowerCore: false,
      buildMode: false,
      restoreSkyGrid: false
    };
  }

  const normalizeAxis = (value: number | undefined) => {
    const next = Number.isFinite(value) ? Number(value) : 0;
    if (Math.abs(next) < deadzone) return 0;
    return Math.max(-1, Math.min(1, next));
  };

  const pressed = (index: number) => Boolean(gamepad.buttons[index]?.pressed || Number(gamepad.buttons[index]?.value || 0) > 0.55);

  return {
    horizontal: normalizeAxis(gamepad.axes[0]),
    vertical: normalizeAxis(gamepad.axes[1]),
    sprint: pressed(10),
    extract: pressed(0),
    buildMode: pressed(1),
    craftPowerCore: pressed(2),
    restoreSkyGrid: pressed(3)
  };
}
