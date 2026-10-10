create or replace function public.enforce_atlas_approval_transition()
returns trigger
language plpgsql
security definer
set search_path = 'public','pg_temp'
as $$
declare
  actor uuid := auth.uid();
  actor_aal text := coalesce(auth.jwt()->>'aal','aal1');
begin
  if tg_op='INSERT' then
    if actor is not null and new.requested_by is distinct from actor then
      raise exception 'approval_requested_by_must_match_actor';
    end if;
    new.status := 'pending';
    new.decided_by := null;
    new.decided_at := null;
    new.updated_at := now();
    return new;
  end if;

  if row(new.org_id,new.subject_type,new.subject_id,new.action,new.risk_level,new.requested_by,new.requested_at,new.expires_at,new.metadata)
     is distinct from
     row(old.org_id,old.subject_type,old.subject_id,old.action,old.risk_level,old.requested_by,old.requested_at,old.expires_at,old.metadata) then
    raise exception 'approval_immutable_fields_cannot_change';
  end if;

  if old.status <> 'pending' then
    raise exception 'approval_terminal_state_is_immutable';
  end if;

  if new.status not in ('approved','rejected','cancelled','expired') then
    raise exception 'invalid_approval_transition';
  end if;

  if new.status in ('approved','rejected') then
    if old.expires_at <= now() then
      raise exception 'approval_request_expired';
    end if;
    if old.risk_level in ('high','critical') and actor_aal <> 'aal2' then
      raise exception 'approval_requires_mfa_step_up';
    end if;
    if new.status='approved' and old.risk_level in ('high','critical') and old.requested_by=actor then
      raise exception 'high_risk_self_approval_not_allowed';
    end if;
    new.decided_by := actor;
    new.decided_at := now();
  elsif new.status='cancelled' then
    new.decided_by := actor;
    new.decided_at := now();
  elsif new.status='expired' then
    if actor is not null then
      raise exception 'approval_expiry_is_system_managed';
    end if;
    new.decided_by := null;
    new.decided_at := now();
  end if;

  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.enforce_atlas_approval_transition() from public,anon,authenticated;
grant execute on function public.enforce_atlas_approval_transition() to postgres,service_role;
