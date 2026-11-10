create or replace function public.atlas_incident_requires_approval(p_incident_id uuid,p_action text)
returns boolean
language sql
stable
security invoker
set search_path='public','pg_temp'
as $$
  select exists(
    select 1 from public.atlas_incidents i
    where i.id=p_incident_id and (
      i.severity in ('P0','P1')
      or lower(coalesce(p_action,'')) ~ '(deploy|dns|edge|secret|permission|role|destroy|delete|drop|rollback)'
    )
  );
$$;

revoke all on function public.atlas_incident_requires_approval(uuid,text) from public,anon;
grant execute on function public.atlas_incident_requires_approval(uuid,text) to authenticated,service_role;

create or replace function public.atlas_request_incident_approval(
  p_incident_id uuid,
  p_action text,
  p_risk_level text
) returns uuid
language plpgsql
security invoker
set search_path='public','pg_temp'
as $$
declare
  i public.atlas_incidents%rowtype;
  a_id uuid;
  actor uuid := auth.uid();
begin
  if actor is null then raise exception 'authentication_required'; end if;
  select * into i from public.atlas_incidents where id=p_incident_id for update;
  if not found then raise exception 'incident_not_found'; end if;
  if i.org_id is null then raise exception 'platform_incident_approval_requires_platform_control_plane'; end if;
  if not public.has_identity_permission(i.org_id,'incidents.manage') then raise exception 'incident_permission_denied'; end if;
  if p_risk_level not in ('low','medium','high','critical') then raise exception 'invalid_risk_level'; end if;
  if length(coalesce(p_action,'')) < 2 or length(p_action) > 160 then raise exception 'invalid_approval_action'; end if;
  if i.status not in ('detected','triaging','blocked') then raise exception 'incident_not_approval_eligible'; end if;

  if i.status='detected' then
    update public.atlas_incidents set status='triaging' where id=i.id;
  end if;

  insert into public.atlas_approvals(org_id,subject_type,subject_id,action,risk_level,requested_by,metadata)
  values(i.org_id,'atlas_incident',i.id::text,p_action,p_risk_level,actor,
         jsonb_build_object('incident_id',i.id,'service',i.service,'severity',i.severity,'contains_sensitive_data',false))
  returning id into a_id;

  update public.atlas_incidents set approval_id=a_id,status='awaiting_approval' where id=i.id;
  return a_id;
end;
$$;

revoke all on function public.atlas_request_incident_approval(uuid,text,text) from public,anon;
grant execute on function public.atlas_request_incident_approval(uuid,text,text) to authenticated;

create or replace function public.atlas_incident_remediation_policy(p_incident_id uuid,p_action text)
returns text
language sql
stable
security invoker
set search_path='public','pg_temp'
as $$
  select case
    when lower(coalesce(p_action,'')) in ('rerun_verification','retry_idempotent','refresh_status_cache','requeue_authorized_repair') then 'auto_allowed'
    when public.atlas_incident_requires_approval(p_incident_id,p_action) then 'approval_required'
    else 'manual_review'
  end;
$$;

revoke all on function public.atlas_incident_remediation_policy(uuid,text) from public,anon;
grant execute on function public.atlas_incident_remediation_policy(uuid,text) to authenticated,service_role;

create or replace function public.atlas_correlate_incidents()
returns jsonb
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  r record;
  i record;
  k text;
  sev text;
  inc_id uuid;
  created_count int := 0;
  updated_count int := 0;
  monitoring_count int := 0;
  resolved_count int := 0;
  second_pass record;
begin
  for r in
    select distinct on (verification_type,target_service)
      id,verification_type,target_service,target_version,environment,status,provider,provider_state,
      organization_id,error_code,trace_id,created_at
    from public.atlas_runtime_verification_runs
    order by verification_type,target_service,created_at desc,id desc
  loop
    if r.status in ('failed','blocked') then
      k := public.atlas_incident_fingerprint(r.environment,r.target_service,r.verification_type,r.error_code,r.provider,null);
      sev := public.atlas_classify_incident_severity(r.target_service,r.verification_type,r.error_code,r.status,r.provider_state);
      inc_id := null;

      select id into inc_id
      from public.atlas_incidents
      where environment=r.environment and incident_key=k and status<>'resolved'
      for update;

      if inc_id is null then
        insert into public.atlas_incidents(
          org_id,incident_key,title,summary,source_type,source_ref,service,module,environment,severity,status,error_code,
          provider,trace_id,first_seen_at,last_seen_at,occurrence_count,detected_by,metadata
        ) values (
          r.organization_id,k,
          left(r.target_service||' verification incident',240),
          left(coalesce(r.error_code,'verification_failure'),1000),
          'verification',r.id::text,r.target_service,null,r.environment,sev,'detected',r.error_code,
          r.provider,r.trace_id,r.created_at,r.created_at,1,'atlas_correlator',
          jsonb_build_object('verification_type',r.verification_type,'provider_state',r.provider_state,'contains_sensitive_data',false)
        ) returning id into inc_id;
        created_count := created_count + 1;
        update public.atlas_incidents set status='triaging' where id=inc_id;
      else
        update public.atlas_incidents
        set last_seen_at=case when source_ref is distinct from r.id::text then greatest(last_seen_at,r.created_at) else last_seen_at end,
            occurrence_count=case when source_ref is distinct from r.id::text then occurrence_count+1 else occurrence_count end,
            severity=case
              when severity='P0' or sev='P0' then 'P0'
              when severity='P1' or sev='P1' then 'P1'
              when severity='P2' or sev='P2' then 'P2'
              else 'P3' end,
            source_ref=r.id::text,
            error_code=r.error_code,
            provider=r.provider,
            trace_id=r.trace_id,
            metadata=metadata || jsonb_build_object('verification_type',r.verification_type,'provider_state',r.provider_state,'contains_sensitive_data',false),
            resolution_evidence=case when status='monitoring' then '{}'::jsonb else resolution_evidence end,
            status=case when status='monitoring' then 'triaging' else status end
        where id=inc_id;
        updated_count := updated_count + 1;
      end if;

    elsif r.status='passed' then
      for i in
        select id,status,resolution_evidence
        from public.atlas_incidents
        where environment=r.environment
          and service=r.target_service
          and source_type='verification'
          and metadata->>'verification_type'=r.verification_type
          and status<>'resolved'
        order by last_seen_at desc
        for update
      loop
        if i.status in ('triaging','mitigating','blocked') then
          update public.atlas_incidents
          set status='monitoring',
              resolution_evidence=jsonb_build_object(
                'first_recovery_verification_id',r.id,
                'first_recovery_at',r.created_at,
                'verification_type',r.verification_type,
                'target_service',r.target_service
              )
          where id=i.id;
          monitoring_count := monitoring_count + 1;
        elsif i.status='monitoring' then
          select v.id,v.created_at into second_pass
          from public.atlas_runtime_verification_runs v
          where v.target_service=r.target_service
            and v.verification_type=r.verification_type
            and v.status='passed'
            and v.id::text <> coalesce(i.resolution_evidence->>'first_recovery_verification_id','')
            and v.created_at > coalesce((i.resolution_evidence->>'first_recovery_at')::timestamptz,'epoch'::timestamptz)
          order by v.created_at desc,v.id desc
          limit 1;

          if second_pass.id is not null then
            update public.atlas_incidents
            set status='resolved',
                resolution_evidence=resolution_evidence || jsonb_build_object(
                  'second_recovery_verification_id',second_pass.id,
                  'verified_recovery_at',second_pass.created_at
                )
            where id=i.id;
            resolved_count := resolved_count + 1;
          end if;
        end if;
      end loop;
    end if;
  end loop;

  return jsonb_build_object(
    'created',created_count,
    'updated',updated_count,
    'monitoring',monitoring_count,
    'resolved',resolved_count,
    'checked_at',now()
  );
end;
$$;

revoke all on function public.atlas_correlate_incidents() from public,anon,authenticated;
grant execute on function public.atlas_correlate_incidents() to postgres,service_role;
