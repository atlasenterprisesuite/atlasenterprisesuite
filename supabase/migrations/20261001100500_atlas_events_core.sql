-- ATLAS Events canonical operational core.
-- Internal planning/execution is implemented here; external ticketing, payments and artist booking remain provider-gated.

insert into public.identity_permissions(code,description)
values
  ('events.read','Read organization-scoped ATLAS Events records.'),
  ('events.write','Create and manage organization-scoped ATLAS Events records.')
on conflict(code) do update set description=excluded.description;

insert into public.identity_role_permissions(role,permission_code)
values
  ('owner','events.read'),('owner','events.write'),
  ('admin','events.read'),('admin','events.write'),
  ('manager','events.read'),('manager','events.write'),
  ('staff','events.read')
on conflict do nothing;

create table if not exists public.event_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 200),
  event_type text not null default 'general' check (event_type in ('general','concert','conference','festival','corporate','community','virtual')),
  status text not null default 'draft' check (status in ('draft','planning','on_sale','live','settling','closed','cancelled')),
  venue_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer check (capacity is null or capacity >= 0),
  notes text not null default '' check (length(notes)<=5000),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);
create index if not exists event_records_org_status_start_idx on public.event_records(org_id,status,starts_at);

create table if not exists public.event_assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.event_records(id) on delete cascade,
  role text not null check (role in ('producer','artist','performer','venue','staff','vendor','sponsor')),
  display_name text not null check (length(trim(display_name)) between 1 and 200),
  contact_reference text,
  status text not null default 'planned' check (status in ('planned','confirmed','declined','completed','cancelled')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists event_assignments_org_event_idx on public.event_assignments(org_id,event_id);

create table if not exists public.event_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.event_records(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 240),
  category text not null default 'production' check (category in ('production','venue','talent','marketing','safety','logistics','settlement')),
  status text not null default 'open' check (status in ('open','in_progress','blocked','complete','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  owner_label text,
  blocker text,
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists event_tasks_org_event_status_idx on public.event_tasks(org_id,event_id,status,due_at);

create or replace function public.touch_event_updated_at()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin new.updated_at:=now(); return new; end $$;

create or replace function public.guard_event_status_transition()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare allowed boolean:=false;
begin
  if tg_op<>'UPDATE' or new.status=old.status then return new; end if;
  allowed := case old.status
    when 'draft' then new.status in ('planning','cancelled')
    when 'planning' then new.status in ('on_sale','cancelled')
    when 'on_sale' then new.status in ('live','cancelled')
    when 'live' then new.status in ('settling','cancelled')
    when 'settling' then new.status in ('closed','cancelled')
    else false
  end;
  if not allowed then raise exception 'invalid_event_status_transition:%->%',old.status,new.status using errcode='22023'; end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['event_records','event_assignments','event_tasks']
  loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop trigger if exists %I_touch on public.%I',t,t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_event_updated_at()',t,t);
    execute format('drop trigger if exists %I_audit on public.%I',t,t);
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row_change()',t,t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  end loop;
end $$;

drop trigger if exists event_records_status_guard on public.event_records;
create trigger event_records_status_guard before update of status on public.event_records
for each row execute function public.guard_event_status_transition();

drop policy if exists event_records_read on public.event_records;
create policy event_records_read on public.event_records for select to authenticated
using (public.has_identity_permission(org_id,'events.read') or public.has_identity_permission(org_id,'events.write'));
drop policy if exists event_records_write on public.event_records;
create policy event_records_write on public.event_records for all to authenticated
using (public.has_identity_permission(org_id,'events.write'))
with check (public.has_identity_permission(org_id,'events.write'));

drop policy if exists event_assignments_read on public.event_assignments;
create policy event_assignments_read on public.event_assignments for select to authenticated
using (public.has_identity_permission(org_id,'events.read') or public.has_identity_permission(org_id,'events.write'));
drop policy if exists event_assignments_write on public.event_assignments;
create policy event_assignments_write on public.event_assignments for all to authenticated
using (public.has_identity_permission(org_id,'events.write'))
with check (
  public.has_identity_permission(org_id,'events.write')
  and exists(select 1 from public.event_records e where e.id=event_id and e.org_id=org_id)
);

drop policy if exists event_tasks_read on public.event_tasks;
create policy event_tasks_read on public.event_tasks for select to authenticated
using (public.has_identity_permission(org_id,'events.read') or public.has_identity_permission(org_id,'events.write'));
drop policy if exists event_tasks_write on public.event_tasks;
create policy event_tasks_write on public.event_tasks for all to authenticated
using (public.has_identity_permission(org_id,'events.write'))
with check (
  public.has_identity_permission(org_id,'events.write')
  and exists(select 1 from public.event_records e where e.id=event_id and e.org_id=org_id)
);
