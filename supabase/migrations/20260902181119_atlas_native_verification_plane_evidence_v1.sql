create table public.atlas_runtime_verification_runs (
  id uuid primary key default gen_random_uuid(),
  verification_type text not null,
  target_service text not null,
  target_version text,
  environment text not null default 'production' check (environment in ('development','staging','production')),
  status text not null default 'running' check (status in ('running','passed','failed','blocked')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  trace_id text,
  provider text,
  provider_state text,
  storage_state text,
  organization_id uuid references public.organizations(id) on delete set null,
  conversation_id uuid,
  checks jsonb not null default '{}'::jsonb check (jsonb_typeof(checks)='object'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  error_code text,
  error_detail text,
  created_at timestamptz not null default now(),
  check ((status='running' and completed_at is null) or (status in ('passed','failed','blocked') and completed_at is not null))
);

create index atlas_runtime_verification_runs_service_started_idx on public.atlas_runtime_verification_runs(target_service, started_at desc);
create index atlas_runtime_verification_runs_status_started_idx on public.atlas_runtime_verification_runs(status, started_at desc);
create index atlas_runtime_verification_runs_org_idx on public.atlas_runtime_verification_runs(organization_id);

comment on table public.atlas_runtime_verification_runs is 'ATLAS-native immutable production verification evidence. Runtime truth does not depend on GitHub Actions.';

insert into public.identity_permissions(code,description) values
 ('runtime_verification.read','Read ATLAS native runtime verification evidence'),
 ('runtime_verification.manage','Manage ATLAS native runtime verification plane'),
 ('runtime_verification.audit','Audit ATLAS native runtime verification evidence')
on conflict (code) do nothing;

insert into public.identity_role_permissions(role,permission_code) values
 ('owner','runtime_verification.read'),('owner','runtime_verification.manage'),('owner','runtime_verification.audit'),
 ('admin','runtime_verification.read'),('admin','runtime_verification.manage'),('admin','runtime_verification.audit'),
 ('manager','runtime_verification.read')
on conflict (role,permission_code) do nothing;

alter table public.atlas_runtime_verification_runs enable row level security;
revoke all on public.atlas_runtime_verification_runs from anon, authenticated;
grant select on public.atlas_runtime_verification_runs to authenticated;

create policy atlas_runtime_verification_runs_read on public.atlas_runtime_verification_runs
for select to authenticated
using (
  (organization_id is not null and public.has_identity_permission(organization_id,'runtime_verification.read'))
  or
  (organization_id is null and exists (
    select 1 from public.organization_members m
    where m.user_id=auth.uid() and m.status='active'
      and public.has_identity_permission(m.org_id,'runtime_verification.read')
  ))
);

create or replace function public.atlas_runtime_verification_guard_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status in ('passed','failed','blocked') then
    raise exception 'verification_run_terminal_immutable';
  end if;
  if new.id is distinct from old.id
     or new.verification_type is distinct from old.verification_type
     or new.target_service is distinct from old.target_service
     or new.environment is distinct from old.environment
     or new.started_at is distinct from old.started_at
     or new.created_at is distinct from old.created_at then
    raise exception 'verification_run_identity_immutable';
  end if;
  if old.status <> 'running' or new.status not in ('passed','failed','blocked') then
    raise exception 'verification_run_invalid_transition';
  end if;
  if new.completed_at is null then
    raise exception 'verification_run_completed_at_required';
  end if;
  return new;
end;
$$;

create trigger atlas_runtime_verification_runs_guard_update
before update on public.atlas_runtime_verification_runs
for each row execute function public.atlas_runtime_verification_guard_update();

create or replace function public.atlas_runtime_verification_begin(
  p_verification_type text,
  p_target_service text,
  p_environment text default 'production',
  p_trace_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_environment not in ('development','staging','production') then
    raise exception 'invalid_verification_environment';
  end if;
  insert into public.atlas_runtime_verification_runs(verification_type,target_service,environment,trace_id,status)
  values (p_verification_type,p_target_service,p_environment,p_trace_id,'running')
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.atlas_runtime_verification_begin(text,text,text,text) from public, anon, authenticated;
grant execute on function public.atlas_runtime_verification_begin(text,text,text,text) to service_role;

create or replace function public.atlas_runtime_verification_complete(
  p_run_id uuid,
  p_status text,
  p_patch jsonb default '{}'::jsonb
)
returns public.atlas_runtime_verification_runs
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_row public.atlas_runtime_verification_runs;
  v_detail text;
begin
  if p_status not in ('passed','failed','blocked') then
    raise exception 'invalid_verification_terminal_status';
  end if;
  select * into v_row from public.atlas_runtime_verification_runs where id=p_run_id for update;
  if not found then raise exception 'verification_run_not_found'; end if;
  if v_row.status <> 'running' then raise exception 'verification_run_terminal_immutable'; end if;

  v_detail := left(coalesce(p_patch->>'error_detail',''),1000);
  v_detail := regexp_replace(v_detail, '(?i)Bearer[[:space:]]+[A-Za-z0-9._~+/-]+=*', 'Bearer [REDACTED]', 'g');
  v_detail := regexp_replace(v_detail, '(?i)(sk-|sb_secret_)[A-Za-z0-9_-]+', '[REDACTED]', 'g');
  v_detail := regexp_replace(v_detail, '(?i)(password|api[_-]?key|token)[[:space:]]*[:=][[:space:]]*[^,;[:space:]]+', '\1=[REDACTED]', 'g');

  update public.atlas_runtime_verification_runs
  set status=p_status,
      completed_at=now(),
      duration_ms=greatest(0, floor(extract(epoch from (now()-started_at))*1000)::integer),
      target_version=coalesce(p_patch->>'target_version',target_version),
      provider=coalesce(p_patch->>'provider',provider),
      provider_state=coalesce(p_patch->>'provider_state',provider_state),
      storage_state=coalesce(p_patch->>'storage_state',storage_state),
      organization_id=case when p_patch ? 'organization_id' and nullif(p_patch->>'organization_id','') is not null then (p_patch->>'organization_id')::uuid else organization_id end,
      conversation_id=case when p_patch ? 'conversation_id' and nullif(p_patch->>'conversation_id','') is not null then (p_patch->>'conversation_id')::uuid else conversation_id end,
      checks=case when jsonb_typeof(p_patch->'checks')='object' then p_patch->'checks' else checks end,
      metadata=case when jsonb_typeof(p_patch->'metadata')='object' then p_patch->'metadata' else metadata end,
      error_code=nullif(p_patch->>'error_code',''),
      error_detail=nullif(v_detail,'')
  where id=p_run_id
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.atlas_runtime_verification_complete(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.atlas_runtime_verification_complete(uuid,text,jsonb) to service_role;

create or replace function public.atlas_runtime_verification_state(p_target_service text default 'atlas-copilot')
returns table(
  verification_state text,
  run_id uuid,
  status text,
  target_service text,
  completed_at timestamptz,
  provider_state text,
  storage_state text,
  conversation_id uuid,
  checks jsonb,
  error_code text
)
language sql
stable
set search_path = public, pg_temp
as $$
  with latest as (
    select * from public.atlas_runtime_verification_runs
    where atlas_runtime_verification_runs.target_service=p_target_service
    order by started_at desc limit 1
  )
  select
    case
      when l.id is null then 'unknown'
      when l.status='passed' and l.completed_at >= now()-interval '30 minutes' then 'verified'
      when l.status='passed' then 'stale'
      when l.status='blocked' then 'blocked'
      when l.status='failed' then 'failed'
      else 'unknown'
    end,
    l.id,l.status,l.target_service,l.completed_at,l.provider_state,l.storage_state,l.conversation_id,l.checks,l.error_code
  from latest l
  union all
  select 'unknown',null::uuid,null::text,p_target_service,null::timestamptz,null::text,null::text,null::uuid,'{}'::jsonb,null::text
  where not exists(select 1 from latest);
$$;
grant execute on function public.atlas_runtime_verification_state(text) to authenticated, service_role;
