import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  `${process.cwd()}/supabase/migrations/20260920041000_frontier_survival_events.sql`,
  'utf8'
);

describe('ATLAS FRONTIER survival persistence', () => {
  it('persists survival state and append-only hazard events under RLS', () => {
    expect(migration).toContain('create table if not exists public.frontier_survival');
    expect(migration).toContain('create table if not exists public.frontier_survival_events');
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('frontier_survival_events_idempotency_unique');
  });

  it('keeps survival writes behind a server-authoritative controller', () => {
    expect(migration).toContain('create or replace function public.frontier_apply_survival_action');
    expect(migration).toContain('security definer');
    expect(migration).toContain('for update');
    expect(migration).toContain("public.has_identity_permission(p_org_id, 'frontier.play')");
    expect(migration).not.toContain('grant insert, update on public.frontier_survival to authenticated');
  });

  it('selects environmental hazards on the server from audited state', () => {
    expect(migration).toContain('v_selector := mod(v_run.action_count + v_survival.revision, 3)');
    expect(migration).toContain("'ion_storm'");
    expect(migration).toContain("'thermal_front'");
    expect(migration).toContain("'anomaly'");
  });

  it('implements damage, exposure and habitat recovery', () => {
    expect(migration).toContain('v_damage :=');
    expect(migration).toContain('v_exposure_gain :=');
    expect(migration).toContain('v_survival.health := greatest(0');
    expect(migration).toContain('v_survival.exposure := least(100');
    expect(migration).toContain('frontier_habitat_required_recovery');
  });

  it('audits both run and survival before/after snapshots', () => {
    expect(migration).toContain("jsonb_build_object('state',v_before_run,'survival',v_before_survival)");
    expect(migration).toContain("jsonb_build_object('state',v_after_run,'survival',v_after_survival)");
    expect(migration).toContain('previous_survival_revision');
    expect(migration).toContain('resulting_survival_revision');
  });
});
