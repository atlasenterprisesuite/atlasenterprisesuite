do $$
declare
  v_runtime_token text;
  v_secret_id uuid;
begin
  select decrypted_secret
    into v_runtime_token
    from vault.decrypted_secrets
   where name = 'atlas_orchestrator_runtime_token'
   limit 1;

  if nullif(v_runtime_token, '') is null then
    raise exception 'atlas_orchestrator_runtime_token_missing';
  end if;

  select id into v_secret_id
    from vault.secrets
   where name = 'atlas_local_ai_runtime_token'
   limit 1;

  if v_secret_id is null then
    perform vault.create_secret(
      v_runtime_token,
      'atlas_local_ai_runtime_token',
      'ATLAS Local AI runtime bearer token shared with the governed Render sovereign host',
      null
    );
  else
    perform vault.update_secret(
      v_secret_id,
      v_runtime_token,
      'atlas_local_ai_runtime_token',
      'ATLAS Local AI runtime bearer token shared with the governed Render sovereign host',
      null
    );
  end if;

  insert into public.atlas_local_ai_runtimes (
    runtime_key,
    provider_id,
    endpoint_url,
    model_id,
    status,
    source,
    last_verified_at,
    last_error_code,
    metadata,
    updated_at
  ) values (
    'primary',
    'atlas-local',
    'https://atlas-sovereign-orchestrator.onrender.com/local-ai',
    'atlas-local-free',
    'provisioning',
    'render-free',
    null,
    null,
    jsonb_build_object(
      'render_service_id', 'srv-damg24ou01pc73a54hgg',
      'render_plan', 'free',
      'model_repo', 'QuantFactory/SmolLM2-135M-Instruct-GGUF',
      'model_file', 'SmolLM2-135M-Instruct-Q4_K_M.gguf',
      'context_size', 512,
      'automatic_model_api_cost_usd', 0
    ),
    now()
  )
  on conflict (runtime_key) do update set
    provider_id = excluded.provider_id,
    endpoint_url = excluded.endpoint_url,
    model_id = excluded.model_id,
    status = excluded.status,
    source = excluded.source,
    last_verified_at = null,
    last_error_code = null,
    metadata = excluded.metadata,
    updated_at = now();
end
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
    'source', r.source,
    'metadata', r.metadata,
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

revoke all on function public.atlas_get_local_ai_runtime_config() from public, anon, authenticated;
grant execute on function public.atlas_get_local_ai_runtime_config() to service_role;
