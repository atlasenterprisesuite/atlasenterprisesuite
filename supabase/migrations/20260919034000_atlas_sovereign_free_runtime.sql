create table if not exists public.atlas_sovereign_ai_runtimes (
  runtime_key text primary key,
  provider_id text not null,
  endpoint_url text not null,
  model_id text not null,
  status text not null default 'provisioning'
    check (status in ('provisioning','verified','degraded','offline','blocked')),
  host_provider text not null default 'render',
  plan text not null default 'free',
  last_verified_at timestamptz,
  last_error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint atlas_sovereign_https_endpoint check (endpoint_url ~ '^https://')
);

alter table public.atlas_sovereign_ai_runtimes enable row level security;
revoke all on table public.atlas_sovereign_ai_runtimes from anon, authenticated;
grant select, insert, update, delete on table public.atlas_sovereign_ai_runtimes to service_role;

create or replace function public.atlas_store_sovereign_free_runtime_token(p_token text)
returns boolean
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'vault', 'pg_temp'
as $$
declare v_id uuid;
begin
  if nullif(p_token,'') is null then raise exception 'sovereign_runtime_token_required'; end if;
  select id into v_id from vault.secrets where name='atlas_sovereign_free_runtime_token' limit 1;
  if v_id is null then
    perform vault.create_secret(p_token,'atlas_sovereign_free_runtime_token','ATLAS Sovereign Free runtime bearer token',null);
  else
    perform vault.update_secret(v_id,p_token,'atlas_sovereign_free_runtime_token','ATLAS Sovereign Free runtime bearer token',null);
  end if;
  return true;
end;
$$;

create or replace function public.atlas_get_sovereign_free_runtime_config()
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
    'status', r.status,
    'host_provider', r.host_provider,
    'plan', r.plan,
    'last_verified_at', r.last_verified_at,
    'last_error_code', r.last_error_code,
    'runtime_token', coalesce((select decrypted_secret from vault.decrypted_secrets where name='atlas_sovereign_free_runtime_token' limit 1),'')
  )
  from public.atlas_sovereign_ai_runtimes r
  where r.runtime_key='render-free-primary'
  limit 1;
$$;

revoke all on function public.atlas_store_sovereign_free_runtime_token(text) from public, anon, authenticated;
revoke all on function public.atlas_get_sovereign_free_runtime_config() from public, anon, authenticated;
grant execute on function public.atlas_store_sovereign_free_runtime_token(text) to service_role;
grant execute on function public.atlas_get_sovereign_free_runtime_config() to service_role;
