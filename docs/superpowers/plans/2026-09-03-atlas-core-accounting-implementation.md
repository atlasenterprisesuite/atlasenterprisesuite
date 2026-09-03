# ATLAS Core + Accounting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current partial ATLAS repository into a buildable single-shell application and deliver Accounting as the first complete enterprise module with coherent double-entry demo data, permission gates, audit contracts, tests, and production verification gates.

**Architecture:** Keep one React/TypeScript web application under `apps/web`, move global routing/shell concerns into ATLAS Core, and isolate business logic in typed `packages/core` and `packages/accounting` modules. The first milestone uses deterministic in-memory/demo adapters with explicit non-production labels; all accounting calculations share the same domain contracts so dashboards, ledgers, journals, reconciliations, and reports cannot diverge.

**Tech Stack:** React, TypeScript, React Router, Vite, Vitest, Testing Library, Playwright, npm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-03-atlas-core-accounting-design.md`

## Global Constraints

- One canonical repository and one application shell.
- No duplicate module trees for the same business capability.
- No fabricated production data or false connected/live states.
- Every visible navigation item must resolve to a real route or valid application state.
- Every actionable control must perform a real client-side or authorized backend action.
- Preserve tenant and organization boundaries in every domain model.
- RBAC and audit contracts are shared core concerns.
- Existing ATLAS Health work must remain accessible inside the shared shell.
- Production claims require build, test, deployment, route, and health verification evidence.
- Payroll, HR, CRM, Inventory, POS, ATLAS Pay, live banking, tax filing, and production persistence are outside this cycle except for interfaces required by Accounting.

---

## File Map

### Workspace and application
- `package.json` — npm workspace scripts for build, typecheck, unit, integration, and e2e tests.
- `tsconfig.base.json` — shared TypeScript configuration.
- `apps/web/package.json` — web dependencies and scripts.
- `apps/web/index.html` — Vite entry document.
- `apps/web/tsconfig.json` — web TypeScript project.
- `apps/web/vite.config.ts` — Vite + Vitest configuration.
- `apps/web/src/main.tsx` — browser entrypoint.
- `apps/web/src/App.tsx` — thin app root only; no domain implementation.
- `apps/web/src/styles.css` — shared ATLAS shell and responsive UI styles.

### ATLAS Core
- `packages/core/src/tenancy.ts` — `TenantScope` and scope predicates.
- `packages/core/src/rbac.ts` — permission vocabulary and authorization helpers.
- `packages/core/src/audit.ts` — audit event contract and in-memory audit sink.
- `packages/core/src/result.ts` — typed success/failure result helpers.
- `packages/core/src/index.ts` — public Core exports.
- `apps/web/src/app/providers/AtlasContext.tsx` — active tenant, organization, actor, permissions, adapters.
- `apps/web/src/app/shell/AtlasShell.tsx` — global responsive navigation and breadcrumbs.
- `apps/web/src/app/router/AppRouter.tsx` — canonical route tree.
- `apps/web/src/app/errors/RouteErrorPage.tsx` — intentional route/error state.

### Health compatibility
- `apps/web/src/modules/health/HealthRoutes.tsx` — Health route ownership moved out of `App.tsx`.
- `apps/web/src/modules/health/HealthPlaceholder.tsx` — explicit degraded/non-production state only where source implementation is unavailable.

### Accounting domain
- `packages/accounting/src/types.ts` — shared accounting types.
- `packages/accounting/src/validation.ts` — account hierarchy and journal validation.
- `packages/accounting/src/ledger.ts` — posting and ledger projection.
- `packages/accounting/src/reconciliation.ts` — matching and difference calculation.
- `packages/accounting/src/assets.ts` — deterministic depreciation calculations.
- `packages/accounting/src/reports.ts` — trial balance, P&L, balance sheet, GL detail, AR/AP aging.
- `packages/accounting/src/repository.ts` — typed repository interface.
- `packages/accounting/src/demoRepository.ts` — coherent scoped demo implementation.
- `packages/accounting/src/index.ts` — public Accounting exports.
- `data/demo/accounting/seed.ts` — balanced demo dataset with explicit demo provenance.

### Accounting UI
- `apps/web/src/modules/finance/FinanceHome.tsx`
- `apps/web/src/modules/finance/accounting/AccountingLayout.tsx`
- `apps/web/src/modules/finance/accounting/AccountingDashboard.tsx`
- `apps/web/src/modules/finance/accounting/ChartOfAccountsPage.tsx`
- `apps/web/src/modules/finance/accounting/GeneralLedgerPage.tsx`
- `apps/web/src/modules/finance/accounting/JournalEntriesPage.tsx`
- `apps/web/src/modules/finance/accounting/ReceivablesPage.tsx`
- `apps/web/src/modules/finance/accounting/PayablesPage.tsx`
- `apps/web/src/modules/finance/accounting/BankCashPage.tsx`
- `apps/web/src/modules/finance/accounting/ReconciliationPage.tsx`
- `apps/web/src/modules/finance/accounting/FixedAssetsPage.tsx`
- `apps/web/src/modules/finance/accounting/PeriodClosePage.tsx`
- `apps/web/src/modules/finance/accounting/ReportsPage.tsx`
- `apps/web/src/modules/finance/accounting/AuditTrailPage.tsx`
- `apps/web/src/modules/finance/accounting/AccountingSettingsPage.tsx`

### Tests
- `tests/unit/core.test.ts`
- `tests/unit/accounting-validation.test.ts`
- `tests/unit/accounting-ledger.test.ts`
- `tests/unit/accounting-reconciliation.test.ts`
- `tests/unit/accounting-assets.test.ts`
- `tests/unit/accounting-reports.test.ts`
- `tests/integration/accounting-repository.test.ts`
- `tests/integration/routes.test.tsx`
- `tests/e2e/accounting.spec.ts`
- `playwright.config.ts`

---

### Task 1: Restore a buildable workspace baseline

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `apps/web/package.json`
- Create: `apps/web/index.html`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/src/main.tsx`
- Modify: `apps/web/src/App.tsx`
- Create: `apps/web/src/styles.css`
- Test: `tests/integration/routes.test.tsx`

**Interfaces:**
- Consumes: current repository `apps/web/src/App.tsx` and the approved design spec.
- Produces: `App`, `AppRouter`, npm scripts `build`, `typecheck`, `test`, `test:integration`, and a browser entrypoint that compiles without unresolved imports.

- [ ] **Step 1: Write the failing smoke test**

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../apps/web/src/App';

test('renders the ATLAS application root', () => {
  render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: /ATLAS Enterprise Suite/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the smoke test and record the current baseline failure**

Run: `npm test -- tests/integration/routes.test.tsx`

Expected before implementation: FAIL because the repository has no runnable workspace/dependency configuration and `App.tsx` references missing modules.

- [ ] **Step 3: Add workspace scripts and web toolchain**

```json
{
  "name": "atlas-enterprise-suite",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "npm --workspace apps/web run dev",
    "build": "npm --workspace apps/web run build",
    "typecheck": "npm --workspace apps/web run typecheck",
    "test": "vitest run",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "playwright test"
  }
}
```

`apps/web/src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter><App /></BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 4: Reduce `App.tsx` to a thin root while route modules are introduced in Task 3**

```tsx
import { AppRouter } from './app/router/AppRouter';

export function App() {
  return <AppRouter />;
}
```

Create a minimal `AppRouter` in Task 1 only with `/` and an intentional not-found screen; Task 3 expands it to Finance, Accounting, and Health.

- [ ] **Step 5: Run baseline gates**

Run:

```bash
npm install
npm run typecheck
npm test -- tests/integration/routes.test.tsx
npm run build
```

Expected: all PASS; no unresolved import remains.

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.base.json apps/web tests/integration/routes.test.tsx
git commit -m "build: restore ATLAS web workspace baseline"
```

---

### Task 2: Implement ATLAS Core tenancy, RBAC, audit, and result contracts

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/src/tenancy.ts`
- Create: `packages/core/src/rbac.ts`
- Create: `packages/core/src/audit.ts`
- Create: `packages/core/src/result.ts`
- Create: `packages/core/src/index.ts`
- Test: `tests/unit/core.test.ts`

**Interfaces:**
- Produces: `TenantScope`, `sameScope`, `AccountingPermission`, `hasPermission`, `AuditEvent`, `AuditSink`, `InMemoryAuditSink`, and `Result<T, E>`.

- [ ] **Step 1: Write failing Core contract tests**

```ts
import { describe, expect, it } from 'vitest';
import { hasPermission, sameScope, InMemoryAuditSink } from '../../packages/core/src';

describe('ATLAS Core', () => {
  it('rejects cross-organization scope', () => {
    expect(sameScope(
      { tenantId: 't1', organizationId: 'o1' },
      { tenantId: 't1', organizationId: 'o2' }
    )).toBe(false);
  });

  it('checks explicit permission membership', () => {
    expect(hasPermission(['accounting.read'], 'accounting.post')).toBe(false);
  });

  it('records immutable audit snapshots', () => {
    const sink = new InMemoryAuditSink();
    sink.append({
      id: 'a1', tenantId: 't1', organizationId: 'o1', actorId: 'u1',
      action: 'journal.post', entityType: 'journal', entityId: 'j1',
      before: { status: 'draft' }, after: { status: 'posted' },
      timestamp: '2026-09-03T16:00:00Z', correlationId: 'c1'
    });
    expect(sink.list({ tenantId: 't1', organizationId: 'o1' })).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests and verify they fail because Core exports do not exist**

Run: `npm test -- tests/unit/core.test.ts`

- [ ] **Step 3: Implement the contracts**

```ts
export type TenantScope = { tenantId: string; organizationId: string };

export function sameScope(a: TenantScope, b: TenantScope) {
  return a.tenantId === b.tenantId && a.organizationId === b.organizationId;
}

export type AccountingPermission =
  | 'accounting.read' | 'accounting.write' | 'accounting.post'
  | 'accounting.close' | 'accounting.admin' | 'audit.read';

export function hasPermission(granted: readonly AccountingPermission[], required: AccountingPermission) {
  return granted.includes(required) || granted.includes('accounting.admin');
}
```

`InMemoryAuditSink.list(scope)` must return only events matching both tenant and organization.

- [ ] **Step 4: Run Core tests**

Run: `npm test -- tests/unit/core.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core tests/unit/core.test.ts
git commit -m "feat: add ATLAS Core tenancy RBAC and audit contracts"
```

---

### Task 3: Build the shared shell, providers, canonical routes, and Health compatibility boundary

**Files:**
- Create: `apps/web/src/app/providers/AtlasContext.tsx`
- Create: `apps/web/src/app/shell/AtlasShell.tsx`
- Create: `apps/web/src/app/router/AppRouter.tsx`
- Create: `apps/web/src/app/errors/RouteErrorPage.tsx`
- Create: `apps/web/src/modules/home/EnterpriseHome.tsx`
- Create: `apps/web/src/modules/finance/FinanceHome.tsx`
- Create: `apps/web/src/modules/health/HealthRoutes.tsx`
- Create: `apps/web/src/modules/health/HealthPlaceholder.tsx`
- Modify: `apps/web/src/styles.css`
- Test: `tests/integration/routes.test.tsx`

**Interfaces:**
- Consumes: Core `TenantScope`, permission helpers, audit sink.
- Produces: `useAtlasContext()`, `AtlasShell`, `AppRouter`, Finance/Accounting route mount point, and retained `/health` route ownership.

- [ ] **Step 1: Extend route integration tests**

```tsx
it.each([
  ['/', 'ATLAS Enterprise Suite'],
  ['/finance', 'Finance'],
  ['/finance/accounting', 'Accounting'],
  ['/health', 'ATLAS Health']
])('renders %s inside the shared shell', (path, heading) => {
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: /ATLAS modules/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run and verify Finance/Accounting/Health route cases fail**

Run: `npm test -- tests/integration/routes.test.tsx`

- [ ] **Step 3: Implement context and shell**

```tsx
export type AtlasContextValue = {
  scope: { tenantId: string; organizationId: string };
  actorId: string;
  permissions: AccountingPermission[];
  environment: 'demo' | 'production';
};
```

Default local context must use explicit demo identifiers such as `tenant-demo` and `org-demo`; the shell must visibly label `Demo data` when environment is `demo`.

- [ ] **Step 4: Implement canonical route tree**

```tsx
<Routes>
  <Route element={<AtlasShell />}>
    <Route path="/" element={<EnterpriseHome />} />
    <Route path="/finance" element={<FinanceHome />} />
    <Route path="/finance/accounting/*" element={<AccountingRoutes />} />
    <Route path="/health/*" element={<HealthRoutes />} />
    <Route path="*" element={<RouteErrorPage kind="not-found" />} />
  </Route>
</Routes>
```

Until the missing historical Health source files are restored, `HealthRoutes` must preserve known route URLs and display an explicit `development/degraded source unavailable` state rather than fabricate clinical functionality.

- [ ] **Step 5: Verify route and responsive shell tests**

Run: `npm test -- tests/integration/routes.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app apps/web/src/modules/home apps/web/src/modules/finance apps/web/src/modules/health apps/web/src/styles.css tests/integration/routes.test.tsx
git commit -m "feat: add shared ATLAS shell and canonical routing"
```

---

### Task 4: Define Accounting domain types, validation, and coherent demo repository

**Files:**
- Create: `packages/accounting/package.json`
- Create: `packages/accounting/src/types.ts`
- Create: `packages/accounting/src/validation.ts`
- Create: `packages/accounting/src/repository.ts`
- Create: `packages/accounting/src/demoRepository.ts`
- Create: `packages/accounting/src/index.ts`
- Create: `data/demo/accounting/seed.ts`
- Test: `tests/unit/accounting-validation.test.ts`
- Test: `tests/integration/accounting-repository.test.ts`

**Interfaces:**
- Produces: `Account`, `JournalEntry`, `JournalLine`, `Invoice`, `Bill`, `BankAccount`, `BankTransaction`, `Reconciliation`, `FixedAsset`, `AccountingPeriod`, `AccountingRepository`, `validateJournalEntry()`, `DemoAccountingRepository`.

- [ ] **Step 1: Write journal-balance and scoping tests**

```ts
it('rejects an unbalanced journal', () => {
  const result = validateJournalEntry({
    ...balancedDraft,
    lines: [
      { id: 'l1', accountId: '1000', description: 'Cash', debit: 100, credit: 0, dimensions: {} },
      { id: 'l2', accountId: '4000', description: 'Revenue', debit: 0, credit: 99, dimensions: {} }
    ]
  });
  expect(result.ok).toBe(false);
});

it('never returns records from another organization', async () => {
  const repo = new DemoAccountingRepository(seed);
  const rows = await repo.listAccounts({ tenantId: 'tenant-demo', organizationId: 'org-demo' });
  expect(rows.every(r => r.tenantId === 'tenant-demo' && r.organizationId === 'org-demo')).toBe(true);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/unit/accounting-validation.test.ts tests/integration/accounting-repository.test.ts`

- [ ] **Step 3: Implement domain types and repository interface**

```ts
export type Money = number;
export type JournalStatus = 'draft' | 'validated' | 'posted' | 'reversed';

export interface JournalLine {
  id: string;
  accountId: string;
  description: string;
  debit: Money;
  credit: Money;
  dimensions: Record<string, string>;
}

export interface JournalEntry extends TenantScope {
  id: string;
  date: string;
  reference: string;
  description: string;
  source: string;
  status: JournalStatus;
  currency: string;
  lines: JournalLine[];
}
```

`validateJournalEntry` must reject negative debit/credit values, lines containing both debit and credit, empty journals, and totals whose rounded two-decimal debit/credit values differ.

- [ ] **Step 4: Seed coherent demo data**

Seed at minimum Cash, AR, AP, Equity, Revenue, and Expense control accounts plus balanced posted and draft journals. Every seeded financial total must be derivable from journal lines; do not seed dashboard totals separately.

- [ ] **Step 5: Run domain/repository tests**

Run: `npm test -- tests/unit/accounting-validation.test.ts tests/integration/accounting-repository.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/accounting data/demo/accounting tests/unit/accounting-validation.test.ts tests/integration/accounting-repository.test.ts
git commit -m "feat: add scoped accounting domain and demo repository"
```

---

### Task 5: Implement journal posting, General Ledger projection, and audit emission

**Files:**
- Create: `packages/accounting/src/ledger.ts`
- Modify: `packages/accounting/src/demoRepository.ts`
- Test: `tests/unit/accounting-ledger.test.ts`
- Test: `tests/integration/accounting-repository.test.ts`

**Interfaces:**
- Produces: `postJournal(entry, context)`, `reverseJournal(entry, context)`, `projectLedger(entries)`.
- Requires: `accounting.post` and an unlocked period for posting.

- [ ] **Step 1: Write failing posting tests**

```ts
it('posts a balanced authorized journal and emits audit', async () => {
  const result = await repo.postJournal('j-draft', {
    scope, actorId: 'u1', permissions: ['accounting.post'], correlationId: 'c-post-1'
  });
  expect(result.ok).toBe(true);
  expect((await repo.getJournal(scope, 'j-draft'))?.status).toBe('posted');
  expect(audit.list(scope).some(e => e.action === 'journal.post')).toBe(true);
});

it('blocks posting without permission', async () => {
  const result = await repo.postJournal('j-draft', {
    scope, actorId: 'u1', permissions: ['accounting.read'], correlationId: 'c-post-2'
  });
  expect(result.ok).toBe(false);
});
```

- [ ] **Step 2: Verify failures**

Run: `npm test -- tests/unit/accounting-ledger.test.ts tests/integration/accounting-repository.test.ts`

- [ ] **Step 3: Implement immutable posted entries and reversal flow**

```ts
export type PostingContext = {
  scope: TenantScope;
  actorId: string;
  permissions: AccountingPermission[];
  correlationId: string;
};
```

A reversal creates a new posted journal with debit/credit sides swapped and links it to the original; it must not mutate posted monetary lines.

- [ ] **Step 4: Implement ledger projection from posted journal lines only**

```ts
export function projectLedger(entries: readonly JournalEntry[]) {
  return entries
    .filter(entry => entry.status === 'posted')
    .flatMap(entry => entry.lines.map(line => ({
      journalId: entry.id,
      date: entry.date,
      accountId: line.accountId,
      debit: line.debit,
      credit: line.credit,
      reference: entry.reference
    })));
}
```

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- tests/unit/accounting-ledger.test.ts tests/integration/accounting-repository.test.ts
git add packages/accounting/src tests/unit/accounting-ledger.test.ts tests/integration/accounting-repository.test.ts
git commit -m "feat: add governed journal posting and ledger projection"
```

---

### Task 6: Implement Accounting dashboard, Chart of Accounts, Journals, and General Ledger UI

**Files:**
- Create: `apps/web/src/modules/finance/accounting/AccountingLayout.tsx`
- Create: `apps/web/src/modules/finance/accounting/AccountingDashboard.tsx`
- Create: `apps/web/src/modules/finance/accounting/ChartOfAccountsPage.tsx`
- Create: `apps/web/src/modules/finance/accounting/GeneralLedgerPage.tsx`
- Create: `apps/web/src/modules/finance/accounting/JournalEntriesPage.tsx`
- Create: `apps/web/src/modules/finance/accounting/AccountingRoutes.tsx`
- Modify: `apps/web/src/app/router/AppRouter.tsx`
- Modify: `apps/web/src/styles.css`
- Test: `tests/integration/routes.test.tsx`

**Interfaces:**
- Consumes: `AccountingRepository`, `validateJournalEntry`, posting methods, `useAtlasContext()`.
- Produces: working routes `/finance/accounting`, `/general-ledger`, `/chart-of-accounts`, `/journal-entries`.

- [ ] **Step 1: Write route and interaction tests**

```tsx
it('filters the Chart of Accounts', async () => {
  renderAccounting('/finance/accounting/chart-of-accounts');
  await userEvent.type(screen.getByRole('searchbox'), 'cash');
  expect(await screen.findByText('Cash')).toBeInTheDocument();
  expect(screen.queryByText('Accounts Payable')).not.toBeInTheDocument();
});

it('does not enable posting for an unbalanced draft', async () => {
  renderAccounting('/finance/accounting/journal-entries');
  await openDraft('j-draft');
  expect(screen.getByRole('button', { name: /Post journal/i })).toBeDisabled();
});
```

- [ ] **Step 2: Verify UI tests fail**

Run: `npm test -- tests/integration/routes.test.tsx`

- [ ] **Step 3: Implement Accounting nested navigation and dashboard derived values**

Dashboard values must be selectors over repository journals, invoices, bills, and reconciliations. If the active adapter has no dataset, render `No accounting dataset configured` instead of numeric zero cards.

- [ ] **Step 4: Implement COA search/filter/sort and journal editing/posting states**

Journal form validation must preserve input after validation failure and surface a visible error summary. Posting button visibility/disabled state must derive from `accounting.post` plus journal validity.

- [ ] **Step 5: Implement GL filters and journal drill-down**

GL filters: date range, account, source. Each ledger row links to its journal detail route/state.

- [ ] **Step 6: Run tests and commit**

```bash
npm test -- tests/integration/routes.test.tsx
npm run typecheck
git add apps/web/src/modules/finance/accounting apps/web/src/app/router/AppRouter.tsx apps/web/src/styles.css tests/integration/routes.test.tsx
git commit -m "feat: add Accounting dashboard ledger journals and chart of accounts"
```

---

### Task 7: Implement AR/AP workspaces and accounting impact links

**Files:**
- Create: `apps/web/src/modules/finance/accounting/ReceivablesPage.tsx`
- Create: `apps/web/src/modules/finance/accounting/PayablesPage.tsx`
- Modify: `packages/accounting/src/types.ts`
- Modify: `packages/accounting/src/demoRepository.ts`
- Modify: `apps/web/src/modules/finance/accounting/AccountingRoutes.tsx`
- Test: `tests/integration/accounting-repository.test.ts`
- Test: `tests/integration/routes.test.tsx`

**Interfaces:**
- Produces: customer/vendor balances, invoice/bill list/detail, aging buckets, payment application state, and journal references.

- [ ] **Step 1: Write aging tests**

```ts
it('places overdue receivables into deterministic aging buckets', async () => {
  const aging = await repo.getReceivablesAging(scope, '2026-09-03');
  expect(aging.total).toBe(
    aging.current + aging.days1to30 + aging.days31to60 + aging.days61to90 + aging.over90
  );
});
```

- [ ] **Step 2: Implement aging as a pure date-based calculation**

Buckets: current, 1-30, 31-60, 61-90, over 90. Compute balances from invoice/bill open amounts; never maintain a second independent aging-total source.

- [ ] **Step 3: Implement UI filters and journal links**

Routes:
- `/finance/accounting/accounts-receivable`
- `/finance/accounting/accounts-payable`

No `Pay now`, bank transfer, card, or gateway control may be shown as connected in this milestone.

- [ ] **Step 4: Run tests and commit**

```bash
npm test -- tests/integration/accounting-repository.test.ts tests/integration/routes.test.tsx
git add packages/accounting apps/web/src/modules/finance/accounting tests/integration
git commit -m "feat: add accounts receivable and payable workspaces"
```

---

### Task 8: Implement Bank & Cash plus reconciliation engine and UI

**Files:**
- Create: `packages/accounting/src/reconciliation.ts`
- Create: `apps/web/src/modules/finance/accounting/BankCashPage.tsx`
- Create: `apps/web/src/modules/finance/accounting/ReconciliationPage.tsx`
- Modify: `packages/accounting/src/demoRepository.ts`
- Modify: `apps/web/src/modules/finance/accounting/AccountingRoutes.tsx`
- Test: `tests/unit/accounting-reconciliation.test.ts`
- Test: `tests/integration/routes.test.tsx`

**Interfaces:**
- Produces: `calculateReconciliationDifference`, `matchTransactions`, `completeReconciliation`.

- [ ] **Step 1: Write failing reconciliation rules**

```ts
it('cannot complete while difference is non-zero', () => {
  const result = completeReconciliation({ ...recon, calculatedDifference: 25 });
  expect(result.ok).toBe(false);
});

it('completes when difference is zero and required items are resolved', () => {
  const result = completeReconciliation({ ...recon, calculatedDifference: 0, unresolvedRequiredItems: [] });
  expect(result.ok).toBe(true);
});
```

- [ ] **Step 2: Implement pure matching/difference functions**

```ts
export function calculateReconciliationDifference(statementEnding: number, bookEnding: number, adjustments: number) {
  return Math.round((statementEnding - bookEnding - adjustments) * 100) / 100;
}
```

- [ ] **Step 3: Implement Bank & Cash and reconciliation routes**

Statement source must display `Demo imported statement` for seed data. Never show `Connected` unless a verified live integration adapter exists.

- [ ] **Step 4: Run tests and commit**

```bash
npm test -- tests/unit/accounting-reconciliation.test.ts tests/integration/routes.test.tsx
git add packages/accounting/src/reconciliation.ts packages/accounting/src/demoRepository.ts apps/web/src/modules/finance/accounting tests
git commit -m "feat: add bank cash and reconciliation workflows"
```

---

### Task 9: Implement fixed assets, period close, reports, audit trail, and Accounting settings

**Files:**
- Create: `packages/accounting/src/assets.ts`
- Create: `packages/accounting/src/reports.ts`
- Create: `apps/web/src/modules/finance/accounting/FixedAssetsPage.tsx`
- Create: `apps/web/src/modules/finance/accounting/PeriodClosePage.tsx`
- Create: `apps/web/src/modules/finance/accounting/ReportsPage.tsx`
- Create: `apps/web/src/modules/finance/accounting/AuditTrailPage.tsx`
- Create: `apps/web/src/modules/finance/accounting/AccountingSettingsPage.tsx`
- Modify: `packages/accounting/src/demoRepository.ts`
- Modify: `apps/web/src/modules/finance/accounting/AccountingRoutes.tsx`
- Test: `tests/unit/accounting-assets.test.ts`
- Test: `tests/unit/accounting-reports.test.ts`
- Test: `tests/integration/accounting-repository.test.ts`

**Interfaces:**
- Produces: `straightLineSchedule`, `trialBalance`, `profitAndLoss`, `balanceSheet`, close validation/locking, audit viewer, effective settings.

- [ ] **Step 1: Write depreciation and report invariant tests**

```ts
it('straight-line depreciation never exceeds depreciable basis', () => {
  const schedule = straightLineSchedule({ cost: 12000, salvageValue: 0, usefulLifeMonths: 12, acquisitionDate: '2026-01-01' });
  expect(schedule.reduce((sum, row) => sum + row.depreciation, 0)).toBe(12000);
});

it('trial balance debits equal credits', async () => {
  const report = trialBalance(await repo.listPostedJournals(scope));
  expect(report.totalDebits).toBe(report.totalCredits);
});
```

- [ ] **Step 2: Implement deterministic asset and report calculations**

Reports must consume posted journal data from the repository. P&L and Balance Sheet mappings derive from `accountType`; AR/AP Aging consume the same open invoices/bills used by their pages.

- [ ] **Step 3: Implement period close guard**

```ts
export type CloseCheck = {
  requiredJournalsPosted: boolean;
  reconciliationsComplete: boolean;
  arApReviewed: boolean;
  authorized: boolean;
};

export function canClosePeriod(check: CloseCheck) {
  return Object.values(check).every(Boolean);
}
```

Repository close must additionally require `accounting.close`, emit `period.close` audit event, and block later journal posting into the locked period.

- [ ] **Step 4: Implement UI routes and permission states**

Routes:
- `/finance/accounting/fixed-assets`
- `/finance/accounting/period-close`
- `/finance/accounting/reports`
- `/finance/accounting/audit-trail`
- `/finance/accounting/settings`

Audit Trail requires `audit.read`. Settings expose only fiscal year start, base currency, supported accounting basis, and default AR/AP control accounts that actually affect repository behavior.

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- tests/unit/accounting-assets.test.ts tests/unit/accounting-reports.test.ts tests/integration/accounting-repository.test.ts
npm run typecheck
git add packages/accounting apps/web/src/modules/finance/accounting tests
git commit -m "feat: complete accounting close reports assets audit and settings"
```

---

### Task 10: Add critical E2E flows, responsive checks, build gates, and production verification hooks

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/accounting.spec.ts`
- Create: `.github/workflows/atlas-core-accounting-ci.yml`
- Create: `apps/web/public/healthz.json`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Produces: reproducible CI gates and a static health artifact for deployment smoke verification until a server-side `/healthz` endpoint exists.

- [ ] **Step 1: Write E2E flows before declaring the milestone complete**

```ts
import { test, expect } from '@playwright/test';

test('authorized user can post a balanced journal and see it in ledger', async ({ page }) => {
  await page.goto('/finance/accounting/journal-entries');
  await page.getByRole('link', { name: /Demo draft/i }).click();
  await page.getByRole('button', { name: /Post journal/i }).click();
  await expect(page.getByText(/Posted successfully/i)).toBeVisible();
  await page.goto('/finance/accounting/general-ledger');
  await expect(page.getByText(/j-draft/i)).toBeVisible();
});

test('unknown route renders intentional not-found state', async ({ page }) => {
  await page.goto('/route-that-does-not-exist');
  await expect(page.getByRole('heading', { name: /Route not found/i })).toBeVisible();
});
```

Add tests for: COA search/filter, unbalanced-journal rejection, reconciliation to zero, period close, permission denial, Health navigation round trip, and mobile navigation at a phone viewport.

- [ ] **Step 2: Run complete local gates**

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Expected: all PASS.

- [ ] **Step 3: Add CI workflow**

Workflow sequence:

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: 22
      cache: npm
  - run: npm ci
  - run: npm run typecheck
  - run: npm test
  - run: npm run build
  - run: npx playwright install --with-deps chromium
  - run: npm run test:e2e
```

CI must not contain deployment credentials. Deployment stays behind separately authorized production secrets/workflows.

- [ ] **Step 4: Add health artifact and README status language**

`apps/web/public/healthz.json`:

```json
{
  "service": "atlas-enterprise-suite-web",
  "status": "static-build-ok",
  "scope": "core-accounting"
}
```

README must say this file verifies the deployed static build only; it does not prove datastore, external integrations, or server health.

- [ ] **Step 5: Verify after authorized deployment**

Run smoke checks against the deployed site:

```bash
curl -f https://www.atlasenterprisesuite.com/healthz.json
curl -I https://www.atlasenterprisesuite.com/finance/accounting
```

Then manually or automatically verify `/`, `/finance/accounting`, `/finance/accounting/journal-entries`, `/finance/accounting/reports`, and `/health` return the intended app instead of 404/403/500.

Do not mark production complete if deployment credentials are unavailable, the deploy workflow fails, the domain returns 403/404/500, or route rewrites are not configured.

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts tests/e2e .github/workflows/atlas-core-accounting-ci.yml apps/web/public/healthz.json package.json README.md
git commit -m "test: add ATLAS Core Accounting release gates"
```

---

## Completion Gate

The milestone is complete only when all ten tasks are committed and the following evidence exists:

1. `npm install`/`npm ci` succeeds.
2. `npm run typecheck` passes.
3. Unit and integration tests pass.
4. Critical Playwright flows pass.
5. `npm run build` passes.
6. Every Accounting route in the approved spec resolves.
7. No active UI control is a dead placeholder.
8. Demo data is visibly labeled and internally balanced.
9. Permission-gated mutations are tested.
10. Tenant/organization scoping is tested.
11. Health remains navigable inside the shared shell.
12. CI passes on the implementation commit.
13. If deployment is authorized, production deployment succeeds and the health/static-build check plus key-route smoke tests pass.
14. Production is not claimed when any gate above lacks evidence.
