-- ATLAS Advisory Office firm-scope RLS hardening.
-- Forward-only: require both organization permission and active firm membership.

create index if not exists advisory_firm_memberships_user_scope_idx
  on public.advisory_firm_memberships (org_id, user_id, firm_id, status);

create or replace function public.is_advisory_firm_member(
  p_org_id uuid,
  p_firm_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.organization_members om
      join public.advisory_firm_memberships afm
        on afm.org_id = om.org_id
       and afm.user_id = om.user_id
      where om.org_id = p_org_id
        and afm.firm_id = p_firm_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and afm.status = 'active'
    )
$$;

revoke all on function public.is_advisory_firm_member(uuid, uuid) from public;
grant execute on function public.is_advisory_firm_member(uuid, uuid) to authenticated;
grant execute on function public.is_advisory_firm_member(uuid, uuid) to service_role;

drop policy if exists advisory_firms_read on public.advisory_firms;
create policy advisory_firms_read
on public.advisory_firms
for select
to authenticated
using (
  public.has_identity_permission(org_id, 'advisory.read')
  and public.is_advisory_firm_member(org_id, id)
);

drop policy if exists advisory_memberships_read on public.advisory_firm_memberships;
create policy advisory_memberships_read
on public.advisory_firm_memberships
for select
to authenticated
using (
  user_id = auth.uid()
  or (
    public.has_identity_permission(org_id, 'advisory.manage')
    and public.is_advisory_firm_member(org_id, firm_id)
  )
);

drop policy if exists advisory_clients_read on public.advisory_clients;
create policy advisory_clients_read
on public.advisory_clients
for select
to authenticated
using (
  public.has_identity_permission(org_id, 'advisory.read')
  and public.is_advisory_firm_member(org_id, firm_id)
);

drop policy if exists advisory_engagements_read on public.advisory_engagements;
create policy advisory_engagements_read
on public.advisory_engagements
for select
to authenticated
using (
  public.has_identity_permission(org_id, 'advisory.read')
  and public.is_advisory_firm_member(org_id, firm_id)
);

drop policy if exists advisory_launch_read on public.advisory_launch_deliverables;
create policy advisory_launch_read
on public.advisory_launch_deliverables
for select
to authenticated
using (
  public.has_identity_permission(org_id, 'advisory.read')
  and public.is_advisory_firm_member(org_id, firm_id)
);

drop policy if exists advisory_audit_read on public.advisory_audit_events;
create policy advisory_audit_read
on public.advisory_audit_events
for select
to authenticated
using (
  public.is_advisory_firm_member(org_id, firm_id)
  and (
    public.has_identity_permission(org_id, 'advisory.admin')
    or public.has_identity_permission(org_id, 'audit.read')
  )
);

comment on function public.is_advisory_firm_member(uuid, uuid) is
  'Fail-closed Advisory firm-scope helper. Requires both active organization membership and active membership in the requested firm.';
