create or replace function public.atlas_run_public_infra_verification()
returns uuid
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
set statement_timeout to '20s'
as $$
declare
  v_started timestamptz := clock_timestamp();
  v_root_status integer;
  v_status_status integer;
  v_health_status integer;
  v_health_content text;
  v_health_json jsonb := '{}'::jsonb;
  v_release_version text;
  v_ok boolean := false;
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

  v_ok := coalesce(v_root_status between 200 and 399,false)
    and coalesce(v_status_status between 200 and 399,false)
    and coalesce(v_health_status between 200 and 299,false)
    and coalesce((v_health_json->>'ok')::boolean,false);

  insert into public.atlas_runtime_verification_runs(
    verification_type,target_service,target_version,environment,status,
    started_at,completed_at,duration_ms,provider,provider_state,storage_state,
    checks,metadata,error_code,error_detail
  ) values (
    'infrastructure-public','atlas-enterprise-suite-web',v_release_version,'production',
    case when v_ok then 'passed' else 'failed' end,
    v_started,clock_timestamp(),greatest(0,round(extract(epoch from (clock_timestamp()-v_started))*1000)::int),
    'public-http','verified','configured',
    jsonb_build_object(
      'root_status',v_root_status,
      'status_page_status',v_status_status,
      'public_health_status',v_health_status,
      'public_health_overall',v_health_json->>'overall'
    ),
    jsonb_build_object(
      'source','supabase-cron-http',
      'public_only',true,
      'health_service',v_health_json->>'service',
      'health_version',v_health_json->>'version'
    ),
    case when v_ok then null else 'public_probe_failed' end,
    case when v_ok then null else 'One or more public ATLAS infrastructure probes did not pass.' end
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.atlas_run_public_infra_verification() from public, anon, authenticated;
grant execute on function public.atlas_run_public_infra_verification() to service_role;

select cron.unschedule(jobid) from cron.job where jobname='atlas-infra-public-verification-15m';
select cron.schedule(
  'atlas-infra-public-verification-15m',
  '7,22,37,52 * * * *',
  'select public.atlas_run_public_infra_verification();'
);
