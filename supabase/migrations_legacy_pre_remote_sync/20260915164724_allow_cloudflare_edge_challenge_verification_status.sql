alter table public.atlas_runtime_verification_runs
  drop constraint if exists atlas_runtime_verification_runs_status_check,
  drop constraint if exists atlas_runtime_verification_runs_check;

alter table public.atlas_runtime_verification_runs
  add constraint atlas_runtime_verification_runs_status_check
    check (status in ('running', 'passed', 'failed', 'blocked', 'blocked_by_edge_challenge')),
  add constraint atlas_runtime_verification_runs_check
    check (
      (status = 'running' and completed_at is null)
      or
      (status in ('passed', 'failed', 'blocked', 'blocked_by_edge_challenge') and completed_at is not null)
    );
