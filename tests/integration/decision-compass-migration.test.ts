import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('supabase/migrations/20260908_decision_compass.sql', 'utf8');

describe('Decision Compass Supabase governance contract', () => {
  it('enables RLS and isolates all rows by active organization membership', () => {
    expect(source).toContain('alter table public.decision_compass_records enable row level security');
    expect(source).toContain('alter table public.decision_compass_evidence_refs enable row level security');
    expect(source).toContain('alter table public.decision_compass_audit enable row level security');
    expect(source.match(/public\.is_org_member\(org_id\)/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
  });

  it('does not expose Decision Compass tables to anon and keeps audit immutable to clients', () => {
    expect(source).toContain('revoke all on public.decision_compass_records from anon');
    expect(source).toContain('revoke all on public.decision_compass_evidence_refs from anon');
    expect(source).toContain('revoke all on public.decision_compass_audit from anon');
    expect(source).toContain('grant select on public.decision_compass_audit to authenticated');
    expect(source).not.toContain('grant update on public.decision_compass_audit');
    expect(source).not.toContain('grant delete on public.decision_compass_audit');
    expect(source).not.toContain('grant insert on public.decision_compass_audit to authenticated');
  });

  it('forces new client-created records to start as reflection', () => {
    expect(source).toContain("truth_state = 'reflection'");
    expect(source).toContain('created_by = auth.uid()');
  });

  it('enforces transitions server-side and forbids direct reflection to verified', () => {
    expect(source).toContain('create or replace function public.decision_compass_transition');
    expect(source).toContain("when 'reflection' then p_next_state in ('needs_evidence', 'blocked', 'rejected', 'superseded')");
    expect(source).toContain("raise exception 'invalid_truth_state_transition'");
  });

  it('requires evidence and every verification gate before verified', () => {
    expect(source).toContain("if p_next_state = 'verified' then");
    expect(source).toContain("raise exception 'verification_requires_independent_evidence'");
    expect(source).toContain("raise exception 'verification_gate_incomplete'");
    expect(source).toContain("coalesce((gate->>'passed')::boolean, false) is not true");
  });

  it('writes immutable audit evidence for every accepted transition', () => {
    expect(source).toContain('insert into public.decision_compass_audit');
    expect(source).toContain('previous_state');
    expect(source).toContain('next_state');
    expect(source).toContain('actor_id');
    expect(source).toContain('reason');
  });
});
