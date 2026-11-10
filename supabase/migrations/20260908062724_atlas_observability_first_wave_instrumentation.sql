create or replace function public.atlas_telemetry_from_ai_request()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  t uuid;
  metric_name text;
  in_tokens int;
  out_tokens int;
begin
  begin
    if new.status not in ('completed','failed') then return new; end if;
    if tg_op='UPDATE' and old.status is not distinct from new.status then return new; end if;

    t := coalesce(new.trace_id,gen_random_uuid());
    if coalesce(new.usage->>'input_tokens',new.usage->>'prompt_tokens','') ~ '^[0-9]+$' then
      in_tokens := coalesce(new.usage->>'input_tokens',new.usage->>'prompt_tokens')::int;
    end if;
    if coalesce(new.usage->>'output_tokens',new.usage->>'completion_tokens','') ~ '^[0-9]+$' then
      out_tokens := coalesce(new.usage->>'output_tokens',new.usage->>'completion_tokens')::int;
    end if;

    perform public.atlas_record_trace_span(
      new.org_id,t,'atlas-copilot','provider_completion',
      case when new.status='completed' then 'ok' else 'error' end,
      new.latency_ms,new.error_code,'production',null,new.conversation_id,
      'chatgpt-main-brain',null,'not_required',in_tokens,out_tokens,null
    );
    metric_name := case when new.status='completed' then 'provider_success_count' else 'provider_fail_count' end;
    perform public.atlas_record_operational_metric(new.org_id,metric_name,1,'count','atlas-copilot','production',null);
    if new.latency_ms is not null then
      perform public.atlas_record_operational_metric(new.org_id,'provider_latency_ms',new.latency_ms,'ms','atlas-copilot','production',null);
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$$;

revoke all on function public.atlas_telemetry_from_ai_request() from public,anon,authenticated;
grant execute on function public.atlas_telemetry_from_ai_request() to postgres,service_role;

drop trigger if exists atlas_observe_ai_request on public.atlas_ai_requests;
create trigger atlas_observe_ai_request
after insert or update on public.atlas_ai_requests
for each row execute function public.atlas_telemetry_from_ai_request();

create or replace function public.atlas_telemetry_from_runtime_verification()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  module_name text;
  operation_name text;
  trace_uuid uuid;
  metric_name text;
begin
  begin
    if new.status not in ('passed','failed','blocked') then return new; end if;
    if tg_op='UPDATE' and old.status is not distinct from new.status then return new; end if;

    module_name := case
      when new.verification_type='identity-security' then 'atlas-auth'
      when new.verification_type='governance-production' then 'atlas-governance'
      when new.verification_type in ('infrastructure-public','infrastructure-deployment','infrastructure-control') then 'atlas-infra-status'
      when new.verification_type='intelligence-production' then 'atlas-runtime-verifier'
      else null
    end;
    if module_name is null then return new; end if;

    operation_name := case
      when module_name='atlas-auth' then 'identity_security_verification'
      when module_name='atlas-governance' then 'governance_readiness'
      when module_name='atlas-infra-status' then 'infra_status_snapshot'
      else 'verification_run'
    end;

    trace_uuid := case when coalesce(new.trace_id,'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then new.trace_id::uuid else gen_random_uuid() end;

    perform public.atlas_record_trace_span(
      new.organization_id,trace_uuid,module_name,operation_name,
      case when new.status='passed' then 'ok' when new.status='blocked' then 'blocked' else 'error' end,
      new.duration_ms,new.error_code,new.environment,new.target_version,new.conversation_id,
      null,null,'not_required',null,null,null
    );

    metric_name := case when new.status='passed' then 'verification_pass_count' else 'verification_fail_count' end;
    perform public.atlas_record_operational_metric(new.organization_id,metric_name,1,'count',module_name,new.environment,new.target_version);
    if new.duration_ms is not null then
      perform public.atlas_record_operational_metric(new.organization_id,'verification_duration_ms',new.duration_ms,'ms',module_name,new.environment,new.target_version);
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$$;

revoke all on function public.atlas_telemetry_from_runtime_verification() from public,anon,authenticated;
grant execute on function public.atlas_telemetry_from_runtime_verification() to postgres,service_role;

drop trigger if exists atlas_observe_runtime_verification on public.atlas_runtime_verification_runs;
create trigger atlas_observe_runtime_verification
after insert or update on public.atlas_runtime_verification_runs
for each row execute function public.atlas_telemetry_from_runtime_verification();

create or replace function public.atlas_telemetry_from_repair_job()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  op text;
  st text;
begin
  begin
    if tg_op='INSERT' then
      op := 'repair_enqueue';
    elsif old.status is not distinct from new.status then
      return new;
    else
      op := case new.status
        when 'claimed' then 'repair_claim'
        when 'planning' then 'repair_plan'
        when 'applying' then 'repair_plan'
        when 'completed' then 'repair_complete'
        when 'failed' then 'repair_failed'
        else null end;
    end if;
    if op is null then return new; end if;
    st := case when new.status='failed' then 'error' else 'ok' end;
    perform public.atlas_record_trace_span(
      new.org_id,gen_random_uuid(),'atlas-repair-bridge',op,st,null,
      case when new.status='failed' then 'repair_failed' else null end,
      'production',null,null,null,'supabase-native',null,null,null,null
    );
    perform public.atlas_record_operational_metric(
      new.org_id,case when new.status='failed' then 'repair_fail_count' else 'repair_event_count' end,
      1,'count','atlas-repair-bridge','production',null
    );
  exception when others then
    null;
  end;
  return new;
end;
$$;

revoke all on function public.atlas_telemetry_from_repair_job() from public,anon,authenticated;
grant execute on function public.atlas_telemetry_from_repair_job() to postgres,service_role;

drop trigger if exists atlas_observe_repair_job on public.atlas_ai_repair_jobs;
create trigger atlas_observe_repair_job
after insert or update on public.atlas_ai_repair_jobs
for each row execute function public.atlas_telemetry_from_repair_job();
