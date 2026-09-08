begin;

alter table public.people_payroll_runs
  add column void_reason text;

alter table public.people_payroll_runs
  add constraint people_payroll_runs_void_reason_check
  check (
    (status = 'void' and void_reason is not null and btrim(void_reason) <> '')
    or (status <> 'void' and void_reason is null)
  );

drop policy if exists people_payroll_runs_write on public.people_payroll_runs;
drop policy if exists people_payroll_lines_write on public.people_payroll_lines;

create or replace function public.create_people_payroll_run(
  organization_uuid uuid,
  period_start_date date,
  period_end_date date,
  pay_date_value date
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  run_id uuid;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;
  if not public.has_identity_permission(organization_uuid, 'payroll.write') then
    raise exception 'payroll.write permission is required';
  end if;
  if period_start_date is null or period_end_date is null or pay_date_value is null then
    raise exception 'Payroll period and pay date are required';
  end if;
  if period_end_date < period_start_date then
    raise exception 'Payroll period end must be on or after period start';
  end if;

  insert into public.people_payroll_runs (
    org_id, period_start, period_end, pay_date, status
  ) values (
    organization_uuid, period_start_date, period_end_date, pay_date_value, 'draft'
  ) returning id into run_id;

  insert into public.audit_logs (
    org_id, user_id, action, table_name, record_id, new_data
  ) values (
    organization_uuid,
    actor,
    'people.payroll.create',
    'people_payroll_runs',
    run_id::text,
    jsonb_build_object(
      'period_start', period_start_date,
      'period_end', period_end_date,
      'pay_date', pay_date_value,
      'status', 'draft'
    )
  );

  return run_id;
end;
$$;

create or replace function public.upsert_people_payroll_line(
  organization_uuid uuid,
  payroll_run_uuid uuid,
  employee_uuid uuid,
  regular_hours_value numeric,
  overtime_hours_value numeric,
  hourly_rate_value numeric,
  overtime_multiplier_value numeric,
  salary_period_amount_value numeric,
  pretax_deductions_value numeric,
  taxes_withheld_value numeric,
  posttax_deductions_value numeric,
  client_gross_pay numeric,
  client_net_pay numeric
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  run_status text;
  regular_pay_value numeric(14,2) := 0;
  overtime_pay_value numeric(14,2) := 0;
  gross_pay_value numeric(14,2);
  net_pay_value numeric(14,2);
  line_id uuid;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;
  if not public.has_identity_permission(organization_uuid, 'payroll.write') then
    raise exception 'payroll.write permission is required';
  end if;

  select status into run_status
  from public.people_payroll_runs
  where org_id = organization_uuid and id = payroll_run_uuid
  for update;

  if not found then
    raise exception 'Payroll run not found';
  end if;
  if run_status <> 'draft' then
    raise exception 'Payroll lines can only be edited while the run is draft';
  end if;
  if not exists (
    select 1 from public.employees e
    where e.org_id = organization_uuid and e.id = employee_uuid
  ) then
    raise exception 'Employee not found in payroll organization';
  end if;

  if regular_hours_value is null or regular_hours_value < 0 then
    raise exception 'Regular hours cannot be negative';
  end if;
  if overtime_hours_value is null or overtime_hours_value < 0 then
    raise exception 'Overtime hours cannot be negative';
  end if;
  if overtime_multiplier_value is null or overtime_multiplier_value < 0 then
    raise exception 'Overtime multiplier cannot be negative';
  end if;
  if pretax_deductions_value is null or pretax_deductions_value < 0
     or taxes_withheld_value is null or taxes_withheld_value < 0
     or posttax_deductions_value is null or posttax_deductions_value < 0 then
    raise exception 'Payroll reductions cannot be negative';
  end if;

  if hourly_rate_value is not null and salary_period_amount_value is not null then
    raise exception 'Use either hourly rate or salary-period amount, not both';
  end if;
  if hourly_rate_value is null and salary_period_amount_value is null then
    raise exception 'Hourly rate or salary-period amount is required';
  end if;

  if salary_period_amount_value is not null then
    if salary_period_amount_value < 0 then
      raise exception 'Salary-period amount cannot be negative';
    end if;
    if regular_hours_value <> 0 or overtime_hours_value <> 0 then
      raise exception 'Salary-period payroll cannot include hourly earnings';
    end if;
    gross_pay_value := round(salary_period_amount_value, 2);
  else
    if hourly_rate_value < 0 then
      raise exception 'Hourly rate cannot be negative';
    end if;
    if overtime_hours_value > 0 and overtime_multiplier_value <= 0 then
      raise exception 'Overtime multiplier must be greater than zero when overtime hours exist';
    end if;
    regular_pay_value := round(regular_hours_value * hourly_rate_value, 2);
    overtime_pay_value := round(overtime_hours_value * hourly_rate_value * overtime_multiplier_value, 2);
    gross_pay_value := regular_pay_value + overtime_pay_value;
  end if;

  pretax_deductions_value := round(pretax_deductions_value, 2);
  taxes_withheld_value := round(taxes_withheld_value, 2);
  posttax_deductions_value := round(posttax_deductions_value, 2);
  net_pay_value := gross_pay_value - pretax_deductions_value - taxes_withheld_value - posttax_deductions_value;

  if net_pay_value < 0 then
    raise exception 'Payroll deductions and withholding cannot exceed gross pay';
  end if;
  if round(client_gross_pay, 2) is distinct from gross_pay_value
     or round(client_net_pay, 2) is distinct from net_pay_value then
    raise exception 'Client payroll calculation does not match server calculation';
  end if;

  insert into public.people_payroll_lines (
    org_id,
    payroll_run_id,
    employee_id,
    regular_hours,
    overtime_hours,
    hourly_rate,
    salary_period_amount,
    gross_pay,
    pretax_deductions,
    taxes_withheld,
    posttax_deductions,
    net_pay,
    calculation
  ) values (
    organization_uuid,
    payroll_run_uuid,
    employee_uuid,
    regular_hours_value,
    overtime_hours_value,
    hourly_rate_value,
    salary_period_amount_value,
    gross_pay_value,
    pretax_deductions_value,
    taxes_withheld_value,
    posttax_deductions_value,
    net_pay_value,
    jsonb_build_object(
      'calculation_version', 'people-payroll-v1',
      'overtime_multiplier', overtime_multiplier_value,
      'regular_pay', regular_pay_value,
      'overtime_pay', overtime_pay_value,
      'gross_pay', gross_pay_value,
      'net_pay', net_pay_value
    )
  )
  on conflict (org_id, payroll_run_id, employee_id)
  do update set
    regular_hours = excluded.regular_hours,
    overtime_hours = excluded.overtime_hours,
    hourly_rate = excluded.hourly_rate,
    salary_period_amount = excluded.salary_period_amount,
    gross_pay = excluded.gross_pay,
    pretax_deductions = excluded.pretax_deductions,
    taxes_withheld = excluded.taxes_withheld,
    posttax_deductions = excluded.posttax_deductions,
    net_pay = excluded.net_pay,
    calculation = excluded.calculation,
    updated_at = now()
  returning id into line_id;

  insert into public.audit_logs (
    org_id, user_id, action, table_name, record_id, new_data
  ) values (
    organization_uuid,
    actor,
    'people.payroll.line.upsert',
    'people_payroll_lines',
    line_id::text,
    jsonb_build_object(
      'payroll_run_id', payroll_run_uuid,
      'employee_id', employee_uuid,
      'gross_pay', gross_pay_value,
      'net_pay', net_pay_value,
      'calculation_version', 'people-payroll-v1'
    )
  );

  return line_id;
end;
$$;

create or replace function public.calculate_people_payroll_run(
  organization_uuid uuid,
  payroll_run_uuid uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  current_status text;
  line_count integer;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if not public.has_identity_permission(organization_uuid, 'payroll.write') then
    raise exception 'payroll.write permission is required';
  end if;

  select status into current_status
  from public.people_payroll_runs
  where org_id = organization_uuid and id = payroll_run_uuid
  for update;

  if not found then raise exception 'Payroll run not found'; end if;
  if current_status <> 'draft' then raise exception 'Only draft payroll runs can be calculated'; end if;

  select count(*) into line_count
  from public.people_payroll_lines
  where org_id = organization_uuid and payroll_run_id = payroll_run_uuid;
  if line_count = 0 then raise exception 'Payroll run requires at least one calculated line'; end if;

  update public.people_payroll_runs
  set status = 'calculated', updated_at = now()
  where org_id = organization_uuid and id = payroll_run_uuid;

  insert into public.audit_logs (org_id, user_id, action, table_name, record_id, old_data, new_data)
  values (
    organization_uuid, actor, 'people.payroll.calculate', 'people_payroll_runs', payroll_run_uuid::text,
    jsonb_build_object('status', current_status), jsonb_build_object('status', 'calculated', 'line_count', line_count)
  );
  return payroll_run_uuid;
end;
$$;

create or replace function public.approve_people_payroll_run(
  organization_uuid uuid,
  payroll_run_uuid uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  current_status text;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if not public.has_identity_permission(organization_uuid, 'payroll.approve') then
    raise exception 'payroll.approve permission is required';
  end if;

  select status into current_status
  from public.people_payroll_runs
  where org_id = organization_uuid and id = payroll_run_uuid
  for update;
  if not found then raise exception 'Payroll run not found'; end if;
  if current_status <> 'calculated' then raise exception 'Payroll run must be calculated before approval'; end if;

  update public.people_payroll_runs
  set status = 'approved', approved_by = actor, approved_at = now(), updated_at = now()
  where org_id = organization_uuid and id = payroll_run_uuid;

  insert into public.audit_logs (org_id, user_id, action, table_name, record_id, old_data, new_data)
  values (
    organization_uuid, actor, 'people.payroll.approve', 'people_payroll_runs', payroll_run_uuid::text,
    jsonb_build_object('status', current_status), jsonb_build_object('status', 'approved', 'approved_by', actor)
  );
  return payroll_run_uuid;
end;
$$;

create or replace function public.lock_people_payroll_run(
  organization_uuid uuid,
  payroll_run_uuid uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  current_status text;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if not public.has_identity_permission(organization_uuid, 'payroll.approve') then
    raise exception 'payroll.approve permission is required';
  end if;

  select status into current_status
  from public.people_payroll_runs
  where org_id = organization_uuid and id = payroll_run_uuid
  for update;
  if not found then raise exception 'Payroll run not found'; end if;
  if current_status <> 'approved' then raise exception 'Payroll run must be approved before locking'; end if;

  update public.people_payroll_runs
  set status = 'locked', updated_at = now()
  where org_id = organization_uuid and id = payroll_run_uuid;

  insert into public.audit_logs (org_id, user_id, action, table_name, record_id, old_data, new_data)
  values (
    organization_uuid, actor, 'people.payroll.lock', 'people_payroll_runs', payroll_run_uuid::text,
    jsonb_build_object('status', current_status), jsonb_build_object('status', 'locked')
  );
  return payroll_run_uuid;
end;
$$;

create or replace function public.void_people_payroll_run(
  organization_uuid uuid,
  payroll_run_uuid uuid,
  void_reason_value text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  current_status text;
  reason text := btrim(coalesce(void_reason_value, ''));
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if not public.has_identity_permission(organization_uuid, 'payroll.approve') then
    raise exception 'payroll.approve permission is required';
  end if;
  if reason = '' then raise exception 'Void reason is required'; end if;

  select status into current_status
  from public.people_payroll_runs
  where org_id = organization_uuid and id = payroll_run_uuid
  for update;
  if not found then raise exception 'Payroll run not found'; end if;
  if current_status = 'void' then raise exception 'Payroll run is already void'; end if;

  update public.people_payroll_runs
  set status = 'void', void_reason = reason, updated_at = now()
  where org_id = organization_uuid and id = payroll_run_uuid;

  insert into public.audit_logs (org_id, user_id, action, table_name, record_id, old_data, new_data)
  values (
    organization_uuid, actor, 'people.payroll.void', 'people_payroll_runs', payroll_run_uuid::text,
    jsonb_build_object('status', current_status), jsonb_build_object('status', 'void', 'reason', reason)
  );
  return payroll_run_uuid;
end;
$$;

revoke all on function public.create_people_payroll_run(uuid, date, date, date) from public, anon;
revoke all on function public.upsert_people_payroll_line(uuid, uuid, uuid, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric) from public, anon;
revoke all on function public.calculate_people_payroll_run(uuid, uuid) from public, anon;
revoke all on function public.approve_people_payroll_run(uuid, uuid) from public, anon;
revoke all on function public.lock_people_payroll_run(uuid, uuid) from public, anon;
revoke all on function public.void_people_payroll_run(uuid, uuid, text) from public, anon;

grant execute on function public.create_people_payroll_run(uuid, date, date, date) to authenticated;
grant execute on function public.upsert_people_payroll_line(uuid, uuid, uuid, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric) to authenticated;
grant execute on function public.calculate_people_payroll_run(uuid, uuid) to authenticated;
grant execute on function public.approve_people_payroll_run(uuid, uuid) to authenticated;
grant execute on function public.lock_people_payroll_run(uuid, uuid) to authenticated;
grant execute on function public.void_people_payroll_run(uuid, uuid, text) to authenticated;

commit;
