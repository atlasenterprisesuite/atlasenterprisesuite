create or replace function public.atlas_identity_self_check()
returns table(check_name text, passed boolean, detail text)
language sql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  with fn as (
    select p.prosecdef
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'atlas_identity_context'
    limit 1
  )
  select
    'identity.context_function_exists',
    exists(select 1 from fn),
    case when exists(select 1 from fn) then 'identity context function exists' else 'identity context function missing' end
  union all
  select
    'identity.context_security_invoker',
    coalesce((select not prosecdef from fn), false),
    case when coalesce((select not prosecdef from fn), false) then 'identity context uses SECURITY INVOKER' else 'identity context is not SECURITY INVOKER' end
  union all
  select
    'identity.context_authenticated_only',
    has_function_privilege('authenticated', 'public.atlas_identity_context()', 'EXECUTE')
      and not has_function_privilege('anon', 'public.atlas_identity_context()', 'EXECUTE'),
    case when has_function_privilege('authenticated', 'public.atlas_identity_context()', 'EXECUTE')
      and not has_function_privilege('anon', 'public.atlas_identity_context()', 'EXECUTE')
      then 'authenticated can execute; anon cannot'
      else 'identity context execute grants are unsafe'
    end;
$$;

revoke all on function public.atlas_identity_self_check() from public, anon, authenticated;
grant execute on function public.atlas_identity_self_check() to service_role;
