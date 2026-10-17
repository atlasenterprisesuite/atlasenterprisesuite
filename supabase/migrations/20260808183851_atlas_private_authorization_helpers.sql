begin;

create schema if not exists atlas_private;
revoke all on schema atlas_private from public;
revoke all on schema atlas_private from anon;
grant usage on schema atlas_private to authenticated;

create or replace function atlas_private.is_org_member(o uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1 from public.organization_members
    where org_id=o and user_id=auth.uid() and status='active'
  )
$$;

create or replace function atlas_private.has_org_role(o uuid,r text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1 from public.organization_members
    where org_id=o and user_id=auth.uid() and status='active' and role=any(r)
  )
$$;

revoke execute on function atlas_private.is_org_member(uuid) from public, anon;
revoke execute on function atlas_private.has_org_role(uuid,text[]) from public, anon;
grant execute on function atlas_private.is_org_member(uuid) to authenticated;
grant execute on function atlas_private.has_org_role(uuid,text[]) to authenticated;

create or replace function public.is_org_member(o uuid)
returns boolean
language sql
stable
security invoker
set search_path = atlas_private, pg_temp
as $$select atlas_private.is_org_member(o)$$;

create or replace function public.has_org_role(o uuid,r text[])
returns boolean
language sql
stable
security invoker
set search_path = atlas_private, pg_temp
as $$select atlas_private.has_org_role(o,r)$$;

revoke execute on function public.is_org_member(uuid) from public, anon;
revoke execute on function public.has_org_role(uuid,text[]) from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid,text[]) to authenticated;

commit;
