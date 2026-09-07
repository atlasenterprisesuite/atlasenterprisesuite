\set ON_ERROR_STOP on

begin;

create temp table atlas_e2e_scope (
  label text primary key,
  user_id uuid not null,
  tenant_slug text not null,
  org_slug text not null,
  tenant_id uuid,
  org_id uuid
) on commit drop;

grant select on table atlas_e2e_scope to authenticated, service_role;
grant update on table atlas_e2e_scope to service_role;

insert into atlas_e2e_scope(label,user_id,tenant_slug,org_slug)
values
  ('A', gen_random_uuid(), 'atlas-e2e-a-' || substr(replace(gen_random_uuid()::text,'-',''),1,12), 'atlas-e2e-org-a-' || substr(replace(gen_random_uuid()::text,'-',''),1,12)),
  ('B', gen_random_uuid(), 'atlas-e2e-b-' || substr(replace(gen_random_uuid()::text,'-',''),1,12), 'atlas-e2e-org-b-' || substr(replace(gen_random_uuid()::text,'-',''),1,12));

insert into auth.users (id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous)
select user_id,'authenticated','authenticated',
       'atlas-e2e-' || lower(label) || '-' || substr(replace(user_id::text,'-',''),1,12) || '@invalid.local',
       '', '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now(),false,false
from atlas_e2e_scope;

if has_function_privilege('authenticated','public.bootstrap_atlas_tenant_service(uuid,text,text,text,text)','execute') then
  \echo 'bootstrap must not be executable by authenticated'
  \quit 1
endif

set local role service_role;
update atlas_e2e_scope s
set (tenant_id,org_id) = (
  select b.tenant_id,b.organization_id
  from public.bootstrap_atlas_tenant_service(
    s.user_id,
    'ATLAS E2E Tenant ' || s.label,
    s.tenant_slug,
    'ATLAS E2E Org ' || s.label,
    s.org_slug
  ) b
);
reset role;

-- User A: identity resolution, own-tenant write/read, and blocked cross-tenant write.
set local role authenticated;
select set_config('request.jwt.claim.sub',(select user_id::text from atlas_e2e_scope where label='A'),true);
select set_config('request.jwt.claims',json_build_object('sub',(select user_id::text from atlas_e2e_scope where label='A'),'role','authenticated')::text,true);

do $$
declare
  a record;
  b record;
  ctx record;
  own_account uuid;
  visible_count integer;
  foreign_count integer;
  blocked boolean := false;
begin
  select * into a from atlas_e2e_scope where label='A';
  select * into b from atlas_e2e_scope where label='B';
  select * into ctx from public.atlas_identity_context();

  if auth.uid() is distinct from a.user_id then raise exception 'A auth.uid mismatch'; end if;
  if ctx.tenant_id is distinct from a.tenant_id or ctx.organization_id is distinct from a.org_id then raise exception 'A identity scope mismatch'; end if;
  if ctx.role <> 'owner' or not ('accounting.write' = any(ctx.permissions)) then raise exception 'A permission resolution failed'; end if;

  own_account := public.create_accounting_account(a.tenant_id,a.org_id,'E2E-A-1000','E2E A Cash','asset','debit',false);
  if own_account is null then raise exception 'A own-scope account write failed'; end if;

  select count(*), count(*) filter (where tenant_id=b.tenant_id)
    into visible_count,foreign_count
  from public.chart_of_accounts;
  if visible_count <> 1 or foreign_count <> 0 then raise exception 'A RLS visibility failed'; end if;

  begin
    perform public.create_accounting_account(b.tenant_id,b.org_id,'E2E-X-9999','Cross Tenant Attempt','asset','debit',false);
  exception when others then
    blocked := true;
  end;
  if not blocked then raise exception 'A cross-tenant write unexpectedly succeeded'; end if;
end $$;

reset role;

-- User B: independent identity and visibility.
set local role authenticated;
select set_config('request.jwt.claim.sub',(select user_id::text from atlas_e2e_scope where label='B'),true);
select set_config('request.jwt.claims',json_build_object('sub',(select user_id::text from atlas_e2e_scope where label='B'),'role','authenticated')::text,true);

do $$
declare
  a record;
  b record;
  ctx record;
  own_account uuid;
  visible_count integer;
  foreign_count integer;
begin
  select * into a from atlas_e2e_scope where label='A';
  select * into b from atlas_e2e_scope where label='B';
  select * into ctx from public.atlas_identity_context();

  if auth.uid() is distinct from b.user_id then raise exception 'B auth.uid mismatch'; end if;
  if ctx.tenant_id is distinct from b.tenant_id or ctx.organization_id is distinct from b.org_id then raise exception 'B identity scope mismatch'; end if;
  if ctx.role <> 'owner' or not ('accounting.write' = any(ctx.permissions)) then raise exception 'B permission resolution failed'; end if;

  own_account := public.create_accounting_account(b.tenant_id,b.org_id,'E2E-B-1000','E2E B Cash','asset','debit',false);
  if own_account is null then raise exception 'B own-scope account write failed'; end if;

  select count(*), count(*) filter (where tenant_id=a.tenant_id)
    into visible_count,foreign_count
  from public.chart_of_accounts;
  if visible_count <> 1 or foreign_count <> 0 then raise exception 'B RLS visibility failed'; end if;
end $$;

reset role;

rollback;

\echo 'ATLAS Supabase v2 tenant isolation E2E: PASS'
