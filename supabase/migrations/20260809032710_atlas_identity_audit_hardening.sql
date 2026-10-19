-- ATLAS Identity audit hardening
-- Force permission overrides through the audited RPC instead of direct table mutations.
begin;

drop policy if exists organization_role_permissions_manage on public.organization_role_permissions;
revoke insert, update, delete on public.organization_role_permissions from authenticated;

commit;
