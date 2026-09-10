-- ATLAS People core v1
-- Multi-tenant HR, time, payroll, recruiting and compensation storage.
-- Browser clients receive SELECT only; governed writes are introduced separately through RPCs.

create schema if not exists private;

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null check (length(trim(full_name)) between 1 and 200),
  department text check (department is null or length(trim(department)) between 1 and 160),
  job_title text check (job_title is null or length(trim(job_title)) between 1 and 160),
  status text not null default 'active' check (status in ('active','leave','terminated')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id, org_id),
  foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade
);

create unique index employees_org_user_unique_idx
  on public.employees(org_id, user_id) where user_id is not null;
create index employees_scope_status_idx on public.employees(tenant_id, org_id, status);

create table public.people_time_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  employee_id uuid not null,
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
  unique (id, tenant_id, org_id),
  foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade,
  foreign key (employee_id, tenant_id, org_id) references public.employees(id, tenant_id, org_id) on delete cascade,
  check ((clock_in is null and clock_out is null) or (clock_in is not null and clock_out is not null and clock_out > clock_in))
);
create index people_time_entries_scope_date_idx on public.people_time_entries(tenant_id, org_id, work_date desc);
create index people_time_entries_employee_date_idx on public.people_time_entries(employee_id, work_date desc);

create table public.people_payroll_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
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
  unique (id, tenant_id, org_id),
  unique (org_id, period_start, period_end, pay_date),
  foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade,
  check (period_end >= period_start),
  check (void_reason is null or length(trim(void_reason)) between 1 and 500)
);
create index people_payroll_runs_scope_pay_date_idx on public.people_payroll_runs(tenant_id, org_id, pay_date desc);

create table public.people_payroll_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  payroll_run_id uuid not null,
  employee_id uuid not null,
  regular_hours numeric(12,4) not null default 0 check (regular_hours >= 0),
  overtime_hours numeric(12,4) not null default 0 check (overtime_hours >= 0),
  hourly_rate numeric(14,4) check (hourly_rate is null or hourly_rate >= 0),
  salary_period_amount numeric(14,2) check (salary_period_amount is null or salary_period_amount >= 0),
  gross_pay numeric(14,2) not null check (gross_pay >= 0),
  pretax_deductions numeric(14,2) not null default 0 check (pretax_deductions >= 0),
  taxes_withheld numeric(14,2) not null default 0 check (taxes_withheld >= 0),
  posttax_deductions numeric(14,2) not null default 0 check (posttax_deductions >= 0),
  net_pay numeric(14,2) not null check (net_pay >= 0),
  calculation jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, payroll_run_id, employee_id),
  foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade,
  foreign key (payroll_run_id, tenant_id, org_id) references public.people_payroll_runs(id, tenant_id, org_id) on delete cascade,
  foreign key (employee_id, tenant_id, org_id) references public.employees(id, tenant_id, org_id) on delete restrict,
  check ((hourly_rate is null) <> (salary_period_amount is null)),
  check (pretax_deductions + taxes_withheld + posttax_deductions <= gross_pay)
);
create index people_payroll_lines_scope_run_idx on public.people_payroll_lines(tenant_id, org_id, payroll_run_id);
create index people_payroll_lines_employee_idx on public.people_payroll_lines(employee_id, payroll_run_id);

create table public.people_job_requisitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  title text not null check (length(trim(title)) between 1 and 200),
  department text check (department is null or length(trim(department)) between 1 and 160),
  status text not null default 'draft' check (status in ('draft','open','paused','closed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id, org_id),
  foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade
);
create index people_job_requisitions_scope_status_idx on public.people_job_requisitions(tenant_id, org_id, status);

create table public.people_candidates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  full_name text not null check (length(trim(full_name)) between 1 and 200),
  email text check (email is null or length(trim(email)) between 3 and 320),
  phone text check (phone is null or length(trim(phone)) between 3 and 80),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id, org_id),
  foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade
);
create index people_candidates_scope_name_idx on public.people_candidates(tenant_id, org_id, full_name);

create table public.people_applications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  requisition_id uuid not null,
  candidate_id uuid not null,
  stage text not null default 'applied' check (stage in ('applied','screening','assessment','interview','offer','hired','rejected','withdrawn')),
  decision_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id, org_id),
  unique (org_id, requisition_id, candidate_id),
  foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade,
  foreign key (requisition_id, tenant_id, org_id) references public.people_job_requisitions(id, tenant_id, org_id) on delete cascade,
  foreign key (candidate_id, tenant_id, org_id) references public.people_candidates(id, tenant_id, org_id) on delete cascade,
  check (decision_reason is null or length(trim(decision_reason)) between 1 and 1000)
);
create index people_applications_scope_stage_idx on public.people_applications(tenant_id, org_id, stage);

create table public.people_assessment_results (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  application_id uuid not null,
  assessment_type text not null check (length(trim(assessment_type)) between 1 and 160),
  score numeric(14,4),
  max_score numeric(14,4),
  result jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, application_id, assessment_type),
  foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade,
  foreign key (application_id, tenant_id, org_id) references public.people_applications(id, tenant_id, org_id) on delete cascade,
  check (score is null or score >= 0),
  check (max_score is null or max_score > 0)
);
create index people_assessment_results_scope_application_idx on public.people_assessment_results(tenant_id, org_id, application_id);

create table public.people_compensation (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  employee_id uuid not null,
  pay_type text not null check (pay_type in ('hourly','salary')),
  hourly_rate numeric(14,4) check (hourly_rate is null or hourly_rate >= 0),
  annual_salary numeric(16,2) check (annual_salary is null or annual_salary >= 0),
  effective_from date not null,
  effective_to date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id, org_id),
  foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade,
  foreign key (employee_id, tenant_id, org_id) references public.employees(id, tenant_id, org_id) on delete cascade,
  check ((pay_type = 'hourly' and hourly_rate is not null and annual_salary is null) or (pay_type = 'salary' and annual_salary is not null and hourly_rate is null)),
  check (effective_to is null or effective_to >= effective_from)
);
create index people_compensation_employee_effective_idx on public.people_compensation(tenant_id, org_id, employee_id, effective_from desc);

create table public.people_deductions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  employee_id uuid not null,
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9_.-]{0,63}$'),
  label text not null check (length(trim(label)) between 1 and 160),
  treatment text not null check (treatment in ('pretax','posttax')),
  calculation_type text not null check (calculation_type in ('fixed','percent')),
  amount numeric(14,4) not null check (amount >= 0),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, employee_id, code),
  foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade,
  foreign key (employee_id, tenant_id, org_id) references public.employees(id, tenant_id, org_id) on delete cascade,
  check (calculation_type <> 'percent' or amount <= 1)
);
create index people_deductions_employee_active_idx on public.people_deductions(tenant_id, org_id, employee_id, active);

create or replace function public.atlas_people_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger employees_touch before update on public.employees for each row execute function public.atlas_people_touch_updated_at();
create trigger people_time_entries_touch before update on public.people_time_entries for each row execute function public.atlas_people_touch_updated_at();
create trigger people_payroll_runs_touch before update on public.people_payroll_runs for each row execute function public.atlas_people_touch_updated_at();
create trigger people_payroll_lines_touch before update on public.people_payroll_lines for each row execute function public.atlas_people_touch_updated_at();
create trigger people_job_requisitions_touch before update on public.people_job_requisitions for each row execute function public.atlas_people_touch_updated_at();
create trigger people_candidates_touch before update on public.people_candidates for each row execute function public.atlas_people_touch_updated_at();
create trigger people_applications_touch before update on public.people_applications for each row execute function public.atlas_people_touch_updated_at();
create trigger people_compensation_touch before update on public.people_compensation for each row execute function public.atlas_people_touch_updated_at();
create trigger people_deductions_touch before update on public.people_deductions for each row execute function public.atlas_people_touch_updated_at();

create or replace function private.atlas_people_is_self_employee(p_org_id uuid, p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.employees employee
    where employee.org_id = p_org_id
      and employee.id = p_employee_id
      and employee.user_id = (select auth.uid())
  );
$$;

revoke all on function private.atlas_people_is_self_employee(uuid, uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.atlas_people_is_self_employee(uuid, uuid) to authenticated;

alter table public.employees enable row level security;
alter table public.people_time_entries enable row level security;
alter table public.people_payroll_runs enable row level security;
alter table public.people_payroll_lines enable row level security;
alter table public.people_job_requisitions enable row level security;
alter table public.people_candidates enable row level security;
alter table public.people_applications enable row level security;
alter table public.people_assessment_results enable row level security;
alter table public.people_compensation enable row level security;
alter table public.people_deductions enable row level security;

create policy employees_read_scope on public.employees for select to authenticated using (
  public.atlas_is_org_member(tenant_id, org_id)
  and (
    public.has_identity_permission(tenant_id, org_id, 'hr.read')
    or public.has_identity_permission(tenant_id, org_id, 'hr.write')
    or public.has_identity_permission(tenant_id, org_id, 'payroll.read')
    or (public.has_identity_permission(tenant_id, org_id, 'payroll.self') and user_id = (select auth.uid()))
  )
);

create policy people_time_entries_read_scope on public.people_time_entries for select to authenticated using (
  public.atlas_is_org_member(tenant_id, org_id)
  and (
    public.has_identity_permission(tenant_id, org_id, 'hr.read')
    or public.has_identity_permission(tenant_id, org_id, 'hr.write')
    or public.has_identity_permission(tenant_id, org_id, 'payroll.read')
    or (public.has_identity_permission(tenant_id, org_id, 'payroll.self') and private.atlas_people_is_self_employee(org_id, employee_id))
  )
);

create policy people_payroll_runs_read_scope on public.people_payroll_runs for select to authenticated using (
  public.atlas_is_org_member(tenant_id, org_id)
  and public.has_identity_permission(tenant_id, org_id, 'payroll.read')
);

create policy people_payroll_lines_read_scope on public.people_payroll_lines for select to authenticated using (
  public.atlas_is_org_member(tenant_id, org_id)
  and (
    public.has_identity_permission(tenant_id, org_id, 'payroll.read')
    or (public.has_identity_permission(tenant_id, org_id, 'payroll.self') and private.atlas_people_is_self_employee(org_id, employee_id))
  )
);

create policy people_job_requisitions_read_scope on public.people_job_requisitions for select to authenticated using (
  public.atlas_is_org_member(tenant_id, org_id)
  and (public.has_identity_permission(tenant_id, org_id, 'hr.read') or public.has_identity_permission(tenant_id, org_id, 'hr.write'))
);
create policy people_candidates_read_scope on public.people_candidates for select to authenticated using (
  public.atlas_is_org_member(tenant_id, org_id)
  and (public.has_identity_permission(tenant_id, org_id, 'hr.read') or public.has_identity_permission(tenant_id, org_id, 'hr.write'))
);
create policy people_applications_read_scope on public.people_applications for select to authenticated using (
  public.atlas_is_org_member(tenant_id, org_id)
  and (public.has_identity_permission(tenant_id, org_id, 'hr.read') or public.has_identity_permission(tenant_id, org_id, 'hr.write'))
);
create policy people_assessment_results_read_scope on public.people_assessment_results for select to authenticated using (
  public.atlas_is_org_member(tenant_id, org_id)
  and (public.has_identity_permission(tenant_id, org_id, 'hr.read') or public.has_identity_permission(tenant_id, org_id, 'hr.write'))
);

create policy people_compensation_read_scope on public.people_compensation for select to authenticated using (
  public.atlas_is_org_member(tenant_id, org_id)
  and (
    public.has_identity_permission(tenant_id, org_id, 'payroll.read')
    or (public.has_identity_permission(tenant_id, org_id, 'payroll.self') and private.atlas_people_is_self_employee(org_id, employee_id))
  )
);
create policy people_deductions_read_scope on public.people_deductions for select to authenticated using (
  public.atlas_is_org_member(tenant_id, org_id)
  and (
    public.has_identity_permission(tenant_id, org_id, 'payroll.read')
    or (public.has_identity_permission(tenant_id, org_id, 'payroll.self') and private.atlas_people_is_self_employee(org_id, employee_id))
  )
);

revoke all on table public.employees, public.people_time_entries, public.people_payroll_runs, public.people_payroll_lines,
  public.people_job_requisitions, public.people_candidates, public.people_applications, public.people_assessment_results,
  public.people_compensation, public.people_deductions from anon;
revoke insert, update, delete on table public.employees, public.people_time_entries, public.people_payroll_runs, public.people_payroll_lines,
  public.people_job_requisitions, public.people_candidates, public.people_applications, public.people_assessment_results,
  public.people_compensation, public.people_deductions from authenticated;
grant select on table public.employees, public.people_time_entries, public.people_payroll_runs, public.people_payroll_lines,
  public.people_job_requisitions, public.people_candidates, public.people_applications, public.people_assessment_results,
  public.people_compensation, public.people_deductions to authenticated;
grant select, insert, update, delete on table public.employees, public.people_time_entries, public.people_payroll_runs, public.people_payroll_lines,
  public.people_job_requisitions, public.people_candidates, public.people_applications, public.people_assessment_results,
  public.people_compensation, public.people_deductions to service_role;
