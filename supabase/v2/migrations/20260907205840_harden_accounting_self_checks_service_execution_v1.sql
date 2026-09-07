alter function public.atlas_accounting_self_check() security definer;
alter function public.atlas_accounting_arap_self_check() security definer;
alter function public.atlas_accounting_bank_self_check() security definer;
alter function public.atlas_accounting_assets_close_self_check() security definer;

alter function public.atlas_accounting_self_check() set search_path = public, pg_catalog, pg_temp;
alter function public.atlas_accounting_arap_self_check() set search_path = public, pg_catalog, pg_temp;
alter function public.atlas_accounting_bank_self_check() set search_path = public, pg_catalog, pg_temp;
alter function public.atlas_accounting_assets_close_self_check() set search_path = public, pg_catalog, pg_temp;

revoke all on function public.atlas_accounting_self_check() from public, anon, authenticated;
revoke all on function public.atlas_accounting_arap_self_check() from public, anon, authenticated;
revoke all on function public.atlas_accounting_bank_self_check() from public, anon, authenticated;
revoke all on function public.atlas_accounting_assets_close_self_check() from public, anon, authenticated;

grant execute on function public.atlas_accounting_self_check() to service_role;
grant execute on function public.atlas_accounting_arap_self_check() to service_role;
grant execute on function public.atlas_accounting_bank_self_check() to service_role;
grant execute on function public.atlas_accounting_assets_close_self_check() to service_role;
