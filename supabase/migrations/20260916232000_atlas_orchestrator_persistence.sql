create table if not exists public.atlas_orchestrator_tasks (
  tenant_id text not null,
  organization_id text not null,
  task_id text not null,
  schema_version integer not null check (schema_version > 0),
  state text not null,
  task_json jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (tenant_id, organization_id, task_id)
);

create table if not exists public.atlas_orchestrator_events (
  id text primary key,
  tenant_id text not null,
  organization_id text not null,
  task_id text not null,
  event_type text not null,
  event_json jsonb not null,
  occurred_at timestamptz not null,
  foreign key (tenant_id, organization_id, task_id)
    references public.atlas_orchestrator_tasks (tenant_id, organization_id, task_id)
    on delete cascade
);

create index if not exists atlas_orchestrator_events_scope_task_time_idx
  on public.atlas_orchestrator_events (tenant_id, organization_id, task_id, occurred_at, id);

alter table public.atlas_orchestrator_tasks enable row level security;
alter table public.atlas_orchestrator_events enable row level security;

revoke all on public.atlas_orchestrator_tasks from anon, authenticated;
revoke all on public.atlas_orchestrator_events from anon, authenticated;
