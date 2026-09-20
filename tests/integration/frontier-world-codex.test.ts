import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  `${process.cwd()}/supabase/migrations/20260920044500_frontier_world_codex.sql`,
  'utf8'
);

describe('ATLAS FRONTIER governed Codex persistence', () => {
  it('persists canonical entries and per-player discoveries', () => {
    expect(migration).toContain('create table if not exists public.frontier_codex_entries');
    expect(migration).toContain('create table if not exists public.frontier_codex_discoveries');
    expect(migration).toContain('frontier_codex_discoveries_unique');
  });

  it('keeps discovery writes behind a campaign-stage checked RPC', () => {
    expect(migration).toContain('create or replace function public.frontier_discover_codex_entry');
    expect(migration).toContain('security definer');
    expect(migration).toContain('v_entry.required_stage > v_run.campaign_stage');
    expect(migration).toContain('frontier_codex_entry_locked');
    expect(migration).not.toContain('grant insert on public.frontier_codex_discoveries to authenticated');
  });

  it('seeds every required world-content category', () => {
    for (const category of ['origin','planet','biome','faction','species','creature','anomaly','vehicle','technology']) {
      expect(migration).toContain(`'${category}'`);
    }
  });

  it('keeps codex data read-only to authenticated clients', () => {
    expect(migration).toContain('grant select on public.frontier_codex_entries to authenticated');
    expect(migration).toContain('grant select on public.frontier_codex_discoveries to authenticated');
    expect(migration).toContain('revoke all on public.frontier_codex_entries from anon, authenticated');
  });
});
