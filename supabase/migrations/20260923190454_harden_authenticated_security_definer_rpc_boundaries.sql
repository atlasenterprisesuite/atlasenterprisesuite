set local search_path = public, atlas_private, pg_temp;

create temp table _atlas_harden_auth_definer as
select p.oid,
       p.proname,
       p.pronargs,
       pg_get_function_identity_arguments(p.oid) as identity_args,
       pg_get_function_arguments(p.oid) as args_with_defaults,
       pg_get_function_result(p.oid) as result_type,
       p.proretset,
       p.provolatile,
       coalesce((
         select string_agg('$'||g.i::text, ', ' order by g.i)
         from generate_series(1,p.pronargs) g(i)
       ),'') as call_args
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.prosecdef
  and has_function_privilege('authenticated',p.oid,'EXECUTE');

do $$
declare
  r record;
  wrapper_sql text;
begin
  for r in select * from _atlas_harden_auth_definer order by proname loop
    execute format('alter function public.%I(%s) set schema atlas_private', r.proname, r.identity_args);

    wrapper_sql := format(
      'create function public.%I(%s) returns %s language sql %s security invoker set search_path=atlas_private,public,pg_temp as %L',
      r.proname,
      r.args_with_defaults,
      r.result_type,
      case r.provolatile when 'i' then 'immutable' when 's' then 'stable' else 'volatile' end,
      case when r.proretset
           then format('select * from atlas_private.%I(%s)', r.proname, r.call_args)
           else format('select atlas_private.%I(%s)', r.proname, r.call_args)
      end
    );
    execute wrapper_sql;

    execute format('revoke all on function public.%I(%s) from public, anon', r.proname, r.identity_args);
    execute format('grant execute on function public.%I(%s) to authenticated, service_role', r.proname, r.identity_args);

    execute format('revoke all on function atlas_private.%I(%s) from public, anon', r.proname, r.identity_args);
    execute format('grant execute on function atlas_private.%I(%s) to authenticated, service_role', r.proname, r.identity_args);
  end loop;
end $$;
