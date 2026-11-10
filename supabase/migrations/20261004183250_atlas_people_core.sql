-- ATLAS People final canonical core.
-- Organization-scoped HR, time, recruiting and compensation. Payroll calculation remains owned by ATLAS Payroll.

insert into public.identity_permissions (code, description)
values
  ('hr.read', 'Read organization-scoped People and HR records.'),
  ('hr.write', 'Create and manage governed People and HR records.'),
  ('payroll.read', 'Read authorized compensation and payroll-related People records.'),
  ('payroll.write', 'Manage authorized compensation and payroll-related People records.'),
  ('payroll.approve', 'Approve governed payroll lifecycle transitions.'),
  ('payroll.self', 'Read and submit the authenticated worker own People records.')
on conflict (code) do update set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code)
values
  ('owner','hr.read'),('owner','hr.write'),('owner','payroll.read'),('owner','payroll.write'),('owner','payroll.approve'),('owner','payroll.self'),
  ('admin','hr.read'),('admin','hr.write'),('admin','payroll.read'),('admin','payroll.write'),('admin','payroll.approve'),('admin','payroll.self'),
  ('manager','hr.read'),('manager','hr.write'),('manager','payroll.read'),('manager','payroll.write'),('manager','payroll.self'),
  ('staff','payroll.self')
on conflict do nothing;

create table if not exists public.people_workers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null check (length(trim(full_name)) between 1 and 200),
  email text,
  department text,
  job_title text,
  worker_type text not null default 'employee' check (worker_type in ('employee','contractor')),
  status text not null default 'active' check (status in ('active','leave','terminated')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists people_workers_org_user_unique on public.people_workers(org_id,user_id) where user_id is not null;
create index if not exists people_workers_org_status_idx on public.people_workers(org_id,status);

create table if not exists public.people_time_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  worker_id uuid not null references public.people_workers(id) on delete cascade,
  work_date date not null,
  clock_in timestamptz,
  clock_out timestamptz,
  break_minutes integer not null default 0 check (break_minutes >= 0),
  status text not null default 'draft' check (status in ('draft','submitted','approved','rejected')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (clock_out is null or (clock_in is not null and clock_out > clock_in))
);
create index if not exists people_time_entries_org_worker_date_idx on public.people_time_entries(org_id,worker_id,work_date desc);

create table if not exists public.people_requisitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  department text,
  status text not null default 'draft' check (status in ('draft','open','paused','closed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists people_requisitions_org_status_idx on public.people_requisitions(org_id,status);

create table if not exists public.people_candidates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 1 and 200),
  email text,
  phone text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists people_candidates_org_name_idx on public.people_candidates(org_id,full_name);

create table if not exists public.people_applications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  requisition_id uuid not null references public.people_requisitions(id) on delete cascade,
  candidate_id uuid not null references public.people_candidates(id) on delete cascade,
  stage text not null default 'applied' check (stage in ('applied','screening','assessment','interview','offer','hired','rejected','withdrawn')),
  decision_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id,requisition_id,candidate_id)
);
create index if not exists people_applications_org_stage_idx on public.people_applications(org_id,stage);

create table if not exists public.people_compensation (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  worker_id uuid not null references public.people_workers(id) on delete cascade,
  pay_type text not null check (pay_type in ('hourly','salary')),
  hourly_rate numeric(14,4) check (hourly_rate is null or hourly_rate >= 0),
  annual_salary numeric(16,2) check (annual_salary is null or annual_salary >= 0),
  effective_from date not null,
  effective_to date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((pay_type='hourly' and hourly_rate is not null and annual_salary is null) or (pay_type='salary' and annual_salary is not null and hourly_rate is null)),
  check (effective_to is null or effective_to >= effective_from)
);
create index if not exists people_compensation_org_worker_idx on public.people_compensation(org_id,worker_id,effective_from desc);

create table if not exists public.people_deductions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  worker_id uuid not null references public.people_workers(id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9_.-]{0,63}$'),
  label text not null,
  treatment text not null check (treatment in ('pretax','posttax')),
  calculation_type text not null check (calculation_type in ('fixed','percent')),
  amount numeric(14,4) not null check (amount >= 0),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id,worker_id,code),
  check (calculation_type <> 'percent' or amount <= 1)
);

create or replace function public.people_touch_updated_at()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin new.updated_at := now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['people_workers','people_time_entries','people_requisitions','people_candidates','people_applications','people_compensation','people_deductions']
  loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.people_touch_updated_at()', t, t);
    execute format('drop trigger if exists %I_audit on public.%I', t, t);
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row_change()', t, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke insert, update, delete on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

drop policy if exists people_workers_read on public.people_workers;
create policy people_workers_read on public.people_workers for select to authenticated using (
  public.has_identity_permission(org_id,'hr.read')
  or public.has_identity_permission(org_id,'hr.write')
  or (user_id=(select auth.uid()) and public.has_identity_permission(org_id,'payroll.self'))
);

drop policy if exists people_time_entries_read on public.people_time_entries;
create policy people_time_entries_read on public.people_time_entries for select to authenticated using (
  public.has_identity_permission(org_id,'hr.read')
  or public.has_identity_permission(org_id,'hr.write')
  or exists (
    select 1 from public.people_workers w
    where w.id=people_time_entries.worker_id and w.org_id=people_time_entries.org_id
      and w.user_id=(select auth.uid()) and public.has_identity_permission(people_time_entries.org_id,'payroll.self')
  )
);

drop policy if exists people_requisitions_read on public.people_requisitions;
create policy people_requisitions_read on public.people_requisitions for select to authenticated using (
  public.has_identity_permission(org_id,'hr.read') or public.has_identity_permission(org_id,'hr.write')
);
drop policy if exists people_candidates_read on public.people_candidates;
create policy people_candidates_read on public.people_candidates for select to authenticated using (
  public.has_identity_permission(org_id,'hr.read') or public.has_identity_permission(org_id,'hr.write')
);
drop policy if exists people_applications_read on public.people_applications;
create policy people_applications_read on public.people_applications for select to authenticated using (
  public.has_identity_permission(org_id,'hr.read') or public.has_identity_permission(org_id,'hr.write')
);

drop policy if exists people_compensation_read on public.people_compensation;
create policy people_compensation_read on public.people_compensation for select to authenticated using (
  public.has_identity_permission(org_id,'payroll.read')
  or public.has_identity_permission(org_id,'payroll.write')
  or exists (
    select 1 from public.people_workers w
    where w.id=people_compensation.worker_id and w.org_id=people_compensation.org_id
      and w.user_id=(select auth.uid()) and public.has_identity_permission(people_compensation.org_id,'payroll.self')
  )
);
drop policy if exists people_deductions_read on public.people_deductions;
create policy people_deductions_read on public.people_deductions for select to authenticated using (
  public.has_identity_permission(org_id,'payroll.read')
  or public.has_identity_permission(org_id,'payroll.write')
  or exists (
    select 1 from public.people_workers w
    where w.id=people_deductions.worker_id and w.org_id=people_deductions.org_id
      and w.user_id=(select auth.uid()) and public.has_identity_permission(people_deductions.org_id,'payroll.self')
  )
);

create or replace function public.people_create_worker(
  p_org_id uuid,p_full_name text,p_email text default null,p_department text default null,
  p_job_title text default null,p_worker_type text default 'employee'
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.has_identity_permission(p_org_id,'hr.write') then raise exception 'hr_write_required'; end if;
  if nullif(btrim(coalesce(p_full_name,'')),'') is null then raise exception 'full_name_required'; end if;
  if p_worker_type not in ('employee','contractor') then raise exception 'invalid_worker_type'; end if;
  insert into public.people_workers(org_id,full_name,email,department,job_title,worker_type,created_by)
  values(p_org_id,btrim(p_full_name),nullif(btrim(coalesce(p_email,'')),''),nullif(btrim(coalesce(p_department,'')),''),
    nullif(btrim(coalesce(p_job_title,'')),''),p_worker_type,auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.people_update_worker(
  p_org_id uuid,p_worker_id uuid,p_full_name text,p_email text,p_department text,p_job_title text,p_status text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.has_identity_permission(p_org_id,'hr.write') then raise exception 'hr_write_required'; end if;
  if p_status not in ('active','leave','terminated') then raise exception 'invalid_worker_status'; end if;
  update public.people_workers set full_name=btrim(p_full_name),email=nullif(btrim(coalesce(p_email,'')),''),
    department=nullif(btrim(coalesce(p_department,'')),''),job_title=nullif(btrim(coalesce(p_job_title,'')),''),
    status=p_status
  where id=p_worker_id and org_id=p_org_id;
  if not found then raise exception 'worker_not_found'; end if;
  return p_worker_id;
end $$;

create or replace function public.people_create_time_entry(
  p_org_id uuid,p_worker_id uuid,p_work_date date,p_clock_in timestamptz,p_clock_out timestamptz,p_break_minutes integer default 0
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_own boolean;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select exists(select 1 from public.people_workers where id=p_worker_id and org_id=p_org_id and user_id=auth.uid()) into v_own;
  if not public.has_identity_permission(p_org_id,'hr.write')
     and not (v_own and public.has_identity_permission(p_org_id,'payroll.self')) then
    raise exception 'people_time_write_required';
  end if;
  if p_work_date is null or p_break_minutes < 0 or (p_clock_out is not null and (p_clock_in is null or p_clock_out <= p_clock_in)) then
    raise exception 'invalid_time_entry';
  end if;
  insert into public.people_time_entries(org_id,worker_id,work_date,clock_in,clock_out,break_minutes,created_by)
  values(p_org_id,p_worker_id,p_work_date,p_clock_in,p_clock_out,coalesce(p_break_minutes,0),auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.people_transition_time_entry(p_org_id uuid,p_entry_id uuid,p_action text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_status text; v_worker uuid; v_own boolean; v_next text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select status,worker_id into v_status,v_worker from public.people_time_entries where id=p_entry_id and org_id=p_org_id for update;
  if not found then raise exception 'time_entry_not_found'; end if;
  select exists(select 1 from public.people_workers where id=v_worker and org_id=p_org_id and user_id=auth.uid()) into v_own;
  if p_action='submit' then
    if v_status <> 'draft' then raise exception 'time_entry_submit_invalid_state'; end if;
    if not public.has_identity_permission(p_org_id,'hr.write')
       and not (v_own and public.has_identity_permission(p_org_id,'payroll.self')) then raise exception 'people_time_write_required'; end if;
    v_next:='submitted';
  elsif p_action in ('approve','reject') then
    if v_status <> 'submitted' then raise exception 'time_entry_review_invalid_state'; end if;
    if not public.has_identity_permission(p_org_id,'hr.write') then raise exception 'hr_write_required'; end if;
    v_next:=case when p_action='approve' then 'approved' else 'rejected' end;
  else raise exception 'invalid_time_action';
  end if;
  update public.people_time_entries set status=v_next,
    approved_by=case when v_next='approved' then auth.uid() else null end,
    approved_at=case when v_next='approved' then now() else null end
  where id=p_entry_id and org_id=p_org_id;
  return p_entry_id;
end $$;

create or replace function public.people_create_requisition(p_org_id uuid,p_title text,p_department text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.has_identity_permission(p_org_id,'hr.write') then raise exception 'hr_write_required'; end if;
  insert into public.people_requisitions(org_id,title,department,status,created_by)
  values(p_org_id,btrim(p_title),nullif(btrim(coalesce(p_department,'')),''),'open',auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.people_create_candidate(p_org_id uuid,p_full_name text,p_email text default null,p_phone text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.has_identity_permission(p_org_id,'hr.write') then raise exception 'hr_write_required'; end if;
  insert into public.people_candidates(org_id,full_name,email,phone,created_by)
  values(p_org_id,btrim(p_full_name),nullif(btrim(coalesce(p_email,'')),''),nullif(btrim(coalesce(p_phone,'')),''),auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.people_create_application(p_org_id uuid,p_requisition_id uuid,p_candidate_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.has_identity_permission(p_org_id,'hr.write') then raise exception 'hr_write_required'; end if;
  insert into public.people_applications(org_id,requisition_id,candidate_id,created_by)
  select p_org_id,r.id,c.id,auth.uid() from public.people_requisitions r, public.people_candidates c
  where r.id=p_requisition_id and r.org_id=p_org_id and c.id=p_candidate_id and c.org_id=p_org_id
  returning id into v_id;
  if v_id is null then raise exception 'requisition_or_candidate_not_found'; end if;
  return v_id;
end $$;

create or replace function public.people_transition_application(p_org_id uuid,p_application_id uuid,p_next_stage text,p_reason text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_current text; v_allowed boolean;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.has_identity_permission(p_org_id,'hr.write') then raise exception 'hr_write_required'; end if;
  select stage into v_current from public.people_applications where id=p_application_id and org_id=p_org_id for update;
  if not found then raise exception 'application_not_found'; end if;
  if v_current in ('hired','rejected','withdrawn') then raise exception 'terminal_application_state'; end if;
  v_allowed:=case v_current
    when 'applied' then p_next_stage in ('screening','rejected','withdrawn')
    when 'screening' then p_next_stage in ('assessment','interview','rejected','withdrawn')
    when 'assessment' then p_next_stage in ('interview','rejected','withdrawn')
    when 'interview' then p_next_stage in ('offer','rejected','withdrawn')
    when 'offer' then p_next_stage in ('hired','rejected','withdrawn')
    else false end;
  if not v_allowed then raise exception 'invalid_application_transition'; end if;
  if p_next_stage in ('rejected','withdrawn') and nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'decision_reason_required'; end if;
  update public.people_applications set stage=p_next_stage,
    decision_reason=case when p_next_stage in ('rejected','withdrawn') then btrim(p_reason) else null end
  where id=p_application_id and org_id=p_org_id;
  return p_application_id;
end $$;

create or replace function public.people_set_compensation(
  p_org_id uuid,p_worker_id uuid,p_pay_type text,p_hourly_rate numeric,p_annual_salary numeric,p_effective_from date
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.has_identity_permission(p_org_id,'payroll.write') then raise exception 'payroll_write_required'; end if;
  if (p_pay_type='hourly' and (p_hourly_rate is null or p_annual_salary is not null))
     or (p_pay_type='salary' and (p_annual_salary is null or p_hourly_rate is not null))
     or p_pay_type not in ('hourly','salary') then raise exception 'invalid_compensation'; end if;
  update public.people_compensation set effective_to=p_effective_from-1
    where org_id=p_org_id and worker_id=p_worker_id and effective_to is null and effective_from < p_effective_from;
  insert into public.people_compensation(org_id,worker_id,pay_type,hourly_rate,annual_salary,effective_from,created_by)
  values(p_org_id,p_worker_id,p_pay_type,p_hourly_rate,p_annual_salary,p_effective_from,auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.people_set_deduction(
  p_org_id uuid,p_worker_id uuid,p_code text,p_label text,p_treatment text,p_calculation_type text,p_amount numeric,p_active boolean default true
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_code text:=upper(btrim(p_code));
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.has_identity_permission(p_org_id,'payroll.write') then raise exception 'payroll_write_required'; end if;
  if p_treatment not in ('pretax','posttax') or p_calculation_type not in ('fixed','percent') or p_amount < 0
     or (p_calculation_type='percent' and p_amount > 1) then raise exception 'invalid_deduction'; end if;
  insert into public.people_deductions(org_id,worker_id,code,label,treatment,calculation_type,amount,active,created_by)
  values(p_org_id,p_worker_id,v_code,btrim(p_label),p_treatment,p_calculation_type,p_amount,coalesce(p_active,true),auth.uid())
  on conflict(org_id,worker_id,code) do update set label=excluded.label,treatment=excluded.treatment,
    calculation_type=excluded.calculation_type,amount=excluded.amount,active=excluded.active
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.people_create_worker(uuid,text,text,text,text,text) from public,anon;
revoke all on function public.people_update_worker(uuid,uuid,text,text,text,text,text) from public,anon;
revoke all on function public.people_create_time_entry(uuid,uuid,date,timestamptz,timestamptz,integer) from public,anon;
revoke all on function public.people_transition_time_entry(uuid,uuid,text) from public,anon;
revoke all on function public.people_create_requisition(uuid,text,text) from public,anon;
revoke all on function public.people_create_candidate(uuid,text,text,text) from public,anon;
revoke all on function public.people_create_application(uuid,uuid,uuid) from public,anon;
revoke all on function public.people_transition_application(uuid,uuid,text,text) from public,anon;
revoke all on function public.people_set_compensation(uuid,uuid,text,numeric,numeric,date) from public,anon;
revoke all on function public.people_set_deduction(uuid,uuid,text,text,text,text,numeric,boolean) from public,anon;

grant execute on function public.people_create_worker(uuid,text,text,text,text,text) to authenticated;
grant execute on function public.people_update_worker(uuid,uuid,text,text,text,text,text) to authenticated;
grant execute on function public.people_create_time_entry(uuid,uuid,date,timestamptz,timestamptz,integer) to authenticated;
grant execute on function public.people_transition_time_entry(uuid,uuid,text) to authenticated;
grant execute on function public.people_create_requisition(uuid,text,text) to authenticated;
grant execute on function public.people_create_candidate(uuid,text,text,text) to authenticated;
grant execute on function public.people_create_application(uuid,uuid,uuid) to authenticated;
grant execute on function public.people_transition_application(uuid,uuid,text,text) to authenticated;
grant execute on function public.people_set_compensation(uuid,uuid,text,numeric,numeric,date) to authenticated;
grant execute on function public.people_set_deduction(uuid,uuid,text,text,text,text,numeric,boolean) to authenticated;
