insert into public.identity_permissions(code,description) values
('approvals.read','Read ATLAS governance approvals'),
('approvals.manage','Create and manage ATLAS governance approval requests'),
('approvals.decide','Approve, reject, cancel, or expire ATLAS governance approval requests'),
('governance.read','Read the ATLAS governance timeline and posture')
on conflict (code) do nothing;

insert into public.identity_role_permissions(role,permission_code) values
('owner','approvals.read'),('admin','approvals.read'),('manager','approvals.read'),
('owner','approvals.manage'),('admin','approvals.manage'),
('owner','approvals.decide'),('admin','approvals.decide'),
('owner','governance.read'),('admin','governance.read'),('manager','governance.read')
on conflict do nothing;

create table if not exists public.atlas_approvals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  subject_type text not null check (length(subject_type) between 2 and 80),
  subject_id text,
  action text not null check (length(action) between 2 and 160),
  risk_level text not null default 'medium' check (risk_level in ('low','medium','high','critical')),
  requested_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled','expired')),
  reason text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  decided_by uuid references auth.users(id) on delete set null,
  decision_note text,
  decided_at timestamptz,
  updated_at timestamptz not null default now(),
  check (expires_at > requested_at),
  check ((status='pending' and decided_at is null and decided_by is null) or status<>'pending')
);

create index if not exists idx_atlas_approvals_org_status_requested on public.atlas_approvals(org_id,status,requested_at desc);
create index if not exists idx_atlas_approvals_requested_by on public.atlas_approvals(requested_by,requested_at desc);
create unique index if not exists uq_atlas_approvals_pending_subject_action
  on public.atlas_approvals(org_id,subject_type,coalesce(subject_id,''),action)
  where status='pending';

alter table public.atlas_approvals enable row level security;
revoke all on public.atlas_approvals from public, anon;
revoke delete on public.atlas_approvals from authenticated;
grant select,insert,update on public.atlas_approvals to authenticated;
grant all on public.atlas_approvals to service_role;

drop policy if exists atlas_approvals_read on public.atlas_approvals;
create policy atlas_approvals_read on public.atlas_approvals
  for select to authenticated
  using (public.has_identity_permission(org_id,'approvals.read'));

drop policy if exists atlas_approvals_insert on public.atlas_approvals;
create policy atlas_approvals_insert on public.atlas_approvals
  for insert to authenticated
  with check (
    public.has_identity_permission(org_id,'approvals.manage')
    and requested_by=(select auth.uid())
    and status='pending'
    and decided_by is null
    and decided_at is null
    and expires_at > now()
    and expires_at <= now() + interval '30 days'
  );

drop policy if exists atlas_approvals_update on public.atlas_approvals;
create policy atlas_approvals_update on public.atlas_approvals
  for update to authenticated
  using (public.has_identity_permission(org_id,'approvals.decide'))
  with check (public.has_identity_permission(org_id,'approvals.decide'));

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
    if new.requested_by is distinct from actor and current_user not in ('service_role','postgres') then
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
    if current_user not in ('service_role','postgres') and actor is not null then
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

drop trigger if exists atlas_approvals_transition_guard on public.atlas_approvals;
create trigger atlas_approvals_transition_guard
before insert or update on public.atlas_approvals
for each row execute function public.enforce_atlas_approval_transition();

drop trigger if exists atlas_audit_atlas_approvals on public.atlas_approvals;
create trigger atlas_audit_atlas_approvals
after insert or update or delete on public.atlas_approvals
for each row execute function public.audit_row_change();

create or replace function public.atlas_expire_pending_approvals()
returns integer
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare n integer;
begin
  update public.atlas_approvals
  set status='expired'
  where status='pending' and expires_at <= now();
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.atlas_expire_pending_approvals() from public,anon,authenticated;
grant execute on function public.atlas_expire_pending_approvals() to postgres,service_role;

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
      select l.created_at,'data_change',l.action,l.user_id,
             concat_ws(':',l.table_name,l.record_id),
             jsonb_build_object('table_name',l.table_name,'record_id',l.record_id)
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
