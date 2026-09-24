import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  `${process.cwd()}/supabase/migrations/20260920080500_frontier_biome_canon_alignment.sql`,
  'utf8'
);

describe('ATLAS FRONTIER Creative Bible biome alignment', () => {
  it('seeds all six canonical biome families without replacing durable IDs', () => {
    for (const title of [
      'Luminous Forest',
      'Crystalline Desert',
      'Ionic Tundra',
      'Biofiber Ocean',
      'Floating Mountains',
      'Abandoned Technological City'
    ]) {
      expect(migration).toContain(`'${title}'`);
    }

    expect(migration).toContain("on conflict (id) do update");
    expect(migration).not.toContain('delete from public.frontier_codex_entries');
  });
});
