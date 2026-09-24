import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  `${process.cwd()}/supabase/migrations/20260919213000_atlas_frontier_vertical_slice.sql`,
  'utf8'
);

describe('ATLAS FRONTIER persistence contract', () => {
  it('uses organization-scoped RLS and identity permissions', () => {
    expect(migration).toContain("frontier.play");
    expect(migration).toContain('enable row level security');
    expect(migration).toContain("public.has_identity_permission(p_org_id, 'frontier.play')");
    expect(migration).toContain('actor_user_id = auth.uid()');
  });

  it('keeps gameplay writes behind the server Flow Controller', () => {
    expect(migration).toContain('create or replace function public.frontier_apply_action');
    expect(migration).toContain('security definer');
    expect(migration).toContain('for update');
    expect(migration).toContain('frontier_events_idempotency_unique');
    expect(migration).toContain('grant execute on function public.frontier_apply_action');
    expect(migration).not.toContain('grant insert, update on public.frontier_runs to authenticated');
  });
});
