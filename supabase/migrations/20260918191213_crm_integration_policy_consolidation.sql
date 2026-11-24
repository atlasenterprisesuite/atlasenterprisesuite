drop policy if exists atlas_integration_connections_select
  on public.atlas_integration_connections;

drop policy if exists atlas_integration_connections_read
  on public.atlas_integration_connections;

create policy atlas_integration_connections_read
  on public.atlas_integration_connections
  for select
  to authenticated
  using (public.has_identity_permission(org_id, 'integrations.read'));
