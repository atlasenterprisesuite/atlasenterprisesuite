create or replace function public.atlas_get_runtime_verifier_token()
returns text
language sql
security definer
set search_path = public, vault, pg_temp
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'atlas_runtime_verifier_token_v1'
  order by created_at desc
  limit 1;
$$;
revoke all on function public.atlas_get_runtime_verifier_token() from public, anon, authenticated;
grant execute on function public.atlas_get_runtime_verifier_token() to service_role;
