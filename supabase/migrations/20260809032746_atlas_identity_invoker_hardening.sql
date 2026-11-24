-- ATLAS Identity read-RPC hardening.
-- Read-only helpers do not need elevated table-owner privileges because their source tables already expose tenant-safe SELECT policies.
begin;

alter function public.has_identity_permission(uuid, text) security invoker;
alter function public.get_identity_context() security invoker;

-- The policy mutation RPC intentionally remains SECURITY DEFINER because direct
-- writes to organization_role_permissions are revoked from authenticated users.
-- It performs its own owner/admin authorization check before every mutation.

commit;
