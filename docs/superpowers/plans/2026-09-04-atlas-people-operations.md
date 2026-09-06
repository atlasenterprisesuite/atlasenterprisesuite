# ATLAS People Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first production-governed ATLAS People Operations vertical across HR, Time & Attendance, Payroll, Recruiting, Assessments, Compensation, Benefits/Deductions, and Employee Self-Service without representing tax filing, banking, background-check, or other provider rails as connected.

**Architecture:** Reuse `packages/core` for identity, RBAC, tenant/organization scoping, audit, and results; reuse the existing `public.employees` table and its `can_manage_people(org_id)` RLS contract; add only the missing People-owned relational sources of truth. Domain rules live in a focused `packages/people` workspace, Supabase repositories stay adapter-specific, and responsive React routes mount under the shared `apps/web` shell. Mutable payroll/time/HR data always carries organization scope and, where the Core contract requires it, explicit `TenantScope`; browser code never bypasses RLS or executes provider actions directly.

**Tech Stack:** TypeScript, React 19, React Router 7, Vite, Vitest, Testing Library, npm workspaces, Supabase/Postgres/RLS, existing ATLAS Core contracts.

**Spec:** `docs/superpowers/specs/2026-09-04-atlas-a-z-closure-design.md`

## Verified existing backend contracts

- `public.employees` already exists with `id`, `org_id`, `user_id`, `full_name`, `department`, `job_title`, `status`, audit timestamps, and foreign keys to organizations/auth users.
- Employee RLS already uses `can_manage_people(org_id)` for manager writes and permits self-read when `employees.user_id = auth.uid()`.
- `can_manage_people(org_id)` resolves owner/admin/manager.
- `has_identity_permission(org_id, permission_code)` already exists and must be reused for granular payroll/time/recruiting policies.
- Existing permission catalog already includes `hr.read`, `hr.write`, `payroll.read`, `payroll.write`, `payroll.approve`, `payroll.tax`, `payroll.audit`, and `payroll.self`.
- No dedicated payroll, timekeeping, recruiting, candidate, compensation, benefit, or deduction tables currently exist; do not create parallel employee tables.

## Global Constraints

- Work only on `release/atlas-a-z`; keep `main` production-stable until the final A-Z release gate.
- Preserve `public.employees` as the canonical employee record; extend by related tables instead of duplicating it.
- Every table that contains organization business data must carry `org_id uuid references public.organizations(id) on delete cascade` and enforce RLS.
- Use `has_identity_permission` or existing self-service identity relations in RLS; never rely only on hidden UI controls.
- No payroll metric may be invented; totals must derive deterministically from persisted inputs and calculator outputs.
- Tax liabilities may be calculated/configured, but filing/payment/provider status remains `not_configured` unless an authorized adapter supplies evidence.
- Employee bank accounts, SSNs, tax IDs, medical/benefit evidence, and provider secrets are not introduced into browser-readable tables in this wave.
- No `href="#"`, dead buttons, fake Connected/Live/Filed/Paid states, console-only actions, or synthetic production metrics.
- Every task follows RED -> GREEN -> REFACTOR with focused unit/integration tests before acceptance.
- GitHub Actions runner-allocation issue #22 currently prevents fresh CI execution; code may advance, but no wave is marked verified until the tests actually run and pass.

---

### Task 1: People domain contracts and deterministic employee lifecycle

**Files:**
- Create: `packages/people/package.json`
- Create: `packages/people/src/index.ts`
- Create: `packages/people/src/types.ts`
- Create: `packages/people/src/employee.ts`
- Create: `packages/people/src/errors.ts`
- Test: `tests/unit/people-employee.test.ts`

**Interfaces:**
- Consumes: `TenantScope`, `Result`, and ATLAS permission strings from `packages/core/src`.
- Produces: `EmployeeRecord`, `EmploymentStatus`, `EmployeeMutation`, `validateEmployeeMutation()`.

- [ ] **Step 1: Write the failing employee contract test**

```ts
expect(validateEmployeeMutation({
  scope: { tenantId: 'tenant-a', organizationId: 'org-a' },
  fullName: 'Ada Rivera',
  department: 'Finance',
  jobTitle: 'Payroll Specialist',
  status: 'active',
}).ok).toBe(true);

expect(validateEmployeeMutation({
  scope: { tenantId: 'tenant-a', organizationId: 'org-a' },
  fullName: '   ',
  department: null,
  jobTitle: null,
  status: 'active',
}).ok).toBe(false);
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- tests/unit/people-employee.test.ts`
Expected: FAIL because `packages/people` contracts do not exist.

- [ ] **Step 3: Implement minimal typed contracts**

```ts
export type EmploymentStatus = 'active' | 'leave' | 'terminated';

export interface EmployeeMutation {
  scope: TenantScope;
  fullName: string;
  department: string | null;
  jobTitle: string | null;
  status: EmploymentStatus;
}

export function validateEmployeeMutation(input: EmployeeMutation): Result<EmployeeMutation, string> {
  const fullName = input.fullName.trim();
  if (!fullName) return err('Employee full name is required.');
  return ok({ ...input, fullName });
}
```

- [ ] **Step 4: Run the focused test and Core regression tests**

Run: `npm test -- tests/unit/people-employee.test.ts tests/unit/core.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/people tests/unit/people-employee.test.ts
git commit -m "feat: add ATLAS People employee contracts"
```

---

### Task 2: Governed People schema and repositories

**Files:**
- Create: `supabase/migrations/20260906_people_operations_foundation.sql`
- Create: `packages/people/src/repository.ts`
- Create: `packages/people/src/supabaseRepository.ts`
- Test: `tests/integration/people-repository.test.ts`

**Interfaces:**
- Consumes: existing `public.employees`, `can_manage_people(uuid)`, `has_identity_permission(uuid,text)`.
- Produces: canonical tables for time, payroll, recruiting, benefits/deductions, plus `PeopleRepository` and `SupabasePeopleRepository`.

- [ ] **Step 1: Write repository contract tests using an in-memory fixture adapter**

```ts
const employees = await repository.listEmployees('org-a');
expect(employees.every((employee) => employee.organizationId === 'org-a')).toBe(true);
expect(await repository.getEmployee('org-a', 'employee-other-org')).toBeNull();
```

- [ ] **Step 2: Confirm RED**

Run: `npm test -- tests/integration/people-repository.test.ts`
Expected: FAIL because repository interfaces do not exist.

- [ ] **Step 3: Add only missing relational sources of truth**

Migration must create these organization-scoped tables with primary keys, foreign keys, timestamps, and RLS enabled:

```sql
create table public.people_time_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  clock_in timestamptz,
  clock_out timestamptz,
  break_minutes integer not null default 0 check (break_minutes >= 0),
  status text not null default 'draft' check (status in ('draft','submitted','approved','rejected')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.people_payroll_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  pay_date date not null,
  status text not null default 'draft' check (status in ('draft','calculated','approved','locked','void')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table public.people_payroll_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  payroll_run_id uuid not null references public.people_payroll_runs(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  regular_hours numeric(10,2) not null default 0,
  overtime_hours numeric(10,2) not null default 0,
  hourly_rate numeric(14,4),
  salary_period_amount numeric(14,2),
  gross_pay numeric(14,2) not null default 0,
  pretax_deductions numeric(14,2) not null default 0,
  taxes_withheld numeric(14,2) not null default 0,
  posttax_deductions numeric(14,2) not null default 0,
  net_pay numeric(14,2) not null default 0,
  calculation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.people_compensation (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  pay_type text not null check (pay_type in ('hourly','salary')),
  hourly_rate numeric(14,4),
  annual_salary numeric(14,2),
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  check ((pay_type='hourly' and hourly_rate is not null) or (pay_type='salary' and annual_salary is not null))
);

create table public.people_deductions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  code text not null,
  label text not null,
  treatment text not null check (treatment in ('pretax','posttax')),
  calculation_type text not null check (calculation_type in ('fixed','percent')),
  amount numeric(14,4) not null check (amount >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.people_job_requisitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  department text,
  status text not null default 'draft' check (status in ('draft','open','paused','closed')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.people_candidates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.people_applications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  requisition_id uuid not null references public.people_job_requisitions(id) on delete cascade,
  candidate_id uuid not null references public.people_candidates(id) on delete cascade,
  stage text not null default 'applied' check (stage in ('applied','screening','assessment','interview','offer','hired','rejected','withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.people_assessment_results (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  application_id uuid not null references public.people_applications(id) on delete cascade,
  assessment_type text not null,
  score numeric(7,3),
  max_score numeric(7,3),
  result jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
```

RLS policy pattern:

```sql
alter table public.people_time_entries enable row level security;
create policy people_time_entries_read on public.people_time_entries
for select to authenticated
using (
  public.has_identity_permission(org_id, 'hr.read')
  or exists (
    select 1 from public.employees e
    where e.id = employee_id and e.user_id = auth.uid() and e.org_id = org_id
  )
);
create policy people_time_entries_write on public.people_time_entries
for all to authenticated
using (public.has_identity_permission(org_id, 'hr.write'))
with check (public.has_identity_permission(org_id, 'hr.write'));
```

Payroll tables use `payroll.read`, `payroll.write`, and approval mutations use `payroll.approve`. Recruiting tables use `hr.read`/`hr.write`. Self-service reads are limited to the authenticated employee relation.

- [ ] **Step 4: Implement `PeopleRepository` methods that always receive `organizationId`**

```ts
export interface PeopleRepository {
  listEmployees(organizationId: string): Promise<EmployeeRecord[]>;
  listTimeEntries(organizationId: string, employeeId?: string): Promise<TimeEntry[]>;
  listPayrollRuns(organizationId: string): Promise<PayrollRun[]>;
  listApplications(organizationId: string): Promise<ApplicationRecord[]>;
}
```

- [ ] **Step 5: Run repository/unit tests and typecheck**

Run: `npm test -- tests/integration/people-repository.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations packages/people tests/integration/people-repository.test.ts
git commit -m "feat: add governed People Operations data model"
```

---

### Task 3: Time & Attendance workflow

**Files:**
- Create: `packages/people/src/time.ts`
- Create: `apps/web/src/modules/people/TimeAttendancePage.tsx`
- Test: `tests/unit/people-time.test.ts`
- Test: `tests/integration/people-time-ui.test.tsx`

**Interfaces:**
- Produces: `calculateWorkedMinutes()`, `submitTimeEntry()`, `approveTimeEntry()`.

- [ ] **Step 1: Write tests for worked time and impossible intervals**

```ts
expect(calculateWorkedMinutes('2026-09-06T09:00:00Z','2026-09-06T17:30:00Z',30)).toBe(480);
expect(() => calculateWorkedMinutes('2026-09-06T17:00:00Z','2026-09-06T09:00:00Z',0)).toThrow();
```

- [ ] **Step 2: Confirm RED, implement calculator, then confirm GREEN**

Run: `npm test -- tests/unit/people-time.test.ts`
Expected after implementation: PASS.

- [ ] **Step 3: Implement state transitions**

Only `draft -> submitted -> approved|rejected` is valid. Approval records actor and timestamp. Editing an approved row requires an explicit reopen/audit action, not a silent update.

- [ ] **Step 4: Build responsive Time page with real repository data**

UI must include period/date filters, employee filter when authorized, status filter, worked-hours derivation, submit/approve/reject actions, loading/empty/error/success states, and no invented timecards.

- [ ] **Step 5: Integration test route and mutations**

Run: `npm test -- tests/integration/people-time-ui.test.tsx`
Expected: PASS with repository fixtures and permission-denied cases.

- [ ] **Step 6: Commit**

```bash
git add packages/people/src/time.ts apps/web/src/modules/people tests/unit/people-time.test.ts tests/integration/people-time-ui.test.tsx
git commit -m "feat: add ATLAS Time and Attendance workflow"
```

---

### Task 4: Deterministic Payroll calculation and approval lifecycle

**Files:**
- Create: `packages/people/src/payroll.ts`
- Create: `apps/web/src/modules/people/PayrollPage.tsx`
- Test: `tests/unit/people-payroll.test.ts`
- Test: `tests/integration/people-payroll-ui.test.tsx`

**Interfaces:**
- Produces: `calculatePayrollLine(input)`, `transitionPayrollRun(run, action, actor)`.

- [ ] **Step 1: Write payroll arithmetic tests**

```ts
expect(calculatePayrollLine({
  regularHours: 40,
  overtimeHours: 5,
  hourlyRate: 20,
  overtimeMultiplier: 1.5,
  pretaxDeductions: 50,
  taxesWithheld: 150,
  posttaxDeductions: 25,
})).toMatchObject({ grossPay: 950, netPay: 725 });
```

Use decimal-safe integer cents internally; never rely on binary floating-point for persisted money.

- [ ] **Step 2: Confirm RED, implement the cents-based calculator, confirm GREEN**

Run: `npm test -- tests/unit/people-payroll.test.ts`
Expected: PASS for hourly, salary-period, zero-hour, overtime, deduction, and invalid-negative cases.

- [ ] **Step 3: Implement payroll lifecycle**

Allowed lifecycle: `draft -> calculated -> approved -> locked`; `void` requires an audit reason. Calculation cannot mark filing/payment as complete. Approval requires `payroll.approve`.

- [ ] **Step 4: Build Payroll page**

Show persisted runs, period/pay-date/status, employee lines, gross/deductions/taxes/net, calculation evidence, approval state, and explicit provider readiness panel:

`Tax filing: Not configured` and `Payment rail: Not configured` until authorized providers exist.

- [ ] **Step 5: Integration test permissions and truthful provider states**

Run: `npm test -- tests/integration/people-payroll-ui.test.tsx`
Expected: users with `payroll.read` can view; writes require `payroll.write`; approval requires `payroll.approve`; no text claims Filed/Paid/Connected without evidence.

- [ ] **Step 6: Commit**

```bash
git add packages/people/src/payroll.ts apps/web/src/modules/people/PayrollPage.tsx tests/unit/people-payroll.test.ts tests/integration/people-payroll-ui.test.tsx
git commit -m "feat: add deterministic ATLAS Payroll lifecycle"
```

---

### Task 5: Recruiting, candidate assessments, and English Assessment

**Files:**
- Create: `packages/people/src/recruiting.ts`
- Create: `apps/web/src/modules/people/RecruitingPage.tsx`
- Create: `apps/web/src/modules/people/AssessmentPage.tsx`
- Test: `tests/unit/people-recruiting.test.ts`
- Test: `tests/integration/people-recruiting-ui.test.tsx`

**Interfaces:**
- Produces: `advanceApplicationStage()`, `scoreAssessment()`.

- [ ] **Step 1: Define application-stage and score tests**

```ts
expect(advanceApplicationStage('applied','screening')).toBe('screening');
expect(() => advanceApplicationStage('hired','screening')).toThrow();
expect(scoreAssessment({ earned: 42, possible: 50 })).toEqual({ score: 84, passed: true });
```

- [ ] **Step 2: Implement deterministic stage and scoring rules**

English Assessment is an assessment type with persisted questions/result evidence; do not infer language proficiency from unrelated profile data.

- [ ] **Step 3: Build Recruiting and Assessment routes**

Required controls: requisition CRUD, applicant search/filter, stage transitions, assessment assignment/result, rejection/withdrawal reasons, audit visibility. No automated hiring decision without a documented, authorized rule.

- [ ] **Step 4: Run unit/integration tests**

Run: `npm test -- tests/unit/people-recruiting.test.ts tests/integration/people-recruiting-ui.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/people/src/recruiting.ts apps/web/src/modules/people tests/unit/people-recruiting.test.ts tests/integration/people-recruiting-ui.test.tsx
git commit -m "feat: add ATLAS Recruiting and assessments"
```

---

### Task 6: Compensation, benefits/deductions, and Employee Self-Service

**Files:**
- Create: `packages/people/src/compensation.ts`
- Create: `apps/web/src/modules/people/CompensationPage.tsx`
- Create: `apps/web/src/modules/people/SelfServicePage.tsx`
- Test: `tests/unit/people-compensation.test.ts`
- Test: `tests/integration/people-self-service-ui.test.tsx`

**Interfaces:**
- Produces effective-dated compensation selection and employee-owned read models.

- [ ] **Step 1: Test effective-dated compensation selection**

```ts
expect(selectCompensation(history, '2026-09-06')?.effectiveFrom).toBe('2026-07-01');
```

Overlapping effective ranges must fail validation.

- [ ] **Step 2: Implement benefits/deduction calculations**

Fixed and percentage deductions return cents and preserve pretax/posttax treatment; provider enrollment is stored as readiness/configuration only unless an authorized benefits provider exists.

- [ ] **Step 3: Implement Self-Service page**

The authenticated employee may view only their employee profile, time entries, payroll statements, compensation/benefit summary permitted by RLS. Management actions never appear in self-service without corresponding permission.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/unit/people-compensation.test.ts tests/integration/people-self-service-ui.test.tsx`
Expected: PASS, including cross-employee denial.

- [ ] **Step 5: Commit**

```bash
git add packages/people/src/compensation.ts apps/web/src/modules/people tests/unit/people-compensation.test.ts tests/integration/people-self-service-ui.test.tsx
git commit -m "feat: add ATLAS People compensation and self service"
```

---

### Task 7: People routes, navigation, permission gates, and module registry

**Files:**
- Create: `apps/web/src/modules/people/PeopleHome.tsx`
- Create: `apps/web/src/modules/people/PeopleRoutes.tsx`
- Modify: `apps/web/src/app/router/AppRouter.tsx`
- Modify: `apps/web/src/app/AtlasShell.tsx`
- Modify: `apps/web/src/modules/home/EnterpriseHome.tsx`
- Test: `tests/integration/people-routes.test.tsx`

**Interfaces:**
- Routes: `/people`, `/people/employees`, `/people/time`, `/people/payroll`, `/people/recruiting`, `/people/assessments`, `/people/compensation`, `/people/self-service`.

- [ ] **Step 1: Write route matrix with permission-denied cases**

HR management routes require `hr.read`; mutations require `hr.write`. Payroll route requires `payroll.read`. Self-service may render with `payroll.self` plus employee RLS.

- [ ] **Step 2: Implement nested People routes and breadcrumbs/cards**

Every visible card must navigate to an implemented route; no placeholder destinations.

- [ ] **Step 3: Register People only when the identity has usable People permission**

```ts
const canSeePeople =
  hasPermission(identity.permissions, 'hr.read') ||
  hasPermission(identity.permissions, 'payroll.read') ||
  hasPermission(identity.permissions, 'payroll.self');
```

- [ ] **Step 4: Run route tests**

Run: `npm test -- tests/integration/people-routes.test.tsx tests/integration/routes.test.tsx`
Expected: PASS with mobile-safe shell navigation.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/people apps/web/src/app tests/integration/people-routes.test.tsx
git commit -m "feat: mount governed ATLAS People routes"
```

---

### Task 8: Audit, safety scans, full People verification, and A-Z acceptance

**Files:**
- Create: `.github/workflows/atlas-people-ci.yml`
- Create: `tests/integration/people-audit.test.ts`
- Modify: `docs/superpowers/release/ATLAS_AZ_STATUS.md`

**Interfaces:**
- Produces a dedicated People CI gate and release evidence; no provider deployment.

- [ ] **Step 1: Add dedicated People CI**

```yaml
- run: npm ci
- run: npm audit --audit-level=high
- run: npm run typecheck
- run: npm test -- tests/unit/people-employee.test.ts tests/unit/people-time.test.ts tests/unit/people-payroll.test.ts tests/unit/people-recruiting.test.ts tests/unit/people-compensation.test.ts
- run: npm test -- tests/integration/people-repository.test.ts tests/integration/people-time-ui.test.tsx tests/integration/people-payroll-ui.test.tsx tests/integration/people-recruiting-ui.test.tsx tests/integration/people-self-service-ui.test.tsx tests/integration/people-routes.test.tsx
- run: npm run build
```

Add a source-safety scan rejecting provider claims such as `tax filing: connected`, hardcoded bank credentials, SSNs, or production payment tokens in People runtime code.

- [ ] **Step 2: Verify audit events for approvals and sensitive mutations**

Time approvals, payroll approvals/voids, employee status changes, compensation changes, and recruiting stage decisions must emit actor/org/entity/correlation evidence through the shared audit contract or an audited Postgres write path.

- [ ] **Step 3: Run full local/CI matrix when runner allocation is restored**

Run: `npm ci && npm audit --audit-level=high && npm run typecheck && npm test && npm run build`
Expected: zero failed tests, zero high-severity dependency gate failures, successful production build.

- [ ] **Step 4: Verify responsive behavior**

Check `/people`, `/people/time`, `/people/payroll`, `/people/recruiting`, and `/people/self-service` at desktop, tablet, and mobile widths; confirm no clipped tables/actions and keyboard-accessible controls.

- [ ] **Step 5: Update release status only with fresh evidence**

Mark People Operations `implemented` after code/schema/routes exist; mark `verified` only after Task 8 Step 3 actually passes. Keep provider rails separately `not_configured`.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/atlas-people-ci.yml tests/integration/people-audit.test.ts docs/superpowers/release/ATLAS_AZ_STATUS.md
git commit -m "ci: add ATLAS People Operations release gate"
```

## Execution order

Execute Tasks 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 on `release/atlas-a-z`. A later task may begin only when its required interfaces exist; acceptance/verification remains blocked by GitHub Actions issue #22 until a fresh runner actually executes the matrix.
