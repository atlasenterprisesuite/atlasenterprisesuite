insert into public.atlas_local_ai_runtimes (
  runtime_key,
  provider_id,
  endpoint_url,
  model_id,
  status,
  source,
  last_error_code,
  metadata,
  updated_at
)
values (
  'primary',
  'atlas-local',
  null,
  'atlas-local-default',
  'offline',
  'github-self-hosted',
  'host_offline',
  jsonb_build_object(
    'bootstrap_workflow', 'atlas-local-ai-bootstrap.yml',
    'bootstrap_state', 'waiting_for_self_hosted_runner',
    'automatic_api_cost_usd', 0,
    'fail_closed', true
  ),
  now()
)
on conflict (runtime_key) do update
set
  model_id = coalesce(public.atlas_local_ai_runtimes.model_id, excluded.model_id),
  status = case
    when public.atlas_local_ai_runtimes.status = 'verified' then 'verified'
    else 'offline'
  end,
  last_error_code = case
    when public.atlas_local_ai_runtimes.status = 'verified' then public.atlas_local_ai_runtimes.last_error_code
    else 'host_offline'
  end,
  metadata = coalesce(public.atlas_local_ai_runtimes.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now();
