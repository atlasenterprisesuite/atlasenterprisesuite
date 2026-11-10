create or replace function public.list_governance_timeline(organization_id uuid, event_limit integer default 100)
returns jsonb
language plpgsql
stable security definer
set search_path='public','pg_temp'
as $$
declare
  v_organization_id uuid := $1;
  v_event_limit integer := $2;
begin
  if v_event_limit < 1 or v_event_limit > 500 then raise exception 'event_limit_out_of_range'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.occurred_at desc)
    from (
      select a.requested_at as occurred_at,'approval'::text category,
             ('approval.'||a.status)::text event_type,
             coalesce(a.decided_by,a.requested_by) actor_id,
             a.id::text reference_id,
             jsonb_build_object('action',a.action,'subject_type',a.subject_type,'subject_id',a.subject_id,'risk_level',a.risk_level,'status',a.status) detail
      from public.atlas_approvals a where a.org_id=v_organization_id
      union all
      select l.created_at,case when l.action like 'agent_trace.%' then 'agent' else 'data_change' end,l.action,l.user_id,
             concat_ws(':',l.table_name,l.record_id),
             jsonb_build_object('table_name',l.table_name,'record_id',l.record_id,'before',l.old_data,'after',l.new_data)
      from public.audit_logs l where l.org_id=v_organization_id
      union all
      select e.created_at,'identity',e.event_type,e.actor_user_id,e.id::text,
             jsonb_build_object('event_type',e.event_type)
      from public.identity_security_events e where e.org_id=v_organization_id
      union all
      select v.created_at,'verification',concat(v.verification_type,'.',v.status),null::uuid,v.id::text,
             jsonb_build_object('target_service',v.target_service,'status',v.status,'provider_state',v.provider_state,'error_code',v.error_code)
      from public.atlas_runtime_verification_runs v
      where v.organization_id=v_organization_id or v.organization_id is null
      union all
      select e.occurred_at,'domain',e.event_type,e.actor_id,e.id::text,
             jsonb_build_object('source_module',e.source_module,'target_module',e.target_module,'entity_type',e.entity_type,'entity_id',e.entity_id)
      from public.atlas_events e where e.org_id=v_organization_id
      union all
      select i.updated_at,'incident'::text,('incident.'||i.status)::text,null::uuid,i.id::text,
             jsonb_build_object(
               'service',i.service,
               'module',i.module,
               'severity',i.severity,
               'status',i.status,
               'error_code',i.error_code,
               'approval_id',i.approval_id,
               'repair_job_id',i.repair_job_id
             )
      from public.atlas_incidents i
      where i.org_id=v_organization_id
      order by occurred_at desc
      limit v_event_limit
    ) x
  ),'[]'::jsonb);
end;
$$;
