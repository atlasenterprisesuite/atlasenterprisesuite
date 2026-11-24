create extension if not exists pg_net;
create extension if not exists pg_cron;

select vault.create_secret(
  encode(extensions.gen_random_bytes(32),'hex'),
  'atlas_runtime_verifier_token_v1',
  'ATLAS native runtime verifier caller token'
)
where not exists (
  select 1 from vault.secrets where name='atlas_runtime_verifier_token_v1'
);

create or replace function public.atlas_verify_runtime_invocation(p_token text)
returns boolean
language plpgsql
security definer
stable
set search_path = public, vault, extensions, pg_temp
as $$
declare
  v_secret text;
begin
  if p_token is null or length(p_token) < 32 then
    return false;
  end if;
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name='atlas_runtime_verifier_token_v1'
  limit 1;
  if v_secret is null then return false; end if;
  return extensions.digest(convert_to(p_token,'utf8'),'sha256') = extensions.digest(convert_to(v_secret,'utf8'),'sha256');
end;
$$;
revoke all on function public.atlas_verify_runtime_invocation(text) from public, anon, authenticated;
grant execute on function public.atlas_verify_runtime_invocation(text) to service_role;
