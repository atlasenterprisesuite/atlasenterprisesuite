create or replace function public.atlas_store_cloudflare_control_credentials(
  p_api_token text,
  p_zone_id text default null,
  p_account_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, vault, pg_temp
as $$
declare
  v_id uuid;
  v_token text := btrim(coalesce(p_api_token,''));
begin
  if length(v_token) < 20 or length(v_token) > 500 then
    raise exception 'cloudflare_api_token_invalid_length';
  end if;

  select id into v_id from vault.secrets where name='cloudflare_api_token' limit 1;
  if v_id is null then
    perform vault.create_secret(v_token,'cloudflare_api_token','ATLAS Direct Deploy Cloudflare API token',null);
  else
    perform vault.update_secret(v_id,v_token,'cloudflare_api_token','ATLAS Direct Deploy Cloudflare API token',null);
  end if;

  if nullif(btrim(coalesce(p_zone_id,'')),'') is not null then
    v_id := null;
    select id into v_id from vault.secrets where name='cloudflare_zone_id' limit 1;
    if v_id is null then
      perform vault.create_secret(btrim(p_zone_id),'cloudflare_zone_id','ATLAS Cloudflare zone id',null);
    else
      perform vault.update_secret(v_id,btrim(p_zone_id),'cloudflare_zone_id','ATLAS Cloudflare zone id',null);
    end if;
  end if;

  if nullif(btrim(coalesce(p_account_id,'')),'') is not null then
    v_id := null;
    select id into v_id from vault.secrets where name='cloudflare_account_id' limit 1;
    if v_id is null then
      perform vault.create_secret(btrim(p_account_id),'cloudflare_account_id','ATLAS Cloudflare account id',null);
    else
      perform vault.update_secret(v_id,btrim(p_account_id),'cloudflare_account_id','ATLAS Cloudflare account id',null);
    end if;
  end if;

  return true;
end;
$$;
revoke all on function public.atlas_store_cloudflare_control_credentials(text,text,text) from public, anon, authenticated;
grant execute on function public.atlas_store_cloudflare_control_credentials(text,text,text) to service_role;

create or replace function public.atlas_get_cloudflare_control_credentials()
returns jsonb
language sql
security definer
set search_path = pg_catalog, public, vault, pg_temp
as $$
  select jsonb_build_object(
    'api_token', coalesce((select decrypted_secret from vault.decrypted_secrets where name='cloudflare_api_token' limit 1),''),
    'zone_id', coalesce((select decrypted_secret from vault.decrypted_secrets where name='cloudflare_zone_id' limit 1),''),
    'account_id', coalesce((select decrypted_secret from vault.decrypted_secrets where name='cloudflare_account_id' limit 1),'')
  );
$$;
revoke all on function public.atlas_get_cloudflare_control_credentials() from public, anon, authenticated;
grant execute on function public.atlas_get_cloudflare_control_credentials() to service_role;

create or replace function public.atlas_cloudflare_access_credentials_present()
returns boolean
language sql
security definer
set search_path = pg_catalog, public, vault, pg_temp
as $$
  select exists(select 1 from vault.secrets where name='cloudflare_access_client_id')
     and exists(select 1 from vault.secrets where name='cloudflare_access_client_secret')
     and exists(select 1 from vault.secrets where name='cloudflare_access_service_token_id');
$$;
revoke all on function public.atlas_cloudflare_access_credentials_present() from public, anon, authenticated;
grant execute on function public.atlas_cloudflare_access_credentials_present() to service_role;

create or replace function public.atlas_internal_runtime_verifier_token()
returns text
language sql
security definer
set search_path = pg_catalog, public, vault, pg_temp
as $$
  select decrypted_secret from vault.decrypted_secrets where name='atlas_runtime_verifier_token_v1' limit 1;
$$;
revoke all on function public.atlas_internal_runtime_verifier_token() from public, anon, authenticated;
grant execute on function public.atlas_internal_runtime_verifier_token() to service_role;
