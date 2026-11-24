create or replace function public.atlas_store_cloudflare_access_credentials(
  p_client_id text,
  p_client_secret text,
  p_service_token_id text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, vault, pg_temp
as $$
declare
  v_id uuid;
begin
  if nullif(p_client_id,'') is null or nullif(p_client_secret,'') is null or nullif(p_service_token_id,'') is null then
    raise exception 'cloudflare_access_credentials_incomplete';
  end if;

  select id into v_id from vault.secrets where name='cloudflare_access_client_id' limit 1;
  if v_id is null then
    perform vault.create_secret(p_client_id,'cloudflare_access_client_id','ATLAS Direct Deploy Cloudflare Access service-token client id',null);
  else
    perform vault.update_secret(v_id,p_client_id,'cloudflare_access_client_id','ATLAS Direct Deploy Cloudflare Access service-token client id',null);
  end if;

  v_id := null;
  select id into v_id from vault.secrets where name='cloudflare_access_client_secret' limit 1;
  if v_id is null then
    perform vault.create_secret(p_client_secret,'cloudflare_access_client_secret','ATLAS Direct Deploy Cloudflare Access service-token client secret',null);
  else
    perform vault.update_secret(v_id,p_client_secret,'cloudflare_access_client_secret','ATLAS Direct Deploy Cloudflare Access service-token client secret',null);
  end if;

  v_id := null;
  select id into v_id from vault.secrets where name='cloudflare_access_service_token_id' limit 1;
  if v_id is null then
    perform vault.create_secret(p_service_token_id,'cloudflare_access_service_token_id','ATLAS Direct Deploy Cloudflare Access service-token id',null);
  else
    perform vault.update_secret(v_id,p_service_token_id,'cloudflare_access_service_token_id','ATLAS Direct Deploy Cloudflare Access service-token id',null);
  end if;

  return true;
end;
$$;
revoke all on function public.atlas_store_cloudflare_access_credentials(text,text,text) from public, anon, authenticated;
grant execute on function public.atlas_store_cloudflare_access_credentials(text,text,text) to service_role;
