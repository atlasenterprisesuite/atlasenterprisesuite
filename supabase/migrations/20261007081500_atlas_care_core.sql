-- ATLAS Care governed core.
-- Coordinates participant eligibility, caregiver authorization, care plans and approved time.
-- This schema intentionally excludes diagnosis, clinical notes and EHR payloads.
-- External payer/EHR connectivity remains fail-closed until separately configured and verified.

insert into public.identity_permissions (code, description)
values
  ('care.read', 'Read organization-scoped ATLAS Care records.'),
  ('care.write', 'Create and manage governed ATLAS Care participants, caregivers, plans and time entries.'),
  ('care.approve', 'Approve or reject governed ATLAS Care time entries for downstream payroll handoff.')
on conflict (code) do update set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code)
values
  ('owner','care.read'),('owner','care.write'),('owner','care.approve'),
  ('admin','care.read'),('admin','care.write'),('admin','care.approve'),
  ('manager','care.read'),('manager','care.write'),('manager','care.approve')
on conflict do nothing;

create table if not exists public.care_people (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 160),
  external_subject_ref text,
  eligibility_status text not null default 'pending' check (eligibility_status in ('pending','eligible','ineligible','review')),
  eligibility_source text not null default 'manual' check (eligibility_source in ('manual','payer','program')),
  eligibility_verified_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists care_people_org_idx on public.care_people(org_id,created_at desc);

create table if not exists public.care_caregivers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  worker_id uuid references public.people_workers(id) on delete set null,
  full_name text not null check (length(trim(full_name)) between 1 and 160),
  authorization_status text not null default 'pending' check (authorization_status in ('pending','authorized','suspended')),
  certification_status text not null default 'pending' check (certification_status in ('pending','verified','expired')),
  certification_expires_on date,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists care_caregivers_org_idx on public.care_caregivers(org_id,created_at desc);

create table if not exists public.care_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  participant_id uuid not null references public.care_people(id) on delete restrict,
  caregiver_id uuid not null references public.care_caregivers(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 160),
  start_date date not null,
  end_date date,
  authorized_minutes_per_week integer not null check (authorized_minutes_per_week between 1 and 10080),
  status text not null default 'active' check (status in ('draft','active','paused','closed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index if not exists care_plans_org_idx on public.care_plans(org_id,status,start_date desc);

create table if not exists public.care_time_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.care_plans(id) on delete restrict,
  participant_id uuid not null references public.care_people(id) on delete restrict,
  caregiver_id uuid not null references public.care_caregivers(id) on delete restrict,
  work_date date not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  minutes integer not null check (minutes > 0 and minutes <= 1440),
  status text not null default 'draft' check (status in ('draft','submitted','approved','rejected')),
  payroll_ready boolean not null default false,
  rejection_reason text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at > started_at)
);
create index if not exists care_time_entries_org_date_idx on public.care_time_entries(org_id,work_date desc);
create index if not exists care_time_entries_caregiver_idx on public.care_time_entries(org_id,caregiver_id,started_at,ended_at);

create or replace function public.care_touch_updated_at()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin new.updated_at:=now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['care_people','care_caregivers','care_plans','care_time_entries']
  loop
    execute format('drop trigger if exists %I_touch on public.%I',t,t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.care_touch_updated_at()',t,t);
    execute format('drop trigger if exists %I_audit on public.%I',t,t);
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row_change()',t,t);
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke insert, update, delete on public.%I from authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
  end loop;
end $$;

drop policy if exists care_people_read on public.care_people;
create policy care_people_read on public.care_people for select to authenticated
using (public.has_identity_permission(org_id,'care.read') or public.has_identity_permission(org_id,'care.write') or public.has_identity_permission(org_id,'care.approve'));

drop policy if exists care_caregivers_read on public.care_caregivers;
create policy care_caregivers_read on public.care_caregivers for select to authenticated
using (public.has_identity_permission(org_id,'care.read') or public.has_identity_permission(org_id,'care.write') or public.has_identity_permission(org_id,'care.approve'));

drop policy if exists care_plans_read on public.care_plans;
create policy care_plans_read on public.care_plans for select to authenticated
using (public.has_identity_permission(org_id,'care.read') or public.has_identity_permission(org_id,'care.write') or public.has_identity_permission(org_id,'care.approve'));

drop policy if exists care_time_entries_read on public.care_time_entries;
create policy care_time_entries_read on public.care_time_entries for select to authenticated
using (public.has_identity_permission(org_id,'care.read') or public.has_identity_permission(org_id,'care.write') or public.has_identity_permission(org_id,'care.approve'));

create or replace function public.care_create_participant(p_org_id uuid,p_display_name text,p_eligibility_status text default 'pending')
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.has_identity_permission(p_org_id,'care.write') then raise exception 'care_write_required'; end if;
  if p_eligibility_status not in ('pending','eligible','ineligible','review') then raise exception 'invalid_eligibility_status'; end if;
  insert into public.care_people(org_id,display_name,eligibility_status,eligibility_verified_at,created_by)
  values(p_org_id,btrim(p_display_name),p_eligibility_status,case when p_eligibility_status='eligible' then now() else null end,auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.care_create_caregiver(
  p_org_id uuid,p_full_name text,p_worker_id uuid default null,p_authorization_status text default 'pending',
  p_certification_status text default 'pending',p_certification_expires_on date default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.has_identity_permission(p_org_id,'care.write') then raise exception 'care_write_required'; end if;
  if p_authorization_status not in ('pending','authorized','suspended') then raise exception 'invalid_caregiver_authorization'; end if;
  if p_certification_status not in ('pending','verified','expired') then raise exception 'invalid_certification_status'; end if;
  if p_worker_id is not null and not exists(select 1 from public.people_workers where id=p_worker_id and org_id=p_org_id) then
    raise exception 'caregiver_worker_not_found';
  end if;
  insert into public.care_caregivers(org_id,worker_id,full_name,authorization_status,certification_status,certification_expires_on,created_by)
  values(p_org_id,p_worker_id,btrim(p_full_name),p_authorization_status,p_certification_status,p_certification_expires_on,auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.care_create_plan(
  p_org_id uuid,p_participant_id uuid,p_caregiver_id uuid,p_name text,p_start_date date,p_end_date date,p_authorized_minutes_per_week integer
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_eligibility text; v_auth text; v_cert text; v_expiry date;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.has_identity_permission(p_org_id,'care.write') then raise exception 'care_write_required'; end if;
  if p_authorized_minutes_per_week < 1 or p_authorized_minutes_per_week > 10080 then raise exception 'invalid_weekly_minutes'; end if;
  if p_end_date is not null and p_end_date < p_start_date then raise exception 'invalid_plan_dates'; end if;

  select eligibility_status into v_eligibility from public.care_people where id=p_participant_id and org_id=p_org_id;
  if not found then raise exception 'care_participant_not_found'; end if;
  select authorization_status,certification_status,certification_expires_on into v_auth,v_cert,v_expiry
    from public.care_caregivers where id=p_caregiver_id and org_id=p_org_id and active;
  if not found then raise exception 'caregiver_not_found'; end if;
  if v_eligibility <> 'eligible' then raise exception 'participant_not_eligible'; end if;
  if v_auth <> 'authorized' then raise exception 'caregiver_not_authorized'; end if;
  if v_cert <> 'verified' or (v_expiry is not null and v_expiry < p_start_date) then raise exception 'caregiver_certification_not_verified'; end if;

  insert into public.care_plans(org_id,participant_id,caregiver_id,name,start_date,end_date,authorized_minutes_per_week,status,created_by)
  values(p_org_id,p_participant_id,p_caregiver_id,btrim(p_name),p_start_date,p_end_date,p_authorized_minutes_per_week,'active',auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.care_create_time_entry(
  p_org_id uuid,p_plan_id uuid,p_work_date date,p_started_at timestamptz,p_ended_at timestamptz
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_id uuid; v_participant uuid; v_caregiver uuid; v_plan_status text; v_start date; v_end date; v_limit integer;
  v_eligibility text; v_auth text; v_cert text; v_cert_expiry date; v_minutes integer; v_used integer;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.has_identity_permission(p_org_id,'care.write') then raise exception 'care_write_required'; end if;
  if p_ended_at <= p_started_at then raise exception 'invalid_time_range'; end if;
  v_minutes:=ceil(extract(epoch from (p_ended_at-p_started_at))/60.0)::integer;
  if v_minutes < 1 or v_minutes > 1440 then raise exception 'invalid_minutes'; end if;

  select participant_id,caregiver_id,status,start_date,end_date,authorized_minutes_per_week
    into v_participant,v_caregiver,v_plan_status,v_start,v_end,v_limit
    from public.care_plans where id=p_plan_id and org_id=p_org_id;
  if not found then raise exception 'care_plan_not_found'; end if;
  if v_plan_status <> 'active' then raise exception 'care_plan_not_active'; end if;
  if p_work_date < v_start or (v_end is not null and p_work_date > v_end) then raise exception 'outside_care_plan_dates'; end if;

  select eligibility_status into v_eligibility from public.care_people where id=v_participant and org_id=p_org_id;
  select authorization_status,certification_status,certification_expires_on into v_auth,v_cert,v_cert_expiry
    from public.care_caregivers where id=v_caregiver and org_id=p_org_id and active;
  if v_eligibility <> 'eligible' then raise exception 'participant_not_eligible'; end if;
  if v_auth <> 'authorized' then raise exception 'caregiver_not_authorized'; end if;
  if v_cert <> 'verified' or (v_cert_expiry is not null and v_cert_expiry < p_work_date) then raise exception 'caregiver_certification_not_verified'; end if;

  if exists(
    select 1 from public.care_time_entries e
    where e.org_id=p_org_id and e.caregiver_id=v_caregiver and e.status <> 'rejected'
      and tstzrange(e.started_at,e.ended_at,'[)') && tstzrange(p_started_at,p_ended_at,'[)')
  ) then raise exception 'overlapping_time_entry'; end if;

  select coalesce(sum(minutes),0)::integer into v_used from public.care_time_entries e
    where e.org_id=p_org_id and e.plan_id=p_plan_id and e.status <> 'rejected'
      and e.work_date >= date_trunc('week',p_work_date::timestamp)::date
      and e.work_date < (date_trunc('week',p_work_date::timestamp)+interval '7 days')::date;
  if v_used + v_minutes > v_limit then raise exception 'authorized_minutes_exceeded'; end if;

  insert into public.care_time_entries(org_id,plan_id,participant_id,caregiver_id,work_date,started_at,ended_at,minutes,created_by)
  values(p_org_id,p_plan_id,v_participant,v_caregiver,p_work_date,p_started_at,p_ended_at,v_minutes,auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.care_transition_time_entry(p_org_id uuid,p_entry_id uuid,p_action text,p_reason text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_status text; v_next text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select status into v_status from public.care_time_entries where id=p_entry_id and org_id=p_org_id for update;
  if not found then raise exception 'care_time_entry_not_found'; end if;

  if p_action='submit' then
    if not public.has_identity_permission(p_org_id,'care.write') then raise exception 'care_write_required'; end if;
    if v_status <> 'draft' then raise exception 'care_submit_invalid_state'; end if;
    v_next:='submitted';
  elsif p_action='approve' then
    if not public.has_identity_permission(p_org_id,'care.approve') then raise exception 'care_approve_required'; end if;
    if v_status <> 'submitted' then raise exception 'care_approve_invalid_state'; end if;
    v_next:='approved';
  elsif p_action='reject' then
    if not public.has_identity_permission(p_org_id,'care.approve') then raise exception 'care_approve_required'; end if;
    if v_status <> 'submitted' then raise exception 'care_reject_invalid_state'; end if;
    if nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'care_rejection_reason_required'; end if;
    v_next:='rejected';
  else raise exception 'invalid_care_time_action';
  end if;

  update public.care_time_entries
  set status=v_next,
      payroll_ready=(v_next='approved'),
      approved_by=case when v_next='approved' then auth.uid() else null end,
      approved_at=case when v_next='approved' then now() else null end,
      rejection_reason=case when v_next='rejected' then btrim(p_reason) else null end
  where id=p_entry_id and org_id=p_org_id;
  return p_entry_id;
end $$;

create or replace function public.care_get_capability_readiness(p_org_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not (
    public.has_identity_permission(p_org_id,'care.read')
    or public.has_identity_permission(p_org_id,'care.write')
    or public.has_identity_permission(p_org_id,'care.approve')
  ) then raise exception 'care_read_required'; end if;
  return jsonb_build_object(
    'as_of',now(),
    'capabilities',jsonb_build_object(
      'payer_eligibility',jsonb_build_object('status','blocked','reason','No verified payer or Medicaid eligibility adapter is configured.'),
      'ehr_exchange',jsonb_build_object('status','blocked','reason','No verified EHR/FHIR/HL7 connection is configured.'),
      'payroll_handoff',jsonb_build_object('status','ready','reason','Approved care time entries are marked payroll_ready for governed downstream handoff.')
    )
  );
end $$;

revoke all on function public.care_create_participant(uuid,text,text) from public,anon;
revoke all on function public.care_create_caregiver(uuid,text,uuid,text,text,date) from public,anon;
revoke all on function public.care_create_plan(uuid,uuid,uuid,text,date,date,integer) from public,anon;
revoke all on function public.care_create_time_entry(uuid,uuid,date,timestamptz,timestamptz) from public,anon;
revoke all on function public.care_transition_time_entry(uuid,uuid,text,text) from public,anon;
revoke all on function public.care_get_capability_readiness(uuid) from public,anon;

grant execute on function public.care_create_participant(uuid,text,text) to authenticated;
grant execute on function public.care_create_caregiver(uuid,text,uuid,text,text,date) to authenticated;
grant execute on function public.care_create_plan(uuid,uuid,uuid,text,date,date,integer) to authenticated;
grant execute on function public.care_create_time_entry(uuid,uuid,date,timestamptz,timestamptz) to authenticated;
grant execute on function public.care_transition_time_entry(uuid,uuid,text,text) to authenticated;
grant execute on function public.care_get_capability_readiness(uuid) to authenticated;
