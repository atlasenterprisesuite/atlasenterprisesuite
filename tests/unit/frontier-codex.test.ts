import { describe, expect, it } from 'vitest';
import {
  FRONTIER_CODEX,
  FRONTIER_CODEX_CATEGORIES,
  FRONTIER_ORIGIN,
  codexCompletion,
  codexEntriesForStage
} from '../../apps/web/src/modules/frontier/codex';

describe('ATLAS FRONTIER Codex', () => {
  it('defines the world origin and every required content family', () => {
    expect(FRONTIER_ORIGIN.title).toContain('Fracture');
    expect(FRONTIER_CODEX.length).toBeGreaterThanOrEqual(40);
    for (const category of ['origin','planet','biome','faction','species','creature','anomaly','vehicle','technology']) {
      expect(FRONTIER_CODEX_CATEGORIES).toContain(category);
      expect(FRONTIER_CODEX.some((entry) => entry.category === category)).toBe(true);
    }
  });

  it('matches the six canonical Creative Bible biome families', () => {
    const biomes = FRONTIER_CODEX
      .filter((entry) => entry.category === 'biome')
      .map((entry) => entry.title);

    expect(biomes).toEqual(expect.arrayContaining([
      'Luminous Forest',
      'Crystalline Desert',
      'Ionic Tundra',
      'Biofiber Ocean',
      'Floating Mountains',
      'Abandoned Technological City'
    ]));
    expect(biomes).toHaveLength(6);
  });

  it('never exposes stage-locked records through stage filtering', () => {
    expect(codexEntriesForStage(1).every((entry) => entry.requiredStage <= 1)).toBe(true);
    expect(codexEntriesForStage(10)).toHaveLength(FRONTIER_CODEX.length);
  });

  it('calculates discovery completion only over currently available entries', () => {
    const stageOne = codexEntriesForStage(1);
    expect(stageOne.length).toBeGreaterThan(0);
    expect(codexCompletion(1, new Set())).toBe(0);
    expect(codexCompletion(1, new Set(stageOne.map((entry) => entry.id)))).toBe(100);
  });

  it('keeps ids unique for durable discovery keys', () => {
    const ids = FRONTIER_CODEX.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
