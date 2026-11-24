alter table public.atlas_trace_spans alter column org_id drop not null;
alter table public.atlas_operational_metrics alter column org_id drop not null;

alter table public.atlas_trace_spans drop constraint if exists atlas_trace_spans_status_check;
alter table public.atlas_trace_spans add constraint atlas_trace_spans_status_check
  check (status = any(array['ok'::text,'error'::text,'blocked'::text,'cancelled'::text,'timeout'::text]));

drop policy if exists atlas_trace_spans_insert on public.atlas_trace_spans;
drop policy if exists atlas_operational_metrics_insert on public.atlas_operational_metrics;
revoke insert,update,delete on public.atlas_trace_spans from authenticated,anon;
revoke insert,update,delete on public.atlas_operational_metrics from authenticated,anon;

drop policy if exists atlas_trace_spans_read on public.atlas_trace_spans;
create policy atlas_trace_spans_read on public.atlas_trace_spans
for select to authenticated
using (
  (org_id is not null and public.has_identity_permission(org_id,'observability.read'))
  or
  (org_id is null and exists(
    select 1 from public.organization_members m
    where m.user_id=(select auth.uid()) and m.status='active'
      and public.has_identity_permission(m.org_id,'runtime_verification.read')
  ))
);

drop policy if exists atlas_operational_metrics_read on public.atlas_operational_metrics;
create policy atlas_operational_metrics_read on public.atlas_operational_metrics
for select to authenticated
using (
  (org_id is not null and public.has_identity_permission(org_id,'observability.read'))
  or
  (org_id is null and exists(
    select 1 from public.organization_members m
    where m.user_id=(select auth.uid()) and m.status='active'
      and public.has_identity_permission(m.org_id,'runtime_verification.read')
  ))
);

create or replace function public.atlas_record_trace_span(
  p_org_id uuid,
  p_trace_id uuid,
  p_module text,
  p_operation text,
  p_status text,
  p_duration_ms integer default null,
  p_error_code text default null,
  p_environment text default 'production',
  p_release_ref text default null,
  p_conversation_id uuid default null,
  p_agent_ref text default null,
  p_tool_name text default null,
  p_approval_state text default null,
  p_input_tokens integer default null,
  p_output_tokens integer default null,
  p_estimated_cost_usd numeric default null
) returns uuid
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  rid uuid;
  probe text := lower(concat_ws('|',coalesce(p_module,''),coalesce(p_operation,''),coalesce(p_error_code,''),coalesce(p_release_ref,''),coalesce(p_agent_ref,''),coalesce(p_tool_name,''),coalesce(p_approval_state,'')));
begin
  if p_trace_id is null then raise exception 'trace_id_required'; end if;
  if p_status not in ('ok','error','blocked','cancelled','timeout') then raise exception 'invalid_trace_status'; end if;
  if p_environment not in ('development','staging','production') then raise exception 'invalid_trace_environment'; end if;
  if p_duration_ms is not null and (p_duration_ms<0 or p_duration_ms>86400000) then raise exception 'invalid_trace_duration'; end if;
  if probe ~ '(bearer[ .:_-]|sb_secret_|sk-proj-|sk-[a-z0-9]{8,}|service_role_key|refresh_token[=:]|access_token[=:]|authorization_header)' then
    raise exception 'telemetry_credential_like_value_rejected';
  end if;

  insert into public.atlas_trace_spans(
    org_id,trace_id,module,operation,status,duration_ms,error_code,environment,release_ref,
    conversation_id,agent_ref,tool_name,approval_state,input_tokens,output_tokens,estimated_cost_usd
  ) values (
    p_org_id,p_trace_id,left(p_module,64),left(p_operation,96),p_status,p_duration_ms,left(p_error_code,96),p_environment,
    left(p_release_ref,96),p_conversation_id,left(p_agent_ref,160),left(p_tool_name,160),left(p_approval_state,80),
    p_input_tokens,p_output_tokens,p_estimated_cost_usd
  ) returning id into rid;
  return rid;
end;
$$;

create or replace function public.atlas_record_operational_metric(
  p_org_id uuid,
  p_metric_name text,
  p_metric_value numeric,
  p_unit text,
  p_module text,
  p_environment text default 'production',
  p_release_ref text default null
) returns uuid
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  rid uuid;
  probe text := lower(concat_ws('|',coalesce(p_metric_name,''),coalesce(p_module,''),coalesce(p_release_ref,'')));
begin
  if p_environment not in ('development','staging','production') then raise exception 'invalid_metric_environment'; end if;
  if p_unit not in ('count','ms','bytes','percent','usd','tokens','items') then raise exception 'invalid_metric_unit'; end if;
  if probe ~ '(bearer[ .:_-]|sb_secret_|sk-proj-|sk-[a-z0-9]{8,}|service_role_key|refresh_token[=:]|access_token[=:]|authorization_header)' then
    raise exception 'metric_credential_like_value_rejected';
  end if;

  insert into public.atlas_operational_metrics(org_id,metric_name,metric_value,unit,module,environment,release_ref)
  values(p_org_id,left(p_metric_name,80),p_metric_value,p_unit,left(p_module,64),p_environment,left(p_release_ref,96))
  returning id into rid;
  return rid;
end;
$$;

revoke all on function public.atlas_record_trace_span(uuid,uuid,text,text,text,integer,text,text,text,uuid,text,text,text,integer,integer,numeric) from public,anon,authenticated;
revoke all on function public.atlas_record_operational_metric(uuid,text,numeric,text,text,text,text) from public,anon,authenticated;
grant execute on function public.atlas_record_trace_span(uuid,uuid,text,text,text,integer,text,text,text,uuid,text,text,text,integer,integer,numeric) to postgres,service_role;
grant execute on function public.atlas_record_operational_metric(uuid,text,numeric,text,text,text,text) to postgres,service_role;
