alter function public.atlas_incident_fingerprint(text,text,text,text,text,text) set search_path = pg_catalog, pg_temp;
alter function public.atlas_classify_incident_severity(text,text,text,text,text) set search_path = pg_catalog, pg_temp;

create or replace function public.atlas_transition_incident(
  p_incident_id uuid,
  p_new_status text,
  p_reason text default null,
  p_resolution_evidence jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security invoker
set search_path='public','pg_temp'
as $$
declare
  i public.atlas_incidents%rowtype;
begin
  select * into i from public.atlas_incidents where id=p_incident_id for update;
  if not found then raise exception 'incident_not_found'; end if;

  if i.org_id is null then
    if auth.uid() is not null then
      raise exception 'platform_incident_service_role_required';
    end if;
  else
    if not public.has_identity_permission(i.org_id,
         case when p_new_status='resolved' then 'incidents.resolve' else 'incidents.manage' end) then
      raise exception 'incident_permission_denied';
    end if;
  end if;

  if p_new_status='resolved' and coalesce(auth.jwt()->>'aal','aal1')<>'aal2' and i.severity in ('P0','P1') and auth.uid() is not null then
    raise exception 'critical_incident_resolution_requires_aal2';
  end if;

  update public.atlas_incidents
  set status=p_new_status,
      resolution_evidence=case when p_new_status='resolved' then p_resolution_evidence else resolution_evidence end,
      metadata=case when p_reason is null then metadata else metadata || jsonb_build_object('last_transition_reason',left(p_reason,500)) end
  where id=p_incident_id;
  return p_incident_id;
end;
$$;

revoke all on function public.atlas_transition_incident(uuid,text,text,jsonb) from public,anon;
grant execute on function public.atlas_transition_incident(uuid,text,text,jsonb) to authenticated,service_role;
