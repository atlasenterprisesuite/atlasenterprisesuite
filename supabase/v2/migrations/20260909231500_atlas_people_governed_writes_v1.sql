-- ATLAS People governed writes v1
-- All browser writes are RPC-only, permission checked, organization scoped and audited.

create or replace function private.atlas_people_actor_tenant(p_org_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select membership.tenant_id
  from public.organization_members membership
  join public.organizations organization
    on organization.id = membership.org_id and organization.tenant_id = membership.tenant_id
  join public.tenants tenant on tenant.id = membership.tenant_id
  where membership.org_id = p_org_id
    and membership.user_id = (select auth.uid())
    and membership.status = 'active'
    and organization.active = true
    and tenant.status = 'active'
  limit 1;
$$;
revoke all on function private.atlas_people_actor_tenant(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.atlas_people_actor_tenant(uuid) to authenticated;

create or replace function public.create_people_time_entry(
  organization_uuid uuid,
  employee_uuid uuid,
  work_day date,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  break_minutes_value integer
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_actor uuid := (select auth.uid());
  v_tenant uuid := private.atlas_people_actor_tenant(organization_uuid);
  v_employee_user uuid;
  v_id uuid;
begin
  if v_actor is null or v_tenant is null then raise exception 'Authenticated organization membership is required'; end if;
  if break_minutes_value < 0 then raise exception 'Break minutes cannot be negative'; end if;
  if clock_in_at is null or clock_out_at is null or clock_out_at <= clock_in_at then raise exception 'Valid clock-in and clock-out are required'; end if;

  select user_id into v_employee_user from public.employees
  where id = employee_uuid and org_id = organization_uuid and tenant_id = v_tenant;
  if not found then raise exception 'Employee not found in organization'; end if;

  if not public.has_identity_permission(v_tenant, organization_uuid, 'hr.write')
     and not (public.has_identity_permission(v_tenant, organization_uuid, 'payroll.self') and v_employee_user = v_actor) then
    raise exception 'People time write permission is required';
  end if;

  insert into public.people_time_entries(tenant_id, org_id, employee_id, work_date, clock_in, clock_out, break_minutes, created_by)
  values (v_tenant, organization_uuid, employee_uuid, work_day, clock_in_at, clock_out_at, break_minutes_value, v_actor)
  returning id into v_id;

  insert into public.audit_logs(tenant_id, org_id, actor_id, action, entity_type, entity_id, after_state)
  values (v_tenant, organization_uuid, v_actor, 'people.time.create', 'people_time_entry', v_id::text,
    jsonb_build_object('employee_id', employee_uuid, 'work_date', work_day, 'status', 'draft'));
  return v_id;
end;
$$;

create or replace function public.submit_people_time_entry(organization_uuid uuid, time_entry_uuid uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_actor uuid := (select auth.uid());
  v_tenant uuid := private.atlas_people_actor_tenant(organization_uuid);
  v_employee uuid;
  v_employee_user uuid;
  v_status text;
begin
  if v_actor is null or v_tenant is null then raise exception 'Authenticated organization membership is required'; end if;
  select entry.employee_id, entry.status, employee.user_id into v_employee, v_status, v_employee_user
  from public.people_time_entries entry
  join public.employees employee on employee.id=entry.employee_id and employee.tenant_id=entry.tenant_id and employee.org_id=entry.org_id
  where entry.id=time_entry_uuid and entry.org_id=organization_uuid and entry.tenant_id=v_tenant
  for update of entry;
  if not found then raise exception 'Time entry not found'; end if;
  if v_status <> 'draft' then raise exception 'Only draft time entries can be submitted'; end if;
  if not public.has_identity_permission(v_tenant, organization_uuid, 'hr.write')
     and not (public.has_identity_permission(v_tenant, organization_uuid, 'payroll.self') and v_employee_user=v_actor) then
    raise exception 'Time entry submit permission is required';
  end if;
  update public.people_time_entries set status='submitted' where id=time_entry_uuid;
  insert into public.audit_logs(tenant_id,org_id,actor_id,action,entity_type,entity_id,before_state,after_state)
  values(v_tenant,organization_uuid,v_actor,'people.time.submit','people_time_entry',time_entry_uuid::text,jsonb_build_object('status','draft'),jsonb_build_object('status','submitted'));
  return time_entry_uuid;
end;
$$;

create or replace function public.atlas_people_review_time_entry(organization_uuid uuid, time_entry_uuid uuid, decision_value text)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_actor uuid := (select auth.uid());
  v_tenant uuid := private.atlas_people_actor_tenant(organization_uuid);
  v_status text;
begin
  if v_actor is null or v_tenant is null then raise exception 'Authenticated organization membership is required'; end if;
  if decision_value not in ('approved','rejected') then raise exception 'Invalid time-entry decision'; end if;
  if not public.has_identity_permission(v_tenant, organization_uuid, 'hr.write') then raise exception 'hr.write permission is required'; end if;
  select status into v_status from public.people_time_entries
    where id=time_entry_uuid and org_id=organization_uuid and tenant_id=v_tenant for update;
  if not found then raise exception 'Time entry not found'; end if;
  if v_status <> 'submitted' then raise exception 'Only submitted time entries can be reviewed'; end if;
  update public.people_time_entries
  set status=decision_value,
      approved_by=case when decision_value='approved' then v_actor else null end,
      approved_at=case when decision_value='approved' then now() else null end
  where id=time_entry_uuid;
  insert into public.audit_logs(tenant_id,org_id,actor_id,action,entity_type,entity_id,before_state,after_state)
  values(v_tenant,organization_uuid,v_actor,'people.time.'||decision_value,'people_time_entry',time_entry_uuid::text,
    jsonb_build_object('status',v_status),jsonb_build_object('status',decision_value));
  return time_entry_uuid;
end;
$$;

create or replace function public.approve_people_time_entry(organization_uuid uuid, time_entry_uuid uuid)
returns uuid language sql security definer set search_path=public,auth,pg_temp
as $$ select public.atlas_people_review_time_entry(organization_uuid,time_entry_uuid,'approved') $$;
create or replace function public.reject_people_time_entry(organization_uuid uuid, time_entry_uuid uuid)
returns uuid language sql security definer set search_path=public,auth,pg_temp
as $$ select public.atlas_people_review_time_entry(organization_uuid,time_entry_uuid,'rejected') $$;

create or replace function public.create_people_payroll_run(
  organization_uuid uuid, period_start_date date, period_end_date date, pay_date_value date
)
returns uuid
language plpgsql security definer set search_path=public,auth,pg_temp
as $$
declare v_actor uuid := (select auth.uid()); v_tenant uuid := private.atlas_people_actor_tenant(organization_uuid); v_id uuid;
begin
  if v_actor is null or v_tenant is null then raise exception 'Authenticated organization membership is required'; end if;
  if not public.has_identity_permission(v_tenant,organization_uuid,'payroll.write') then raise exception 'payroll.write permission is required'; end if;
  if period_end_date < period_start_date then raise exception 'Payroll period end cannot precede start'; end if;
  insert into public.people_payroll_runs(tenant_id,org_id,period_start,period_end,pay_date,created_by)
  values(v_tenant,organization_uuid,period_start_date,period_end_date,pay_date_value,v_actor) returning id into v_id;
  insert into public.audit_logs(tenant_id,org_id,actor_id,action,entity_type,entity_id,after_state)
  values(v_tenant,organization_uuid,v_actor,'people.payroll.create','people_payroll_run',v_id::text,
    jsonb_build_object('period_start',period_start_date,'period_end',period_end_date,'pay_date',pay_date_value,'status','draft'));
  return v_id;
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
language plpgsql security definer set search_path=public,auth,pg_temp
as $$
declare
  v_actor uuid := (select auth.uid());
  v_tenant uuid := private.atlas_people_actor_tenant(organization_uuid);
  v_run_status text;
  v_regular numeric(14,2) := 0;
  v_overtime numeric(14,2) := 0;
  v_gross numeric(14,2);
  v_net numeric(14,2);
  v_id uuid;
begin
  if v_actor is null or v_tenant is null then raise exception 'Authenticated organization membership is required'; end if;
  if not public.has_identity_permission(v_tenant,organization_uuid,'payroll.write') then raise exception 'payroll.write permission is required'; end if;
  if regular_hours_value < 0 or overtime_hours_value < 0 or overtime_multiplier_value < 0
     or pretax_deductions_value < 0 or taxes_withheld_value < 0 or posttax_deductions_value < 0 then
    raise exception 'Payroll inputs cannot be negative';
  end if;
  if (hourly_rate_value is null) = (salary_period_amount_value is null) then raise exception 'Use hourly rate or salary-period amount, not both'; end if;
  if hourly_rate_value is not null and hourly_rate_value < 0 then raise exception 'Hourly rate cannot be negative'; end if;
  if salary_period_amount_value is not null and salary_period_amount_value < 0 then raise exception 'Salary-period amount cannot be negative'; end if;
  if salary_period_amount_value is not null and (regular_hours_value <> 0 or overtime_hours_value <> 0) then raise exception 'Salary-period payroll cannot include hourly earnings'; end if;
  if overtime_hours_value > 0 and overtime_multiplier_value <= 0 then raise exception 'Overtime multiplier must be positive when overtime exists'; end if;

  select status into v_run_status from public.people_payroll_runs
   where id=payroll_run_uuid and org_id=organization_uuid and tenant_id=v_tenant for update;
  if not found then raise exception 'Payroll run not found'; end if;
  if v_run_status <> 'draft' then raise exception 'Payroll lines are editable only while the run is draft'; end if;
  if not exists(select 1 from public.employees where id=employee_uuid and org_id=organization_uuid and tenant_id=v_tenant) then raise exception 'Employee not found in organization'; end if;

  if salary_period_amount_value is not null then
    v_gross := round(salary_period_amount_value,2);
  else
    v_regular := round(regular_hours_value * hourly_rate_value,2);
    v_overtime := round(overtime_hours_value * hourly_rate_value * overtime_multiplier_value,2);
    v_gross := v_regular + v_overtime;
  end if;
  if pretax_deductions_value + taxes_withheld_value + posttax_deductions_value > v_gross then raise exception 'Payroll deductions and withholding cannot exceed gross pay'; end if;
  v_net := round(v_gross - pretax_deductions_value - taxes_withheld_value - posttax_deductions_value,2);
  if abs(v_gross - client_gross_pay) > 0.01 or abs(v_net - client_net_pay) > 0.01 then raise exception 'Client payroll calculation does not match governed server calculation'; end if;

  insert into public.people_payroll_lines(
    tenant_id,org_id,payroll_run_id,employee_id,regular_hours,overtime_hours,hourly_rate,salary_period_amount,
    gross_pay,pretax_deductions,taxes_withheld,posttax_deductions,net_pay,calculation,created_by
  ) values(
    v_tenant,organization_uuid,payroll_run_uuid,employee_uuid,regular_hours_value,overtime_hours_value,hourly_rate_value,salary_period_amount_value,
    v_gross,round(pretax_deductions_value,2),round(taxes_withheld_value,2),round(posttax_deductions_value,2),v_net,
    jsonb_build_object('regular_pay',v_regular,'overtime_pay',v_overtime,'overtime_multiplier',overtime_multiplier_value,'server_calculated',true),v_actor
  ) on conflict(org_id,payroll_run_id,employee_id) do update set
    regular_hours=excluded.regular_hours,overtime_hours=excluded.overtime_hours,hourly_rate=excluded.hourly_rate,
    salary_period_amount=excluded.salary_period_amount,gross_pay=excluded.gross_pay,pretax_deductions=excluded.pretax_deductions,
    taxes_withheld=excluded.taxes_withheld,posttax_deductions=excluded.posttax_deductions,net_pay=excluded.net_pay,calculation=excluded.calculation
  returning id into v_id;
  insert into public.audit_logs(tenant_id,org_id,actor_id,action,entity_type,entity_id,after_state)
  values(v_tenant,organization_uuid,v_actor,'people.payroll.line.upsert','people_payroll_line',v_id::text,
    jsonb_build_object('run_id',payroll_run_uuid,'employee_id',employee_uuid,'gross_pay',v_gross,'net_pay',v_net));
  return v_id;
end;
$$;

create or replace function public.atlas_people_transition_payroll_run(
  organization_uuid uuid, payroll_run_uuid uuid, action_value text, void_reason_value text default null
)
returns uuid
language plpgsql security definer set search_path=public,auth,pg_temp
as $$
declare v_actor uuid := (select auth.uid()); v_tenant uuid := private.atlas_people_actor_tenant(organization_uuid); v_status text; v_next text;
begin
  if v_actor is null or v_tenant is null then raise exception 'Authenticated organization membership is required'; end if;
  select status into v_status from public.people_payroll_runs where id=payroll_run_uuid and org_id=organization_uuid and tenant_id=v_tenant for update;
  if not found then raise exception 'Payroll run not found'; end if;
  if v_status in ('locked','void') then raise exception 'Locked or void payroll runs are immutable'; end if;
  if action_value='calculate' then
    if not public.has_identity_permission(v_tenant,organization_uuid,'payroll.write') then raise exception 'payroll.write permission is required'; end if;
    if v_status<>'draft' then raise exception 'Only draft payroll runs can be calculated'; end if;
    if not exists(select 1 from public.people_payroll_lines where payroll_run_id=payroll_run_uuid and org_id=organization_uuid and tenant_id=v_tenant) then raise exception 'At least one payroll line is required before calculation'; end if;
    v_next := 'calculated';
  elsif action_value='approve' then
    if not public.has_identity_permission(v_tenant,organization_uuid,'payroll.approve') then raise exception 'payroll.approve permission is required'; end if;
    if v_status<>'calculated' then raise exception 'Payroll run must be calculated before approval'; end if;
    v_next := 'approved';
  elsif action_value='lock' then
    if not public.has_identity_permission(v_tenant,organization_uuid,'payroll.approve') then raise exception 'payroll.approve permission is required'; end if;
    if v_status<>'approved' then raise exception 'Payroll run must be approved before locking'; end if;
    v_next := 'locked';
  elsif action_value='void' then
    if not public.has_identity_permission(v_tenant,organization_uuid,'payroll.approve') then raise exception 'payroll.approve permission is required'; end if;
    if length(trim(coalesce(void_reason_value,'')))=0 then raise exception 'Void reason is required'; end if;
    v_next := 'void';
  else raise exception 'Unsupported payroll transition'; end if;

  update public.people_payroll_runs set status=v_next,
    approved_by=case when action_value='approve' then v_actor else approved_by end,
    approved_at=case when action_value='approve' then now() else approved_at end,
    void_reason=case when action_value='void' then trim(void_reason_value) else void_reason end
  where id=payroll_run_uuid;
  insert into public.audit_logs(tenant_id,org_id,actor_id,action,entity_type,entity_id,before_state,after_state)
  values(v_tenant,organization_uuid,v_actor,'people.payroll.'||action_value,'people_payroll_run',payroll_run_uuid::text,
    jsonb_build_object('status',v_status),jsonb_build_object('status',v_next,'void_reason',case when action_value='void' then trim(void_reason_value) else null end));
  return payroll_run_uuid;
end;
$$;

create or replace function public.calculate_people_payroll_run(organization_uuid uuid,payroll_run_uuid uuid)
returns uuid language sql security definer set search_path=public,auth,pg_temp as $$ select public.atlas_people_transition_payroll_run(organization_uuid,payroll_run_uuid,'calculate',null) $$;
create or replace function public.approve_people_payroll_run(organization_uuid uuid,payroll_run_uuid uuid)
returns uuid language sql security definer set search_path=public,auth,pg_temp as $$ select public.atlas_people_transition_payroll_run(organization_uuid,payroll_run_uuid,'approve',null) $$;
create or replace function public.lock_people_payroll_run(organization_uuid uuid,payroll_run_uuid uuid)
returns uuid language sql security definer set search_path=public,auth,pg_temp as $$ select public.atlas_people_transition_payroll_run(organization_uuid,payroll_run_uuid,'lock',null) $$;
create or replace function public.void_people_payroll_run(organization_uuid uuid,payroll_run_uuid uuid,void_reason_value text)
returns uuid language sql security definer set search_path=public,auth,pg_temp as $$ select public.atlas_people_transition_payroll_run(organization_uuid,payroll_run_uuid,'void',void_reason_value) $$;

create or replace function public.create_people_compensation(
  organization_uuid uuid, employee_uuid uuid, pay_type_value text, hourly_rate_value numeric,
  annual_salary_value numeric, effective_from_value date, effective_to_value date
)
returns uuid language plpgsql security definer set search_path=public,auth,pg_temp
as $$
declare v_actor uuid := (select auth.uid()); v_tenant uuid := private.atlas_people_actor_tenant(organization_uuid); v_id uuid;
begin
  if v_actor is null or v_tenant is null then raise exception 'Authenticated organization membership is required'; end if;
  if not public.has_identity_permission(v_tenant,organization_uuid,'payroll.write') then raise exception 'payroll.write permission is required'; end if;
  if not exists(select 1 from public.employees where id=employee_uuid and org_id=organization_uuid and tenant_id=v_tenant) then raise exception 'Employee not found in organization'; end if;
  insert into public.people_compensation(tenant_id,org_id,employee_id,pay_type,hourly_rate,annual_salary,effective_from,effective_to,created_by)
  values(v_tenant,organization_uuid,employee_uuid,pay_type_value,hourly_rate_value,annual_salary_value,effective_from_value,effective_to_value,v_actor)
  returning id into v_id;
  insert into public.audit_logs(tenant_id,org_id,actor_id,action,entity_type,entity_id,after_state)
  values(v_tenant,organization_uuid,v_actor,'people.compensation.create','people_compensation',v_id::text,
    jsonb_build_object('employee_id',employee_uuid,'pay_type',pay_type_value,'effective_from',effective_from_value,'effective_to',effective_to_value));
  return v_id;
end;
$$;

create or replace function public.set_people_deduction(
  organization_uuid uuid, employee_uuid uuid, code_value text, label_value text, treatment_value text,
  calculation_type_value text, amount_value numeric, active_value boolean
)
returns uuid language plpgsql security definer set search_path=public,auth,pg_temp
as $$
declare v_actor uuid := (select auth.uid()); v_tenant uuid := private.atlas_people_actor_tenant(organization_uuid); v_id uuid; v_code text := upper(trim(code_value));
begin
  if v_actor is null or v_tenant is null then raise exception 'Authenticated organization membership is required'; end if;
  if not public.has_identity_permission(v_tenant,organization_uuid,'payroll.write') then raise exception 'payroll.write permission is required'; end if;
  if not exists(select 1 from public.employees where id=employee_uuid and org_id=organization_uuid and tenant_id=v_tenant) then raise exception 'Employee not found in organization'; end if;
  insert into public.people_deductions(tenant_id,org_id,employee_id,code,label,treatment,calculation_type,amount,active,created_by)
  values(v_tenant,organization_uuid,employee_uuid,v_code,trim(label_value),treatment_value,calculation_type_value,amount_value,active_value,v_actor)
  on conflict(org_id,employee_id,code) do update set label=excluded.label,treatment=excluded.treatment,
    calculation_type=excluded.calculation_type,amount=excluded.amount,active=excluded.active
  returning id into v_id;
  insert into public.audit_logs(tenant_id,org_id,actor_id,action,entity_type,entity_id,after_state)
  values(v_tenant,organization_uuid,v_actor,'people.deduction.set','people_deduction',v_id::text,
    jsonb_build_object('employee_id',employee_uuid,'code',v_code,'active',active_value));
  return v_id;
end;
$$;

create or replace function public.advance_people_application_stage(
  organization_uuid uuid, application_uuid uuid, next_stage_value text, decision_reason_value text
)
returns uuid language plpgsql security definer set search_path=public,auth,pg_temp
as $$
declare v_actor uuid := (select auth.uid()); v_tenant uuid := private.atlas_people_actor_tenant(organization_uuid); v_current text;
begin
  if v_actor is null or v_tenant is null then raise exception 'Authenticated organization membership is required'; end if;
  if not public.has_identity_permission(v_tenant,organization_uuid,'hr.write') then raise exception 'hr.write permission is required'; end if;
  select stage into v_current from public.people_applications where id=application_uuid and org_id=organization_uuid and tenant_id=v_tenant for update;
  if not found then raise exception 'Application not found'; end if;
  if next_stage_value not in ('applied','screening','assessment','interview','offer','hired','rejected','withdrawn') then raise exception 'Invalid application stage'; end if;
  if next_stage_value in ('rejected','withdrawn') and length(trim(coalesce(decision_reason_value,'')))=0 then raise exception 'Decision reason is required'; end if;
  if v_current in ('hired','rejected','withdrawn') then raise exception 'Terminal application stages cannot be advanced'; end if;
  update public.people_applications set stage=next_stage_value,decision_reason=nullif(trim(coalesce(decision_reason_value,'')),'') where id=application_uuid;
  insert into public.audit_logs(tenant_id,org_id,actor_id,action,entity_type,entity_id,before_state,after_state)
  values(v_tenant,organization_uuid,v_actor,'people.recruiting.stage','people_application',application_uuid::text,
    jsonb_build_object('stage',v_current),jsonb_build_object('stage',next_stage_value,'decision_reason',nullif(trim(coalesce(decision_reason_value,'')),'')));
  return application_uuid;
end;
$$;

create or replace function public.record_people_assessment_result(
  organization_uuid uuid, application_uuid uuid, assessment_type_value text,
  earned_value numeric, possible_value numeric, passing_percent_value numeric, result_value jsonb
)
returns uuid language plpgsql security definer set search_path=public,auth,pg_temp
as $$
declare v_actor uuid := (select auth.uid()); v_tenant uuid := private.atlas_people_actor_tenant(organization_uuid); v_id uuid; v_percent numeric; v_passed boolean;
begin
  if v_actor is null or v_tenant is null then raise exception 'Authenticated organization membership is required'; end if;
  if not public.has_identity_permission(v_tenant,organization_uuid,'hr.write') then raise exception 'hr.write permission is required'; end if;
  if possible_value <= 0 or earned_value < 0 or earned_value > possible_value then raise exception 'Invalid assessment score'; end if;
  if passing_percent_value < 0 or passing_percent_value > 100 then raise exception 'Passing percent must be between 0 and 100'; end if;
  if not exists(select 1 from public.people_applications where id=application_uuid and org_id=organization_uuid and tenant_id=v_tenant) then raise exception 'Application not found'; end if;
  v_percent := round((earned_value / possible_value) * 100,4); v_passed := v_percent >= passing_percent_value;
  insert into public.people_assessment_results(tenant_id,org_id,application_id,assessment_type,score,max_score,result,completed_at,created_by)
  values(v_tenant,organization_uuid,application_uuid,trim(assessment_type_value),earned_value,possible_value,
    coalesce(result_value,'{}'::jsonb) || jsonb_build_object('server_percent',v_percent,'server_passed',v_passed,'passing_percent',passing_percent_value),now(),v_actor)
  on conflict(org_id,application_id,assessment_type) do update set score=excluded.score,max_score=excluded.max_score,result=excluded.result,completed_at=excluded.completed_at
  returning id into v_id;
  insert into public.audit_logs(tenant_id,org_id,actor_id,action,entity_type,entity_id,after_state)
  values(v_tenant,organization_uuid,v_actor,'people.assessment.record','people_assessment_result',v_id::text,
    jsonb_build_object('application_id',application_uuid,'assessment_type',trim(assessment_type_value),'percent',v_percent,'passed',v_passed));
  return v_id;
end;
$$;

revoke all on function public.create_people_time_entry(uuid,uuid,date,timestamptz,timestamptz,integer) from public,anon;
revoke all on function public.submit_people_time_entry(uuid,uuid) from public,anon;
revoke all on function public.atlas_people_review_time_entry(uuid,uuid,text) from public,anon;
revoke all on function public.approve_people_time_entry(uuid,uuid) from public,anon;
revoke all on function public.reject_people_time_entry(uuid,uuid) from public,anon;
revoke all on function public.create_people_payroll_run(uuid,date,date,date) from public,anon;
revoke all on function public.upsert_people_payroll_line(uuid,uuid,uuid,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric) from public,anon;
revoke all on function public.atlas_people_transition_payroll_run(uuid,uuid,text,text) from public,anon;
revoke all on function public.calculate_people_payroll_run(uuid,uuid) from public,anon;
revoke all on function public.approve_people_payroll_run(uuid,uuid) from public,anon;
revoke all on function public.lock_people_payroll_run(uuid,uuid) from public,anon;
revoke all on function public.void_people_payroll_run(uuid,uuid,text) from public,anon;
revoke all on function public.create_people_compensation(uuid,uuid,text,numeric,numeric,date,date) from public,anon;
revoke all on function public.set_people_deduction(uuid,uuid,text,text,text,text,numeric,boolean) from public,anon;
revoke all on function public.advance_people_application_stage(uuid,uuid,text,text) from public,anon;
revoke all on function public.record_people_assessment_result(uuid,uuid,text,numeric,numeric,numeric,jsonb) from public,anon;

grant execute on function public.create_people_time_entry(uuid,uuid,date,timestamptz,timestamptz,integer),
  public.submit_people_time_entry(uuid,uuid), public.approve_people_time_entry(uuid,uuid), public.reject_people_time_entry(uuid,uuid),
  public.create_people_payroll_run(uuid,date,date,date),
  public.upsert_people_payroll_line(uuid,uuid,uuid,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric),
  public.calculate_people_payroll_run(uuid,uuid), public.approve_people_payroll_run(uuid,uuid), public.lock_people_payroll_run(uuid,uuid),
  public.void_people_payroll_run(uuid,uuid,text), public.create_people_compensation(uuid,uuid,text,numeric,numeric,date,date),
  public.set_people_deduction(uuid,uuid,text,text,text,text,numeric,boolean), public.advance_people_application_stage(uuid,uuid,text,text),
  public.record_people_assessment_result(uuid,uuid,text,numeric,numeric,numeric,jsonb) to authenticated;
