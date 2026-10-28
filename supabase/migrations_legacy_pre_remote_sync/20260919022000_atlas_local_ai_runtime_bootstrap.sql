create table if not exists public.atlas_local_ai_runtimes (
  id uuid primary key default gen_random_uuid(),
  runtime_key text not null unique default 'primary',
  provider_id text not null default 'atlas-local',
  endpoint_url text,
  model_id text,
  tunnel_id text,
  tunnel_hostname text,
  status text not null default 'provisioning'
    check (status in ('provisioning','verified','degraded','offline','blocked')),
  source text not null default 'github-self-hosted',
  last_verified_at timestamptz,
  last_error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint atlas_local_ai_https_endpoint
    check (endpoint_url is null or endpoint_url ~ '^https://')
);

alter table public.atlas_local_ai_runtimes enable row level security;
revoke all on table public.atlas_local_ai_runtimes from anon, authenticated;
grant select, insert, update, delete on table public.atlas_local_ai_runtimes to service_role;

create or replace function public.atlas_store_local_ai_runtime_credentials(
  p_runtime_token text,
  p_access_client_id text,
  p_access_client_secret text,
  p_access_service_token_id text
)
returns boolean
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'vault', 'pg_temp'
as $$
declare
  v_id uuid;
begin
  if nullif(p_runtime_token,'') is null
     or nullif(p_access_client_id,'') is null
     or nullif(p_access_client_secret,'') is null
     or nullif(p_access_service_token_id,'') is null then
    raise exception 'atlas_local_ai_credentials_incomplete';
  end if;

  select id into v_id from vault.secrets where name='atlas_local_ai_runtime_token' limit 1;
  if v_id is null then
    perform vault.create_secret(p_runtime_token,'atlas_local_ai_runtime_token','ATLAS Local AI runtime bearer token',null);
  else
    perform vault.update_secret(v_id,p_runtime_token,'atlas_local_ai_runtime_token','ATLAS Local AI runtime bearer token',null);
  end if;

  v_id := null;
  select id into v_id from vault.secrets where name='atlas_local_ai_access_client_id' limit 1;
  if v_id is null then
    perform vault.create_secret(p_access_client_id,'atlas_local_ai_access_client_id','ATLAS Local AI Cloudflare Access client id',null);
  else
    perform vault.update_secret(v_id,p_access_client_id,'atlas_local_ai_access_client_id','ATLAS Local AI Cloudflare Access client id',null);
  end if;

  v_id := null;
  select id into v_id from vault.secrets where name='atlas_local_ai_access_client_secret' limit 1;
  if v_id is null then
    perform vault.create_secret(p_access_client_secret,'atlas_local_ai_access_client_secret','ATLAS Local AI Cloudflare Access client secret',null);
  else
    perform vault.update_secret(v_id,p_access_client_secret,'atlas_local_ai_access_client_secret','ATLAS Local AI Cloudflare Access client secret',null);
  end if;

  v_id := null;
  select id into v_id from vault.secrets where name='atlas_local_ai_access_service_token_id' limit 1;
  if v_id is null then
    perform vault.create_secret(p_access_service_token_id,'atlas_local_ai_access_service_token_id','ATLAS Local AI Cloudflare Access service token id',null);
  else
    perform vault.update_secret(v_id,p_access_service_token_id,'atlas_local_ai_access_service_token_id','ATLAS Local AI Cloudflare Access service token id',null);
  end if;

  return true;
end;
$$;

create or replace function public.atlas_local_ai_runtime_credentials_present()
returns boolean
language sql
security definer
set search_path to 'pg_catalog', 'public', 'vault', 'pg_temp'
as $$
  select exists(select 1 from vault.secrets where name='atlas_local_ai_runtime_token')
     and exists(select 1 from vault.secrets where name='atlas_local_ai_access_client_id')
     and exists(select 1 from vault.secrets where name='atlas_local_ai_access_client_secret')
     and exists(select 1 from vault.secrets where name='atlas_local_ai_access_service_token_id');
$$;

create or replace function public.atlas_get_local_ai_runtime_config()
returns jsonb
language sql
security definer
set search_path to 'pg_catalog', 'public', 'vault', 'pg_temp'
as $$
  select jsonb_build_object(
    'runtime_key', r.runtime_key,
    'provider_id', r.provider_id,
    'endpoint_url', r.endpoint_url,
    'model_id', r.model_id,
    'tunnel_id', r.tunnel_id,
    'tunnel_hostname', r.tunnel_hostname,
    'status', r.status,
    'last_verified_at', r.last_verified_at,
    'last_error_code', r.last_error_code,
    'runtime_token', coalesce((select decrypted_secret from vault.decrypted_secrets where name='atlas_local_ai_runtime_token' limit 1),''),
    'access_client_id', coalesce((select decrypted_secret from vault.decrypted_secrets where name='atlas_local_ai_access_client_id' limit 1),''),
    'access_client_secret', coalesce((select decrypted_secret from vault.decrypted_secrets where name='atlas_local_ai_access_client_secret' limit 1),''),
    'access_service_token_id', coalesce((select decrypted_secret from vault.decrypted_secrets where name='atlas_local_ai_access_service_token_id' limit 1),'')
  )
  from public.atlas_local_ai_runtimes r
  where r.runtime_key='primary'
  limit 1;
$$;

revoke all on function public.atlas_store_local_ai_runtime_credentials(text,text,text,text) from public, anon, authenticated;
revoke all on function public.atlas_local_ai_runtime_credentials_present() from public, anon, authenticated;
revoke all on function public.atlas_get_local_ai_runtime_config() from public, anon, authenticated;

grant execute on function public.atlas_store_local_ai_runtime_credentials(text,text,text,text) to service_role;
grant execute on function public.atlas_local_ai_runtime_credentials_present() to service_role;
grant execute on function public.atlas_get_local_ai_runtime_config() to service_role;
