create or replace function private.atlas_orchestrator_github_setup_authorized()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() = 'service_role' then
    return true;
  end if;
  return private.atlas_orchestrator_runtime_authorized();
end;
$$;

revoke all on function private.atlas_orchestrator_github_setup_authorized()
  from public, anon, authenticated;

create or replace function private.atlas_orchestrator_set_github_secret(
  p_name text,
  p_secret text,
  p_description text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if nullif(btrim(p_name), '') is null or nullif(p_secret, '') is null then
    raise invalid_parameter_value using message = 'atlas_github_secret_invalid';
  end if;

  select id into v_id
    from vault.secrets
   where name = p_name
   order by updated_at desc
   limit 1;

  if v_id is null then
    perform vault.create_secret(p_secret, p_name, p_description);
  else
    perform vault.update_secret(v_id, p_secret, p_name, p_description);
  end if;
end;
$$;

revoke all on function private.atlas_orchestrator_set_github_secret(text,text,text)
  from public, anon, authenticated;

create or replace function public.atlas_orchestrator_store_github_app_credentials(
  p_app_id text,
  p_private_key text,
  p_webhook_secret text,
  p_client_id text default null,
  p_client_secret text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.atlas_orchestrator_github_setup_authorized() then
    raise insufficient_privilege using message = 'atlas_orchestrator_runtime_unauthorized';
  end if;

  perform private.atlas_orchestrator_set_github_secret(
    'atlas_github_app_id', p_app_id, 'ATLAS GitHub App id'
  );
  perform private.atlas_orchestrator_set_github_secret(
    'atlas_github_private_key', p_private_key, 'ATLAS GitHub App PEM private key'
  );
  perform private.atlas_orchestrator_set_github_secret(
    'atlas_github_webhook_secret', p_webhook_secret, 'ATLAS GitHub App webhook secret'
  );

  if nullif(p_client_id, '') is not null then
    perform private.atlas_orchestrator_set_github_secret(
      'atlas_github_client_id', p_client_id, 'ATLAS GitHub App client id'
    );
  end if;
  if nullif(p_client_secret, '') is not null then
    perform private.atlas_orchestrator_set_github_secret(
      'atlas_github_client_secret', p_client_secret, 'ATLAS GitHub App client secret'
    );
  end if;
end;
$$;

create or replace function public.atlas_orchestrator_get_github_app_credentials()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not private.atlas_orchestrator_github_setup_authorized() then
    raise insufficient_privilege using message = 'atlas_orchestrator_runtime_unauthorized';
  end if;

  select jsonb_build_object(
    'app_id', max(decrypted_secret) filter (where name = 'atlas_github_app_id'),
    'private_key', max(decrypted_secret) filter (where name = 'atlas_github_private_key'),
    'webhook_secret', max(decrypted_secret) filter (where name = 'atlas_github_webhook_secret'),
    'client_id', max(decrypted_secret) filter (where name = 'atlas_github_client_id'),
    'client_secret', max(decrypted_secret) filter (where name = 'atlas_github_client_secret')
  )
  into result
  from vault.decrypted_secrets
  where name in (
    'atlas_github_app_id',
    'atlas_github_private_key',
    'atlas_github_webhook_secret',
    'atlas_github_client_id',
    'atlas_github_client_secret'
  );

  return result;
end;
$$;

create or replace function public.atlas_orchestrator_store_github_installation(
  p_installation_id bigint,
  p_repository_full_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.atlas_orchestrator_github_setup_authorized() then
    raise insufficient_privilege using message = 'atlas_orchestrator_runtime_unauthorized';
  end if;
  if p_installation_id <= 0 or nullif(btrim(p_repository_full_name), '') is null then
    raise invalid_parameter_value using message = 'atlas_github_installation_invalid';
  end if;

  perform private.atlas_orchestrator_set_github_secret(
    'atlas_github_installation_id',
    p_installation_id::text,
    'ATLAS GitHub App installation id'
  );
  perform private.atlas_orchestrator_set_github_secret(
    'atlas_github_repository',
    p_repository_full_name,
    'ATLAS canonical GitHub repository'
  );
end;
$$;

revoke all on function public.atlas_orchestrator_store_github_app_credentials(text,text,text,text,text)
  from public, authenticated;
revoke all on function public.atlas_orchestrator_get_github_app_credentials()
  from public, authenticated;
revoke all on function public.atlas_orchestrator_store_github_installation(bigint,text)
  from public, authenticated;

grant execute on function public.atlas_orchestrator_store_github_app_credentials(text,text,text,text,text)
  to anon, service_role;
grant execute on function public.atlas_orchestrator_get_github_app_credentials()
  to anon, service_role;
grant execute on function public.atlas_orchestrator_store_github_installation(bigint,text)
  to anon, service_role;
