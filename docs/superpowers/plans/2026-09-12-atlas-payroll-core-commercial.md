# ATLAS Payroll Core + Commercialization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first production-grade ATLAS Payroll foundation: employer onboarding, payroll RBAC, workers/time/PTO, deterministic gross-to-net calculation, governed payroll-run lifecycle, Accounting posting contracts, contextual help, and tenant-scoped commercial entitlements where the ATLAS internal organization has a `0` ATLAS software fee while external customer organizations remain billable.

**Architecture:** Extend the existing React/Vite application and Supabase backend rather than creating a parallel app. Payroll domain logic lives in focused `packages/payroll/*` units, persistence/RLS/audit lives in Supabase migrations and functions, and the web module consumes those contracts through one authenticated API adapter. Phase 1 does not claim live tax filing, tax remittance, insurance issuance, or direct deposit unless a real authorized provider is configured.

**Tech Stack:** TypeScript 5.7, React 18.3, React Router, Vite 6.4, Vitest 3.2, Testing Library, Supabase Postgres/Auth/RLS/Edge Functions, npm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-payroll-core-commercial-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`; integration target remains `main`.
- Work on `feat/atlas-payroll-core-commercial`; do not merge or deploy during implementation unless separately approved.
- Reuse `apps/web`, `AtlasShell`, `atlasSession`, Supabase Auth, organization membership, RLS, and existing ATLAS navigation patterns.
- Every Payroll record that varies by customer entity must carry both `tenant_id` and `organization_id`.
- No Gusto branding, copy, illustrations, assets, or proprietary trade dress.
- No fabricated payroll data, tax balances, bank connectivity, direct-deposit state, insurance state, filing state, payment state, or compliance state.
- `internal_comp` is tenant-scoped, auditable, server-authorized, and never inferred from email address or client UI.
- External customer pricing is not hard-coded in this cycle. Customers are billable, but numeric pricing requires a separate approved commercialization decision.
- External provider charges are never waived merely because `billing_mode = internal_comp`.
- Gross-to-net calculations are deterministic, versioned, reproducible, and UI-independent.
- Tax rules are effective-dated. If no validated rule exists for a jurisdiction/date, production calculation must block rather than estimate silently.
- Accounting is authoritative for General Ledger posting; Payroll produces a balanced posting contract.
- Every sensitive Payroll write must verify authorization and emit an audit event.
- UI permission checks never replace backend authorization/RLS.
- All visible navigation/actions must resolve to real application behavior; no `href="#"`, console-only actions, fake connected states, or unsupported "Coming Soon" screens.
- Responsive behavior is required for desktop, tablet, and mobile.
- Completion requires `npm run typecheck`, `npm test`, and `npm run build`, plus affected route/security/state verification.
- First-cycle non-goals: live tax filing, live tax remittance, unapproved live direct deposit provider, unheld regulatory licensing, unapproved public pricing, and unverified provider fees of `0`.

---

## File Structure Map

### Domain package
- `packages/payroll/types.ts` — canonical Payroll types and state unions.
- `packages/payroll/permissions.ts` — permission atoms, role templates, authorization-ceiling helpers.
- `packages/payroll/entitlements.ts` — capability keys and billing/entitlement evaluation.
- `packages/payroll/calculation.ts` — deterministic gross-to-net engine.
- `packages/payroll/tax-rules.ts` — effective-dated rule registry and unsupported-rule failure contract.
- `packages/payroll/journal.ts` — balanced Accounting posting-contract builder.
- `packages/payroll/index.ts` — public exports.

### Supabase
- `supabase/migrations/20260912_payroll_core.sql` — Payroll schema, constraints, RLS, indexes, audit hooks/RPCs.
- `supabase/functions/atlas-payroll-run/index.ts` — authenticated payroll-run transition/calculation orchestration.

### Web application
- `apps/web/src/lib/payrollApi.ts` — authenticated Payroll REST/Function adapter using existing session context.
- `apps/web/src/modules/payroll/PayrollRoutes.tsx` — route tree and permission-aware Payroll layout.
- `apps/web/src/modules/payroll/PayrollHome.tsx` — live/empty-state Payroll home.
- `apps/web/src/modules/payroll/SetupWizard.tsx` — employer onboarding wizard.
- `apps/web/src/modules/payroll/PeoplePage.tsx` — employees and contractors.
- `apps/web/src/modules/payroll/TimePtoPage.tsx` — time entries, approval, PTO.
- `apps/web/src/modules/payroll/PayrollRunsPage.tsx` — run list/detail and lifecycle actions.
- `apps/web/src/modules/payroll/PayrollSettingsPage.tsx` — permissions, billing mode/status, entitlements.
- `apps/web/src/modules/payroll/HelpDrawer.tsx` — contextual governed help.
- `apps/web/src/modules/payroll/payroll.css` — responsive ATLAS Payroll presentation.
- `apps/web/src/App.tsx` — mount `/payroll/*` into the existing application.
- `apps/web/src/components/AtlasShell.tsx` — add Payroll to shared navigation.
- `apps/web/src/main.tsx` — import Payroll stylesheet only.

### Tests
- `tests/unit/payroll-permissions.test.ts`
- `tests/unit/payroll-entitlements.test.ts`
- `tests/unit/payroll-calculation.test.ts`
- `tests/unit/payroll-tax-rules.test.ts`
- `tests/unit/payroll-journal.test.ts`
- `tests/integration/payroll-schema-contract.test.ts`
- `tests/integration/payroll-api.test.ts`
- `tests/integration/payroll-routes.test.tsx`
- `tests/integration/payroll-setup.test.tsx`
- `tests/integration/payroll-workforce.test.tsx`
- `tests/integration/payroll-runs.test.tsx`
- `tests/integration/payroll-commercial.test.tsx`
- `tests/integration/payroll-accessibility-contract.test.tsx`

---

### Task 1: Payroll Domain Contracts, Permissions, and Entitlements

**Files:**
- Create: `packages/payroll/types.ts`
- Create: `packages/payroll/permissions.ts`
- Create: `packages/payroll/entitlements.ts`
- Create: `packages/payroll/index.ts`
- Test: `tests/unit/payroll-permissions.test.ts`
- Test: `tests/unit/payroll-entitlements.test.ts`

**Interfaces:**
- Produces: `PayrollPermission`, `PayrollRoleKey`, `BillingMode`, `BillingStatus`, `PayrollEntitlement`, `hasPayrollPermission()`, `canGrantPayrollPermission()`, `resolvePayrollEntitlements()`.
- Consumes: no new dependencies.

- [ ] **Step 1: Write failing permission and entitlement tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  canGrantPayrollPermission,
  hasPayrollPermission,
  resolvePayrollEntitlements
} from '../../packages/payroll';

describe('payroll permissions', () => {
  it('does not let a payroll admin grant organization-owner authority', () => {
    expect(canGrantPayrollPermission('payroll_admin', 'platform.billing.internal_comp.manage')).toBe(false);
  });

  it('lets a payroll approver approve but not process payroll', () => {
    expect(hasPayrollPermission('payroll_approver', 'payroll.run.approve')).toBe(true);
    expect(hasPayrollPermission('payroll_approver', 'payroll.run.process')).toBe(false);
  });
});

describe('payroll entitlements', () => {
  it('gives the internal tenant approved first-party capabilities without an ATLAS software fee', () => {
    const result = resolvePayrollEntitlements({
      billingMode: 'internal_comp',
      explicit: ['payroll.core', 'payroll.time', 'payroll.contractors']
    });
    expect(result.softwareFeeExempt).toBe(true);
    expect(result.capabilities).toContain('payroll.time');
    expect(result.externalProviderFeesWaived).toBe(false);
  });

  it('does not invent customer pricing', () => {
    const result = resolvePayrollEntitlements({ billingMode: 'customer', explicit: ['payroll.core'] });
    expect(result.softwareFeeExempt).toBe(false);
    expect(result.publicPrice).toBeNull();
  });
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run:
```bash
npm test -- tests/unit/payroll-permissions.test.ts tests/unit/payroll-entitlements.test.ts
```
Expected: FAIL because `packages/payroll` and its exports do not yet exist.

- [ ] **Step 3: Implement the minimal domain contracts**

`packages/payroll/types.ts` must define at least:

```ts
export type PayrollRunStatus =
  | 'draft' | 'review' | 'awaiting_approval' | 'approved'
  | 'processing' | 'processed' | 'posted'
  | 'blocked' | 'failed' | 'cancelled' | 'reversed';

export type BillingMode = 'customer' | 'internal_comp';
export type BillingStatus =
  | 'not_configured' | 'trial' | 'active' | 'past_due'
  | 'grace_period' | 'suspended' | 'cancelled' | 'internal_comp';

export type PayrollEntitlement =
  | 'payroll.core' | 'payroll.time' | 'payroll.contractors'
  | 'payroll.benefits_admin' | 'payroll.tax_filing'
  | 'payroll.direct_deposit' | 'payroll.priority_support'
  | 'payroll.hr_resources';
```

`packages/payroll/permissions.ts` must export the exact permission union from the approved spec plus `platform.billing.internal_comp.manage`, role templates, and:

```ts
export function hasPayrollPermission(role: PayrollRoleKey, permission: PayrollPermission): boolean;
export function canGrantPayrollPermission(role: PayrollRoleKey, permission: PayrollPermission): boolean;
```

`packages/payroll/entitlements.ts` must export:

```ts
export function resolvePayrollEntitlements(input: {
  billingMode: BillingMode;
  explicit: PayrollEntitlement[];
}): {
  capabilities: PayrollEntitlement[];
  softwareFeeExempt: boolean;
  externalProviderFeesWaived: false;
  publicPrice: null;
};
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/unit/payroll-permissions.test.ts tests/unit/payroll-entitlements.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/payroll tests/unit/payroll-permissions.test.ts tests/unit/payroll-entitlements.test.ts
git commit -m "feat(payroll): add domain permissions and entitlements"
```

---

### Task 2: Supabase Payroll Schema, RLS, Audit, and Commercial State

**Files:**
- Create: `supabase/migrations/20260912_payroll_core.sql`
- Test: `tests/integration/payroll-schema-contract.test.ts`

**Interfaces:**
- Consumes: existing `organizations`, `organization_members`, Supabase Auth `auth.uid()`.
- Produces tables: `payroll_legal_entities`, `payroll_addresses`, `payroll_tax_profiles`, `payroll_admin_bindings`, `payroll_workers`, `payroll_compensation`, `payroll_contractors`, `payroll_pay_schedules`, `payroll_time_entries`, `payroll_pto_policies`, `payroll_pto_balances`, `payroll_deductions`, `payroll_tax_elections`, `payroll_runs`, `payroll_run_workers`, `payroll_calculations`, `payroll_liabilities`, `payroll_disbursement_accounts`, `payroll_journal_contracts`, `payroll_billing_accounts`, `payroll_entitlements`, `payroll_help_content`, `payroll_audit_events`.

- [ ] **Step 1: Write a failing migration-contract test**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/20260912_payroll_core.sql', 'utf8');

describe('payroll schema contract', () => {
  it('creates tenant-scoped payroll records and enables RLS', () => {
    for (const table of ['payroll_workers', 'payroll_runs', 'payroll_billing_accounts', 'payroll_audit_events']) {
      expect(sql).toContain(`create table if not exists public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
    expect(sql).toContain('tenant_id uuid not null');
    expect(sql).toContain('organization_id uuid not null');
  });

  it('restricts internal_comp to server-authorized commercial administration', () => {
    expect(sql).toContain("billing_mode in ('customer','internal_comp')");
    expect(sql).toContain('platform.billing.internal_comp.manage');
    expect(sql).toContain('payroll_audit_events');
  });
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/integration/payroll-schema-contract.test.ts
```
Expected: FAIL because the migration file does not exist.

- [ ] **Step 3: Implement the schema with explicit historical and security constraints**

The migration must:

```sql
create table if not exists public.payroll_workers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  legal_entity_id uuid not null,
  worker_type text not null check (worker_type in ('employee','contractor')),
  employment_status text not null,
  hire_date date,
  termination_date date,
  work_location_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payroll_billing_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  organization_id uuid not null unique references public.organizations(id) on delete restrict,
  billing_mode text not null check (billing_mode in ('customer','internal_comp')),
  billing_status text not null check (billing_status in ('not_configured','trial','active','past_due','grace_period','suspended','cancelled','internal_comp')),
  plan_id text,
  pricing_version text,
  billing_provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Every historical configuration table must use effective dates or immutable snapshot references so later employer/address/schedule/compensation changes do not rewrite prior runs. `payroll_disbursement_accounts` may store masked account metadata and provider IDs but never raw bank credentials. Add membership-based RLS policies that resolve the current user through `organization_members`; write policies must additionally enforce role/permission checks. Add a server-side function/policy path containing the literal permission key `platform.billing.internal_comp.manage` before allowing `internal_comp` mutation. Sensitive mutations must append `payroll_audit_events` with actor, tenant, organization, entity, action, before/after JSON, timestamp, and correlation ID.

- [ ] **Step 4: Run the contract test**

```bash
npm test -- tests/integration/payroll-schema-contract.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260912_payroll_core.sql tests/integration/payroll-schema-contract.test.ts
git commit -m "feat(payroll): add Supabase schema RLS and audit"
```

---

### Task 3: Authenticated Payroll API Adapter

**Files:**
- Create: `apps/web/src/lib/payrollApi.ts`
- Modify: `apps/web/src/lib/atlasSession.ts`
- Test: `tests/integration/payroll-api.test.ts`

**Interfaces:**
- Consumes: `getActiveAtlasOrganization()` and the existing token-refresh behavior.
- Produces: `getPayrollOverview()`, `savePayrollSetupSection()`, `listPayrollWorkers()`, `savePayrollWorker()`, `listPayrollTimeEntries()`, `savePayrollTimeEntry()`, `listPayrollRuns()`, `getPayrollRun()`, `transitionPayrollRun()`, `getPayrollCommercialState()`, `listPayrollHelp()`.

- [ ] **Step 1: Expose one reusable authorized fetch contract and write failing API tests**

Add to `atlasSession.ts`:

```ts
export async function atlasAuthorizedFetch(path: string, init: RequestInit = {}) {
  return authorizedFetch(path, init);
}
```

Then test organization scoping:

```ts
import { beforeEach, expect, it, vi } from 'vitest';
import { getPayrollOverview } from '../../apps/web/src/lib/payrollApi';

beforeEach(() => vi.restoreAllMocks());

it('queries payroll state only for the active organization', async () => {
  localStorage.setItem('atlas_access_token', 'test-token');
  const fetchMock = vi.spyOn(globalThis, 'fetch');
  fetchMock
    .mockResolvedValueOnce(new Response(JSON.stringify([{ org_id: 'org-1', role: 'owner', organizations: { id: 'org-1', name: 'ATLAS', legal_name: 'ATLAS', active: true } }]), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

  await getPayrollOverview();
  expect(fetchMock.mock.calls[1][0]).toContain('organization_id=eq.org-1');
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/integration/payroll-api.test.ts
```
Expected: FAIL because `payrollApi.ts` does not exist and `atlasAuthorizedFetch` is not exported.

- [ ] **Step 3: Implement the adapter**

Use `atlasAuthorizedFetch()` for all calls, resolve the active organization before constructing filters, encode `eq.<organization.id>`, and return typed empty arrays/states rather than demo data. Mutations must include `tenant_id`/`organization_id` from authoritative backend/session context and never accept an organization override from arbitrary UI state.

Define:

```ts
export type PayrollOverview = {
  organizationId: string;
  setupComplete: boolean;
  nextPayrollDate: string | null;
  currentRunStatus: string | null;
  workerCount: number;
  missingOnboardingItems: number;
  timecardExceptions: number;
  pendingApprovals: number;
  taxConfigurationStatus: 'not_configured' | 'incomplete' | 'configured';
  disbursementStatus: 'not_configured' | 'incomplete' | 'verified';
  journalStatus: 'not_generated' | 'generated' | 'awaiting_posting_approval' | 'posted' | 'posting_failed' | null;
};
```

`getPayrollOverview()` must derive counts from actual rows returned by Supabase and return `setupComplete: false` when no legal entity/pay schedule exists; it must not synthesize zeros as business activity.

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/integration/payroll-api.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/atlasSession.ts apps/web/src/lib/payrollApi.ts tests/integration/payroll-api.test.ts
git commit -m "feat(payroll): add authenticated payroll API adapter"
```

---

### Task 4: Payroll Route Shell, Navigation, Home, and Responsive Module Frame

**Files:**
- Create: `apps/web/src/modules/payroll/PayrollRoutes.tsx`
- Create: `apps/web/src/modules/payroll/PayrollHome.tsx`
- Create: `apps/web/src/modules/payroll/payroll.css`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/AtlasShell.tsx`
- Modify: `apps/web/src/main.tsx`
- Test: `tests/integration/payroll-routes.test.tsx`

**Interfaces:**
- Consumes: `getPayrollOverview()`, shared identity/session shell.
- Produces: `/payroll` and all canonical route placeholders as real routed empty/configuration states until later tasks supply their final components.

- [ ] **Step 1: Write failing navigation tests**

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PayrollRoutes } from '../../apps/web/src/modules/payroll/PayrollRoutes';

it('renders Payroll home without invented metrics when setup is incomplete', async () => {
  render(<MemoryRouter initialEntries={['/payroll']}><PayrollRoutes /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'Payroll' })).toBeInTheDocument();
  expect(await screen.findByText(/Set up payroll/i)).toBeInTheDocument();
});

it('exposes real navigation targets for setup, runs, people, time, reports, settings and help', () => {
  render(<MemoryRouter initialEntries={['/payroll']}><PayrollRoutes /></MemoryRouter>);
  for (const label of ['Setup', 'Payroll runs', 'People', 'Time & PTO', 'Reports', 'Settings', 'Help']) {
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('href');
  }
});
```

Mock `getPayrollOverview()` to return an incomplete setup state in the test file.

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/integration/payroll-routes.test.tsx
```
Expected: FAIL because Payroll routes/components do not exist.

- [ ] **Step 3: Implement route shell and responsive ATLAS UI**

`PayrollRoutes.tsx` must own nested routes under `/payroll/*` and a Payroll-local nav. `App.tsx` mounts `<Route path="/payroll/*" element={<RequireAtlasIdentity><PayrollRoutes /></RequireAtlasIdentity>} />`. `AtlasShell.tsx` adds `{ to: '/payroll', label: 'Payroll' }`. `main.tsx` imports `./modules/payroll/payroll.css`.

CSS requirements:

```css
.payroll-layout { display: grid; grid-template-columns: minmax(180px, 240px) minmax(0, 1fr); gap: 24px; }
.payroll-card { border: 1px solid var(--border, #d9dde5); border-radius: 18px; padding: 20px; }
@media (max-width: 900px) { .payroll-layout { grid-template-columns: 1fr; } .payroll-nav { overflow-x: auto; display: flex; } }
@media (max-width: 600px) { .payroll-card { border-radius: 14px; padding: 16px; } .payroll-actions { display: grid; grid-template-columns: 1fr; } }
```

Use ATLAS styles/variables when existing equivalents exist; do not reproduce Gusto colors or branding.

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/integration/payroll-routes.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/components/AtlasShell.tsx apps/web/src/main.tsx apps/web/src/modules/payroll tests/integration/payroll-routes.test.tsx
git commit -m "feat(payroll): add module routes and responsive shell"
```

---

### Task 5: Employer Setup Wizard, Admin Permissions, EIN/Address/Bank/Schedule, and Contextual Help

**Files:**
- Create: `apps/web/src/modules/payroll/SetupWizard.tsx`
- Create: `apps/web/src/modules/payroll/HelpDrawer.tsx`
- Modify: `apps/web/src/modules/payroll/PayrollRoutes.tsx`
- Modify: `apps/web/src/lib/payrollApi.ts`
- Modify: `supabase/migrations/20260912_payroll_core.sql`
- Test: `tests/integration/payroll-setup.test.tsx`

**Interfaces:**
- Consumes: Payroll API adapter, permission atoms, tables from Task 2.
- Produces persisted setup sections `company`, `admins`, `tax`, `bank`, `pay_schedule`, `workers`, `benefits`, `review`; contextual help records by route tag.

- [ ] **Step 1: Write failing wizard tests**

```tsx
it('blocks progression for an invalid EIN and links the error summary to the field', async () => {
  renderPayrollSetup('/payroll/setup/tax');
  await user.type(screen.getByLabelText('Federal EIN'), '123');
  await user.click(screen.getByRole('button', { name: 'Save and continue' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a Federal EIN in 12-3456789 format');
  expect(screen.getByLabelText('Federal EIN')).toHaveAttribute('aria-invalid', 'true');
});

it('shows a disconnected bank state until real verification exists', async () => {
  renderPayrollSetup('/payroll/setup/bank');
  expect(await screen.findByText('Bank connection not configured')).toBeInTheDocument();
  expect(screen.queryByText('Direct deposit enabled')).not.toBeInTheDocument();
});
```

Add a test that Back returns to the previous step with saved values and a test that the help drawer exposes `Federal EIN` with source metadata instead of copied Gusto text.

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/integration/payroll-setup.test.tsx
```
Expected: FAIL because wizard/help components do not exist.

- [ ] **Step 3: Implement persisted setup and help behavior**

Use a stable setup-progress row keyed by tenant/organization/legal entity and persist `current_step`, completion flags, and timestamps. Validate EIN format as a formatting check only; do not claim IRS verification unless a future verified service exists. Store addresses with `effective_from` and nullable `effective_to`. Store only masked bank/account metadata, verification status, provider metadata, and `last_verified_at`; never raw online-banking credentials.

Seed governed help content for `ein-basics` with fields:

```ts
{
  content_id: 'payroll.ein.basics',
  title: 'Federal EIN',
  module: 'payroll',
  route_tags: ['/payroll/setup/tax'],
  jurisdiction: 'US-FED',
  source_url: 'https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number',
  reviewed_date: '2026-09-12',
  last_verified_date: '2026-09-12',
  owner: 'ATLAS Tax & Payroll Governance'
}
```

Body copy must say ATLAS is presenting general setup information, EIN is distinct from a user's SSN, and official IRS registration resources should be used when registration is required. It must not present individualized tax advice.

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/integration/payroll-setup.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/payroll/SetupWizard.tsx apps/web/src/modules/payroll/HelpDrawer.tsx apps/web/src/modules/payroll/PayrollRoutes.tsx apps/web/src/lib/payrollApi.ts supabase/migrations/20260912_payroll_core.sql tests/integration/payroll-setup.test.tsx
git commit -m "feat(payroll): add employer onboarding and contextual help"
```

---

### Task 6: Employees, Contractors, Compensation, Time Tracking, and PTO

**Files:**
- Create: `apps/web/src/modules/payroll/PeoplePage.tsx`
- Create: `apps/web/src/modules/payroll/TimePtoPage.tsx`
- Modify: `apps/web/src/modules/payroll/PayrollRoutes.tsx`
- Modify: `apps/web/src/lib/payrollApi.ts`
- Test: `tests/integration/payroll-workforce.test.tsx`

**Interfaces:**
- Consumes: `payroll_workers`, compensation, contractor, time-entry and PTO tables; Payroll permissions.
- Produces: worker CRUD, contractor-specific profiles, audited compensation changes, time entry creation/approval, payroll-lock behavior, PTO policy/balance views.

- [ ] **Step 1: Write failing workforce tests**

```tsx
it('keeps employee and contractor classifications explicit', async () => {
  renderPeople();
  await user.click(screen.getByRole('button', { name: 'Add worker' }));
  expect(screen.getByLabelText('Worker classification')).toHaveTextContent('Employee');
  expect(screen.getByLabelText('Worker classification')).toHaveTextContent('Contractor');
});

it('locks approved time entries after the linked payroll run reaches processing', async () => {
  renderTime({ runStatus: 'processing' });
  expect(await screen.findByRole('button', { name: 'Edit time entry' })).toBeDisabled();
  expect(screen.getByText('Locked by payroll processing')).toBeInTheDocument();
});

it('shows no PTO balance when no policy exists', async () => {
  renderTime({ ptoPolicy: null });
  expect(await screen.findByText('No PTO policy configured')).toBeInTheDocument();
  expect(screen.queryByText(/0 hours available/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/integration/payroll-workforce.test.tsx
```
Expected: FAIL because workforce views are not implemented.

- [ ] **Step 3: Implement workforce operations**

Compensation edits require `payroll.compensation.write`, viewing compensation requires `payroll.compensation.read`, and changes emit audit events. Contractors remain a distinct `worker_type='contractor'` plus contractor profile, never an automatic reclassification. Time entries support clock/import/manual sources, regular/overtime/paid leave/unpaid leave categories, approval status, exception flags, and immutable lock metadata once a related run is `processing` or later. PTO balances exist only when an actual policy/ledger exists.

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/integration/payroll-workforce.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/payroll/PeoplePage.tsx apps/web/src/modules/payroll/TimePtoPage.tsx apps/web/src/modules/payroll/PayrollRoutes.tsx apps/web/src/lib/payrollApi.ts tests/integration/payroll-workforce.test.tsx
git commit -m "feat(payroll): add workforce time and PTO workflows"
```

---

### Task 7: Deterministic Gross-to-Net Engine and Effective-Dated Tax Rule Registry

**Files:**
- Create: `packages/payroll/calculation.ts`
- Create: `packages/payroll/tax-rules.ts`
- Modify: `packages/payroll/index.ts`
- Test: `tests/unit/payroll-calculation.test.ts`
- Test: `tests/unit/payroll-tax-rules.test.ts`

**Interfaces:**
- Produces: `calculatePayroll(input, ruleSet)`, `TaxRuleSet`, `resolveTaxRuleSet(registry, jurisdiction, effectiveDate)`, `UnsupportedTaxRuleError`.
- Consumes: no UI and no network calls.

- [ ] **Step 1: Write failing deterministic-calculation tests**

```ts
it('reproduces the same result and checksum for identical immutable inputs', () => {
  const input = {
    workerId: 'worker-1',
    periodStart: '2026-09-01',
    periodEnd: '2026-09-15',
    taxableEarningsCents: 200_000,
    nonTaxableEarningsCents: 0,
    reimbursementsCents: 10_000,
    pretaxDeductionsCents: 20_000,
    postTaxDeductionsCents: 5_000,
    garnishmentsCents: 0
  };
  const ruleSet = fixtureRuleSet({ employeeTaxBps: 1000, employerTaxBps: 500 });
  const first = calculatePayroll(input, ruleSet);
  const second = calculatePayroll(input, ruleSet);
  expect(second).toEqual(first);
  expect(first.netPayCents).toBe(157_000);
  expect(first.checksum).toMatch(/^[a-f0-9]{64}$/);
});

it('blocks when no validated rule exists for the jurisdiction and effective date', () => {
  expect(() => resolveTaxRuleSet([], 'US-FL', '2026-09-15')).toThrow(UnsupportedTaxRuleError);
});
```

The fixture's `employeeTaxBps` and `employerTaxBps` are synthetic test inputs, not production tax rates.

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/unit/payroll-calculation.test.ts tests/unit/payroll-tax-rules.test.ts
```
Expected: FAIL because the engine and registry do not exist.

- [ ] **Step 3: Implement integer-cent calculation and versioned rule resolution**

Exact engine signature:

```ts
export function calculatePayroll(input: PayrollCalculationInput, ruleSet: TaxRuleSet): PayrollCalculationResult;
```

Calculation order:

```text
taxable wage base = taxable earnings - pretax deductions
employee taxes = ruleSet.calculateEmployeeTaxes(taxable wage base)
net pay = taxable earnings + non-taxable earnings + reimbursements
          - pretax deductions - employee taxes - post-tax deductions - garnishments
```

Employer liabilities are returned separately and never reduce employee net pay. Use integer cents and explicit rounding per rule component. Serialize normalized immutable inputs plus rule version/effective date/result components and hash with SHA-256 for the checksum. `resolveTaxRuleSet()` selects only a validated rule whose jurisdiction matches and whose effective-date window contains the pay date; otherwise throw `UnsupportedTaxRuleError`.

Do not ship synthetic fixture rates in production registry data.

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/unit/payroll-calculation.test.ts tests/unit/payroll-tax-rules.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/payroll/calculation.ts packages/payroll/tax-rules.ts packages/payroll/index.ts tests/unit/payroll-calculation.test.ts tests/unit/payroll-tax-rules.test.ts
git commit -m "feat(payroll): add deterministic gross to net engine"
```

---

### Task 8: Governed Payroll Run Lifecycle, Approval, Calculation Snapshots, and Audit

**Files:**
- Create: `supabase/functions/atlas-payroll-run/index.ts`
- Create: `apps/web/src/modules/payroll/PayrollRunsPage.tsx`
- Modify: `apps/web/src/modules/payroll/PayrollRoutes.tsx`
- Modify: `apps/web/src/lib/payrollApi.ts`
- Test: `tests/integration/payroll-runs.test.tsx`

**Interfaces:**
- Consumes: Task 7 engine/rules; run schema and RLS; `payroll.run.create`, `payroll.run.approve`, `payroll.run.process`.
- Produces: lifecycle transition function and immutable calculation snapshots.

- [ ] **Step 1: Write failing lifecycle tests**

```tsx
it('prevents processing a run before approval', async () => {
  renderRun({ status: 'awaiting_approval', permissions: ['payroll.run.process'] });
  expect(await screen.findByRole('button', { name: 'Process payroll' })).toBeDisabled();
});

it('lets an authorized approver move awaiting_approval to approved and records evidence', async () => {
  renderRun({ status: 'awaiting_approval', permissions: ['payroll.run.approve'] });
  await user.click(await screen.findByRole('button', { name: 'Approve payroll' }));
  expect(mockTransition).toHaveBeenCalledWith(expect.objectContaining({ action: 'approve' }));
});

it('shows a blocked state when the tax rule is unavailable', async () => {
  renderRun({ status: 'blocked', blockedReason: 'tax_rule_unavailable' });
  expect(await screen.findByText('Validated tax rule unavailable')).toBeInTheDocument();
  expect(screen.queryByText('Taxes filed')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/integration/payroll-runs.test.tsx
```
Expected: FAIL because the run UI/function do not exist.

- [ ] **Step 3: Implement a server-governed state machine**

Allow only:

```ts
const allowedTransitions = {
  draft: ['review', 'cancelled'],
  review: ['draft', 'awaiting_approval', 'blocked', 'cancelled'],
  awaiting_approval: ['review', 'approved', 'blocked', 'cancelled'],
  approved: ['processing', 'cancelled'],
  processing: ['processed', 'failed'],
  processed: ['posted', 'reversed'],
  posted: ['reversed'],
  blocked: ['review', 'cancelled'],
  failed: ['review', 'cancelled'],
  cancelled: [],
  reversed: []
} as const;
```

The Edge Function must derive user/org membership server-side, authorize the action, load immutable worker/time/compensation/deduction inputs, resolve validated tax rules, calculate snapshots, write run totals, write per-worker calculation inputs/results/checksum/rule version, and append one correlation-linked audit event. It must never accept client-supplied totals as authoritative.

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/integration/payroll-runs.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/atlas-payroll-run apps/web/src/modules/payroll/PayrollRunsPage.tsx apps/web/src/modules/payroll/PayrollRoutes.tsx apps/web/src/lib/payrollApi.ts tests/integration/payroll-runs.test.tsx
git commit -m "feat(payroll): add governed payroll run lifecycle"
```

---

### Task 9: Accounting Journal Contract and Commercial Billing/Entitlement Settings

**Files:**
- Create: `packages/payroll/journal.ts`
- Create: `apps/web/src/modules/payroll/PayrollSettingsPage.tsx`
- Modify: `packages/payroll/index.ts`
- Modify: `apps/web/src/modules/payroll/PayrollRoutes.tsx`
- Modify: `apps/web/src/lib/payrollApi.ts`
- Test: `tests/unit/payroll-journal.test.ts`
- Test: `tests/integration/payroll-commercial.test.tsx`

**Interfaces:**
- Produces: `buildPayrollJournalContract()`, journal posting statuses, billing/entitlement settings UI.
- Consumes: processed run totals/liabilities and server-authoritative commercial state.

- [ ] **Step 1: Write failing journal and commercial tests**

```ts
it('builds a balanced payroll posting contract', () => {
  const journal = buildPayrollJournalContract({
    runId: 'run-1',
    wageExpenseCents: 200_000,
    employerTaxExpenseCents: 10_000,
    employeeTaxLiabilityCents: 20_000,
    employerTaxLiabilityCents: 10_000,
    benefitsLiabilityCents: 0,
    garnishmentLiabilityCents: 0,
    netPayrollPayableCents: 180_000
  });
  expect(journal.totalDebitsCents).toBe(journal.totalCreditsCents);
  expect(journal.status).toBe('generated');
});
```

```tsx
it('shows zero ATLAS software fee only for server-authorized internal_comp', async () => {
  renderCommercial({ billingMode: 'internal_comp', billingStatus: 'internal_comp' });
  expect(await screen.findByText('$0 ATLAS software fee')).toBeInTheDocument();
  expect(screen.getByText(/External provider charges remain separate/i)).toBeInTheDocument();
});

it('marks customer tenants billable without inventing a price', async () => {
  renderCommercial({ billingMode: 'customer', billingStatus: 'not_configured' });
  expect(await screen.findByText('Billable customer organization')).toBeInTheDocument();
  expect(screen.getByText('Customer pricing not configured')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/unit/payroll-journal.test.ts tests/integration/payroll-commercial.test.tsx
```
Expected: FAIL because the journal builder/settings view do not exist.

- [ ] **Step 3: Implement balanced journal contracts and safe commercial controls**

`buildPayrollJournalContract()` returns lines for wage expense, employer tax expense, tax liabilities, benefit/garnishment liabilities when nonzero, and net payroll payable/cash clearing. It throws when total debits and credits differ. It creates a contract only; Accounting remains responsible for actual GL posting and updates Payroll with `not_generated | generated | awaiting_posting_approval | posted | posting_failed`.

Billing settings must read server-authoritative `billing_mode`, `billing_status`, plan/pricing metadata, and entitlements. `internal_comp` mutation control is hidden/disabled unless the session has `platform.billing.internal_comp.manage`, and the backend remains authoritative even if client state is manipulated. For customer tenants, show "Billable customer organization" and "Customer pricing not configured" until an approved price/provider exists.

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/unit/payroll-journal.test.ts tests/integration/payroll-commercial.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/payroll/journal.ts packages/payroll/index.ts apps/web/src/modules/payroll/PayrollSettingsPage.tsx apps/web/src/modules/payroll/PayrollRoutes.tsx apps/web/src/lib/payrollApi.ts tests/unit/payroll-journal.test.ts tests/integration/payroll-commercial.test.tsx
git commit -m "feat(payroll): add accounting contract and commercial state"
```

---

### Task 10: Accessibility, Error/Empty/Disconnected States, Regression, and Release Evidence

**Files:**
- Modify: `apps/web/src/modules/payroll/*.tsx`
- Modify: `apps/web/src/modules/payroll/payroll.css`
- Create: `tests/integration/payroll-accessibility-contract.test.tsx`
- Create: `docs/verification/2026-09-12-atlas-payroll-core.md`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: verified first-cycle Payroll foundation with documented real limitations.

- [ ] **Step 1: Write failing accessibility/state contract tests**

```tsx
it('provides named navigation, headings, error summaries and non-color status text', async () => {
  renderPayroll('/payroll/setup/tax');
  expect(screen.getByRole('navigation', { name: 'Payroll' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /Federal tax/i })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Save and continue' }));
  expect(screen.getByRole('alert')).toBeInTheDocument();
});

it('never labels unavailable integrations as connected, filed, paid or compliant', async () => {
  renderPayroll('/payroll');
  const text = document.body.textContent?.toLowerCase() || '';
  expect(text).not.toContain('direct deposit connected');
  expect(text).not.toContain('taxes filed');
  expect(text).not.toContain('taxes paid');
  expect(text).not.toContain('fully compliant');
});
```

- [ ] **Step 2: Run and verify failure where contracts are not yet satisfied**

```bash
npm test -- tests/integration/payroll-accessibility-contract.test.tsx
```
Expected: FAIL only on concrete missing accessibility/state behavior, not because of missing test fixtures.

- [ ] **Step 3: Fix semantic, responsive, and state gaps**

Required final states across Payroll: loading, empty, validation error, backend error, success, permission denied, disconnected/integration unavailable. Ensure keyboard-reachable controls, semantic headings, explicit labels, `aria-invalid` + linked error text, non-color-only statuses, and mobile targets at least 44 CSS pixels where interactive.

- [ ] **Step 4: Run focused Payroll suite**

```bash
npm test -- tests/unit/payroll-permissions.test.ts tests/unit/payroll-entitlements.test.ts tests/unit/payroll-calculation.test.ts tests/unit/payroll-tax-rules.test.ts tests/unit/payroll-journal.test.ts tests/integration/payroll-schema-contract.test.ts tests/integration/payroll-api.test.ts tests/integration/payroll-routes.test.tsx tests/integration/payroll-setup.test.tsx tests/integration/payroll-workforce.test.tsx tests/integration/payroll-runs.test.tsx tests/integration/payroll-commercial.test.tsx tests/integration/payroll-accessibility-contract.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Run repository-wide verification**

```bash
npm run typecheck
npm test
npm run build
```
Expected: all commands PASS. Any pre-existing unrelated failure must be recorded with exact command/output and must not be mislabeled as a Payroll success.

- [ ] **Step 6: Verify route and security behavior manually in the local app**

Check at minimum:

```text
/payroll
/payroll/setup/company
/payroll/setup/admins
/payroll/setup/tax
/payroll/setup/bank
/payroll/setup/pay-schedule
/payroll/setup/workers
/payroll/setup/benefits
/payroll/setup/review
/payroll/runs
/payroll/people
/payroll/contractors
/payroll/time
/payroll/pto
/payroll/taxes
/payroll/deductions
/payroll/benefits
/payroll/reports
/payroll/settings
/payroll/settings/permissions
/payroll/settings/billing
/payroll/help
```

Verify no route 404/500, unauthorized controls do not execute, cross-organization filters cannot be overridden from the UI, internal-comp cannot be self-assigned by a normal customer admin, bank/tax/provider states remain truthful, and desktop/tablet/mobile navigation remains usable.

- [ ] **Step 7: Write verification evidence**

`docs/verification/2026-09-12-atlas-payroll-core.md` must record:

```markdown
# ATLAS Payroll Core Verification — 2026-09-12

Branch: feat/atlas-payroll-core-commercial
Scope: first-cycle Payroll foundation

## Automated evidence
- typecheck: PASS/FAIL with command output reference
- full tests: PASS/FAIL with test count
- build: PASS/FAIL

## Security evidence
- organization/RLS isolation checked
- permission elevation checked
- internal_comp restriction checked
- audit events checked
- no raw bank credentials stored

## Truthful-state evidence
- no unverified direct-deposit connected state
- no unverified tax filed/paid/compliant state
- no unapproved customer price
- provider costs remain separate from internal ATLAS software exemption

## Known external dependency boundaries
- live tax filing/remittance: not configured unless separately evidenced
- live direct-deposit provider: not configured unless separately evidenced
- insurance carrier/broker transmission: not configured unless separately evidenced
- customer billing provider/pricing: not configured until separately approved
```

Replace `PASS/FAIL with ...` with the actual observed result during execution; do not pre-mark success.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/modules/payroll tests/integration/payroll-accessibility-contract.test.tsx docs/verification/2026-09-12-atlas-payroll-core.md
git commit -m "test(payroll): verify accessibility security and release gates"
```

---

## Plan Self-Review

### Spec coverage

- Canonical routes/home/empty-state behavior: Tasks 4–5.
- Employer identity, EIN, addresses, legal entities: Tasks 2 and 5.
- Payroll permissions/admin authority ceiling/audit: Tasks 1, 2, 5, 8, 9.
- Employees/contractors/compensation: Task 6.
- Time Tracking/PTO: Task 6.
- Weekly/biweekly/semimonthly/monthly schedules and historical preservation: Tasks 2 and 5.
- Deterministic gross-to-net and effective-dated rule versioning: Task 7.
- Tax filing/remittance truthfulness: Tasks 7, 8, 10.
- Bank/disbursement truthful connection states and restricted metadata: Tasks 2 and 5.
- Payroll lifecycle/approval/calculation snapshots: Task 8.
- Accounting journal contract/status: Task 9.
- Benefits configuration without false issuance/transmission claims: Tasks 4, 5, 10.
- Governed Help Drawer/regulatory source metadata: Task 5.
- Internal `0` ATLAS software fee vs billable customers: Tasks 1, 2, 9.
- Customer entitlements without invented public pricing: Tasks 1 and 9.
- Responsive/mobile parity, accessibility, error/loading/empty/disconnected states: Tasks 4 and 10.
- Production-readiness evidence and explicit non-goals: Task 10.

### Placeholder scan

The implementation steps contain no `TBD`, `TODO`, "implement later", or fake-success instruction. Deferred external providers and pricing are explicit approved dependency boundaries, not implementation placeholders.

### Type/interface consistency

- `BillingMode`: `customer | internal_comp` across domain, database behavior, and UI.
- `PayrollRunStatus`: one canonical lifecycle union used by engine/UI/function.
- `PayrollEntitlement`: one explicit capability union.
- `platform.billing.internal_comp.manage`: one high-privilege permission key used by domain, DB authorization, and UI gating.
- Payroll API always derives the active organization from existing session/backend context.
- Payroll calculations use integer cents and immutable versioned rule sets.
