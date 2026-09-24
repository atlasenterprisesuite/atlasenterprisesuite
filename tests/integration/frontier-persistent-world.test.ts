import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  `${process.cwd()}/supabase/migrations/20260919232000_frontier_persistent_world.sql`,
  'utf8'
);
const hardening = readFileSync(
  `${process.cwd()}/supabase/migrations/20260919232800_frontier_persistent_world_hardening.sql`,
  'utf8'
);

describe('ATLAS FRONTIER persistent spatial world migration', () => {
  it('creates durable tenant-scoped structures with read-only browser access', () => {
    expect(migration).toContain('create table if not exists public.frontier_structures');
    expect(migration).toContain('frontier_structures_scope_check');
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('revoke all on public.frontier_structures from anon, authenticated');
    expect(migration).toContain('grant select on public.frontier_structures to authenticated');
    expect(migration).toContain("public.has_identity_permission(org_id, 'frontier.play')");
  });

  it('commits spatial builds through a server-authoritative idempotent RPC', () => {
    expect(migration).toContain('create or replace function public.frontier_build_structure');
    expect(migration).toContain('security definer');
    expect(migration).toContain('frontier_structures_idempotency_unique');
    expect(migration).toContain('frontier_idempotency_conflict');
    expect(migration).toContain('for update');
    expect(migration).toContain('world_delta');
    expect(migration).toContain("'build_habitat'");
  });

  it('validates world bounds, collisions and protected resource nodes', () => {
    expect(migration).toContain('frontier_structure_out_of_bounds');
    expect(migration).toContain('frontier_structure_collision');
    expect(migration).toContain('frontier_structure_blocks_resource_node');
    expect(migration).toContain('position_x between -6.5 and 6.5');
    expect(migration).toContain('position_z between -6.5 and 6.5');
  });

  it('backfills old habitats and catches legacy client builds transactionally', () => {
    expect(migration).toContain("'legacy_backfill'");
    expect(migration).toContain("'legacy_default'");
    expect(migration).toContain('frontier_runs_persist_legacy_habitat_position');
    expect(migration).toContain("current_setting('atlas.frontier_spatial_build', true)");
    expect(migration).toContain("set_config('atlas.frontier_spatial_build', '1', true)");
  });

  it('hardens trigger execution and Frontier access paths', () => {
    expect(hardening).toContain('revoke all on function public.frontier_persist_legacy_habitat_position()');
    expect(hardening).toContain('from public, anon, authenticated');
    expect(hardening).toContain('frontier_structures_run_idx');
    expect(hardening).toContain('frontier_events_run_idx');
    expect(hardening).toContain('actor_user_id = (select auth.uid())');
  });
});
