-- ATLAS Payroll governed commercial core.
-- Computes payroll line arithmetic and lifecycle only. Tax determination, filing, remittance and direct deposit are external-gated.

create table if not exists public.payroll_schedules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  frequency text not null check (frequency in ('weekly','biweekly','semimonthly','monthly')),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,name)
);

create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  schedule_id uuid references public.payroll_schedules(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  pay_date date not null,
  status text not null default 'draft' check (status in ('draft','calculated','approved','locked','void')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  void_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique(org_id,period_start,period_end,pay_date)
);
create index if not exists payroll_runs_org_date_idx on public.payroll_runs(org_id,pay_date desc);

create table if not exists public.payroll_run_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.payroll_runs(id) on delete cascade,
  worker_id uuid not null references public.people_workers(id) on delete restrict,
  regular_hours numeric(10,2) not null default 0 check (regular_hours >= 0),
  overtime_hours numeric(10,2) not null default 0 check (overtime_hours >= 0),
  hourly_rate numeric(14,4) check (hourly_rate is null or hourly_rate >= 0),
  overtime_multiplier numeric(6,3) not null default 1.5 check (overtime_multiplier >= 1),
  salary_period_amount numeric(16,2) check (salary_period_amount is null or salary_period_amount >= 0),
  gross_pay numeric(16,2) not null default 0 check (gross_pay >= 0),
  pretax_deductions numeric(16,2) not null default 0 check (pretax_deductions >= 0),
  taxes_withheld numeric(16,2) not null default 0 check (taxes_withheld >= 0),
  posttax_deductions numeric(16,2) not null default 0 check (posttax_deductions >= 0),
  net_pay numeric(16,2) not null default 0 check (net_pay >= 0),
  calculation jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,run_id,worker_id),
  check ((hourly_rate is null) <> (salary_period_amount is null)),
  check (pretax_deductions + taxes_withheld + posttax_deductions <= gross_pay)
);
create index if not exists payroll_run_lines_org_run_idx on public.payroll_run_lines(org_id,run_id);

create or replace function public.payroll_touch_updated_at()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin new.updated_at:=now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['payroll_schedules','payroll_runs','payroll_run_lines']
  loop
    execute format('drop trigger if exists %I_touch on public.%I',t,t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.payroll_touch_updated_at()',t,t);
    execute format('drop trigger if exists %I_audit on public.%I',t,t);
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row_change()',t,t);
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke insert, update, delete on public.%I from authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
  end loop;
end $$;

drop policy if exists payroll_schedules_read on public.payroll_schedules;
create policy payroll_schedules_read on public.payroll_schedules for select to authenticated
using (public.has_identity_permission(org_id,'payroll.read') or public.has_identity_permission(org_id,'payroll.write'));

drop policy if exists payroll_runs_read on public.payroll_runs;
create policy payroll_runs_read on public.payroll_runs for select to authenticated
using (public.has_identity_permission(org_id,'payroll.read') or public.has_identity_permission(org_id,'payroll.write'));

drop policy if exists payroll_run_lines_read on public.payroll_run_lines;
create policy payroll_run_lines_read on public.payroll_run_lines for select to authenticated
using (
  public.has_identity_permission(org_id,'payroll.read')
  or public.has_identity_permission(org_id,'payroll.write')
  or exists (
    select 1 from public.people_workers w
    where w.id=payroll_run_lines.worker_id and w.org_id=payroll_run_lines.org_id
      and w.user_id=(select auth.uid()) and public.has_identity_permission(payroll_run_lines.org_id,'payroll.self')
  )
);

create or replace function public.payroll_create_schedule(p_org_id uuid,p_name text,p_frequency text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.has_identity_permission(p_org_id,'payroll.write') then raise exception 'payroll_write_required'; end if;
  if p_frequency not in ('weekly','biweekly','semimonthly','monthly') then raise exception 'invalid_pay_frequency'; end if;
  insert into public.payroll_schedules(org_id,name,frequency,created_by)
  values(p_org_id,btrim(p_name),p_frequency,auth.uid())
  on conflict(org_id,name) do update set frequency=excluded.frequency,active=true
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.payroll_create_run(
  p_org_id uuid,p_schedule_id uuid,p_period_start date,p_period_end date,p_pay_date date
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.has_identity_permission(p_org_id,'payroll.write') then raise exception 'payroll_write_required'; end if;
  if p_period_end < p_period_start or p_pay_date < p_period_end then raise exception 'invalid_pay_period'; end if;
  if p_schedule_id is not null and not exists(select 1 from public.payroll_schedules where id=p_schedule_id and org_id=p_org_id and active) then raise exception 'pay_schedule_not_found'; end if;
  insert into public.payroll_runs(org_id,schedule_id,period_start,period_end,pay_date,created_by)
  values(p_org_id,p_schedule_id,p_period_start,p_period_end,p_pay_date,auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.payroll_upsert_line(
  p_org_id uuid,p_run_id uuid,p_worker_id uuid,
  p_regular_hours numeric,p_overtime_hours numeric,p_hourly_rate numeric,p_overtime_multiplier numeric,
  p_salary_period_amount numeric,p_pretax_deductions numeric,p_taxes_withheld numeric,p_posttax_deductions numeric
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_gross numeric(16,2); v_net numeric(16,2); v_status text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.has_identity_permission(p_org_id,'payroll.write') then raise exception 'payroll_write_required'; end if;
  select status into v_status from public.payroll_runs where id=p_run_id and org_id=p_org_id for update;
  if not found then raise exception 'payroll_run_not_found'; end if;
  if v_status not in ('draft','calculated') then raise exception 'payroll_run_not_editable'; end if;
  if not exists(select 1 from public.people_workers where id=p_worker_id and org_id=p_org_id and status='active') then raise exception 'active_worker_not_found'; end if;
  if (p_hourly_rate is null) = (p_salary_period_amount is null) then raise exception 'choose_hourly_or_salary'; end if;
  if coalesce(p_regular_hours,0)<0 or coalesce(p_overtime_hours,0)<0 or coalesce(p_pretax_deductions,0)<0 or coalesce(p_taxes_withheld,0)<0 or coalesce(p_posttax_deductions,0)<0 then raise exception 'negative_payroll_input'; end if;

  v_gross:=round(case when p_hourly_rate is not null
    then coalesce(p_regular_hours,0)*p_hourly_rate + coalesce(p_overtime_hours,0)*p_hourly_rate*coalesce(p_overtime_multiplier,1.5)
    else p_salary_period_amount end,2);
  v_net:=round(v_gross-coalesce(p_pretax_deductions,0)-coalesce(p_taxes_withheld,0)-coalesce(p_posttax_deductions,0),2);
  if v_net < 0 then raise exception 'deductions_exceed_gross'; end if;

  insert into public.payroll_run_lines(
    org_id,run_id,worker_id,regular_hours,overtime_hours,hourly_rate,overtime_multiplier,salary_period_amount,
    gross_pay,pretax_deductions,taxes_withheld,posttax_deductions,net_pay,calculation,created_by
  ) values(
    p_org_id,p_run_id,p_worker_id,coalesce(p_regular_hours,0),coalesce(p_overtime_hours,0),p_hourly_rate,coalesce(p_overtime_multiplier,1.5),p_salary_period_amount,
    v_gross,coalesce(p_pretax_deductions,0),coalesce(p_taxes_withheld,0),coalesce(p_posttax_deductions,0),v_net,
    jsonb_build_object('version','payroll-core-v1','tax_source','governed_input','direct_deposit_executed',false,'tax_filing_executed',false),auth.uid()
  )
  on conflict(org_id,run_id,worker_id) do update set
    regular_hours=excluded.regular_hours,overtime_hours=excluded.overtime_hours,hourly_rate=excluded.hourly_rate,
    overtime_multiplier=excluded.overtime_multiplier,salary_period_amount=excluded.salary_period_amount,gross_pay=excluded.gross_pay,
    pretax_deductions=excluded.pretax_deductions,taxes_withheld=excluded.taxes_withheld,posttax_deductions=excluded.posttax_deductions,
    net_pay=excluded.net_pay,calculation=excluded.calculation
  returning id into v_id;
  update public.payroll_runs set status='draft',approved_by=null,approved_at=null where id=p_run_id and org_id=p_org_id;
  return v_id;
end $$;

create or replace function public.payroll_transition_run(p_org_id uuid,p_run_id uuid,p_action text,p_reason text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_status text; v_next text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select status into v_status from public.payroll_runs where id=p_run_id and org_id=p_org_id for update;
  if not found then raise exception 'payroll_run_not_found'; end if;

  if p_action='calculate' then
    if not public.has_identity_permission(p_org_id,'payroll.write') then raise exception 'payroll_write_required'; end if;
    if v_status not in ('draft','calculated') then raise exception 'payroll_calculate_invalid_state'; end if;
    if not exists(select 1 from public.payroll_run_lines where org_id=p_org_id and run_id=p_run_id) then raise exception 'payroll_lines_required'; end if;
    v_next:='calculated';
  elsif p_action='approve' then
    if not public.has_identity_permission(p_org_id,'payroll.approve') then raise exception 'payroll_approve_required'; end if;
    if v_status <> 'calculated' then raise exception 'payroll_approve_invalid_state'; end if;
    v_next:='approved';
  elsif p_action='lock' then
    if not public.has_identity_permission(p_org_id,'payroll.approve') then raise exception 'payroll_approve_required'; end if;
    if v_status <> 'approved' then raise exception 'payroll_lock_invalid_state'; end if;
    v_next:='locked';
  elsif p_action='void' then
    if not public.has_identity_permission(p_org_id,'payroll.approve') then raise exception 'payroll_approve_required'; end if;
    if v_status='locked' then raise exception 'locked_payroll_run_immutable'; end if;
    if nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'void_reason_required'; end if;
    v_next:='void';
  else raise exception 'invalid_payroll_action';
  end if;

  update public.payroll_runs set status=v_next,
    approved_by=case when v_next in ('approved','locked') then auth.uid() else approved_by end,
    approved_at=case when v_next in ('approved','locked') then coalesce(approved_at,now()) else approved_at end,
    void_reason=case when v_next='void' then btrim(p_reason) else void_reason end
  where id=p_run_id and org_id=p_org_id;
  return p_run_id;
end $$;

revoke all on function public.payroll_create_schedule(uuid,text,text) from public,anon;
revoke all on function public.payroll_create_run(uuid,uuid,date,date,date) from public,anon;
revoke all on function public.payroll_upsert_line(uuid,uuid,uuid,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric) from public,anon;
revoke all on function public.payroll_transition_run(uuid,uuid,text,text) from public,anon;
grant execute on function public.payroll_create_schedule(uuid,text,text) to authenticated;
grant execute on function public.payroll_create_run(uuid,uuid,date,date,date) to authenticated;
grant execute on function public.payroll_upsert_line(uuid,uuid,uuid,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric) to authenticated;
grant execute on function public.payroll_transition_run(uuid,uuid,text,text) to authenticated;
