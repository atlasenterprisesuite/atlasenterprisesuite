-- ATLAS 777 REVIEW / AW Finance Pilot #001.
-- P0: launch intake rows contain contact information and must be isolated by firm.
-- This replaces the organization-only SELECT policy; it does not create demo data,
-- modify leads, enable client access, or authorize any provider.
--
-- The atlas_private.is_advisory_firm_member helper denies anonymous and inactive
-- memberships, and checks both organization and firm against auth.uid().

alter table public.advisory_launch_intakes enable row level security;

drop policy if exists advisory_launch_intakes_read on public.advisory_launch_intakes;
create policy advisory_launch_intakes_read
on public.advisory_launch_intakes
for select
to authenticated
using (
  public.has_identity_permission(org_id, 'advisory.read')
  and atlas_private.is_advisory_firm_member(org_id, firm_id)
);

-- Anonymous intake remains Edge-Function-mediated; no direct public table reads.
revoke all on public.advisory_launch_intakes from anon;
