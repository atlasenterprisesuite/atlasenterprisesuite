-- Restrict provider connection reads to non-secret metadata only.
-- Server-side credential/evidence references remain unavailable to authenticated clients.

revoke select on public.payroll_provider_connections from authenticated;

grant select (
  id,
  org_id,
  provider_key,
  environment,
  status,
  capabilities,
  last_verified_at,
  created_at,
  updated_at
) on public.payroll_provider_connections to authenticated;
