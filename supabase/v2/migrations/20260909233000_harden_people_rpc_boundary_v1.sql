-- Harden ATLAS People RPC boundary.
-- Privileged implementations live in private; exposed public RPCs are SECURITY INVOKER wrappers.

alter function public.create_people_time_entry(uuid,uuid,date,timestamptz,timestamptz,integer) set schema private;
alter function public.submit_people_time_entry(uuid,uuid) set schema private;
alter function public.atlas_people_review_time_entry(uuid,uuid,text) set schema private;
alter function public.create_people_payroll_run(uuid,date,date,date) set schema private;
alter function public.upsert_people_payroll_line(uuid,uuid,uuid,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric) set schema private;
alter function public.atlas_people_transition_payroll_run(uuid,uuid,text,text) set schema private;
alter function public.create_people_compensation(uuid,uuid,text,numeric,numeric,date,date) set schema private;
alter function public.set_people_deduction(uuid,uuid,text,text,text,text,numeric,boolean) set schema private;
alter function public.advance_people_application_stage(uuid,uuid,text,text) set schema private;
alter function public.record_people_assessment_result(uuid,uuid,text,numeric,numeric,numeric,jsonb) set schema private;

create or replace function public.create_people_time_entry(
  organization_uuid uuid, employee_uuid uuid, work_day date,
  clock_in_at timestamptz, clock_out_at timestamptz, break_minutes_value integer
)
returns uuid language sql security invoker set search_path='' as $$
  select private.create_people_time_entry(organization_uuid,employee_uuid,work_day,clock_in_at,clock_out_at,break_minutes_value)
$$;

create or replace function public.submit_people_time_entry(organization_uuid uuid,time_entry_uuid uuid)
returns uuid language sql security invoker set search_path='' as $$
  select private.submit_people_time_entry(organization_uuid,time_entry_uuid)
$$;

create or replace function public.approve_people_time_entry(organization_uuid uuid,time_entry_uuid uuid)
returns uuid language sql security invoker set search_path='' as $$
  select private.atlas_people_review_time_entry(organization_uuid,time_entry_uuid,'approved')
$$;
create or replace function public.reject_people_time_entry(organization_uuid uuid,time_entry_uuid uuid)
returns uuid language sql security invoker set search_path='' as $$
  select private.atlas_people_review_time_entry(organization_uuid,time_entry_uuid,'rejected')
$$;

create or replace function public.create_people_payroll_run(organization_uuid uuid,period_start_date date,period_end_date date,pay_date_value date)
returns uuid language sql security invoker set search_path='' as $$
  select private.create_people_payroll_run(organization_uuid,period_start_date,period_end_date,pay_date_value)
$$;

create or replace function public.upsert_people_payroll_line(
  organization_uuid uuid,payroll_run_uuid uuid,employee_uuid uuid,
  regular_hours_value numeric,overtime_hours_value numeric,hourly_rate_value numeric,overtime_multiplier_value numeric,
  salary_period_amount_value numeric,pretax_deductions_value numeric,taxes_withheld_value numeric,posttax_deductions_value numeric,
  client_gross_pay numeric,client_net_pay numeric
)
returns uuid language sql security invoker set search_path='' as $$
  select private.upsert_people_payroll_line(
    organization_uuid,payroll_run_uuid,employee_uuid,regular_hours_value,overtime_hours_value,hourly_rate_value,overtime_multiplier_value,
    salary_period_amount_value,pretax_deductions_value,taxes_withheld_value,posttax_deductions_value,client_gross_pay,client_net_pay
  )
$$;

create or replace function public.calculate_people_payroll_run(organization_uuid uuid,payroll_run_uuid uuid)
returns uuid language sql security invoker set search_path='' as $$
  select private.atlas_people_transition_payroll_run(organization_uuid,payroll_run_uuid,'calculate',null)
$$;
create or replace function public.approve_people_payroll_run(organization_uuid uuid,payroll_run_uuid uuid)
returns uuid language sql security invoker set search_path='' as $$
  select private.atlas_people_transition_payroll_run(organization_uuid,payroll_run_uuid,'approve',null)
$$;
create or replace function public.lock_people_payroll_run(organization_uuid uuid,payroll_run_uuid uuid)
returns uuid language sql security invoker set search_path='' as $$
  select private.atlas_people_transition_payroll_run(organization_uuid,payroll_run_uuid,'lock',null)
$$;
create or replace function public.void_people_payroll_run(organization_uuid uuid,payroll_run_uuid uuid,void_reason_value text)
returns uuid language sql security invoker set search_path='' as $$
  select private.atlas_people_transition_payroll_run(organization_uuid,payroll_run_uuid,'void',void_reason_value)
$$;

create or replace function public.create_people_compensation(
  organization_uuid uuid,employee_uuid uuid,pay_type_value text,hourly_rate_value numeric,annual_salary_value numeric,
  effective_from_value date,effective_to_value date
)
returns uuid language sql security invoker set search_path='' as $$
  select private.create_people_compensation(organization_uuid,employee_uuid,pay_type_value,hourly_rate_value,annual_salary_value,effective_from_value,effective_to_value)
$$;

create or replace function public.set_people_deduction(
  organization_uuid uuid,employee_uuid uuid,code_value text,label_value text,treatment_value text,
  calculation_type_value text,amount_value numeric,active_value boolean
)
returns uuid language sql security invoker set search_path='' as $$
  select private.set_people_deduction(organization_uuid,employee_uuid,code_value,label_value,treatment_value,calculation_type_value,amount_value,active_value)
$$;

create or replace function public.advance_people_application_stage(
  organization_uuid uuid,application_uuid uuid,next_stage_value text,decision_reason_value text
)
returns uuid language sql security invoker set search_path='' as $$
  select private.advance_people_application_stage(organization_uuid,application_uuid,next_stage_value,decision_reason_value)
$$;

create or replace function public.record_people_assessment_result(
  organization_uuid uuid,application_uuid uuid,assessment_type_value text,earned_value numeric,possible_value numeric,
  passing_percent_value numeric,result_value jsonb
)
returns uuid language sql security invoker set search_path='' as $$
  select private.record_people_assessment_result(organization_uuid,application_uuid,assessment_type_value,earned_value,possible_value,passing_percent_value,result_value)
$$;

-- Privileged implementations are not API objects. Authenticated may execute them only through the named public wrappers/policies.
revoke all on function private.create_people_time_entry(uuid,uuid,date,timestamptz,timestamptz,integer) from public,anon;
revoke all on function private.submit_people_time_entry(uuid,uuid) from public,anon;
revoke all on function private.atlas_people_review_time_entry(uuid,uuid,text) from public,anon;
revoke all on function private.create_people_payroll_run(uuid,date,date,date) from public,anon;
revoke all on function private.upsert_people_payroll_line(uuid,uuid,uuid,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric) from public,anon;
revoke all on function private.atlas_people_transition_payroll_run(uuid,uuid,text,text) from public,anon;
revoke all on function private.create_people_compensation(uuid,uuid,text,numeric,numeric,date,date) from public,anon;
revoke all on function private.set_people_deduction(uuid,uuid,text,text,text,text,numeric,boolean) from public,anon;
revoke all on function private.advance_people_application_stage(uuid,uuid,text,text) from public,anon;
revoke all on function private.record_people_assessment_result(uuid,uuid,text,numeric,numeric,numeric,jsonb) from public,anon;

grant execute on function private.create_people_time_entry(uuid,uuid,date,timestamptz,timestamptz,integer),
  private.submit_people_time_entry(uuid,uuid),private.atlas_people_review_time_entry(uuid,uuid,text),
  private.create_people_payroll_run(uuid,date,date,date),
  private.upsert_people_payroll_line(uuid,uuid,uuid,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric),
  private.atlas_people_transition_payroll_run(uuid,uuid,text,text),
  private.create_people_compensation(uuid,uuid,text,numeric,numeric,date,date),
  private.set_people_deduction(uuid,uuid,text,text,text,text,numeric,boolean),
  private.advance_people_application_stage(uuid,uuid,text,text),
  private.record_people_assessment_result(uuid,uuid,text,numeric,numeric,numeric,jsonb) to authenticated;

revoke all on function public.create_people_time_entry(uuid,uuid,date,timestamptz,timestamptz,integer),
  public.submit_people_time_entry(uuid,uuid),public.approve_people_time_entry(uuid,uuid),public.reject_people_time_entry(uuid,uuid),
  public.create_people_payroll_run(uuid,date,date,date),
  public.upsert_people_payroll_line(uuid,uuid,uuid,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric),
  public.calculate_people_payroll_run(uuid,uuid),public.approve_people_payroll_run(uuid,uuid),public.lock_people_payroll_run(uuid,uuid),
  public.void_people_payroll_run(uuid,uuid,text),public.create_people_compensation(uuid,uuid,text,numeric,numeric,date,date),
  public.set_people_deduction(uuid,uuid,text,text,text,text,numeric,boolean),public.advance_people_application_stage(uuid,uuid,text,text),
  public.record_people_assessment_result(uuid,uuid,text,numeric,numeric,numeric,jsonb) from public,anon;

grant execute on function public.create_people_time_entry(uuid,uuid,date,timestamptz,timestamptz,integer),
  public.submit_people_time_entry(uuid,uuid),public.approve_people_time_entry(uuid,uuid),public.reject_people_time_entry(uuid,uuid),
  public.create_people_payroll_run(uuid,date,date,date),
  public.upsert_people_payroll_line(uuid,uuid,uuid,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric),
  public.calculate_people_payroll_run(uuid,uuid),public.approve_people_payroll_run(uuid,uuid),public.lock_people_payroll_run(uuid,uuid),
  public.void_people_payroll_run(uuid,uuid,text),public.create_people_compensation(uuid,uuid,text,numeric,numeric,date,date),
  public.set_people_deduction(uuid,uuid,text,text,text,text,numeric,boolean),public.advance_people_application_stage(uuid,uuid,text,text),
  public.record_people_assessment_result(uuid,uuid,text,numeric,numeric,numeric,jsonb) to authenticated;
