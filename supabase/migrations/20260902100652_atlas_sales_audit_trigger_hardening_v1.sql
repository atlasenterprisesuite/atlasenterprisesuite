-- audit_sales_change is a trigger-only SECURITY DEFINER function.
-- Prevent direct RPC execution while preserving database-trigger invocation.
revoke execute on function public.audit_sales_change() from public, anon, authenticated;
