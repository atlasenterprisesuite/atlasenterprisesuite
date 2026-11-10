create or replace function public.audit_atlas_release_control_change()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  v_org uuid; v_action text; v_old jsonb:=null; v_new jsonb:=null; v_record text; v_actor uuid:=auth.uid();
begin
  if tg_table_name='atlas_releases' then
    v_org:=case when tg_op='DELETE' then old.org_id else new.org_id end;
    v_record:=case when tg_op='DELETE' then old.id::text else new.id::text end;
    v_action:='release.'||lower(tg_op);
    if tg_op in ('UPDATE','DELETE') then
      v_old:=jsonb_build_object('id',old.id,'release_key',old.release_key,'version',old.version,'channel',old.channel,'status',old.status,'manifest_hash',old.manifest_hash,'approval_id',old.approval_id,'updated_at',old.updated_at);
    end if;
    if tg_op in ('INSERT','UPDATE') then
      v_new:=jsonb_build_object('id',new.id,'release_key',new.release_key,'version',new.version,'channel',new.channel,'status',new.status,'manifest_hash',new.manifest_hash,'approval_id',new.approval_id,'updated_at',new.updated_at);
    end if;
  elsif tg_table_name='atlas_deployments' then
    v_org:=case when tg_op='DELETE' then old.org_id else new.org_id end;
    v_record:=case when tg_op='DELETE' then old.id::text else new.id::text end;
    v_action:='deployment.'||lower(tg_op);
    if tg_op in ('UPDATE','DELETE') then
      v_old:=jsonb_build_object('id',old.id,'release_id',old.release_id,'environment',old.environment,'kind',old.deployment_kind,'status',old.status,'provider_state',old.provider_execution_state,'health_state',old.health_state,'approval_id',old.approval_id,'error_code',old.error_code,'updated_at',old.updated_at);
    end if;
    if tg_op in ('INSERT','UPDATE') then
      v_new:=jsonb_build_object('id',new.id,'release_id',new.release_id,'environment',new.environment,'kind',new.deployment_kind,'status',new.status,'provider_state',new.provider_execution_state,'health_state',new.health_state,'approval_id',new.approval_id,'error_code',new.error_code,'updated_at',new.updated_at);
    end if;
  else
    select d.org_id into v_org from public.atlas_deployments d where d.id=case when tg_op='DELETE' then old.deployment_id else new.deployment_id end;
    v_record:=case when tg_op='DELETE' then old.id::text else new.id::text end;
    v_action:='gate.'||lower(tg_op);
    if tg_op in ('UPDATE','DELETE') then
      v_old:=jsonb_build_object('id',old.id,'deployment_id',old.deployment_id,'gate_key',old.gate_key,'required',old.required,'status',old.status,'approval_id',old.approval_id,'verification_run_id',old.verification_run_id,'error_code',old.error_code,'updated_at',old.updated_at);
    end if;
    if tg_op in ('INSERT','UPDATE') then
      v_new:=jsonb_build_object('id',new.id,'deployment_id',new.deployment_id,'gate_key',new.gate_key,'required',new.required,'status',new.status,'approval_id',new.approval_id,'verification_run_id',new.verification_run_id,'error_code',new.error_code,'updated_at',new.updated_at);
    end if;
  end if;
  insert into public.audit_logs(org_id,user_id,action,table_name,record_id,old_data,new_data)
  values(v_org,v_actor,v_action,tg_table_name,v_record,v_old,v_new);
  return case when tg_op='DELETE' then old else new end;
exception when others then
  return case when tg_op='DELETE' then old else new end;
end;
$$;

create trigger atlas_releases_audit after insert or update or delete on public.atlas_releases for each row execute function public.audit_atlas_release_control_change();
create trigger atlas_deployments_audit after insert or update or delete on public.atlas_deployments for each row execute function public.audit_atlas_release_control_change();
create trigger atlas_deployment_gates_audit after insert or update or delete on public.atlas_deployment_gates for each row execute function public.audit_atlas_release_control_change();

create or replace function public.list_governance_timeline(organization_id uuid, event_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
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
             jsonb_build_object('service',i.service,'module',i.module,'severity',i.severity,'status',i.status,'error_code',i.error_code,'approval_id',i.approval_id,'repair_job_id',i.repair_job_id)
      from public.atlas_incidents i where i.org_id=v_organization_id
      union all
      select r.updated_at,'release'::text,('release.'||r.status)::text,r.requested_by,r.id::text,
             jsonb_build_object('release_key',r.release_key,'version',r.version,'channel',r.channel,'status',r.status,'approval_id',r.approval_id,'manifest_hash',r.manifest_hash)
      from public.atlas_releases r where r.org_id=v_organization_id
      union all
      select d.updated_at,'deployment'::text,('deployment.'||d.status)::text,d.requested_by,d.id::text,
             jsonb_build_object('release_id',d.release_id,'environment',d.environment,'kind',d.deployment_kind,'status',d.status,'provider_state',d.provider_execution_state,'health_state',d.health_state,'approval_id',d.approval_id,'error_code',d.error_code)
      from public.atlas_deployments d where d.org_id=v_organization_id
      order by occurred_at desc
      limit v_event_limit
    ) x
  ),'[]'::jsonb);
end;
$$;

create or replace function public.atlas_release_control_telemetry()
returns trigger
language plpgsql
security definer
set search_path='public','extensions','pg_temp'
as $$
declare
  v_module text:='atlas-release-control'; v_op text; v_status text; v_org uuid; v_release_ref text; v_metric text; v_error text;
begin
  if tg_table_name='atlas_releases' then
    v_op:='release.transition'; v_status:=new.status; v_org:=new.org_id; v_release_ref:=new.id::text;
    v_metric:='release.transition.count'; v_error:=case when new.status in ('failed','blocked') then 'release_control_blocked' end;
  elsif tg_table_name='atlas_deployments' then
    v_op:=case when new.status in ('rolling_back','rolled_back') or new.deployment_kind='rollback' then 'deployment.rollback' when new.status='promoted' then 'deployment.promote' else 'deployment.transition' end;
    v_status:=new.status; v_org:=new.org_id; v_release_ref:=new.release_id::text;
    v_metric:=case when new.status='failed' then 'deployment.failure.count' when new.status='rolled_back' then 'deployment.rollback.count' when new.status='promoted' then 'deployment.promote.count' else 'deployment.transition.count' end;
    v_error:=case when new.status in ('failed','blocked') then coalesce(new.error_code,'release_control_blocked') end;
  else
    v_op:='gate.evaluate'; v_status:=new.status; v_metric:=case when new.status in ('failed','blocked','expired') then 'gate.failure.count' else 'gate.evaluation.count' end;
    select d.org_id,d.release_id::text into v_org,v_release_ref from public.atlas_deployments d where d.id=new.deployment_id;
    v_error:=case when new.status in ('failed','blocked','expired') then coalesce(new.error_code,'release_gate_blocked') end;
  end if;
  begin
    perform public.atlas_record_trace_span(v_org,gen_random_uuid(),v_module,v_op,case when v_status in ('failed','blocked','expired') then 'blocked' else 'ok' end,0,v_error,'production',v_release_ref,null,null,null,null,null,null,null);
  exception when others then null; end;
  begin
    perform public.atlas_record_operational_metric(v_org,v_metric,1,'count',v_module,'production',v_release_ref);
  exception when others then null; end;
  return new;
end;
$$;
create trigger atlas_releases_telemetry after insert or update on public.atlas_releases for each row execute function public.atlas_release_control_telemetry();
create trigger atlas_deployments_telemetry after insert or update on public.atlas_deployments for each row execute function public.atlas_release_control_telemetry();
create trigger atlas_deployment_gates_telemetry after insert or update on public.atlas_deployment_gates for each row execute function public.atlas_release_control_telemetry();

create or replace function atlas_private.release_failure_incident_internal(p_deployment_id uuid,p_error_code text,p_summary text)
returns uuid
language plpgsql
security definer
set search_path='public','atlas_private','pg_temp'
as $$
declare d public.atlas_deployments; v_key text; v_id uuid;
begin
  select * into d from public.atlas_deployments where id=p_deployment_id;
  if not found then raise exception 'deployment_not_found'; end if;
  v_key:=public.atlas_incident_fingerprint(d.environment,'atlas-release-control','edge',coalesce(p_error_code,'release_control_failure'),'supabase','atlas-release-control');
  insert into public.atlas_incidents(org_id,incident_key,title,summary,source_type,source_ref,service,module,environment,severity,status,error_code,provider,release_ref,detected_by)
  values(d.org_id,v_key,'ATLAS release/deployment failure',left(coalesce(p_summary,'Release-control failure'),500),'edge',d.id::text,'atlas-release-control','atlas-release-control',d.environment,case when d.environment='production' then 'P1' else 'P2' end,'detected',left(coalesce(p_error_code,'release_control_failure'),120),'supabase',d.release_id::text,'release-control')
  on conflict (environment,incident_key) where status<>'resolved'
  do update set last_seen_at=now(),occurrence_count=public.atlas_incidents.occurrence_count+1,summary=excluded.summary,error_code=excluded.error_code,updated_at=now()
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function atlas_private.release_failure_incident_internal(uuid,text,text) from public,anon,authenticated;
grant execute on function atlas_private.release_failure_incident_internal(uuid,text,text) to service_role;

create or replace function public.atlas_release_failure_incident(p_deployment_id uuid,p_error_code text,p_summary text)
returns uuid language sql security invoker set search_path='public','atlas_private','pg_temp'
as $$ select atlas_private.release_failure_incident_internal(p_deployment_id,p_error_code,p_summary); $$;
revoke all on function public.atlas_release_failure_incident(uuid,text,text) from public,anon,authenticated;
grant execute on function public.atlas_release_failure_incident(uuid,text,text) to service_role;
