-- ATLAS Identity invitation actor indexes.
begin;

create index if not exists identity_invitations_invited_by_idx
  on public.identity_invitations(invited_by);

create index if not exists identity_invitations_accepted_by_idx
  on public.identity_invitations(accepted_by);

commit;
