-- ATLAS 777 REVIEW / Teleprompter P0 grant hardening.
-- Catalog evidence 2026-10-28: public.creator_recordings has RLS enabled, but
-- anon has all table grants, including TRUNCATE (which bypasses RLS).
-- No public recording access is part of the Creator contract.
-- Idempotent, transactional, and intentionally limited to one existing table.
begin;

revoke all privileges on table public.creator_recordings from public;
revoke all privileges on table public.creator_recordings from anon;

-- Fail closed if role inheritance or later grants undermine the fix.
do $atlas_private_recording_grants$
begin
  if has_table_privilege('anon', 'public.creator_recordings', 'SELECT')
     or has_table_privilege('anon', 'public.creator_recordings', 'INSERT')
     or has_table_privilege('anon', 'public.creator_recordings', 'UPDATE')
     or has_table_privilege('anon', 'public.creator_recordings', 'DELETE')
     or has_table_privilege('anon', 'public.creator_recordings', 'TRUNCATE')
     or has_table_privilege('anon', 'public.creator_recordings', 'REFERENCES')
     or has_table_privilege('anon', 'public.creator_recordings', 'TRIGGER') then
    raise exception 'creator_recordings_anon_privileges_remain';
  end if;

  -- Creator Edge writes with the service role; authorized user reads via RLS.
  if not has_table_privilege('service_role', 'public.creator_recordings', 'INSERT')
     or not has_table_privilege('authenticated', 'public.creator_recordings', 'SELECT') then
    raise exception 'creator_recordings_required_privileges_missing';
  end if;
end;
$atlas_private_recording_grants$;

commit;
