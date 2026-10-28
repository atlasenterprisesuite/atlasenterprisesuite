-- ATLAS Identity security-event privilege hardening.
-- RLS already denies direct reads; remove table privileges as a second independent boundary.
begin;

revoke all on public.identity_security_events from public, anon, authenticated;

grant execute on function public.list_identity_security_events(uuid,integer) to authenticated;

comment on table public.identity_security_events is
  'ATLAS Identity audit store. Direct public/anon/authenticated table access is revoked; use guarded audit RPCs.';

commit;
