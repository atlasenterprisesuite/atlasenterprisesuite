-- Isolated CI database fixture only. NEVER apply to atlas-core or any live project.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create table public.organizations (
  id uuid primary key,
  active boolean not null default true
);
create table public.organization_members (
  org_id uuid not null references public.organizations(id),
  user_id uuid not null,
  status text not null default 'active',
  primary key (org_id, user_id)
);
create table public.identity_permissions (
  code text primary key,
  description text not null
);
create table public.identity_role_permissions (
  role text not null,
  permission_code text not null references public.identity_permissions(code),
  primary key (role, permission_code)
);
create table public.audit_logs (
  id bigint generated always as identity primary key,
  org_id uuid,
  user_id uuid,
  action text not null,
  table_name text,
  record_id text,
  new_data jsonb
);

insert into public.organizations (id, active) values
('10000000-0000-4000-8000-000000000001', true),
('20000000-0000-4000-8000-000000000002', true);
insert into public.organization_members (org_id,user_id,status) values
('10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001','active'),
('20000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000002','active');

grant usage on schema public to service_role, authenticated, anon;
grant select on public.organizations, public.organization_members to service_role;
grant insert on public.audit_logs to service_role;
grant usage, select on sequence public.audit_logs_id_seq to service_role;
