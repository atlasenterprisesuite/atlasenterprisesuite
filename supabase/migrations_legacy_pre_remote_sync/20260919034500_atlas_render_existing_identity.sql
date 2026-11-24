-- Reuse the governed Render orchestrator identity as the ATLAS Local bearer
-- without materializing a second plaintext-equivalent secret. Service-role-only
-- runtime configuration resolves the dedicated local token first when present,
-- then falls back to the existing orchestrator identity.
update public.atlas_local_ai_runtimes
set provider_id = 'atlas-local',
    endpoint_url = 'https://atlas-sovereign-orchestrator.onrender.com/local-ai',
    model_id = 'atlas-local-free',
    status = 'provisioning',
    source = 'render-free',
    last_verified_at = null,
    last_error_code = null,
    metadata = jsonb_build_object(
      'render_service_id', 'srv-damg24ou01pc73a54hgg',
      'render_plan', 'free',
      'model_repo', 'QuantFactory/SmolLM2-135M-Instruct-GGUF',
      'model_file', 'SmolLM2-135M-Instruct-Q4_K_M.gguf',
      'context_size', 512,
      'automatic_model_api_cost_usd', 0,
      'credential_mode', 'existing_orchestrator_identity'
    ),
    updated_at = now()
where runtime_key = 'primary';

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
    'runtime_token', coalesce(
      (select decrypted_secret from vault.decrypted_secrets where name='atlas_local_ai_runtime_token' limit 1),
      (select decrypted_secret from vault.decrypted_secrets where name='atlas_orchestrator_runtime_token' limit 1),
      ''
    ),
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
