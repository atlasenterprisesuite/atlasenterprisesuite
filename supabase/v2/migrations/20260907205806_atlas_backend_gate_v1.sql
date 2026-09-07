create or replace function public.atlas_backend_gate()
returns table(component text, total_checks bigint, passed_checks bigint, failed_checks bigint)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select 'foundation'::text, count(*)::bigint, count(*) filter (where passed)::bigint, count(*) filter (where not passed)::bigint from public.atlas_foundation_self_check()
  union all
  select 'identity'::text, count(*)::bigint, count(*) filter (where passed)::bigint, count(*) filter (where not passed)::bigint from public.atlas_identity_self_check()
  union all
  select 'accounting.ledger'::text, count(*)::bigint, count(*) filter (where passed)::bigint, count(*) filter (where not passed)::bigint from public.atlas_accounting_self_check()
  union all
  select 'accounting.arap'::text, count(*)::bigint, count(*) filter (where passed)::bigint, count(*) filter (where not passed)::bigint from public.atlas_accounting_arap_self_check()
  union all
  select 'accounting.bank'::text, count(*)::bigint, count(*) filter (where passed)::bigint, count(*) filter (where not passed)::bigint from public.atlas_accounting_bank_self_check()
  union all
  select 'accounting.assets_close'::text, count(*)::bigint, count(*) filter (where passed)::bigint, count(*) filter (where not passed)::bigint from public.atlas_accounting_assets_close_self_check();
$$;
revoke all on function public.atlas_backend_gate() from public, anon, authenticated;
grant execute on function public.atlas_backend_gate() to service_role;