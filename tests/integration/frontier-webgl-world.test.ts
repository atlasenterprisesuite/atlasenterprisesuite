import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const world = readFileSync(`${process.cwd()}/apps/web/src/modules/frontier/FrontierWorld3D.tsx`, 'utf8');
const route = readFileSync(`${process.cwd()}/apps/web/src/modules/frontier/FrontierRoutes.tsx`, 'utf8');
const api = readFileSync(`${process.cwd()}/apps/web/src/modules/frontier/api.ts`, 'utf8');

describe('ATLAS FRONTIER WebGL world contract', () => {
  it('uses a real WebGL2 rendering context with a fail-safe fallback', () => {
    expect(world).toContain("getContext('webgl2'");
    expect(world).toContain("setEngineStatus('fallback')");
    expect(world).toContain('requestAnimationFrame');
  });

  it('supports canonical keyboard, touch movement and hold-to-extract interaction', () => {
    expect(world).toContain('FRONTIER_MOVEMENT_KEYS');
    expect(world).toContain('frontierMovementVector');
    expect(world).toContain('frontierMovementSpeed');
    expect(world).toContain('frontier-mobile-controls');
    expect(world).toContain('beginExtraction');
    expect(world).toContain('900');
  });

  it('closes production 3D contracts for terrain, raycast, collision, physical progression and gamepad', () => {
    expect(world).toContain('frontierTerrainHeight');
    expect(world).toContain('resolveCollisionSafeMove');
    expect(world).toContain('raycastResourceTarget');
    expect(world).toContain('frontierGamepadState');
    expect(world).toContain('state.powerCores > 0');
    expect(world).toContain('activeGridNodes');
    expect(world).toContain('FRONTIER_RENDER_DPR_LIMIT');
    expect(world).toContain('FRONTIER_FRAME_DELTA_LIMIT_SECONDS');
    expect(world).toContain('Keyboard + Pointer + Gamepad');
  });

  it('keeps resource, spatial build and biome mutations behind governed callbacks', () => {
    expect(world).toContain('await onBuildHabitat(spatialPlacement)');
    expect(world).toContain('await onAction(target.action)');
    expect(world).toContain('biomeTransitionRef.current(targetBiome, movement.point)');
    expect(world).not.toContain('/rest/v1/');
    expect(api).toContain("'/rest/v1/rpc/frontier_apply_action'");
    expect(api).toContain("'/rest/v1/rpc/frontier_build_structure'");
    expect(api).toContain("'/rest/v1/rpc/frontier_transition_biome'");
  });

  it('replaces the CSS-only world with the interactive renderer', () => {
    expect(route).toContain('<FrontierWorld3D');
    expect(route).not.toContain('<div className="frontier-world"');
    expect(route).toContain("action.id === 'build_habitat'");
    expect(route).toContain('structures={structures}');
    expect(route).toContain('initialPosition={worldPresence.position}');
    expect(world).toContain('structures.forEach');
    expect(world).toContain('FRONTIER_BIOME_REGIONS.forEach');
    expect(world).toContain('frontier-biome-card');
  });
});
