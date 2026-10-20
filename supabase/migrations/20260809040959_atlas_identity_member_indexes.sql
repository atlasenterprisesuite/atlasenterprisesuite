-- ATLAS Identity membership lookup indexes.
-- Optimize user-to-organization context resolution and owner hierarchy checks.
begin;

create index if not exists organization_members_user_id_idx
  on public.organization_members(user_id);

create index if not exists organization_members_org_role_status_idx
  on public.organization_members(org_id, role, status);

commit;
