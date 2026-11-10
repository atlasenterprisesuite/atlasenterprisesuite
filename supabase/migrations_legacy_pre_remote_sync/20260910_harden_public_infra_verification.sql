create or replace function public.atlas_run_public_infra_verification()
returns uuid
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
set statement_timeout to '25s'
as $function$
declare
  v_started timestamptz := clock_timestamp();
  v_root_status integer;
  v_status_status integer;
  v_deployment_status integer;
  v_deployment_content_type text;
  v_deployment_content text;
  v_deployment_json jsonb := '{}'::jsonb;
  v_health_status integer;
  v_health_content text;
  v_health_json jsonb := '{}'::jsonb;
  v_release_version text;
  v_edge_ok boolean := false;
  v_access_login boolean := false;
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
    select status into v_root_status
    from extensions.http_get('https://www.atlasenterprisesuite.com/');
  exception when others then
    v_root_status := null;
  end;

  begin
    select status into v_status_status
    from extensions.http_get('https://www.atlasenterprisesuite.com/status');
  exception when others then
    v_status_status := null;
  end;

  begin
    select status, content_type, content
      into v_deployment_status, v_deployment_content_type, v_deployment_content
    from extensions.http_get('https://www.atlasenterprisesuite.com/deployment.json');

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

  v_edge_ok := coalesce(v_root_status between 200 and 399,false)
    and coalesce(v_status_status between 200 and 399,false)
    and coalesce(v_health_status between 200 and 299,false)
    and coalesce((v_health_json->>'ok')::boolean,false);

  v_artifact_verified := coalesce(v_deployment_status between 200 and 299,false)
    and not v_access_login
    and coalesce(v_deployment_json->>'service','') = 'atlas-enterprise-suite-web'
    and coalesce(v_deployment_json->>'source','') = 'github-main'
    and nullif(v_deployment_json->>'deployment_probe','') is not null;

  if v_edge_ok and v_artifact_verified then
    v_result_status := 'passed';
    v_provider_state := 'verified';
    v_error_code := null;
    v_error_detail := null;
  elsif v_edge_ok and v_access_login then
    v_result_status := 'blocked';
    v_provider_state := 'edge_reachable_artifact_unverified';
    v_error_code := 'artifact_verification_blocked_by_access';
    v_error_detail := 'Cloudflare edge is reachable, but Cloudflare Access returned the sign-in surface for deployment.json; artifact deployment is not independently verified by this public probe.';
  else
    v_result_status := 'failed';
    v_provider_state := 'degraded';
    v_error_code := 'public_probe_failed';
    v_error_detail := 'One or more public ATLAS infrastructure probes did not pass or the expected deployment artifact signature was not verified.';
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
      'deployment_status',v_deployment_status,
      'deployment_content_type',v_deployment_content_type,
      'cloudflare_access_login_detected',v_access_login,
      'artifact_verified',v_artifact_verified,
      'deployment_probe',v_deployment_json->>'deployment_probe'
    ),
    jsonb_build_object(
      'source','supabase-cron-http',
      'public_only',true,
      'health_service',v_health_json->>'service',
      'health_version',v_health_json->>'version',
      'evidence_semantics','edge_reachability_and_artifact_signature_are_separate'
    ),
    v_error_code,
    v_error_detail
  ) returning id into v_id;

  return v_id;
end;
$function$;
