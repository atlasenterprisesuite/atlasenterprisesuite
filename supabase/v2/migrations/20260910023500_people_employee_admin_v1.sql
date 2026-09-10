-- ATLAS People employee administration v1
-- Governed employee create/update RPCs plus FK index coverage for People tables.

create schema if not exists private;

create or replace function private.create_people_employee(
  organization_uuid uuid,
  full_name_value text,
  department_value text default null,
  job_title_value text default null,
  status_value text default 'active'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_employee_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select organization.tenant_id into v_tenant_id
  from public.organizations organization
  where organization.id = organization_uuid
    and organization.active = true;

  if v_tenant_id is null
     or not public.atlas_is_org_member(v_tenant_id, organization_uuid)
     or not public.has_identity_permission(v_tenant_id, organization_uuid, 'hr.write') then
    raise exception 'hr.write permission is required';
  end if;

  if length(trim(coalesce(full_name_value, ''))) = 0 then
    raise exception 'Employee full name is required.';
  end if;

  insert into public.employees(
    tenant_id, org_id, full_name, department, job_title, status, created_by
  ) values (
    v_tenant_id,
    organization_uuid,
    trim(full_name_value),
    nullif(trim(coalesce(department_value, '')), ''),
    nullif(trim(coalesce(job_title_value, '')), ''),
    status_value,
    v_user_id
  ) returning id into v_employee_id;

  insert into public.audit_logs(
    tenant_id, org_id, actor_id, action, entity_type, entity_id, after_state
  ) values (
    v_tenant_id,
    organization_uuid,
    v_user_id,
    'people.employee.create',
    'employee',
    v_employee_id::text,
    jsonb_build_object(
      'full_name', trim(full_name_value),
      'department', nullif(trim(coalesce(department_value, '')), ''),
      'job_title', nullif(trim(coalesce(job_title_value, '')), ''),
      'status', status_value
    )
  );

  return v_employee_id;
end;
$$;

create or replace function private.update_people_employee(
  organization_uuid uuid,
  employee_uuid uuid,
  full_name_value text,
  department_value text default null,
  job_title_value text default null,
  status_value text default 'active'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_before jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select organization.tenant_id into v_tenant_id
  from public.organizations organization
  where organization.id = organization_uuid
    and organization.active = true;

  if v_tenant_id is null
     or not public.atlas_is_org_member(v_tenant_id, organization_uuid)
     or not public.has_identity_permission(v_tenant_id, organization_uuid, 'hr.write') then
    raise exception 'hr.write permission is required';
  end if;

  if length(trim(coalesce(full_name_value, ''))) = 0 then
    raise exception 'Employee full name is required.';
  end if;

  select to_jsonb(employee) into v_before
  from public.employees employee
  where employee.id = employee_uuid
    and employee.tenant_id = v_tenant_id
    and employee.org_id = organization_uuid
  for update;

  if v_before is null then
    raise exception 'Employee not found';
  end if;

  update public.employees employee
  set full_name = trim(full_name_value),
      department = nullif(trim(coalesce(department_value, '')), ''),
      job_title = nullif(trim(coalesce(job_title_value, '')), ''),
      status = status_value
  where employee.id = employee_uuid
    and employee.tenant_id = v_tenant_id
    and employee.org_id = organization_uuid;

  insert into public.audit_logs(
    tenant_id, org_id, actor_id, action, entity_type, entity_id, before_state, after_state
  )
  select
    v_tenant_id,
    organization_uuid,
    v_user_id,
    'people.employee.update',
    'employee',
    employee_uuid::text,
    v_before,
    to_jsonb(employee)
  from public.employees employee
  where employee.id = employee_uuid
    and employee.tenant_id = v_tenant_id
    and employee.org_id = organization_uuid;

  return employee_uuid;
end;
$$;

revoke all on function private.create_people_employee(uuid, text, text, text, text) from public, anon;
revoke all on function private.update_people_employee(uuid, uuid, text, text, text, text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.create_people_employee(uuid, text, text, text, text) to authenticated;
grant execute on function private.update_people_employee(uuid, uuid, text, text, text, text) to authenticated;

create or replace function public.create_people_employee(
  organization_uuid uuid,
  full_name_value text,
  department_value text default null,
  job_title_value text default null,
  status_value text default 'active'
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_people_employee(
    organization_uuid,
    full_name_value,
    department_value,
    job_title_value,
    status_value
  );
$$;

create or replace function public.update_people_employee(
  organization_uuid uuid,
  employee_uuid uuid,
  full_name_value text,
  department_value text default null,
  job_title_value text default null,
  status_value text default 'active'
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.update_people_employee(
    organization_uuid,
    employee_uuid,
    full_name_value,
    department_value,
    job_title_value,
    status_value
  );
$$;

revoke all on function public.create_people_employee(uuid, text, text, text, text) from public, anon;
revoke all on function public.update_people_employee(uuid, uuid, text, text, text, text) from public, anon;
grant execute on function public.create_people_employee(uuid, text, text, text, text) to authenticated;
grant execute on function public.update_people_employee(uuid, uuid, text, text, text, text) to authenticated;

-- Cover People foreign keys using the same leading column order as each FK.
create index if not exists employees_org_tenant_fk_idx on public.employees(org_id, tenant_id);
create index if not exists employees_user_fk_idx on public.employees(user_id) where user_id is not null;
create index if not exists employees_created_by_fk_idx on public.employees(created_by) where created_by is not null;

create index if not exists people_time_entries_org_tenant_fk_idx on public.people_time_entries(org_id, tenant_id);
create index if not exists people_time_entries_employee_scope_fk_idx on public.people_time_entries(employee_id, tenant_id, org_id);
create index if not exists people_time_entries_approved_by_fk_idx on public.people_time_entries(approved_by) where approved_by is not null;
create index if not exists people_time_entries_created_by_fk_idx on public.people_time_entries(created_by) where created_by is not null;

create index if not exists people_payroll_runs_org_tenant_fk_idx on public.people_payroll_runs(org_id, tenant_id);
create index if not exists people_payroll_runs_approved_by_fk_idx on public.people_payroll_runs(approved_by) where approved_by is not null;
create index if not exists people_payroll_runs_created_by_fk_idx on public.people_payroll_runs(created_by) where created_by is not null;

create index if not exists people_payroll_lines_org_tenant_fk_idx on public.people_payroll_lines(org_id, tenant_id);
create index if not exists people_payroll_lines_run_scope_fk_idx on public.people_payroll_lines(payroll_run_id, tenant_id, org_id);
create index if not exists people_payroll_lines_employee_scope_fk_idx on public.people_payroll_lines(employee_id, tenant_id, org_id);
create index if not exists people_payroll_lines_created_by_fk_idx on public.people_payroll_lines(created_by) where created_by is not null;

create index if not exists people_job_requisitions_org_tenant_fk_idx on public.people_job_requisitions(org_id, tenant_id);
create index if not exists people_job_requisitions_created_by_fk_idx on public.people_job_requisitions(created_by) where created_by is not null;
create index if not exists people_candidates_org_tenant_fk_idx on public.people_candidates(org_id, tenant_id);
create index if not exists people_candidates_created_by_fk_idx on public.people_candidates(created_by) where created_by is not null;

create index if not exists people_applications_org_tenant_fk_idx on public.people_applications(org_id, tenant_id);
create index if not exists people_applications_requisition_scope_fk_idx on public.people_applications(requisition_id, tenant_id, org_id);
create index if not exists people_applications_candidate_scope_fk_idx on public.people_applications(candidate_id, tenant_id, org_id);
create index if not exists people_applications_created_by_fk_idx on public.people_applications(created_by) where created_by is not null;

create index if not exists people_assessment_results_org_tenant_fk_idx on public.people_assessment_results(org_id, tenant_id);
create index if not exists people_assessment_results_application_scope_fk_idx on public.people_assessment_results(application_id, tenant_id, org_id);
create index if not exists people_assessment_results_created_by_fk_idx on public.people_assessment_results(created_by) where created_by is not null;

create index if not exists people_compensation_org_tenant_fk_idx on public.people_compensation(org_id, tenant_id);
create index if not exists people_compensation_employee_scope_fk_idx on public.people_compensation(employee_id, tenant_id, org_id);
create index if not exists people_compensation_created_by_fk_idx on public.people_compensation(created_by) where created_by is not null;

create index if not exists people_deductions_org_tenant_fk_idx on public.people_deductions(org_id, tenant_id);
create index if not exists people_deductions_employee_scope_fk_idx on public.people_deductions(employee_id, tenant_id, org_id);
create index if not exists people_deductions_created_by_fk_idx on public.people_deductions(created_by) where created_by is not null;
