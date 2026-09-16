create table public.atlas_orchestrator_tasks (
  task_id text primary key,
  tenant_id uuid not null,
  org_id uuid not null,
  state text not null check (state in ('draft','queued','planning','implementation','review','qa','ci','awaiting_human_approval','approved','deploying','verified','completed','blocked','failed','cancelled')),
  task jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint atlas_orchestrator_task_id_matches check ((task->>'taskId') = task_id),
  constraint atlas_orchestrator_task_state_matches check ((task->>'state') = state),
  constraint atlas_orchestrator_task_tenant_matches check ((task->'scope'->>'tenantId') = tenant_id::text),
  constraint atlas_orchestrator_task_org_matches check ((task->'scope'->>'organizationId') = org_id::text)
);

create index atlas_orchestrator_tasks_scope_state_idx
  on public.atlas_orchestrator_tasks (tenant_id, org_id, state, updated_at desc);

create table public.atlas_orchestrator_events (
  event_id text primary key,
  task_id text not null references public.atlas_orchestrator_tasks(task_id) on delete cascade,
  tenant_id uuid not null,
  org_id uuid not null,
  type text not null,
  outcome text not null check (outcome in ('success','denied','failed')),
  correlation_id text not null,
  event jsonb not null,
  created_at timestamptz not null,
  constraint atlas_orchestrator_event_id_matches check ((event->>'eventId') = event_id),
  constraint atlas_orchestrator_event_task_matches check ((event->>'taskId') = task_id),
  constraint atlas_orchestrator_event_tenant_matches check ((event->'scope'->>'tenantId') = tenant_id::text),
  constraint atlas_orchestrator_event_org_matches check ((event->'scope'->>'organizationId') = org_id::text)
);

create index atlas_orchestrator_events_scope_task_idx
  on public.atlas_orchestrator_events (tenant_id, org_id, task_id, created_at asc);
create index atlas_orchestrator_events_correlation_idx
  on public.atlas_orchestrator_events (correlation_id);

alter table public.atlas_orchestrator_tasks enable row level security;
alter table public.atlas_orchestrator_events enable row level security;

revoke all on public.atlas_orchestrator_tasks from anon, authenticated;
revoke all on public.atlas_orchestrator_events from anon, authenticated;
grant all on public.atlas_orchestrator_tasks to service_role;
grant all on public.atlas_orchestrator_events to service_role;
