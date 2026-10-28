begin;

alter table public.atlas_work_units
  drop constraint if exists atlas_work_units_org_project_id_key;
alter table public.atlas_work_units
  add constraint atlas_work_units_org_project_id_key unique (org_id, project_id, id);

alter table public.atlas_work_units
  drop constraint if exists atlas_work_units_parent_fk;
alter table public.atlas_work_units
  add constraint atlas_work_units_parent_fk
  foreign key (org_id, project_id, parent_work_unit_id)
  references public.atlas_work_units(org_id, project_id, id)
  on delete cascade;

alter table public.atlas_conversation_executions
  drop constraint if exists atlas_conversation_executions_project_fk;
alter table public.atlas_conversation_executions
  add constraint atlas_conversation_executions_project_fk
  foreign key (org_id, project_id)
  references public.atlas_work_projects(org_id, id)
  on delete no action
  deferrable initially deferred;

alter table public.atlas_conversation_executions
  drop constraint if exists atlas_conversation_executions_work_unit_fk;
alter table public.atlas_conversation_executions
  add constraint atlas_conversation_executions_work_unit_fk
  foreign key (org_id, project_id, work_unit_id)
  references public.atlas_work_units(org_id, project_id, id)
  on delete no action
  deferrable initially deferred;

create or replace function public.guard_atlas_work_dependency_cycle()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  creates_cycle boolean;
begin
  if new.status <> 'active' then
    return new;
  end if;
  if new.predecessor_work_unit_id = new.successor_work_unit_id then
    raise exception 'A work unit cannot depend on itself';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('atlas-work-dependency:' || new.org_id::text, 0));
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
  select exists(select 1 from downstream where work_unit_id = new.predecessor_work_unit_id)
    into creates_cycle;
  if creates_cycle then raise exception 'Work dependency would create a cycle'; end if;
  return new;
end;
$$;

create or replace function public.guard_atlas_work_unit_parent_cycle()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  creates_cycle boolean;
begin
  if new.parent_work_unit_id is null then return new; end if;
  if new.parent_work_unit_id = new.id then raise exception 'A work unit cannot be its own parent'; end if;
  perform pg_advisory_xact_lock(hashtextextended('atlas-work-parent:' || new.org_id::text || ':' || new.project_id::text, 0));
  with recursive ancestors(work_unit_id) as (
    select new.parent_work_unit_id
    union
    select u.parent_work_unit_id
      from public.atlas_work_units u
      join ancestors a on u.id = a.work_unit_id
     where u.org_id = new.org_id
       and u.project_id = new.project_id
       and u.parent_work_unit_id is not null
       and u.id <> new.id
  )
  select exists(select 1 from ancestors where work_unit_id = new.id) into creates_cycle;
  if creates_cycle then raise exception 'Work unit parent relationship would create a cycle'; end if;
  return new;
end;
$$;

drop trigger if exists atlas_work_unit_parent_cycle on public.atlas_work_units;
create trigger atlas_work_unit_parent_cycle
before insert or update of parent_work_unit_id, project_id
on public.atlas_work_units
for each row execute function public.guard_atlas_work_unit_parent_cycle();

create or replace function public.guard_atlas_auto_safe_policy()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  elevated boolean;
  authority_changed boolean := false;
begin
  if tg_op = 'UPDATE' and new.org_id is distinct from old.org_id then
    raise exception 'Conversation executions cannot be moved between organizations';
  end if;
  elevated := public.has_org_role(new.org_id, array['owner','admin','manager']);
  if tg_op = 'UPDATE' then
    authority_changed :=
      new.requested_action is distinct from old.requested_action
      or new.intent is distinct from old.intent
      or new.status is distinct from old.status
      or new.execution_policy is distinct from old.execution_policy
      or new.project_id is distinct from old.project_id
      or new.work_unit_id is distinct from old.work_unit_id;
  end if;
  if new.execution_policy = 'auto_safe' and not elevated then
    raise exception 'auto_safe execution policy requires owner, admin or manager role';
  end if;
  if tg_op = 'UPDATE' and old.execution_policy = 'auto_safe' and authority_changed and not elevated then
    raise exception 'Modifying an authorized auto_safe execution requires owner, admin or manager role';
  end if;
  return new;
end;
$$;

drop trigger if exists atlas_conversation_auto_safe_guard on public.atlas_conversation_executions;
create trigger atlas_conversation_auto_safe_guard
before insert or update of org_id, requested_action, intent, status, execution_policy, project_id, work_unit_id
on public.atlas_conversation_executions
for each row execute function public.guard_atlas_auto_safe_policy();

commit;
