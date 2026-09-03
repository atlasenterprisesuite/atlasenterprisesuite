# ATLAS Core + Accounting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current partial ATLAS repository into a buildable single-shell application and deliver Accounting as the first complete enterprise module with coherent double-entry demo data, permission gates, audit contracts, tests, and production verification gates.

**Architecture:** Keep one React/TypeScript web application under `apps/web`, move global routing and shell concerns into ATLAS Core, and isolate business logic in typed `packages/core` and `packages/accounting` modules. The first milestone uses deterministic in-memory/demo adapters with explicit non-production labels; dashboards, journals, ledgers, reconciliations, and reports all consume the same accounting contracts.

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

### Workspace
- `package.json`
- `tsconfig.base.json`
- `apps/web/package.json`
- `apps/web/index.html`
- `apps/web/tsconfig.json`
- `apps/web/vite.config.ts`
- `apps/web/src/main.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`

### Core application
- `apps/web/src/app/router/AppRouter.tsx`
- `apps/web/src/app/providers/AtlasContext.tsx`
- `apps/web/src/app/shell/AtlasShell.tsx`
- `apps/web/src/app/errors/RouteErrorPage.tsx`
- `apps/web/src/modules/home/EnterpriseHome.tsx`
- `apps/web/src/modules/finance/FinanceHome.tsx`
- `apps/web/src/modules/finance/accounting/AccountingModulePlaceholder.tsx`
- `apps/web/src/modules/health/HealthRoutes.tsx`
- `apps/web/src/modules/health/HealthPlaceholder.tsx`

### Core packages
- `packages/core/src/tenancy.ts`
- `packages/core/src/rbac.ts`
- `packages/core/src/audit.ts`
- `packages/core/src/result.ts`
- `packages/core/src/index.ts`

### Accounting package
- `packages/accounting/src/types.ts`
- `packages/accounting/src/validation.ts`
- `packages/accounting/src/repository.ts`
- `packages/accounting/src/demoRepository.ts`
- `packages/accounting/src/ledger.ts`
- `packages/accounting/src/reconciliation.ts`
- `packages/accounting/src/assets.ts`
- `packages/accounting/src/reports.ts`
- `packages/accounting/src/index.ts`
- `data/demo/accounting/seed.ts`

### Accounting UI
- `apps/web/src/modules/finance/accounting/AccountingRoutes.tsx`
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

### Tests and release gates
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
- `.github/workflows/atlas-core-accounting-ci.yml`
- `apps/web/public/healthz.json`

---

### Task 1: Restore a buildable workspace and minimal application root

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `apps/web/package.json`
- Create: `apps/web/index.html`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/src/main.tsx`
- Modify: `apps/web/src/App.tsx`
- Create: `apps/web/src/app/router/AppRouter.tsx`
- Create: `apps/web/src/app/errors/RouteErrorPage.tsx`
- Create: `apps/web/src/modules/home/EnterpriseHome.tsx`
- Create: `apps/web/src/styles.css`
- Test: `tests/integration/routes.test.tsx`

**Interfaces:**
- Produces: `App`, `AppRouter`, a valid browser entrypoint, `/`, intentional `*` not-found behavior, and npm scripts `build`, `typecheck`, `test`, `test:integration`, `test:e2e`.

- [ ] **Step 1: Write the failing smoke test**

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../apps/web/src/App';

test('renders the ATLAS application root', () => {
  render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'ATLAS Enterprise Suite' })).toBeInTheDocument();
});

test('renders intentional not found state', () => {
  render(<MemoryRouter initialEntries={['/missing']}><App /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'Route not found' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test and capture the real baseline failure**

Run: `npm test -- tests/integration/routes.test.tsx`

Expected before implementation: FAIL because the repository has no runnable workspace configuration and the current `App.tsx` imports files that are absent from `main`.

- [ ] **Step 3: Add workspace and web scripts**

Root `package.json` must expose:

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

- [ ] **Step 4: Replace the broken monolithic root with the minimal router**

`apps/web/src/App.tsx`:

```tsx
import { AppRouter } from './app/router/AppRouter';

export function App() {
  return <AppRouter />;
}
```

`AppRouter` at this task contains only `/` and `*`; later tasks modify this existing file.

- [ ] **Step 5: Run baseline gates**

```bash
npm install
npm run typecheck
npm test -- tests/integration/routes.test.tsx
npm run build
```

Expected: PASS with no unresolved imports.

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
- Produces: `TenantScope`, `sameScope`, `AccountingPermission`, `hasPermission`, `AuditEvent`, `AuditSink`, `InMemoryAuditSink`, `Result<T,E>`.

- [ ] **Step 1: Write failing Core tests**

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

  it('requires explicit permission', () => {
    expect(hasPermission(['accounting.read'], 'accounting.post')).toBe(false);
  });

  it('lists audit events only for the requested scope', () => {
    const sink = new InMemoryAuditSink();
    sink.append({
      id: 'a1', tenantId: 't1', organizationId: 'o1', actorId: 'u1',
      action: 'journal.post', entityType: 'journal', entityId: 'j1',
      before: { status: 'draft' }, after: { status: 'posted' },
      timestamp: '2026-09-03T16:00:00Z', correlationId: 'c1'
    });
    expect(sink.list({ tenantId: 't1', organizationId: 'o1' })).toHaveLength(1);
    expect(sink.list({ tenantId: 't1', organizationId: 'o2' })).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Verify tests fail because Core exports do not exist**

Run: `npm test -- tests/unit/core.test.ts`

- [ ] **Step 3: Implement contracts**

```ts
export type TenantScope = { tenantId: string; organizationId: string };

export function sameScope(a: TenantScope, b: TenantScope) {
  return a.tenantId === b.tenantId && a.organizationId === b.organizationId;
}

export type AccountingPermission =
  | 'accounting.read'
  | 'accounting.write'
  | 'accounting.post'
  | 'accounting.close'
  | 'accounting.admin'
  | 'audit.read';

export function hasPermission(granted: readonly AccountingPermission[], required: AccountingPermission) {
  return granted.includes(required) || granted.includes('accounting.admin');
}
```

`InMemoryAuditSink.list(scope)` must require both tenant and organization to match.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/unit/core.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core tests/unit/core.test.ts
git commit -m "feat: add ATLAS Core tenancy RBAC and audit contracts"
```

---

### Task 3: Build the shared shell and safe Finance/Health route boundaries

**Files:**
- Create: `apps/web/src/app/providers/AtlasContext.tsx`
- Create: `apps/web/src/app/shell/AtlasShell.tsx`
- Create: `apps/web/src/modules/finance/FinanceHome.tsx`
- Create: `apps/web/src/modules/finance/accounting/AccountingModulePlaceholder.tsx`
- Create: `apps/web/src/modules/health/HealthRoutes.tsx`
- Create: `apps/web/src/modules/health/HealthPlaceholder.tsx`
- Modify: `apps/web/src/app/router/AppRouter.tsx`
- Modify: `apps/web/src/styles.css`
- Test: `tests/integration/routes.test.tsx`

**Interfaces:**
- Consumes: Core permission and scope contracts.
- Produces: `useAtlasContext()`, `AtlasShell`, `/finance`, `/finance/accounting`, `/health`, and preserved known Health URLs with explicit degraded states when historical source is unavailable.

- [ ] **Step 1: Add failing route tests**

```tsx
it.each([
  ['/finance', 'Finance'],
  ['/finance/accounting', 'Accounting'],
  ['/health', 'ATLAS Health']
])('renders %s in the ATLAS shell', (path, heading) => {
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'ATLAS modules' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify the new cases fail**

Run: `npm test -- tests/integration/routes.test.tsx`

- [ ] **Step 3: Implement context and shell**

```ts
export type AtlasContextValue = {
  scope: { tenantId: string; organizationId: string };
  actorId: string;
  permissions: AccountingPermission[];
  environment: 'demo' | 'production';
};
```

Default local context uses `tenant-demo` and `org-demo`. The shell visibly labels demo mode and includes desktop, tablet, and mobile navigation states.

- [ ] **Step 4: Expand the existing router without referencing future Accounting files**

```tsx
<Route path="/finance" element={<FinanceHome />} />
<Route path="/finance/accounting" element={<AccountingModulePlaceholder />} />
<Route path="/health/*" element={<HealthRoutes />} />
```

Known Health paths from the existing `App.tsx` must continue resolving. Where the referenced Health implementation is missing from `main`, render an explicit development/degraded message rather than a fake clinical or research feature.

- [ ] **Step 5: Run route tests and commit**

```bash
npm test -- tests/integration/routes.test.tsx
npm run typecheck
git add apps/web/src/app apps/web/src/modules apps/web/src/styles.css tests/integration/routes.test.tsx
git commit -m "feat: add shared ATLAS shell and module route boundaries"
```

---

### Task 4: Define Accounting domain types, validation, and scoped demo repository

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
- Produces: `Account`, `JournalEntry`, `JournalLine`, `Customer`, `Vendor`, `Invoice`, `Bill`, `PaymentApplication`, `BankAccount`, `BankTransaction`, `Reconciliation`, `FixedAsset`, `AccountingPeriod`, `AccountingRepository`, `validateJournalEntry`, `DemoAccountingRepository`.

- [ ] **Step 1: Write failing validation and scoping tests**

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

it('never leaks accounts across organizations', async () => {
  const rows = await repo.listAccounts({ tenantId: 'tenant-demo', organizationId: 'org-demo' });
  expect(rows.every(row => row.tenantId === 'tenant-demo' && row.organizationId === 'org-demo')).toBe(true);
});
```

- [ ] **Step 2: Verify failures**

Run: `npm test -- tests/unit/accounting-validation.test.ts tests/integration/accounting-repository.test.ts`

- [ ] **Step 3: Implement core types**

```ts
export type JournalStatus = 'draft' | 'validated' | 'posted' | 'reversed';

export interface JournalLine {
  id: string;
  accountId: string;
  description: string;
  debit: number;
  credit: number;
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

`validateJournalEntry` rejects empty entries, negative values, lines with both debit and credit, and rounded two-decimal debit/credit totals that differ.

- [ ] **Step 4: Seed coherent demo data**

Seed Cash, AR, AP, Equity, Revenue, and Expense control accounts plus balanced posted and draft journals, sample invoices/bills, a bank statement, reconciliation, fixed asset, and accounting period. Every displayed financial total must be derivable from these records; do not seed dashboard totals separately.

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- tests/unit/accounting-validation.test.ts tests/integration/accounting-repository.test.ts
git add packages/accounting data/demo/accounting tests
git commit -m "feat: add scoped accounting domain and demo repository"
```

---

### Task 5: Implement governed journal posting, reversal, ledger projection, and audit emission

**Files:**
- Create: `packages/accounting/src/ledger.ts`
- Modify: `packages/accounting/src/repository.ts`
- Modify: `packages/accounting/src/demoRepository.ts`
- Modify: `packages/accounting/src/index.ts`
- Test: `tests/unit/accounting-ledger.test.ts`
- Test: `tests/integration/accounting-repository.test.ts`

**Interfaces:**
- Produces: `PostingContext`, `projectLedger`, repository methods `postJournal` and `reverseJournal`.

- [ ] **Step 1: Write failing posting tests**

```ts
it('posts a balanced authorized journal and emits audit', async () => {
  const result = await repo.postJournal('j-draft', {
    scope,
    actorId: 'u1',
    permissions: ['accounting.post'],
    correlationId: 'c-post-1'
  });
  expect(result.ok).toBe(true);
  expect((await repo.getJournal(scope, 'j-draft'))?.status).toBe('posted');
  expect(audit.list(scope).some(event => event.action === 'journal.post')).toBe(true);
});

it('blocks posting without accounting.post', async () => {
  const result = await repo.postJournal('j-draft', {
    scope,
    actorId: 'u1',
    permissions: ['accounting.read'],
    correlationId: 'c-post-2'
  });
  expect(result.ok).toBe(false);
});
```

- [ ] **Step 2: Verify failures**

Run: `npm test -- tests/unit/accounting-ledger.test.ts tests/integration/accounting-repository.test.ts`

- [ ] **Step 3: Implement posting context and ledger projection**

```ts
export type PostingContext = {
  scope: TenantScope;
  actorId: string;
  permissions: AccountingPermission[];
  correlationId: string;
};

export function projectLedger(entries: readonly JournalEntry[]) {
  return entries
    .filter(entry => entry.status === 'posted')
    .flatMap(entry => entry.lines.map(line => ({
      journalId: entry.id,
      date: entry.date,
      accountId: line.accountId,
      debit: line.debit,
      credit: line.credit,
      reference: entry.reference,
      source: entry.source
    })));
}
```

Posting requires a balanced entry, `accounting.post`, matching scope, and an unlocked period. Posted monetary lines are immutable. Reversal creates a new posted journal with sides swapped and a reference to the original.

- [ ] **Step 4: Run tests and commit**

```bash
npm test -- tests/unit/accounting-ledger.test.ts tests/integration/accounting-repository.test.ts
git add packages/accounting tests
git commit -m "feat: add governed journal posting and ledger projection"
```

---

### Task 6: Replace the Accounting placeholder with dashboard, COA, journals, and General Ledger

**Files:**
- Create: `apps/web/src/modules/finance/accounting/AccountingRoutes.tsx`
- Create: `apps/web/src/modules/finance/accounting/AccountingLayout.tsx`
- Create: `apps/web/src/modules/finance/accounting/AccountingDashboard.tsx`
- Create: `apps/web/src/modules/finance/accounting/ChartOfAccountsPage.tsx`
- Create: `apps/web/src/modules/finance/accounting/GeneralLedgerPage.tsx`
- Create: `apps/web/src/modules/finance/accounting/JournalEntriesPage.tsx`
- Modify: `apps/web/src/app/router/AppRouter.tsx`
- Modify: `apps/web/src/app/providers/AtlasContext.tsx`
- Modify: `apps/web/src/styles.css`
- Test: `tests/integration/routes.test.tsx`

**Interfaces:**
- Consumes: `AccountingRepository`, `validateJournalEntry`, `postJournal`, `projectLedger`, `useAtlasContext()`.
- Produces routes `/finance/accounting`, `/chart-of-accounts`, `/journal-entries`, `/general-ledger`.

- [ ] **Step 1: Write failing Accounting UI tests**

```tsx
it('filters Chart of Accounts', async () => {
  renderAccounting('/finance/accounting/chart-of-accounts');
  await userEvent.type(screen.getByRole('searchbox'), 'cash');
  expect(await screen.findByText('Cash')).toBeInTheDocument();
  expect(screen.queryByText('Accounts Payable')).not.toBeInTheDocument();
});

it('does not allow posting an unbalanced draft', async () => {
  renderAccounting('/finance/accounting/journal-entries');
  await openDraft('j-draft');
  expect(screen.getByRole('button', { name: 'Post journal' })).toBeDisabled();
});
```

- [ ] **Step 2: Verify failures**

Run: `npm test -- tests/integration/routes.test.tsx`

- [ ] **Step 3: Mount the real Accounting route tree**

```tsx
<Route path="/finance/accounting/*" element={<AccountingRoutes />} />
```

`AccountingRoutes` owns nested routes and `AccountingLayout`; remove `AccountingModulePlaceholder` from active routing once these routes pass.

- [ ] **Step 4: Implement data-derived dashboard and working controls**

Dashboard cards: Cash, AR, AP, current-period net activity, unposted journals, reconciliation status, close status. If no dataset exists, render `No accounting dataset configured` instead of zero-valued financial cards.

COA must support search, type/status filters, sort, detail, create/edit with `accounting.write`, and activate/deactivate. Journals must preserve input on validation failure and enforce permission/validation states. GL supports date/account/source filters and journal drill-down.

- [ ] **Step 5: Run UI gates and commit**

```bash
npm test -- tests/integration/routes.test.tsx
npm run typecheck
git add apps/web/src/modules/finance/accounting apps/web/src/app apps/web/src/styles.css tests/integration/routes.test.tsx
git commit -m "feat: add Accounting dashboard ledger journals and chart of accounts"
```

---

### Task 7: Implement AR/AP, Bank & Cash, and reconciliation

**Files:**
- Create: `packages/accounting/src/reconciliation.ts`
- Create: `apps/web/src/modules/finance/accounting/ReceivablesPage.tsx`
- Create: `apps/web/src/modules/finance/accounting/PayablesPage.tsx`
- Create: `apps/web/src/modules/finance/accounting/BankCashPage.tsx`
- Create: `apps/web/src/modules/finance/accounting/ReconciliationPage.tsx`
- Modify: `packages/accounting/src/demoRepository.ts`
- Modify: `packages/accounting/src/index.ts`
- Modify: `apps/web/src/modules/finance/accounting/AccountingRoutes.tsx`
- Test: `tests/unit/accounting-reconciliation.test.ts`
- Test: `tests/integration/accounting-repository.test.ts`
- Test: `tests/integration/routes.test.tsx`

**Interfaces:**
- Produces: deterministic AR/AP aging, payment application state, `calculateReconciliationDifference`, match/unmatch behavior, and reconciliation completion guards.

- [ ] **Step 1: Write failing aging and reconciliation tests**

```ts
it('AR aging totals equal the sum of buckets', async () => {
  const aging = await repo.getReceivablesAging(scope, '2026-09-03');
  expect(aging.total).toBe(
    aging.current + aging.days1to30 + aging.days31to60 + aging.days61to90 + aging.over90
  );
});

it('cannot complete reconciliation with a non-zero difference', () => {
  const result = completeReconciliation({ ...recon, calculatedDifference: 25 });
  expect(result.ok).toBe(false);
});
```

- [ ] **Step 2: Implement deterministic calculations**

Aging buckets are current, 1-30, 31-60, 61-90, over 90 and derive from open invoice/bill amounts. Reconciliation difference:

```ts
export function calculateReconciliationDifference(statementEnding: number, bookEnding: number, adjustments: number) {
  return Math.round((statementEnding - bookEnding - adjustments) * 100) / 100;
}
```

Completion requires zero difference and no unresolved required items.

- [ ] **Step 3: Implement routes and UI**

Routes:
- `/finance/accounting/accounts-receivable`
- `/finance/accounting/accounts-payable`
- `/finance/accounting/bank-cash`
- `/finance/accounting/reconciliation`

Invoices/bills link to accounting impact journals. Demo statements display `Demo imported statement`. No live bank, card, gateway, or money-movement state is shown as connected.

- [ ] **Step 4: Run tests and commit**

```bash
npm test -- tests/unit/accounting-reconciliation.test.ts tests/integration/accounting-repository.test.ts tests/integration/routes.test.tsx
git add packages/accounting apps/web/src/modules/finance/accounting tests
git commit -m "feat: add receivables payables bank cash and reconciliation"
```

---

### Task 8: Implement fixed assets, close, reports, audit trail, and settings

**Files:**
- Create: `packages/accounting/src/assets.ts`
- Create: `packages/accounting/src/reports.ts`
- Create: `apps/web/src/modules/finance/accounting/FixedAssetsPage.tsx`
- Create: `apps/web/src/modules/finance/accounting/PeriodClosePage.tsx`
- Create: `apps/web/src/modules/finance/accounting/ReportsPage.tsx`
- Create: `apps/web/src/modules/finance/accounting/AuditTrailPage.tsx`
- Create: `apps/web/src/modules/finance/accounting/AccountingSettingsPage.tsx`
- Modify: `packages/accounting/src/demoRepository.ts`
- Modify: `packages/accounting/src/index.ts`
- Modify: `apps/web/src/modules/finance/accounting/AccountingRoutes.tsx`
- Test: `tests/unit/accounting-assets.test.ts`
- Test: `tests/unit/accounting-reports.test.ts`
- Test: `tests/integration/accounting-repository.test.ts`

**Interfaces:**
- Produces: `straightLineSchedule`, `trialBalance`, `profitAndLoss`, `balanceSheet`, period-close validation/locking, audit view, effective settings.

- [ ] **Step 1: Write failing asset/report/close tests**

```ts
it('straight-line depreciation does not exceed depreciable basis', () => {
  const schedule = straightLineSchedule({
    cost: 12000,
    salvageValue: 0,
    usefulLifeMonths: 12,
    acquisitionDate: '2026-01-01'
  });
  expect(schedule.reduce((sum, row) => sum + row.depreciation, 0)).toBe(12000);
});

it('trial balance debits equal credits', async () => {
  const report = trialBalance(await repo.listPostedJournals(scope));
  expect(report.totalDebits).toBe(report.totalCredits);
});
```

- [ ] **Step 2: Implement deterministic reports and depreciation**

Reports consume the same posted journals used by the ledger. P&L and Balance Sheet classifications derive from account types. AR/AP Aging uses the same open invoices/bills as Task 7.

- [ ] **Step 3: Implement close guard and locked-period behavior**

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

Repository close also requires `accounting.close`, emits `period.close`, and prevents later journal posting into the locked period.

- [ ] **Step 4: Implement routes and permission states**

Routes:
- `/finance/accounting/fixed-assets`
- `/finance/accounting/period-close`
- `/finance/accounting/reports`
- `/finance/accounting/audit-trail`
- `/finance/accounting/settings`

Audit Trail requires `audit.read`. Settings expose only fiscal year start, base currency, supported accounting basis, and default AR/AP control accounts that affect repository behavior.

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- tests/unit/accounting-assets.test.ts tests/unit/accounting-reports.test.ts tests/integration/accounting-repository.test.ts
npm run typecheck
git add packages/accounting apps/web/src/modules/finance/accounting tests
git commit -m "feat: complete accounting assets close reports audit and settings"
```

---

### Task 9: Add E2E flows, responsive checks, CI, build health, and deployment verification

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/accounting.spec.ts`
- Create: `.github/workflows/atlas-core-accounting-ci.yml`
- Create: `apps/web/public/healthz.json`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Produces: repeatable release gates and a static-build health artifact; it does not claim backend or external integration health.

- [ ] **Step 1: Write critical E2E flows**

```ts
import { test, expect } from '@playwright/test';

test('authorized user posts a balanced journal and sees it in the ledger', async ({ page }) => {
  await page.goto('/finance/accounting/journal-entries');
  await page.getByRole('link', { name: /Demo draft/i }).click();
  await page.getByRole('button', { name: 'Post journal' }).click();
  await expect(page.getByText('Posted successfully')).toBeVisible();
  await page.goto('/finance/accounting/general-ledger');
  await expect(page.getByText('j-draft')).toBeVisible();
});

test('unknown routes render an intentional state', async ({ page }) => {
  await page.goto('/route-that-does-not-exist');
  await expect(page.getByRole('heading', { name: 'Route not found' })).toBeVisible();
});
```

Also cover COA search/filter, unbalanced journal rejection, reconciliation to zero, period close, permission denial, Accounting-to-Health round trip, desktop/tablet/mobile navigation, and empty/error states.

- [ ] **Step 2: Run full local gates**

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Expected: all PASS.

- [ ] **Step 3: Add CI**

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

CI contains no deployment credentials.

- [ ] **Step 4: Add static-build health artifact**

`apps/web/public/healthz.json`:

```json
{
  "service": "atlas-enterprise-suite-web",
  "status": "static-build-ok",
  "scope": "core-accounting"
}
```

README must state that this proves only that the deployed static web artifact is reachable; it does not prove datastore, external integration, or server health.

- [ ] **Step 5: Verify after an authorized production deployment**

```bash
curl -f https://www.atlasenterprisesuite.com/healthz.json
curl -I https://www.atlasenterprisesuite.com/finance/accounting
```

Smoke-test `/`, `/finance/accounting`, `/finance/accounting/journal-entries`, `/finance/accounting/reports`, and `/health`. Do not claim production if credentials are unavailable, deployment fails, the domain returns 403/404/500, SPA rewrites are broken, or any required gate lacks evidence.

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts tests/e2e .github/workflows/atlas-core-accounting-ci.yml apps/web/public/healthz.json package.json README.md
git commit -m "test: add ATLAS Core Accounting release gates"
```

---

## Completion Gate

The milestone is complete only when all nine tasks are committed and evidence confirms:

1. `npm install` or `npm ci` succeeds.
2. `npm run typecheck` passes.
3. Unit and integration tests pass.
4. Critical Playwright flows pass.
5. `npm run build` passes.
6. Every Accounting route in the approved spec resolves.
7. No active UI control is a dead placeholder.
8. Demo data is visibly labeled and internally balanced.
9. Permission-gated mutations are tested.
10. Tenant and organization scoping is tested.
11. Health remains navigable inside the shared shell.
12. CI passes on the implementation commit.
13. When deployment is authorized, production deployment succeeds and static-build health plus key-route smoke tests pass.
14. Production is not claimed when any gate lacks evidence.
