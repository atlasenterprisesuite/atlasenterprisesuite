import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  `${process.cwd()}/supabase/migrations/20260920024000_frontier_living_worlds.sql`,
  'utf8'
);

describe('ATLAS FRONTIER Living Worlds persistence', () => {
  it('extends campaign progression without weakening the existing stage constraint', () => {
    expect(migration).toContain('campaign_stage between 1 and 6');
    expect(migration).toContain('frontier_campaign_gate_living_worlds');
  });

  it('persists ecology state and append-only ecology events under RLS', () => {
    expect(migration).toContain('create table if not exists public.frontier_ecology');
    expect(migration).toContain('create table if not exists public.frontier_ecology_events');
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('frontier_ecology_events_idempotency_unique');
    expect(migration).toContain("public.has_identity_permission(org_id, 'frontier.play')");
  });

  it('keeps Living Worlds writes behind the server-authoritative controller', () => {
    expect(migration).toContain('create or replace function public.frontier_apply_ecology_action');
    expect(migration).toContain('security definer');
    expect(migration).toContain('for update');
    expect(migration).toContain('frontier_unknown_ecology_action');
    expect(migration).toContain('grant execute on function public.frontier_apply_ecology_action');
    expect(migration).not.toContain('grant insert, update on public.frontier_ecology to authenticated');
  });

  it('audits both frontier and ecology before/after state', () => {
    expect(migration).toContain("jsonb_build_object('state', v_before_frontier, 'ecology', v_before_ecology)");
    expect(migration).toContain("jsonb_build_object('state', v_after_frontier, 'ecology', v_after_ecology)");
    expect(migration).toContain('previous_run_revision');
    expect(migration).toContain('resulting_ecology_revision');
  });

  it('implements the first living-world gameplay loop', () => {
    for (const action of ['collect_seed_pods', 'cultivate_plot', 'generate_eco_energy', 'restore_biome']) {
      expect(migration).toContain(action);
    }
    expect(migration).toContain('ecosystem_stability');
    expect(migration).toContain('restored_biomes');
    expect(migration).toContain('v_run.campaign_stage := 6');
  });
});
