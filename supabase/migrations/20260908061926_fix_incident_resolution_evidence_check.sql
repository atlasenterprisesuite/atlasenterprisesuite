create or replace function public.enforce_atlas_incident_transition()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
begin
  if tg_op='INSERT' then
    new.status := coalesce(new.status,'detected');
    new.first_seen_at := coalesce(new.first_seen_at,now());
    new.last_seen_at := coalesce(new.last_seen_at,new.first_seen_at);
    new.updated_at := now();
    if new.status='resolved' then raise exception 'incident_cannot_start_resolved'; end if;
    return new;
  end if;

  if row(new.org_id,new.incident_key,new.source_type,new.service,new.environment,new.first_seen_at,new.detected_by)
     is distinct from
     row(old.org_id,old.incident_key,old.source_type,old.service,old.environment,old.first_seen_at,old.detected_by) then
    raise exception 'incident_immutable_identity_fields_cannot_change';
  end if;

  if old.status='resolved' then raise exception 'resolved_incident_is_terminal'; end if;

  if new.status is distinct from old.status then
    if not (
      (old.status='detected' and new.status='triaging') or
      (old.status='triaging' and new.status in ('mitigating','awaiting_approval','blocked','monitoring')) or
      (old.status='awaiting_approval' and new.status in ('mitigating','blocked')) or
      (old.status='mitigating' and new.status in ('monitoring','blocked')) or
      (old.status='monitoring' and new.status in ('resolved','triaging')) or
      (old.status='blocked' and new.status in ('triaging','awaiting_approval','mitigating'))
    ) then
      raise exception 'invalid_incident_transition:%->%',old.status,new.status;
    end if;
    if new.status='resolved' then
      if coalesce(new.resolution_evidence,'{}'::jsonb) = '{}'::jsonb then raise exception 'resolution_evidence_required'; end if;
      new.resolved_at := now();
    else
      new.resolved_at := null;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.enforce_atlas_incident_transition() from public,anon,authenticated;
grant execute on function public.enforce_atlas_incident_transition() to postgres,service_role;
