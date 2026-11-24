create or replace function public.atlas_run_public_infra_verification()
returns uuid
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
set statement_timeout to '25s'
as $function$
declare
  v_started timestamptz := clock_timestamp();
  v_root_response extensions.http_response;
  v_root_status integer;
  v_root_version_id text;
  v_root_version_tag text;
  v_status_status integer;
  v_deployment_status integer;
  v_deployment_content_type text;
  v_deployment_content text;
  v_deployment_json jsonb := '{}'::jsonb;
  v_health_status integer;
  v_health_content text;
  v_health_json jsonb := '{}'::jsonb;
  v_release_version text;
  v_expected_probe text;
  v_cf_access_client_id text;
  v_cf_access_client_secret text;
  v_service_token_configured boolean := false;
  v_edge_ok boolean := false;
  v_access_login boolean := false;
  v_deployment_path_protected boolean := false;
  v_artifact_verified_by_header boolean := false;
  v_artifact_verified_by_manifest boolean := false;
  v_artifact_verified boolean := false;
  v_result_status text;
  v_provider_state text;
  v_error_code text;
  v_error_detail text;
  v_id uuid;
begin
  perform set_config('http.curlopt_timeout_msec','5000',true);
  perform set_config('http.curlopt_connecttimeout_msec','2000',true);

  begin
    select
      max(case when lower(name) in ('cloudflare_access_client_id','cf_access_client_id') then decrypted_secret end),
      max(case when lower(name) in ('cloudflare_access_client_secret','cf_access_client_secret') then decrypted_secret end)
    into v_cf_access_client_id, v_cf_access_client_secret
    from vault.decrypted_secrets
    where lower(name) in ('cloudflare_access_client_id','cf_access_client_id','cloudflare_access_client_secret','cf_access_client_secret');
  exception when others then
    v_cf_access_client_id := null;
    v_cf_access_client_secret := null;
  end;
  v_service_token_configured := nullif(v_cf_access_client_id,'') is not null
    and nullif(v_cf_access_client_secret,'') is not null;

  begin
    select * into v_root_response
    from extensions.http((
      'GET',
      'https://www.atlasenterprisesuite.com/',
      array[('User-Agent','ATLAS-Supabase-Native-Verifier/2.0')::extensions.http_header],
      null,
      null
    )::extensions.http_request);

    v_root_status := v_root_response.status;

    select (h).value into v_root_version_id
    from unnest(v_root_response.headers) h
    where lower((h).field)='x-atlas-version-id'
    limit 1;

    select (h).value into v_root_version_tag
    from unnest(v_root_response.headers) h
    where lower((h).field)='x-atlas-version-tag'
    limit 1;
  exception when others then
    v_root_status := null;
    v_root_version_id := null;
    v_root_version_tag := null;
  end;

  begin
    select status into v_status_status
    from extensions.http_get('https://www.atlasenterprisesuite.com/status');
  exception when others then
    v_status_status := null;
  end;

  begin
    if v_service_token_configured then
      select status, content_type, content
        into v_deployment_status, v_deployment_content_type, v_deployment_content
      from extensions.http((
        'GET',
        'https://www.atlasenterprisesuite.com/deployment.json',
        array[
          ('CF-Access-Client-Id',v_cf_access_client_id)::extensions.http_header,
          ('CF-Access-Client-Secret',v_cf_access_client_secret)::extensions.http_header,
          ('User-Agent','ATLAS-Manager/Direct-Deploy-Verifier')::extensions.http_header
        ],
        null,
        null
      )::extensions.http_request);
    else
      select status, content_type, content
        into v_deployment_status, v_deployment_content_type, v_deployment_content
      from extensions.http_get('https://www.atlasenterprisesuite.com/deployment.json');
    end if;

    if v_deployment_content is not null then
      v_access_login := coalesce(
        v_deployment_content_type ilike 'text/html%'
        and (
          v_deployment_content ilike '%Cloudflare Access%'
          or v_deployment_content ilike '%Sign in%Cloudflare Access%'
        ),
        false
      );

      if not v_access_login and v_deployment_content_type ilike 'application/json%' then
        begin
          v_deployment_json := v_deployment_content::jsonb;
        exception when others then
          v_deployment_json := '{}'::jsonb;
        end;
      end if;
    end if;
  exception when others then
    v_deployment_status := null;
    v_deployment_content_type := null;
    v_deployment_content := null;
    v_deployment_json := '{}'::jsonb;
    v_access_login := false;
  end;

  begin
    select status, content into v_health_status, v_health_content
    from extensions.http_get('https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-public-health');
    if v_health_content is not null then
      begin
        v_health_json := v_health_content::jsonb;
      exception when others then
        v_health_json := '{}'::jsonb;
      end;
    end if;
  exception when others then
    v_health_status := null;
    v_health_json := '{}'::jsonb;
  end;

  select version into v_release_version
  from public.atlas_release_registry
  order by released_at desc nulls last
  limit 1;

  select checks->>'deployment_probe' into v_expected_probe
  from public.atlas_runtime_verification_runs
  where verification_type='infrastructure-deployment'
    and environment='production'
    and status='passed'
    and nullif(checks->>'deployment_probe','') is not null
  order by created_at desc
  limit 1;

  v_edge_ok := coalesce(v_root_status between 200 and 399,false)
    and coalesce(v_status_status between 200 and 399,false)
    and coalesce(v_health_status between 200 and 299,false)
    and coalesce((v_health_json->>'ok')::boolean,false);

  v_artifact_verified_by_header :=
    nullif(v_expected_probe,'') is not null
    and nullif(v_root_version_id,'') is not null
    and coalesce(v_root_version_tag,'') = v_expected_probe;

  v_artifact_verified_by_manifest := coalesce(v_deployment_status between 200 and 299,false)
    and not v_access_login
    and coalesce(v_deployment_json->>'service','') = 'atlas-enterprise-suite-web'
    and coalesce(v_deployment_json->>'target','') = 'cloudflare-workers-static-assets'
    and coalesce(v_deployment_json->>'source','') in ('atlas-direct-deploy','supabase-direct','cloudflare-direct','github-main')
    and nullif(v_expected_probe,'') is not null
    and coalesce(v_deployment_json->>'deployment_probe','') = v_expected_probe;

  v_deployment_path_protected :=
    coalesce(v_deployment_status in (302,401,403),false)
    or v_access_login;

  v_artifact_verified := v_artifact_verified_by_header or v_artifact_verified_by_manifest;

  if v_edge_ok and v_artifact_verified and (v_deployment_path_protected or v_artifact_verified_by_manifest) then
    v_result_status := 'passed';
    v_provider_state := 'verified';
    v_error_code := null;
    v_error_detail := null;
  elsif v_edge_ok and nullif(v_expected_probe,'') is null then
    v_result_status := 'blocked';
    v_provider_state := 'deployment_evidence_missing';
    v_error_code := 'deployment_probe_evidence_missing';
    v_error_detail := 'Public edge is reachable but no passed deployment probe exists to correlate the served artifact.';
  elsif v_edge_ok and nullif(v_root_version_tag,'') is null and v_access_login and not v_service_token_configured then
    v_result_status := 'blocked';
    v_provider_state := 'artifact_attestation_missing';
    v_error_code := 'public_version_attestation_missing';
    v_error_detail := 'Deployment manifest remains protected and no public version attestation header is available.';
  else
    v_result_status := 'failed';
    v_provider_state := 'degraded';
    v_error_code := 'public_probe_failed';
    v_error_detail := 'One or more public ATLAS infrastructure probes failed, or public version attestation does not match the latest approved deployment probe.';
  end if;

  insert into public.atlas_runtime_verification_runs(
    verification_type,target_service,target_version,environment,status,
    started_at,completed_at,duration_ms,provider,provider_state,storage_state,
    checks,metadata,error_code,error_detail
  ) values (
    'infrastructure-public','atlas-enterprise-suite-web',v_release_version,'production',
    v_result_status,
    v_started,clock_timestamp(),greatest(0,round(extract(epoch from (clock_timestamp()-v_started))*1000)::int),
    'public-http',v_provider_state,'configured',
    jsonb_build_object(
      'root_status',v_root_status,
      'status_page_status',v_status_status,
      'public_health_status',v_health_status,
      'public_health_overall',v_health_json->>'overall',
      'public_version_id_present',nullif(v_root_version_id,'') is not null,
      'public_version_tag',v_root_version_tag,
      'deployment_status',v_deployment_status,
      'deployment_content_type',v_deployment_content_type,
      'deployment_path_protected',v_deployment_path_protected,
      'cloudflare_access_login_detected',v_access_login,
      'cloudflare_access_service_token_configured',v_service_token_configured,
      'artifact_verified',v_artifact_verified,
      'artifact_verified_by_header',v_artifact_verified_by_header,
      'artifact_verified_by_manifest',v_artifact_verified_by_manifest,
      'expected_deployment_probe',v_expected_probe,
      'deployment_probe',v_deployment_json->>'deployment_probe',
      'deployment_source',v_deployment_json->>'source',
      'deployment_target',v_deployment_json->>'target'
    ),
    jsonb_build_object(
      'source','supabase-cron-http',
      'architecture','ATLAS Direct Deploy',
      'github_required',false,
      'public_only',true,
      'health_service',v_health_json->>'service',
      'health_version',v_health_json->>'version',
      'evidence_semantics','public_version_header_plus_correlated_deployment_probe_with_private_manifest_preserved'
    ),
    v_error_code,
    v_error_detail
  ) returning id into v_id;

  return v_id;
end;
$function$;
