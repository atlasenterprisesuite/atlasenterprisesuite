insert into public.identity_permissions(code,description) values
('projects.read','Read ATLAS Projects portfolio and tasks'),
('projects.write','Create and manage ATLAS Projects work')
on conflict (code) do nothing;

insert into public.identity_role_permissions(role,permission_code)
select r.role,p.code
from (values ('owner'),('admin'),('manager'),('staff')) as r(role)
cross join (values ('projects.read'),('projects.write')) as p(code)
on conflict do nothing;
insert into public.identity_role_permissions(role,permission_code)
select r.role,'projects.read'
from (values ('accountant'),('viewer')) as r(role)
on conflict do nothing;

create or replace function public.can_write_projects_data(o uuid)
returns boolean language sql stable set search_path to 'public','pg_temp'
as $$ select public.has_identity_permission(o,'projects.write') $$;

create table if not exists public.projects (
 id uuid primary key default gen_random_uuid(), org_id uuid not null, name text not null, description text,
 status text not null default 'planned' check(status in ('planned','active','on_hold','at_risk','completed','cancelled')),
 priority text not null default 'medium' check(priority in ('low','medium','high','critical')),
 owner_user_id uuid, start_date date, due_date date, completed_at timestamptz,
 created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists projects_org_status_idx on public.projects(org_id,status,due_date);

create table if not exists public.project_tasks (
 id uuid primary key default gen_random_uuid(), org_id uuid not null, project_id uuid not null references public.projects(id) on delete cascade,
 title text not null, description text, status text not null default 'todo' check(status in ('todo','in_progress','blocked','review','done','cancelled')),
 priority text not null default 'medium' check(priority in ('low','medium','high','critical')),
 assigned_user_id uuid, due_date date, completed_at timestamptz,
 created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists project_tasks_org_project_idx on public.project_tasks(org_id,project_id,status,due_date);

create table if not exists public.project_milestones (
 id uuid primary key default gen_random_uuid(), org_id uuid not null, project_id uuid not null references public.projects(id) on delete cascade,
 name text not null, status text not null default 'planned' check(status in ('planned','in_progress','complete','blocked','cancelled')),
 due_date date, completed_at timestamptz, created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists project_milestones_org_project_idx on public.project_milestones(org_id,project_id,status,due_date);

alter table public.projects enable row level security; alter table public.project_tasks enable row level security; alter table public.project_milestones enable row level security;
create policy projects_read on public.projects for select to authenticated using(public.is_org_member(org_id));
create policy projects_insert on public.projects for insert to authenticated with check(public.can_write_projects_data(org_id));
create policy projects_update on public.projects for update to authenticated using(public.can_write_projects_data(org_id)) with check(public.can_write_projects_data(org_id));
create policy projects_delete on public.projects for delete to authenticated using(public.can_write_projects_data(org_id));
create policy project_tasks_read on public.project_tasks for select to authenticated using(public.is_org_member(org_id));
create policy project_tasks_insert on public.project_tasks for insert to authenticated with check(public.can_write_projects_data(org_id));
create policy project_tasks_update on public.project_tasks for update to authenticated using(public.can_write_projects_data(org_id)) with check(public.can_write_projects_data(org_id));
create policy project_tasks_delete on public.project_tasks for delete to authenticated using(public.can_write_projects_data(org_id));
create policy project_milestones_read on public.project_milestones for select to authenticated using(public.is_org_member(org_id));
create policy project_milestones_insert on public.project_milestones for insert to authenticated with check(public.can_write_projects_data(org_id));
create policy project_milestones_update on public.project_milestones for update to authenticated using(public.can_write_projects_data(org_id)) with check(public.can_write_projects_data(org_id));
create policy project_milestones_delete on public.project_milestones for delete to authenticated using(public.can_write_projects_data(org_id));
grant select,insert,update,delete on public.projects,public.project_tasks,public.project_milestones to authenticated;
