import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  `${process.cwd()}/supabase/migrations/20260920033000_frontier_campaign_6_10.sql`,
  'utf8'
);

describe('ATLAS FRONTIER phases 6-10 persistence', () => {
  it('extends governed campaign stages through ten', () => {
    expect(migration).toContain('campaign_stage between 1 and 10');
    for (const stage of [6, 7, 8, 9, 10]) {
      expect(migration).toContain(`then ${stage}`);
    }
  });

  it('persists advanced campaign state and append-only events under RLS', () => {
    expect(migration).toContain('create table if not exists public.frontier_expansion');
    expect(migration).toContain('create table if not exists public.frontier_expansion_events');
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('frontier_expansion_events_idempotency_unique');
    expect(migration).toContain("public.has_identity_permission(org_id, 'frontier.play')");
  });

  it('keeps phases 6-10 writes behind one exact-stage server controller', () => {
    expect(migration).toContain('create or replace function public.frontier_apply_expansion_action');
    expect(migration).toContain('security definer');
    expect(migration).toContain('v_run.campaign_stage <> v_required_stage');
    expect(migration).toContain('frontier_expansion_stage_mismatch');
    expect(migration).toContain('for update');
    expect(migration).not.toContain('grant insert, update on public.frontier_expansion to authenticated');
  });

  it('contains every advanced campaign action', () => {
    for (const action of [
      'capture_storm_charge',
      'reinforce_storm_shelter',
      'master_ion_storm',
      'found_settlement',
      'connect_settlements',
      'establish_civilization',
      'fabricate_orbital_frame',
      'launch_orbital_station',
      'open_orbital_horizon',
      'establish_network_link',
      'run_trade_route',
      'activate_frontier_network',
      'synthesize_world_seed',
      'generate_frontier_world',
      'restore_generated_world'
    ]) {
      expect(migration).toContain(action);
    }
  });

  it('audits run and expansion before/after state and preserves endless cycles', () => {
    expect(migration).toContain("jsonb_build_object('state', v_before_run, 'expansion', v_before_expansion)");
    expect(migration).toContain("jsonb_build_object('state', v_after_run, 'expansion', v_after_expansion)");
    expect(migration).toContain('v_expansion.endless_cycles := v_expansion.endless_cycles + 1');
    expect(migration).toContain('v_expansion.campaign_complete := true');
  });
});
