-- ATLAS Work Graph + Conversation-to-Execution
-- Tenant-scoped execution model that turns intent into traceable work without
-- storing raw conversation transcripts by default.
begin;

create table if not exists public.atlas_work_projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_code text not null,
  title text not null,
  description text,
  status text not null default 'planned'
    check (status in ('planned','active','blocked','completed','cancelled','archived')),
  priority text not null default 'medium'
    check (priority in ('low','medium','high','urgent')),
  owner_user_id uuid references auth.users(id),
  starts_on date,
  due_on date,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, project_code),
  unique (org_id, id),
  check (due_on is null or starts_on is null or due_on >= starts_on)
);

create table if not exists public.atlas_work_units (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  parent_work_unit_id uuid,
  work_key text not null,
  title text not null,
  description text,
  work_type text not null default 'task'
    check (work_type in ('milestone','task','action','review','approval','automation')),
  status text not null default 'backlog'
    check (status in ('backlog','ready','in_progress','blocked','review','verified','completed','failed','cancelled')),
  priority text not null default 'medium'
    check (priority in ('low','medium','high','urgent')),
  assigned_user_id uuid references auth.users(id),
  assigned_agent text,
  acceptance_criteria jsonb not null default '[]'::jsonb,
  execution_context jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, project_id, work_key),
  unique (org_id, id),
  constraint atlas_work_units_project_fk
    foreign key (org_id, project_id)
    references public.atlas_work_projects(org_id, id)
    on delete cascade,
  constraint atlas_work_units_parent_fk
    foreign key (org_id, parent_work_unit_id)
    references public.atlas_work_units(org_id, id)
    on delete cascade,
  check (parent_work_unit_id is null or parent_work_unit_id <> id),
  check (completed_at is null or started_at is null or completed_at >= started_at)
);

create table if not exists public.atlas_work_dependencies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  predecessor_work_unit_id uuid not null,
  successor_work_unit_id uuid not null,
  dependency_type text not null default 'finish_to_start'
    check (dependency_type in ('finish_to_start','start_to_start','finish_to_finish','approval')),
  status text not null default 'active'
    check (status in ('active','satisfied','waived','cancelled')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, predecessor_work_unit_id, successor_work_unit_id, dependency_type),
  constraint atlas_work_dependencies_predecessor_fk
    foreign key (org_id, predecessor_work_unit_id)
    references public.atlas_work_units(org_id, id)
    on delete cascade,
  constraint atlas_work_dependencies_successor_fk
    foreign key (org_id, successor_work_unit_id)
    references public.atlas_work_units(org_id, id)
    on delete cascade,
  check (predecessor_work_unit_id <> successor_work_unit_id)
);

create table if not exists public.atlas_work_evidence (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  work_unit_id uuid not null,
  evidence_type text not null default 'note'
    check (evidence_type in ('note','commit','pull_request','deployment','test','document','approval','metric','external_event','other')),
  source_system text,
  source_ref text,
  summary text not null,
  evidence_payload jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint atlas_work_evidence_work_unit_fk
    foreign key (org_id, work_unit_id)
    references public.atlas_work_units(org_id, id)
    on delete cascade
);

create table if not exists public.atlas_conversation_executions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  source_kind text not null default 'chat'
    check (source_kind in ('chat','email','voice','document','api','manual','other')),
  source_ref text,
  source_hash text,
  source_summary text,
  intent text not null,
  requested_action jsonb not null default '{}'::jsonb,
  execution_policy text not null default 'assisted'
    check (execution_policy in ('manual','assisted','auto_safe')),
  status text not null default 'captured'
    check (status in ('captured','planned','approved','executing','blocked','completed','failed','cancelled')),
  project_id uuid,
  work_unit_id uuid,
  result_summary text,
  last_error text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  constraint atlas_conversation_executions_project_fk
    foreign key (org_id, project_id)
    references public.atlas_work_projects(org_id, id)
    on delete set null,
  constraint atlas_conversation_executions_work_unit_fk
    foreign key (org_id, work_unit_id)
    references public.atlas_work_units(org_id, id)
    on delete set null
);

create index if not exists atlas_work_projects_org_status_idx
  on public.atlas_work_projects(org_id, status, priority, due_on);
create index if not exists atlas_work_units_org_status_idx
  on public.atlas_work_units(org_id, status, priority, updated_at desc);
create index if not exists atlas_work_units_project_idx
  on public.atlas_work_units(org_id, project_id, status);
create index if not exists atlas_work_dependencies_successor_idx
  on public.atlas_work_dependencies(org_id, successor_work_unit_id, status);
create index if not exists atlas_work_evidence_unit_idx
  on public.atlas_work_evidence(org_id, work_unit_id, created_at desc);
create index if not exists atlas_conversation_executions_org_status_idx
  on public.atlas_conversation_executions(org_id, status, created_at desc);
create index if not exists atlas_conversation_executions_source_idx
  on public.atlas_conversation_executions(org_id, source_kind, source_ref)
  where source_ref is not null;

create or replace function public.guard_atlas_work_dependency_cycle()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  creates_cycle boolean;
begin
  if new.predecessor_work_unit_id = new.successor_work_unit_id then
    raise exception 'A work unit cannot depend on itself';
  end if;

  with recursive downstream(work_unit_id) as (
    select new.successor_work_unit_id
    union
    select d.successor_work_unit_id
      from public.atlas_work_dependencies d
      join downstream x on d.predecessor_work_unit_id = x.work_unit_id
     where d.org_id = new.org_id
       and d.status = 'active'
       and d.id <> new.id
  )
  select exists(
    select 1 from downstream where work_unit_id = new.predecessor_work_unit_id
  ) into creates_cycle;

  if creates_cycle then
    raise exception 'Work dependency would create a cycle';
  end if;
  return new;
end;
$$;

drop trigger if exists atlas_work_dependency_cycle on public.atlas_work_dependencies;
create trigger atlas_work_dependency_cycle
before insert or update of predecessor_work_unit_id, successor_work_unit_id, status
on public.atlas_work_dependencies
for each row execute function public.guard_atlas_work_dependency_cycle();

create or replace function public.guard_atlas_auto_safe_policy()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.execution_policy = 'auto_safe'
     and not public.has_org_role(new.org_id, array['owner','admin','manager']) then
    raise exception 'auto_safe execution policy requires owner, admin or manager role';
  end if;
  return new;
end;
$$;

drop trigger if exists atlas_conversation_auto_safe_guard on public.atlas_conversation_executions;
create trigger atlas_conversation_auto_safe_guard
before insert or update of execution_policy
on public.atlas_conversation_executions
for each row execute function public.guard_atlas_auto_safe_policy();

create or replace function public.capture_atlas_conversation_execution(
  organization_uuid uuid,
  execution_intent text,
  project_title text,
  work_unit_title text,
  source_kind_value text default 'chat',
  source_reference text default null,
  source_summary_value text default null,
  policy_value text default 'assisted'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  project_uuid uuid;
  work_unit_uuid uuid;
  execution_uuid uuid;
  project_code_value text;
  work_key_value text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_write_business_data(organization_uuid) then raise exception 'Write access required'; end if;
  if nullif(trim(execution_intent), '') is null then raise exception 'Intent is required'; end if;
  if nullif(trim(project_title), '') is null then raise exception 'Project title is required'; end if;
  if nullif(trim(work_unit_title), '') is null then raise exception 'Work unit title is required'; end if;

  project_code_value := 'WG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  work_key_value := 'WU-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  insert into public.atlas_work_projects(
    org_id, project_code, title, status, owner_user_id, created_by
  ) values (
    organization_uuid, project_code_value, trim(project_title), 'active', auth.uid(), auth.uid()
  ) returning id into project_uuid;

  insert into public.atlas_work_units(
    org_id, project_id, work_key, title, work_type, status, assigned_user_id, created_by
  ) values (
    organization_uuid, project_uuid, work_key_value, trim(work_unit_title), 'task', 'ready', auth.uid(), auth.uid()
  ) returning id into work_unit_uuid;

  insert into public.atlas_conversation_executions(
    org_id, source_kind, source_ref, source_summary, intent, execution_policy,
    status, project_id, work_unit_id, created_by
  ) values (
    organization_uuid, source_kind_value, source_reference, source_summary_value,
    trim(execution_intent), policy_value, 'planned', project_uuid, work_unit_uuid, auth.uid()
  ) returning id into execution_uuid;

  return execution_uuid;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'atlas_work_projects',
    'atlas_work_units',
    'atlas_work_dependencies',
    'atlas_conversation_executions'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'atlas_updated_' || table_name, table_name);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', 'atlas_updated_' || table_name, table_name);
  end loop;

  foreach table_name in array array[
    'atlas_work_projects',
    'atlas_work_units',
    'atlas_work_dependencies',
    'atlas_work_evidence',
    'atlas_conversation_executions'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'atlas_audit_' || table_name, table_name);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row_change()', 'atlas_audit_' || table_name, table_name);
  end loop;
end;
$$;

alter table public.atlas_work_projects enable row level security;
alter table public.atlas_work_units enable row level security;
alter table public.atlas_work_dependencies enable row level security;
alter table public.atlas_work_evidence enable row level security;
alter table public.atlas_conversation_executions enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'atlas_work_projects',
    'atlas_work_units',
    'atlas_work_dependencies',
    'atlas_work_evidence',
    'atlas_conversation_executions'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_read', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_delete', table_name);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_org_member(org_id))', table_name || '_read', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_write_business_data(org_id))', table_name || '_insert', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_write_business_data(org_id)) with check (public.can_write_business_data(org_id))', table_name || '_update', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using (public.has_org_role(org_id, array[''owner'',''admin'',''manager'']))', table_name || '_delete', table_name);
  end loop;
end;
$$;

grant select, insert, update, delete on public.atlas_work_projects to authenticated;
grant select, insert, update, delete on public.atlas_work_units to authenticated;
grant select, insert, update, delete on public.atlas_work_dependencies to authenticated;
grant select, insert, update, delete on public.atlas_work_evidence to authenticated;
grant select, insert, update, delete on public.atlas_conversation_executions to authenticated;
grant execute on function public.capture_atlas_conversation_execution(uuid,text,text,text,text,text,text,text) to authenticated;

create or replace function public.seed_atlas_work_modules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.organization_modules(org_id, module_code, enabled, launch_status)
  values
    (new.id, 'work_graph', true, 'beta'),
    (new.id, 'conversation_execution', true, 'beta')
  on conflict (org_id, module_code)
  do update set enabled = excluded.enabled, launch_status = excluded.launch_status, updated_at = now();
  return new;
end;
$$;

drop trigger if exists atlas_seed_work_modules on public.organizations;
create trigger atlas_seed_work_modules
after insert on public.organizations
for each row execute function public.seed_atlas_work_modules();

insert into public.organization_modules(org_id, module_code, enabled, launch_status)
select id, module_code, true, 'beta'
from public.organizations
cross join (values ('work_graph'), ('conversation_execution')) as modules(module_code)
on conflict (org_id, module_code)
do update set enabled = excluded.enabled, launch_status = excluded.launch_status, updated_at = now();

commit;
