import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  `${process.cwd()}/supabase/migrations/20260920083000_frontier_physical_biomes.sql`,
  'utf8'
);

describe('ATLAS FRONTIER governed physical biome persistence', () => {
  it('persists player presence and append-only transition evidence', () => {
    expect(migration).toContain('create table if not exists public.frontier_world_presence');
    expect(migration).toContain('create table if not exists public.frontier_world_presence_events');
    expect(migration).toContain('frontier_world_presence_events_idempotency_unique');
  });

  it('keeps browser writes behind the biome controller', () => {
    expect(migration).toContain('create or replace function public.frontier_transition_biome');
    expect(migration).toContain('security definer');
    expect(migration).toContain("public.has_identity_permission(p_org_id, 'frontier.play')");
    expect(migration).toContain('frontier_biome_position_mismatch');
    expect(migration).toContain('frontier_biome_locked');
    expect(migration).not.toContain('grant insert on public.frontier_world_presence to authenticated');
    expect(migration).not.toContain('grant update on public.frontier_world_presence to authenticated');
  });

  it('atomically records biome discovery during a valid transition', () => {
    expect(migration).toContain('insert into public.frontier_codex_discoveries');
    expect(migration).toContain('on conflict (org_id, actor_user_id, entry_id) do nothing');
    expect(migration).toContain('insert into public.frontier_world_presence_events');
  });

  it('enforces campaign biome gates on persistent structures too', () => {
    expect(migration).toContain('frontier_validate_structure_biome_gate');
    expect(migration).toContain('frontier_structures_biome_gate');
    expect(migration).toContain('frontier_structure_biome_locked');
  });

  it('uses the same canonical six biome entry ids as the web world', () => {
    for (const entryId of [
      'biome-luminous-grove',
      'biome-aether-fields',
      'biome-tidal-reefs',
      'biome-thermal-rifts',
      'biome-cloud-steppe',
      'biome-abandoned-city'
    ]) {
      expect(migration).toContain(`'${entryId}'`);
    }
  });
});
