-- Disposable PostgreSQL 17 fixtures ONLY; synthetic identifiers.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create table public.organizations (id uuid primary key);
create table public.organization_members (
  org_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id),
  role text not null, status text not null,
  primary key(org_id,user_id)
);
create table public.execution_tasks (
  id uuid primary key, org_id uuid not null references public.organizations(id),
  owner_user_id uuid not null references auth.users(id)
);
create table public.execution_evidence (
  id uuid primary key, org_id uuid not null references public.organizations(id),
  task_id uuid not null references public.execution_tasks(id),
  verified boolean not null
);
grant usage on schema public to service_role, authenticated, anon;
grant usage on schema auth to service_role;
grant select on public.organization_members, public.execution_tasks,
  public.execution_evidence to service_role;
insert into auth.users(id) values
 ('00000000-0000-4000-8000-000000000101'),
 ('00000000-0000-4000-8000-000000000102'),
 ('00000000-0000-4000-8000-000000000201');
insert into public.organizations(id) values
 ('00000000-0000-4000-8000-000000000001'),
 ('00000000-0000-4000-8000-000000000002');
insert into public.organization_members(org_id,user_id,role,status) values
 ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000101','editor','active'),
 ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000102','owner','active'),
 ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000201','owner','active');
insert into public.execution_tasks(id,org_id,owner_user_id) values
 ('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000101'),
 ('00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000201');
insert into public.execution_evidence(id,org_id,task_id,verified) values
 ('00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000301',true),
 ('00000000-0000-4000-8000-000000000402','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000301',false),
 ('00000000-0000-4000-8000-000000000403','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000302',true);
