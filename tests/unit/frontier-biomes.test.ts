import { describe, expect, it } from 'vitest';
import {
  FRONTIER_BIOME_REGIONS,
  INITIAL_FRONTIER_WORLD_PRESENCE,
  frontierBiomeAt,
  frontierBiomeForEntry,
  resolveFrontierBiomeMovement
} from '../../apps/web/src/modules/frontier/biomes';
import { FRONTIER_RESOURCE_TARGETS } from '../../apps/web/src/modules/frontier/world3d';

describe('ATLAS FRONTIER physical biomes', () => {
  it('maps the playable world into all six canonical biome regions', () => {
    expect(frontierBiomeAt({ x: 0, z: 0 }).label).toBe('Luminous Forest');
    expect(frontierBiomeAt({ x: -6, z: 0 }).label).toBe('Crystalline Desert');
    expect(frontierBiomeAt({ x: 0, z: 6.5 }).label).toBe('Biofiber Ocean');
    expect(frontierBiomeAt({ x: 0, z: -6.5 }).label).toBe('Ionic Tundra');
    expect(frontierBiomeAt({ x: 6, z: -3 }).label).toBe('Floating Mountains');
    expect(frontierBiomeAt({ x: 6, z: 3 }).label).toBe('Abandoned Technological City');
    expect(FRONTIER_BIOME_REGIONS).toHaveLength(6);
  });

  it('keeps the initial core resource loop inside the phase-one biome', () => {
    for (const target of FRONTIER_RESOURCE_TARGETS) {
      expect(frontierBiomeAt(target).requiredStage).toBe(1);
    }
    expect(frontierBiomeAt(INITIAL_FRONTIER_WORLD_PRESENCE.position).requiredStage).toBe(1);
  });

  it('blocks traversal into a biome before its campaign phase', () => {
    const current = { x: -3.9, z: 0 };
    const result = resolveFrontierBiomeMovement(current, { x: -4.2, z: 0 }, 1);
    expect(result.point).toEqual(current);
    expect(result.blockedBiome?.label).toBe('Crystalline Desert');
    expect(result.changedBiome).toBe(false);
  });

  it('allows an unlocked transition and resolves the durable Codex entry', () => {
    const result = resolveFrontierBiomeMovement({ x: -3.9, z: 0 }, { x: -4.2, z: 0 }, 3);
    expect(result.changedBiome).toBe(true);
    expect(result.biome.entryId).toBe('biome-aether-fields');
    expect(frontierBiomeForEntry(result.biome.entryId)?.label).toBe('Crystalline Desert');
  });
});
