revoke execute on function public.audit_accounting_period_close() from public, anon, authenticated;
revoke execute on function public.audit_accounting_settings_change() from public, anon, authenticated;
grant execute on function public.audit_accounting_period_close() to postgres, service_role;
grant execute on function public.audit_accounting_settings_change() to postgres, service_role;
