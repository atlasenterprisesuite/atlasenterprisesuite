create or replace function public.audit_atlas_incident_change()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  old_s jsonb;
  new_s jsonb;
begin
  old_s := case when tg_op in ('UPDATE','DELETE') then jsonb_build_object(
    'id',old.id,'service',old.service,'module',old.module,'severity',old.severity,'status',old.status,
    'error_code',old.error_code,'source_type',old.source_type,'source_ref',old.source_ref,
    'approval_id',old.approval_id,'repair_job_id',old.repair_job_id,'first_seen_at',old.first_seen_at,
    'last_seen_at',old.last_seen_at,'occurrence_count',old.occurrence_count,'resolved_at',old.resolved_at
  ) else null end;
  new_s := case when tg_op in ('INSERT','UPDATE') then jsonb_build_object(
    'id',new.id,'service',new.service,'module',new.module,'severity',new.severity,'status',new.status,
    'error_code',new.error_code,'source_type',new.source_type,'source_ref',new.source_ref,
    'approval_id',new.approval_id,'repair_job_id',new.repair_job_id,'first_seen_at',new.first_seen_at,
    'last_seen_at',new.last_seen_at,'occurrence_count',new.occurrence_count,'resolved_at',new.resolved_at
  ) else null end;

  insert into public.audit_logs(org_id,user_id,action,table_name,record_id,old_data,new_data)
  values(
    case when tg_op='DELETE' then old.org_id else new.org_id end,
    auth.uid(),
    'incident_trace.'||lower(tg_op),
    'atlas_incidents',
    case when tg_op='DELETE' then old.id::text else new.id::text end,
    old_s,new_s
  );
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;

revoke all on function public.audit_atlas_incident_change() from public,anon,authenticated;
grant execute on function public.audit_atlas_incident_change() to postgres,service_role;

create trigger atlas_audit_atlas_incidents
after insert or update or delete on public.atlas_incidents
for each row execute function public.audit_atlas_incident_change();
