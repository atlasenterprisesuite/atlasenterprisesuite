import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('supabase/migrations/20260908_decision_compass.sql', 'utf8');

describe('Decision Compass Supabase governance contract', () => {
  it('enables RLS and isolates governed data by organization', () => {
    expect(source).toContain('alter table public.decision_compass_records enable row level security');
    expect(source).toContain('alter table public.decision_compass_evidence_refs enable row level security');
    expect(source).toContain('alter table public.decision_compass_audit enable row level security');
    expect(source).toContain('alter table public.decision_compass_permissions enable row level security');
    expect(source).toContain('public.is_org_member(p_org_id)');
  });

  it('implements domain-specific permissions with owner/admin override', () => {
    expect(source).toContain('create table if not exists public.decision_compass_permissions');
    expect(source).toContain("permission in ('decision.read', 'decision.create', 'decision.review', 'decision.verify', 'decision.admin')");
    expect(source).toContain('create or replace function public.decision_compass_has_permission');
    expect(source).toContain("m.role = 'owner'");
    expect(source).toContain("p.permission = 'decision.admin'");
    expect(source).toContain('p.permission = p_permission');
    expect(source).toContain("public.decision_compass_has_permission(org_id, 'decision.read')");
    expect(source).toContain("public.decision_compass_has_permission(org_id, 'decision.create')");
    expect(source).toContain("public.decision_compass_has_permission(org_id, 'decision.review')");
    expect(source).toContain("public.decision_compass_has_permission(current_record.org_id, required_permission)");
  });

  it('does not expose Decision Compass tables to anon and keeps audit immutable to clients', () => {
    expect(source).toContain('revoke all on public.decision_compass_records from anon');
    expect(source).toContain('revoke all on public.decision_compass_evidence_refs from anon');
    expect(source).toContain('revoke all on public.decision_compass_audit from anon');
    expect(source).toContain('revoke all on public.decision_compass_permissions from anon');
    expect(source).toContain('grant select on public.decision_compass_audit to authenticated');
    expect(source).not.toContain('grant update on public.decision_compass_audit');
    expect(source).not.toContain('grant delete on public.decision_compass_audit');
    expect(source).not.toContain('grant insert on public.decision_compass_audit to authenticated');
  });

  it('forces new client-created records to start as reflection with unpassed verification gates', () => {
    expect(source).toContain("truth_state = 'reflection'");
    expect(source).toContain('created_by = auth.uid()');
    expect(source).toContain("not exists (select 1 from jsonb_array_elements(verification_gate) gate where coalesce((gate->>'passed')::boolean, false) is true)");
  });

  it('prevents review-level evidence inserts from claiming verification timestamps', () => {
    expect(source).toContain("public.decision_compass_has_permission(org_id, 'decision.review')");
    expect(source).toContain('and verified_at is null');
  });

  it('enforces transitions server-side and forbids direct reflection to verified', () => {
    expect(source).toContain('create or replace function public.decision_compass_transition');
    expect(source).toContain("when 'reflection' then p_next_state in ('needs_evidence', 'blocked', 'rejected', 'superseded')");
    expect(source).toContain("raise exception 'invalid_truth_state_transition'");
  });

  it('requires evidence before evidence_found or action_proposed', () => {
    expect(source).toContain("if p_next_state in ('evidence_found', 'action_proposed') and evidence_count < 1 then");
    expect(source).toContain("raise exception 'evidence_required_for_truth_state'");
    expect(source).toContain("raise exception 'proposed_action_required'");
  });

  it('requires verify permission for verification and for superseding a verified record', () => {
    expect(source).toContain("required_permission := case when p_next_state = 'verified' or current_record.truth_state = 'verified' then 'decision.verify' else 'decision.review' end");
    expect(source).toContain("if p_next_state = 'verified' then");
    expect(source).toContain("raise exception 'verification_requires_independent_evidence'");
    expect(source).toContain("raise exception 'verification_gate_incomplete'");
    expect(source).toContain("coalesce((gate->>'passed')::boolean, false) is not true");
  });

  it('updates verification gates only through a governed verify-permission RPC with evidence present', () => {
    expect(source).toContain('create or replace function public.decision_compass_set_gate');
    expect(source).toContain("public.decision_compass_has_permission(current_record.org_id, 'decision.verify')");
    expect(source).toContain("raise exception 'verification_gate_requires_evidence'");
    expect(source).toContain("raise exception 'verification_gate_not_found'");
    expect(source).toContain("jsonb_set(gate, '{passed}', to_jsonb(p_passed), true)");
  });

  it('writes immutable audit evidence for every accepted transition and gate update', () => {
    expect(source).toContain('insert into public.decision_compass_audit');
    expect(source).toContain('previous_state');
    expect(source).toContain('next_state');
    expect(source).toContain('actor_id');
    expect(source).toContain('reason');
    expect(source).toContain('verification_gate_update');
  });
});