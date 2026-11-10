-- ATLAS People/Payroll least-privilege hardening.
-- Supabase default grants can leave anon/authenticated with table-level privileges
-- beyond the intended client boundary. People/Payroll remains read-only from the
-- client; mutations stay behind governed RPCs and RBAC.
-- This migration is intentionally declarative/idempotent so a fresh ready-for-review
-- PR run can verify the same production security boundary without changing behavior.

-- Anonymous clients receive no direct People/Payroll table privileges.
revoke all privileges on table public.people_workers from anon;
revoke all privileges on table public.people_time_entries from anon;
revoke all privileges on table public.people_requisitions from anon;
revoke all privileges on table public.people_candidates from anon;
revoke all privileges on table public.people_applications from anon;
revoke all privileges on table public.people_compensation from anon;
revoke all privileges on table public.people_deductions from anon;
revoke all privileges on table public.payroll_schedules from anon;
revoke all privileges on table public.payroll_runs from anon;
revoke all privileges on table public.payroll_run_lines from anon;
revoke all privileges on table public.payroll_rule_packs from anon;
revoke all privileges on table public.payroll_provider_connections from anon;
revoke all privileges on table public.payroll_execution_intents from anon;
revoke all privileges on table public.payroll_execution_evidence from anon;

-- Authenticated clients must never obtain table-level destructive/DDL-style rights.
revoke truncate, references, trigger on table public.people_workers from authenticated;
revoke truncate, references, trigger on table public.people_time_entries from authenticated;
revoke truncate, references, trigger on table public.people_requisitions from authenticated;
revoke truncate, references, trigger on table public.people_candidates from authenticated;
revoke truncate, references, trigger on table public.people_applications from authenticated;
revoke truncate, references, trigger on table public.people_compensation from authenticated;
revoke truncate, references, trigger on table public.people_deductions from authenticated;
revoke truncate, references, trigger on table public.payroll_schedules from authenticated;
revoke truncate, references, trigger on table public.payroll_runs from authenticated;
revoke truncate, references, trigger on table public.payroll_run_lines from authenticated;
revoke truncate, references, trigger on table public.payroll_rule_packs from authenticated;
revoke truncate, references, trigger on table public.payroll_provider_connections from authenticated;
revoke truncate, references, trigger on table public.payroll_execution_intents from authenticated;
revoke truncate, references, trigger on table public.payroll_execution_evidence from authenticated;

-- Reassert the intended authenticated read surface. RLS remains authoritative.
grant select on table public.people_workers to authenticated;
grant select on table public.people_time_entries to authenticated;
grant select on table public.people_requisitions to authenticated;
grant select on table public.people_candidates to authenticated;
grant select on table public.people_applications to authenticated;
grant select on table public.people_compensation to authenticated;
grant select on table public.people_deductions to authenticated;
grant select on table public.payroll_schedules to authenticated;
grant select on table public.payroll_runs to authenticated;
grant select on table public.payroll_run_lines to authenticated;
grant select on table public.payroll_rule_packs to authenticated;
grant select on table public.payroll_execution_intents to authenticated;
grant select on table public.payroll_execution_evidence to authenticated;

-- Provider secret references and verification hashes remain server-side only.
revoke select on table public.payroll_provider_connections from authenticated;
grant select (
  id,
  org_id,
  provider_key,
  environment,
  status,
  capabilities,
  last_verified_at,
  created_at,
  updated_at
) on table public.payroll_provider_connections to authenticated;
