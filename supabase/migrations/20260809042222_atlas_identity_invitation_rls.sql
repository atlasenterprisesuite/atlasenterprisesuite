-- ATLAS Identity invitation RLS documentation/hardening.
-- Direct table access is intentionally denied; all access goes through guarded RPCs.
begin;

create policy identity_invitations_deny_direct
on public.identity_invitations
for all
to anon, authenticated
using (false)
with check (false);

comment on table public.identity_invitations is
  'ATLAS Identity invitation store. Direct anon/authenticated access is denied; use guarded invitation RPCs.';

comment on function public.create_identity_invitation(uuid,text,text,integer) is
  'Intentional SECURITY DEFINER boundary: AAL2 + members.manage + hierarchy checks; stores only invitation token hashes.';

comment on function public.list_identity_invitations(uuid) is
  'Intentional SECURITY DEFINER boundary: returns the authorized organization invitation projection.';

comment on function public.revoke_identity_invitation(uuid,uuid) is
  'Intentional SECURITY DEFINER boundary: AAL2 + members.manage + hierarchy checks.';

comment on function public.accept_identity_invitation(text) is
  'Intentional SECURITY DEFINER boundary: one-time token hash lookup plus confirmed-email binding before membership creation.';

commit;
