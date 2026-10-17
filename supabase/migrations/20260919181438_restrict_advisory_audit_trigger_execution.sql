revoke execute on function public.advisory_log_audit() from public, anon, authenticated;
grant execute on function public.advisory_log_audit() to service_role;
