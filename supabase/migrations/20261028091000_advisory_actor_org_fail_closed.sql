-- ATLAS 777: fail closed on ambiguous organization context for legacy Advisory RPCs.
-- Until trusted explicit tenant binding is implemented, multi-org identities cannot write.
create or replace function public.advisory_actor_org()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select case when count(*) = 1 then (array_agg(om.org_id))[1] else null::uuid end
  from public.organization_members om
  where om.user_id = auth.uid()
    and om.status = 'active'
$$;

revoke all on function public.advisory_actor_org() from public;
grant execute on function public.advisory_actor_org() to authenticated;
comment on function public.advisory_actor_org() is
  'Fail-closed legacy Advisory organization resolver: exactly one active org required. Multi-org identities need explicit trusted tenant binding.';
