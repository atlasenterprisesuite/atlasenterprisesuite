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

export const FRONTIER_CONTROLS: readonly FrontierControl[] = [
  { id: 'move_forward', label: 'Move forward', keys: ['W', '↑'], group: 'Movement' },
  { id: 'move_backward', label: 'Move backward', keys: ['S', '↓'], group: 'Movement' },
  { id: 'move_left', label: 'Move left', keys: ['A', '←'], group: 'Movement' },
  { id: 'move_right', label: 'Move right', keys: ['D', '→'], group: 'Movement' },
  { id: 'sprint', label: 'Sprint', keys: ['Shift'], group: 'Movement' },
  { id: 'extract', label: 'Hold to extract', keys: ['E'], group: 'Interaction' },
  { id: 'craft_power_core', label: 'Craft Power Core', keys: ['C'], group: 'Interaction' },
  { id: 'restore_sky_grid', label: 'Restore Sky Grid', keys: ['G'], group: 'Interaction' },
  { id: 'build_mode', label: 'Toggle build mode', keys: ['B'], group: 'Build' },
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
