import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const world = readFileSync(
  `${process.cwd()}/apps/web/src/modules/frontier/FrontierWorld3D.tsx`,
  'utf8'
);
const controls = readFileSync(
  `${process.cwd()}/apps/web/src/modules/frontier/controls.ts`,
  'utf8'
);

describe('ATLAS FRONTIER native controls UI', () => {
  it('uses the canonical controls module inside the WebGL world', () => {
    expect(world).toContain("from './controls'");
    expect(world).toContain('FRONTIER_MOVEMENT_KEYS');
    expect(world).toContain('frontierMovementSpeed');
    expect(world).toContain('frontierMovementVector');
  });

  it('supports sprint and keyboard gameplay shortcuts without direct REST writes', () => {
    expect(world).toContain("key === 'shift'");
    expect(world).toContain("onAction('craft_power_core')");
    expect(world).toContain("onAction('restore_sky_grid')");
    expect(world).toContain("key === 'b'");
    expect(world).toContain("key === 'e'");
    expect(world).not.toContain('/rest/v1/');
  });

  it('surfaces inventory and a readable control matrix in the HUD', () => {
    expect(world).toContain('FIELD INVENTORY');
    expect(world).toContain('CONTROL MATRIX');
    expect(world).toContain('FRONTIER_CONTROLS.map');
    expect(world).toContain('<kbd key={key}>{key}</kbd>');
    expect(controls).toContain("label: 'Sprint'");
    expect(controls).toContain("label: 'Craft Power Core'");
    expect(controls).toContain("label: 'Restore Sky Grid'");
  });

  it('keeps unsupported mechanics out of the control contract', () => {
    expect(controls).not.toContain("label: 'Jump'");
    expect(controls).not.toContain("label: 'Attack'");
  });
});
