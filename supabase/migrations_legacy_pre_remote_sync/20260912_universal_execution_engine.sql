create table if not exists public.execution_workflows (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  tenant_id text not null check (length(trim(tenant_id)) > 0),
  workflow_type text not null check (length(trim(workflow_type)) > 0),
  owner_module text not null check (length(trim(owner_module)) > 0),
  status text not null check (status in ('draft','now','next','blocked','awaiting_approval','completed','delegated','automatable','discarded','failed','cancelled')),
  current_task_id uuid,
  current_module text not null check (length(trim(current_module)) > 0),
  context jsonb not null default '{}'::jsonb,
  created_by uuid not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.execution_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  tenant_id text not null check (length(trim(tenant_id)) > 0),
  workflow_id uuid not null references public.execution_workflows(id) on delete cascade,
  module text not null check (length(trim(module)) > 0),
  owner_user_id uuid,
  title text not null check (length(trim(title)) > 0),
  intent text not null check (length(trim(intent)) > 0),
  goal text not null check (length(trim(goal)) > 0),
  status text not null check (status in ('draft','now','next','blocked','awaiting_approval','completed','delegated','automatable','discarded','failed','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  current_step_id uuid,
  next_action text,
  blocked_reason text,
  permissions_required text[] not null default '{}'::text[],
  source_type text,
  source_id text,
  parent_task_id uuid references public.execution_tasks(id) on delete set null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((source_type is null and source_id is null) or (length(trim(source_type)) > 0 and length(trim(source_id)) > 0))
);

create table if not exists public.execution_steps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  tenant_id text not null check (length(trim(tenant_id)) > 0),
  task_id uuid not null references public.execution_tasks(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  module text not null check (length(trim(module)) > 0),
  action_type text not null check (length(trim(action_type)) > 0),
  action_payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','ready','running','blocked','awaiting_approval','completed','failed','cancelled')),
  completion_criteria text[] not null default '{}'::text[],
  permissions_required text[] not null default '{}'::text[],
  evidence_requirement text[] not null default '{}'::text[],
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, sequence)
);

create table if not exists public.execution_dependencies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  tenant_id text not null check (length(trim(tenant_id)) > 0),
  task_id uuid not null references public.execution_tasks(id) on delete cascade,
  step_id uuid references public.execution_steps(id) on delete cascade,
  depends_on_task_id uuid references public.execution_tasks(id) on delete restrict,
  depends_on_step_id uuid references public.execution_steps(id) on delete restrict,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (num_nonnulls(depends_on_task_id, depends_on_step_id) = 1)
);

create table if not exists public.execution_evidence (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  tenant_id text not null check (length(trim(tenant_id)) > 0),
  task_id uuid not null references public.execution_tasks(id) on delete cascade,
  step_id uuid references public.execution_steps(id) on delete cascade,
  kind text not null check (length(trim(kind)) > 0),
  reference text not null check (length(trim(reference)) > 0),
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.execution_approvals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  tenant_id text not null check (length(trim(tenant_id)) > 0),
  task_id uuid not null references public.execution_tasks(id) on delete cascade,
  workflow_id uuid not null references public.execution_workflows(id) on delete cascade,
  module text not null check (length(trim(module)) > 0),
  requested_by uuid not null,
  approval_type text not null check (length(trim(approval_type)) > 0),
  required_permission text not null check (length(trim(required_permission)) > 0),
  risk_level text not null check (risk_level in ('low','medium','high','critical')),
  summary text not null check (length(trim(summary)) > 0),
  payload_version integer not null check (payload_version > 0),
  payload_digest text not null check (payload_digest ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled','expired')),
  decided_by uuid,
  decision_reason text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table if not exists public.execution_audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  tenant_id text not null check (length(trim(tenant_id)) > 0),
  actor_user_id uuid not null,
  task_id uuid references public.execution_tasks(id) on delete set null,
  workflow_id uuid references public.execution_workflows(id) on delete set null,
  module text not null check (length(trim(module)) > 0),
  action text not null check (length(trim(action)) > 0),
  previous_state text,
  resulting_state text,
  evidence_ids uuid[] not null default '{}'::uuid[],
  correlation_id text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'execution_workflows_current_task_fk') then
    alter table public.execution_workflows
      add constraint execution_workflows_current_task_fk
      foreign key (current_task_id) references public.execution_tasks(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'execution_tasks_current_step_fk') then
    alter table public.execution_tasks
      add constraint execution_tasks_current_step_fk
      foreign key (current_step_id) references public.execution_steps(id) on delete set null;
  end if;
end $$;

create index if not exists execution_workflows_org_status_idx
  on public.execution_workflows (org_id, status, updated_at desc);
create index if not exists execution_tasks_org_status_owner_idx
  on public.execution_tasks (org_id, status, owner_user_id, updated_at desc);
create index if not exists execution_tasks_org_module_idx
  on public.execution_tasks (org_id, module, updated_at desc);
create index if not exists execution_steps_task_sequence_idx
  on public.execution_steps (task_id, sequence);
create index if not exists execution_dependencies_task_idx
  on public.execution_dependencies (task_id, resolved_at);
create index if not exists execution_evidence_task_step_idx
  on public.execution_evidence (task_id, step_id, created_at desc);
create index if not exists execution_approvals_org_status_idx
  on public.execution_approvals (org_id, status, created_at desc);
create index if not exists execution_audit_org_created_idx
  on public.execution_audit_events (org_id, created_at desc);

alter table public.execution_workflows enable row level security;
alter table public.execution_tasks enable row level security;
alter table public.execution_steps enable row level security;
alter table public.execution_dependencies enable row level security;
alter table public.execution_evidence enable row level security;
alter table public.execution_approvals enable row level security;
alter table public.execution_audit_events enable row level security;

drop policy if exists execution_workflows_member_read on public.execution_workflows;
create policy execution_workflows_member_read on public.execution_workflows
for select to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = execution_workflows.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

drop policy if exists execution_tasks_member_read on public.execution_tasks;
create policy execution_tasks_member_read on public.execution_tasks
for select to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = execution_tasks.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

drop policy if exists execution_steps_member_read on public.execution_steps;
create policy execution_steps_member_read on public.execution_steps
for select to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = execution_steps.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

drop policy if exists execution_dependencies_member_read on public.execution_dependencies;
create policy execution_dependencies_member_read on public.execution_dependencies
for select to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = execution_dependencies.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

drop policy if exists execution_evidence_member_read on public.execution_evidence;
create policy execution_evidence_member_read on public.execution_evidence
for select to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = execution_evidence.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

drop policy if exists execution_approvals_member_read on public.execution_approvals;
create policy execution_approvals_member_read on public.execution_approvals
for select to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = execution_approvals.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

drop policy if exists execution_audit_events_member_read on public.execution_audit_events;
create policy execution_audit_events_member_read on public.execution_audit_events
for select to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = execution_audit_events.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

revoke all on public.execution_workflows from authenticated;
revoke all on public.execution_tasks from authenticated;
revoke all on public.execution_steps from authenticated;
revoke all on public.execution_dependencies from authenticated;
revoke all on public.execution_evidence from authenticated;
revoke all on public.execution_approvals from authenticated;
revoke all on public.execution_audit_events from authenticated;

grant select on public.execution_workflows to authenticated;
grant select on public.execution_tasks to authenticated;
grant select on public.execution_steps to authenticated;
grant select on public.execution_dependencies to authenticated;
grant select on public.execution_evidence to authenticated;
grant select on public.execution_approvals to authenticated;
grant select on public.execution_audit_events to authenticated;

comment on table public.execution_workflows is
  'ATLAS execution workflow lineage and bounded cross-module context. No provider credentials or domain shadow records.';
comment on table public.execution_tasks is
  'ATLAS execution tasks referencing authoritative domain records through source_type/source_id only.';
comment on table public.execution_steps is
  'ATLAS execution microactions. action_payload is bounded application data and must never contain secrets or credentials.';
comment on table public.execution_evidence is
  'Verified references to evidence; binary secrets and raw credentials must never be persisted here.';
comment on table public.execution_audit_events is
  'Immutable append-only execution audit events. Application code must insert new events and never update or delete existing events.';
