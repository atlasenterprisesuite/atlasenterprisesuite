-- ATLAS Identity relationship indexes.
-- Cover foreign-key lookups and common security-event access paths without altering authorization semantics.
begin;

create index if not exists identity_role_permissions_permission_code_idx
  on public.identity_role_permissions(permission_code);

create index if not exists identity_security_events_org_created_idx
  on public.identity_security_events(org_id, created_at desc);

create index if not exists identity_security_events_actor_user_id_idx
  on public.identity_security_events(actor_user_id);

create index if not exists organization_role_permissions_permission_code_idx
  on public.organization_role_permissions(permission_code);

create index if not exists organization_role_permissions_updated_by_idx
  on public.organization_role_permissions(updated_by);

commit;
