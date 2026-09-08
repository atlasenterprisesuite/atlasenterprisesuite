begin;

alter table public.employees
  add constraint employees_org_id_id_key unique (org_id, id);

create table public.people_time_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null,
  work_date date not null,
  clock_in timestamptz,
  clock_out timestamptz,
  break_minutes integer not null default 0 check (break_minutes >= 0),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (org_id, employee_id) references public.employees(org_id, id) on delete cascade,
  check (clock_out is null or clock_in is not null),
  check (clock_out is null or clock_out >= clock_in)
);

create table public.people_payroll_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  pay_date date not null,
  status text not null default 'draft' check (status in ('draft', 'calculated', 'approved', 'locked', 'void')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  check (period_end >= period_start)
);

create table public.people_payroll_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  payroll_run_id uuid not null,
  employee_id uuid not null,
  regular_hours numeric(10,2) not null default 0 check (regular_hours >= 0),
  overtime_hours numeric(10,2) not null default 0 check (overtime_hours >= 0),
  hourly_rate numeric(14,4) check (hourly_rate is null or hourly_rate >= 0),
  salary_period_amount numeric(14,2) check (salary_period_amount is null or salary_period_amount >= 0),
  gross_pay numeric(14,2) not null default 0 check (gross_pay >= 0),
  pretax_deductions numeric(14,2) not null default 0 check (pretax_deductions >= 0),
  taxes_withheld numeric(14,2) not null default 0 check (taxes_withheld >= 0),
  posttax_deductions numeric(14,2) not null default 0 check (posttax_deductions >= 0),
  net_pay numeric(14,2) not null default 0 check (net_pay >= 0),
  calculation jsonb not null default '{}'::jsonb check (jsonb_typeof(calculation) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (org_id, payroll_run_id) references public.people_payroll_runs(org_id, id) on delete cascade,
  foreign key (org_id, employee_id) references public.employees(org_id, id) on delete restrict,
  unique (org_id, payroll_run_id, employee_id)
);

create table public.people_compensation (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null,
  pay_type text not null check (pay_type in ('hourly', 'salary')),
  hourly_rate numeric(14,4) check (hourly_rate is null or hourly_rate >= 0),
  annual_salary numeric(14,2) check (annual_salary is null or annual_salary >= 0),
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (org_id, employee_id) references public.employees(org_id, id) on delete cascade,
  check (effective_to is null or effective_to >= effective_from),
  check (
    (pay_type = 'hourly' and hourly_rate is not null and annual_salary is null)
    or (pay_type = 'salary' and annual_salary is not null and hourly_rate is null)
  )
);

create table public.people_deductions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null,
  code text not null check (btrim(code) <> ''),
  label text not null check (btrim(label) <> ''),
  treatment text not null check (treatment in ('pretax', 'posttax')),
  calculation_type text not null check (calculation_type in ('fixed', 'percent')),
  amount numeric(14,4) not null check (amount >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (org_id, employee_id) references public.employees(org_id, id) on delete cascade,
  check (calculation_type <> 'percent' or amount <= 1),
  unique (org_id, employee_id, code)
);

create table public.people_job_requisitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (btrim(title) <> ''),
  department text,
  status text not null default 'draft' check (status in ('draft', 'open', 'paused', 'closed')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id)
);

create table public.people_candidates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null check (btrim(full_name) <> ''),
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id)
);

create table public.people_applications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  requisition_id uuid not null,
  candidate_id uuid not null,
  stage text not null default 'applied' check (stage in ('applied', 'screening', 'assessment', 'interview', 'offer', 'hired', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (org_id, requisition_id) references public.people_job_requisitions(org_id, id) on delete cascade,
  foreign key (org_id, candidate_id) references public.people_candidates(org_id, id) on delete cascade,
  unique (org_id, id),
  unique (org_id, requisition_id, candidate_id)
);

create table public.people_assessment_results (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  application_id uuid not null,
  assessment_type text not null check (btrim(assessment_type) <> ''),
  score numeric(7,3),
  max_score numeric(7,3),
  result jsonb not null default '{}'::jsonb check (jsonb_typeof(result) = 'object'),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (org_id, application_id) references public.people_applications(org_id, id) on delete cascade,
  check (
    (score is null and max_score is null)
    or (score is not null and max_score is not null and max_score > 0 and score >= 0 and score <= max_score)
  )
);

create index people_time_entries_org_employee_date_idx
  on public.people_time_entries (org_id, employee_id, work_date desc);
create index people_payroll_runs_org_period_idx
  on public.people_payroll_runs (org_id, period_end desc);
create index people_payroll_lines_org_run_idx
  on public.people_payroll_lines (org_id, payroll_run_id);
create index people_compensation_org_employee_effective_idx
  on public.people_compensation (org_id, employee_id, effective_from desc);
create index people_deductions_org_employee_idx
  on public.people_deductions (org_id, employee_id);
create index people_job_requisitions_org_status_idx
  on public.people_job_requisitions (org_id, status);
create index people_candidates_org_name_idx
  on public.people_candidates (org_id, full_name);
create index people_applications_org_stage_idx
  on public.people_applications (org_id, stage);
create index people_assessment_results_org_application_idx
  on public.people_assessment_results (org_id, application_id);

alter table public.people_time_entries enable row level security;
alter table public.people_payroll_runs enable row level security;
alter table public.people_payroll_lines enable row level security;
alter table public.people_compensation enable row level security;
alter table public.people_deductions enable row level security;
alter table public.people_job_requisitions enable row level security;
alter table public.people_candidates enable row level security;
alter table public.people_applications enable row level security;
alter table public.people_assessment_results enable row level security;

create policy people_time_entries_read on public.people_time_entries
for select to authenticated
using (
  public.has_identity_permission(people_time_entries.org_id, 'hr.read')
  or exists (
    select 1
    from public.employees e
    where e.id = people_time_entries.employee_id
      and e.org_id = people_time_entries.org_id
      and e.user_id = auth.uid()
  )
);
create policy people_time_entries_write on public.people_time_entries
for all to authenticated
using (public.has_identity_permission(people_time_entries.org_id, 'hr.write'))
with check (public.has_identity_permission(people_time_entries.org_id, 'hr.write'));

create policy people_payroll_runs_read on public.people_payroll_runs
for select to authenticated
using (public.has_identity_permission(people_payroll_runs.org_id, 'payroll.read'));
create policy people_payroll_runs_write on public.people_payroll_runs
for all to authenticated
using (public.has_identity_permission(people_payroll_runs.org_id, 'payroll.write'))
with check (public.has_identity_permission(people_payroll_runs.org_id, 'payroll.write'));

create policy people_payroll_lines_read on public.people_payroll_lines
for select to authenticated
using (
  public.has_identity_permission(people_payroll_lines.org_id, 'payroll.read')
  or (
    public.has_identity_permission(people_payroll_lines.org_id, 'payroll.self')
    and exists (
      select 1
      from public.employees e
      where e.id = people_payroll_lines.employee_id
        and e.org_id = people_payroll_lines.org_id
        and e.user_id = auth.uid()
    )
  )
);
create policy people_payroll_lines_write on public.people_payroll_lines
for all to authenticated
using (public.has_identity_permission(people_payroll_lines.org_id, 'payroll.write'))
with check (public.has_identity_permission(people_payroll_lines.org_id, 'payroll.write'));

create policy people_compensation_read on public.people_compensation
for select to authenticated
using (
  public.has_identity_permission(people_compensation.org_id, 'payroll.read')
  or (
    public.has_identity_permission(people_compensation.org_id, 'payroll.self')
    and exists (
      select 1
      from public.employees e
      where e.id = people_compensation.employee_id
        and e.org_id = people_compensation.org_id
        and e.user_id = auth.uid()
    )
  )
);
create policy people_compensation_write on public.people_compensation
for all to authenticated
using (public.has_identity_permission(people_compensation.org_id, 'payroll.write'))
with check (public.has_identity_permission(people_compensation.org_id, 'payroll.write'));

create policy people_deductions_read on public.people_deductions
for select to authenticated
using (
  public.has_identity_permission(people_deductions.org_id, 'payroll.read')
  or (
    public.has_identity_permission(people_deductions.org_id, 'payroll.self')
    and exists (
      select 1
      from public.employees e
      where e.id = people_deductions.employee_id
        and e.org_id = people_deductions.org_id
        and e.user_id = auth.uid()
    )
  )
);
create policy people_deductions_write on public.people_deductions
for all to authenticated
using (public.has_identity_permission(people_deductions.org_id, 'payroll.write'))
with check (public.has_identity_permission(people_deductions.org_id, 'payroll.write'));

create policy people_job_requisitions_read on public.people_job_requisitions
for select to authenticated
using (public.has_identity_permission(people_job_requisitions.org_id, 'hr.read'));
create policy people_job_requisitions_write on public.people_job_requisitions
for all to authenticated
using (public.has_identity_permission(people_job_requisitions.org_id, 'hr.write'))
with check (public.has_identity_permission(people_job_requisitions.org_id, 'hr.write'));

create policy people_candidates_read on public.people_candidates
for select to authenticated
using (public.has_identity_permission(people_candidates.org_id, 'hr.read'));
create policy people_candidates_write on public.people_candidates
for all to authenticated
using (public.has_identity_permission(people_candidates.org_id, 'hr.write'))
with check (public.has_identity_permission(people_candidates.org_id, 'hr.write'));

create policy people_applications_read on public.people_applications
for select to authenticated
using (public.has_identity_permission(people_applications.org_id, 'hr.read'));
create policy people_applications_write on public.people_applications
for all to authenticated
using (public.has_identity_permission(people_applications.org_id, 'hr.write'))
with check (public.has_identity_permission(people_applications.org_id, 'hr.write'));

create policy people_assessment_results_read on public.people_assessment_results
for select to authenticated
using (public.has_identity_permission(people_assessment_results.org_id, 'hr.read'));
create policy people_assessment_results_write on public.people_assessment_results
for all to authenticated
using (public.has_identity_permission(people_assessment_results.org_id, 'hr.write'))
with check (public.has_identity_permission(people_assessment_results.org_id, 'hr.write'));

create or replace function public.guard_people_payroll_run_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.org_id is distinct from old.org_id then
    raise exception 'Payroll run organization scope cannot change';
  end if;

  if new.status is distinct from old.status and new.status in ('approved', 'locked') then
    if not public.has_identity_permission(old.org_id, 'payroll.approve') then
      raise exception 'payroll.approve permission is required';
    end if;
    new.approved_by := auth.uid();
    new.approved_at := now();
  elsif (
    new.approved_by is distinct from old.approved_by
    or new.approved_at is distinct from old.approved_at
  ) and not public.has_identity_permission(old.org_id, 'payroll.approve') then
    raise exception 'payroll.approve permission is required to modify approval evidence';
  end if;

  if old.status = 'locked' and new.status is distinct from old.status then
    if not public.has_identity_permission(old.org_id, 'payroll.approve') then
      raise exception 'payroll.approve permission is required to unlock payroll';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_people_payroll_run_transition() from public, anon, authenticated;

create trigger people_payroll_runs_guard_transition
before update on public.people_payroll_runs
for each row execute function public.guard_people_payroll_run_transition();

commit;
