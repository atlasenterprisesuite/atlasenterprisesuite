insert into public.identity_permissions(code,description) values
  ('observability.read','Read ATLAS observability summaries and telemetry'),
  ('incidents.read','Read ATLAS technical incidents'),
  ('incidents.manage','Triage and manage ATLAS technical incidents'),
  ('incidents.resolve','Resolve ATLAS technical incidents after verified recovery')
on conflict (code) do update set description=excluded.description;

insert into public.identity_role_permissions(role,permission_code) values
  ('owner','observability.read'),('owner','incidents.read'),('owner','incidents.manage'),('owner','incidents.resolve'),
  ('admin','observability.read'),('admin','incidents.read'),('admin','incidents.manage'),('admin','incidents.resolve'),
  ('manager','observability.read'),('manager','incidents.read'),('manager','incidents.manage')
on conflict do nothing;

create table public.atlas_incidents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid null references public.organizations(id) on delete set null,
  incident_key text not null,
  title text not null,
  summary text not null,
  source_type text not null check (source_type in ('verification','trace','metric','edge','manual','agent')),
  source_ref text null,
  service text not null,
  module text null,
  environment text not null default 'production' check (environment in ('development','staging','production')),
  severity text not null check (severity in ('P0','P1','P2','P3')),
  status text not null default 'detected' check (status in ('detected','triaging','awaiting_approval','mitigating','monitoring','blocked','resolved')),
  error_code text null,
  provider text null,
  release_ref text null,
  trace_id text null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  occurrence_count integer not null default 1 check (occurrence_count >= 1),
  detected_by text not null,
  assigned_to text null,
  approval_id uuid null references public.atlas_approvals(id) on delete set null,
  repair_job_id uuid null references public.atlas_ai_repair_jobs(id) on delete set null,
  resolution_evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(resolution_evidence)='object'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz null,
  constraint atlas_incidents_resolution_consistency check (
    (status='resolved' and resolved_at is not null)
    or (status<>'resolved' and resolved_at is null)
  )
);

create unique index atlas_incidents_active_dedupe_idx
  on public.atlas_incidents(environment,incident_key)
  where status <> 'resolved';
create index atlas_incidents_org_status_idx on public.atlas_incidents(org_id,status,severity,last_seen_at desc);
create index atlas_incidents_approval_fk_idx on public.atlas_incidents(approval_id);
create index atlas_incidents_repair_job_fk_idx on public.atlas_incidents(repair_job_id);
create index atlas_incidents_last_seen_idx on public.atlas_incidents(last_seen_at desc);

alter table public.atlas_incidents enable row level security;
revoke all on public.atlas_incidents from public, anon, authenticated;
grant select,insert,update on public.atlas_incidents to authenticated;
grant all on public.atlas_incidents to service_role;

create or replace function public.atlas_incident_fingerprint(
  p_environment text,
  p_service text,
  p_source_type text,
  p_error_code text,
  p_provider text default null,
  p_module text default null
) returns text
language sql immutable
as $$
  select lower(concat_ws('|',
    coalesce(nullif(trim(p_environment),''),'production'),
    coalesce(nullif(trim(p_service),''),'unknown-service'),
    coalesce(nullif(trim(p_source_type),''),'unknown-source'),
    coalesce(nullif(trim(p_error_code),''),'unknown-error'),
    nullif(trim(coalesce(p_provider,'')),''),
    nullif(trim(coalesce(p_module,'')),'')
  ));
$$;

create or replace function public.atlas_classify_incident_severity(
  p_service text,
  p_source_type text,
  p_error_code text,
  p_status text,
  p_provider_state text default null
) returns text
language sql immutable
as $$
  select case
    when lower(coalesce(p_error_code,'')) in ('cross_tenant_isolation_failure','data_integrity_threat','security_compromise') then 'P0'
    when lower(coalesce(p_service,'')) in ('atlas-enterprise-suite-web','atlas-auth')
         and lower(coalesce(p_status,''))='failed' then 'P0'
    when lower(coalesce(p_error_code,'')) in ('deployment_failed_active_release','privileged_admin_unavailable_urgent') then 'P1'
    when lower(coalesce(p_error_code,'')) in ('github_runner_unallocated','provider_unavailable','integration_unavailable') then 'P2'
    when lower(coalesce(p_error_code,'')) in ('privileged_email_confirmation_incomplete','privileged_mfa_incomplete','auth_leaked_password_protection') then 'P3'
    when lower(coalesce(p_status,''))='blocked' then 'P2'
    else 'P3'
  end;
$$;

create policy atlas_incidents_read on public.atlas_incidents
for select to authenticated
using (
  (org_id is not null and public.has_identity_permission(org_id,'incidents.read'))
  or
  (org_id is null and exists (
    select 1 from public.organization_members m
    where m.user_id=auth.uid() and m.status='active'
      and public.has_identity_permission(m.org_id,'runtime_verification.read')
  ))
);

create policy atlas_incidents_insert on public.atlas_incidents
for insert to authenticated
with check (
  org_id is not null
  and public.has_identity_permission(org_id,'incidents.manage')
  and detected_by='manual'
);

create policy atlas_incidents_update on public.atlas_incidents
for update to authenticated
using (
  org_id is not null and public.has_identity_permission(org_id,'incidents.manage')
)
with check (
  org_id is not null and public.has_identity_permission(org_id,'incidents.manage')
);

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
      if coalesce(jsonb_object_length(new.resolution_evidence),0)=0 then raise exception 'resolution_evidence_required'; end if;
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

create trigger atlas_enforce_incident_transition
before insert or update on public.atlas_incidents
for each row execute function public.enforce_atlas_incident_transition();

create or replace function public.atlas_transition_incident(
  p_incident_id uuid,
  p_new_status text,
  p_reason text default null,
  p_resolution_evidence jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  i public.atlas_incidents%rowtype;
  platform_allowed boolean := false;
begin
  select * into i from public.atlas_incidents where id=p_incident_id for update;
  if not found then raise exception 'incident_not_found'; end if;

  if i.org_id is not null then
    if not public.has_identity_permission(i.org_id,
         case when p_new_status='resolved' then 'incidents.resolve' else 'incidents.manage' end) then
      raise exception 'incident_permission_denied';
    end if;
  else
    select exists(
      select 1 from public.organization_members m
      where m.user_id=auth.uid() and m.status='active'
        and public.has_identity_permission(m.org_id,'runtime_verification.manage')
    ) into platform_allowed;
    if auth.uid() is not null and not platform_allowed then
      raise exception 'platform_incident_permission_denied';
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
