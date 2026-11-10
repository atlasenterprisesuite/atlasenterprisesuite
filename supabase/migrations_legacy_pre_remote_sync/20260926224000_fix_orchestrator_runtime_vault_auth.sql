-- Fix ATLAS orchestrator runtime authentication against Supabase Vault.
-- vault.decrypted_secrets exposes plaintext through decrypted_secret; comparing
-- against the encrypted storage field makes every legitimate runtime token fail.
-- Keep authorization fail-closed and compare SHA-256 digests only.

create or replace function private.atlas_orchestrator_runtime_authorized()
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  provided_token text;
  expected_token text;
begin
  provided_token := nullif(
    (nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-atlas-runtime-token'),
    ''
  );

  if provided_token is null then
    return false;
  end if;

  select decrypted_secret
    into expected_token
    from vault.decrypted_secrets
   where name = 'atlas_orchestrator_runtime_token'
   order by updated_at desc
   limit 1;

  if expected_token is null then
    return false;
  end if;

  return extensions.digest(provided_token, 'sha256')
       = extensions.digest(expected_token, 'sha256');
end;
$$;

revoke all on function private.atlas_orchestrator_runtime_authorized() from public, anon, authenticated;
