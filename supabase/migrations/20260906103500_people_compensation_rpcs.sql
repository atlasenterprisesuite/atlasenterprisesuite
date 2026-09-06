begin;

drop policy if exists people_compensation_write on public.people_compensation;
drop policy if exists people_deductions_write on public.people_deductions;

create or replace function public.create_people_compensation(
  organization_uuid uuid,
  employee_uuid uuid,
  pay_type_value text,
  hourly_rate_value numeric,
  annual_salary_value numeric,
  effective_from_value date,
  effective_to_value date
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  compensation_id uuid;
  overlaps_existing boolean;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;
  if not public.has_identity_permission(organization_uuid, 'payroll.write') then
    raise exception 'payroll.write permission is required';
  end if;
  if not exists (
    select 1 from public.employees e
    where e.org_id = organization_uuid and e.id = employee_uuid
  ) then
    raise exception 'Employee not found in organization';
  end if;
  if effective_from_value is null then
    raise exception 'Effective start is required';
  end if;
  if effective_to_value is not null and effective_to_value < effective_from_value then
    raise exception 'Effective end must be on or after effective start';
  end if;

  if pay_type_value = 'hourly' then
    if hourly_rate_value is null or hourly_rate_value < 0 or annual_salary_value is not null then
      raise exception 'Hourly compensation requires a non-negative hourly rate and no annual salary';
    end if;
  elsif pay_type_value = 'salary' then
    if annual_salary_value is null or annual_salary_value < 0 or hourly_rate_value is not null then
      raise exception 'Salary compensation requires a non-negative annual salary and no hourly rate';
    end if;
  else
    raise exception 'Unsupported compensation pay type';
  end if;

  select exists (
    select 1
    from public.people_compensation pc
    where pc.org_id = organization_uuid
      and pc.employee_id = employee_uuid
      and daterange(pc.effective_from, pc.effective_to, '[]')
          && daterange(effective_from_value, effective_to_value, '[]')
  ) into overlaps_existing;

  if overlaps_existing then
    raise exception 'Compensation effective range overlaps an existing record';
  end if;

  insert into public.people_compensation (
    org_id, employee_id, pay_type, hourly_rate, annual_salary, effective_from, effective_to
  ) values (
    organization_uuid, employee_uuid, pay_type_value, hourly_rate_value,
    annual_salary_value, effective_from_value, effective_to_value
  ) returning id into compensation_id;

  insert into public.audit_logs (
    org_id, user_id, action, table_name, record_id, new_data
  ) values (
    organization_uuid,
    actor,
    'people.compensation.create',
    'people_compensation',
    compensation_id::text,
    jsonb_build_object(
      'employee_id', employee_uuid,
      'pay_type', pay_type_value,
      'effective_from', effective_from_value,
      'effective_to', effective_to_value
    )
  );

  return compensation_id;
end;
$$;

create or replace function public.set_people_deduction(
  organization_uuid uuid,
  employee_uuid uuid,
  code_value text,
  label_value text,
  treatment_value text,
  calculation_type_value text,
  amount_value numeric,
  active_value boolean
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  deduction_id uuid;
  previous_row public.people_deductions%rowtype;
  normalized_code text := upper(btrim(code_value));
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;
  if not public.has_identity_permission(organization_uuid, 'payroll.write') then
    raise exception 'payroll.write permission is required';
  end if;
  if not exists (
    select 1 from public.employees e
    where e.org_id = organization_uuid and e.id = employee_uuid
  ) then
    raise exception 'Employee not found in organization';
  end if;
  if normalized_code = '' then
    raise exception 'Deduction code is required';
  end if;
  if btrim(label_value) = '' then
    raise exception 'Deduction label is required';
  end if;
  if treatment_value not in ('pretax', 'posttax') then
    raise exception 'Unsupported deduction treatment';
  end if;
  if calculation_type_value not in ('fixed', 'percent') then
    raise exception 'Unsupported deduction calculation type';
  end if;
  if amount_value is null or amount_value < 0 then
    raise exception 'Deduction amount must be non-negative';
  end if;
  if calculation_type_value = 'percent' and amount_value > 1 then
    raise exception 'Percent deduction amount must be between 0 and 1';
  end if;

  select * into previous_row
  from public.people_deductions
  where org_id = organization_uuid
    and employee_id = employee_uuid
    and code = normalized_code
  for update;

  insert into public.people_deductions (
    org_id, employee_id, code, label, treatment, calculation_type, amount, active
  ) values (
    organization_uuid, employee_uuid, normalized_code, btrim(label_value), treatment_value,
    calculation_type_value, amount_value, coalesce(active_value, true)
  )
  on conflict (org_id, employee_id, code) do update set
    label = excluded.label,
    treatment = excluded.treatment,
    calculation_type = excluded.calculation_type,
    amount = excluded.amount,
    active = excluded.active,
    updated_at = now()
  returning id into deduction_id;

  insert into public.audit_logs (
    org_id, user_id, action, table_name, record_id, old_data, new_data
  ) values (
    organization_uuid,
    actor,
    case when previous_row.id is null then 'people.deduction.create' else 'people.deduction.update' end,
    'people_deductions',
    deduction_id::text,
    case when previous_row.id is null then null else jsonb_build_object(
      'code', previous_row.code,
      'label', previous_row.label,
      'treatment', previous_row.treatment,
      'calculation_type', previous_row.calculation_type,
      'amount', previous_row.amount,
      'active', previous_row.active
    ) end,
    jsonb_build_object(
      'employee_id', employee_uuid,
      'code', normalized_code,
      'label', btrim(label_value),
      'treatment', treatment_value,
      'calculation_type', calculation_type_value,
      'amount', amount_value,
      'active', coalesce(active_value, true)
    )
  );

  return deduction_id;
end;
$$;

revoke all on function public.create_people_compensation(uuid, uuid, text, numeric, numeric, date, date) from public, anon;
revoke all on function public.set_people_deduction(uuid, uuid, text, text, text, text, numeric, boolean) from public, anon;
grant execute on function public.create_people_compensation(uuid, uuid, text, numeric, numeric, date, date) to authenticated;
grant execute on function public.set_people_deduction(uuid, uuid, text, text, text, text, numeric, boolean) to authenticated;

commit;
