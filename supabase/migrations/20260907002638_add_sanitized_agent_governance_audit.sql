create or replace function public.audit_agent_execution_change()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  source_row jsonb;
  old_snapshot jsonb;
  new_snapshot jsonb;
  organization_uuid uuid;
  entity_id text;
  actor uuid;
begin
  source_row := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  organization_uuid := (source_row->>'org_id')::uuid;
  entity_id := source_row->>'id';
  actor := auth.uid();

  if tg_table_name='atlas_ai_requests' then
    actor := coalesce(actor,(source_row->>'actor_id')::uuid);
    if tg_op in ('UPDATE','DELETE') then
      old_snapshot := jsonb_build_object(
        'trace_id',old.trace_id,'module',old.module,'intent',old.intent,'provider',old.provider,'model',old.model,
        'status',old.status,'latency_ms',old.latency_ms,'error_code',old.error_code,'completed_at',old.completed_at
      );
    end if;
    if tg_op in ('INSERT','UPDATE') then
      new_snapshot := jsonb_build_object(
        'trace_id',new.trace_id,'module',new.module,'intent',new.intent,'provider',new.provider,'model',new.model,
        'status',new.status,'latency_ms',new.latency_ms,'error_code',new.error_code,'completed_at',new.completed_at
      );
    end if;
  elsif tg_table_name='atlas_ai_repair_jobs' then
    actor := coalesce(actor,(source_row->>'requested_by')::uuid);
    if tg_op in ('UPDATE','DELETE') then
      old_snapshot := jsonb_build_object(
        'status',old.status,'claimed_by',old.claimed_by,'attempts',old.attempts,'branch_name',old.branch_name,
        'pull_request_url',old.pull_request_url,'source_commit',old.source_commit,'claimed_at',old.claimed_at,'completed_at',old.completed_at
      );
    end if;
    if tg_op in ('INSERT','UPDATE') then
      new_snapshot := jsonb_build_object(
        'status',new.status,'claimed_by',new.claimed_by,'attempts',new.attempts,'branch_name',new.branch_name,
        'pull_request_url',new.pull_request_url,'source_commit',new.source_commit,'claimed_at',new.claimed_at,'completed_at',new.completed_at
      );
    end if;
  elsif tg_table_name='atlas_conversation_executions' then
    actor := coalesce(actor,(source_row->>'created_by')::uuid);
    if tg_op in ('UPDATE','DELETE') then
      old_snapshot := jsonb_build_object(
        'source_kind',old.source_kind,'source_ref',old.source_ref,'source_hash',old.source_hash,'intent',old.intent,
        'execution_policy',old.execution_policy,'status',old.status,'project_id',old.project_id,'work_unit_id',old.work_unit_id
      );
    end if;
    if tg_op in ('INSERT','UPDATE') then
      new_snapshot := jsonb_build_object(
        'source_kind',new.source_kind,'source_ref',new.source_ref,'source_hash',new.source_hash,'intent',new.intent,
        'execution_policy',new.execution_policy,'status',new.status,'project_id',new.project_id,'work_unit_id',new.work_unit_id
      );
    end if;
  else
    raise exception 'unsupported_agent_audit_table';
  end if;

  insert into public.audit_logs(org_id,user_id,action,table_name,record_id,old_data,new_data)
  values(organization_uuid,actor,lower('agent_trace.'||tg_table_name||'.'||tg_op),tg_table_name,entity_id,old_snapshot,new_snapshot);

  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.audit_agent_execution_change() from public,anon,authenticated;
grant execute on function public.audit_agent_execution_change() to postgres,service_role;

drop trigger if exists atlas_audit_atlas_ai_requests on public.atlas_ai_requests;
create trigger atlas_audit_atlas_ai_requests after insert or update or delete on public.atlas_ai_requests for each row execute function public.audit_agent_execution_change();

drop trigger if exists atlas_audit_atlas_ai_repair_jobs on public.atlas_ai_repair_jobs;
create trigger atlas_audit_atlas_ai_repair_jobs after insert or update or delete on public.atlas_ai_repair_jobs for each row execute function public.audit_agent_execution_change();

drop trigger if exists atlas_audit_atlas_conversation_executions on public.atlas_conversation_executions;
create trigger atlas_audit_atlas_conversation_executions after insert or update or delete on public.atlas_conversation_executions for each row execute function public.audit_agent_execution_change();

create or replace function public.list_governance_timeline(organization_id uuid,event_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path='public','pg_temp'
as $$
begin
  if event_limit < 1 or event_limit > 500 then raise exception 'event_limit_out_of_range'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.occurred_at desc)
    from (
      select a.requested_at as occurred_at,'approval'::text category,
             ('approval.'||a.status)::text event_type,
             coalesce(a.decided_by,a.requested_by) actor_id,
             a.id::text reference_id,
             jsonb_build_object('action',a.action,'subject_type',a.subject_type,'subject_id',a.subject_id,'risk_level',a.risk_level,'status',a.status) detail
      from public.atlas_approvals a where a.org_id=organization_id
      union all
      select l.created_at,case when l.action like 'agent_trace.%' then 'agent' else 'data_change' end,l.action,l.user_id,
             concat_ws(':',l.table_name,l.record_id),
             jsonb_build_object('table_name',l.table_name,'record_id',l.record_id,'before',l.old_data,'after',l.new_data)
      from public.audit_logs l where l.org_id=organization_id
      union all
      select e.created_at,'identity',e.event_type,e.actor_user_id,e.id::text,
             jsonb_build_object('event_type',e.event_type)
      from public.identity_security_events e where e.org_id=organization_id
      union all
      select v.created_at,'verification',concat(v.verification_type,'.',v.status),null::uuid,v.id::text,
             jsonb_build_object('target_service',v.target_service,'status',v.status,'provider_state',v.provider_state,'error_code',v.error_code)
      from public.atlas_runtime_verification_runs v
      where v.organization_id=organization_id or v.organization_id is null
      union all
      select e.occurred_at,'domain',e.event_type,e.actor_id,e.id::text,
             jsonb_build_object('source_module',e.source_module,'target_module',e.target_module,'entity_type',e.entity_type,'entity_id',e.entity_id)
      from public.atlas_events e where e.org_id=organization_id
      order by occurred_at desc
      limit event_limit
    ) x
  ),'[]'::jsonb);
end;
$$;
revoke all on function public.list_governance_timeline(uuid,integer) from public,anon,authenticated;
grant execute on function public.list_governance_timeline(uuid,integer) to postgres,service_role;
