# ATLAS Core + Accounting Design

Date: 2026-09-03
Status: Approved architecture, awaiting written-spec review before implementation
Repository: `atlasenterprisesuite/atlasenterprisesuite`

## 1. Objective

Build the first reusable enterprise foundation of ATLAS Enterprise Suite and make Accounting the first complete business module running on top of it.

The implementation order is:

`ATLAS Core -> Finance -> Accounting -> Payroll -> HR -> CRM -> Inventory/POS -> remaining ATLAS modules`

ATLAS Health remains part of the same ecosystem and must be migrated into the shared shell rather than maintained as a parallel application.

## 2. Product Principles

- One canonical repository and one application shell.
- No duplicate module trees for the same business capability.
- No fabricated production data or false connected/live states.
- Every visible navigation item must resolve to a real route or valid application state.
- Every actionable control must perform a real client-side or authorized backend action.
- Preserve tenant and organization boundaries in every domain model.
- RBAC and audit contracts are shared core concerns, not module-specific reinventions.
- Existing ATLAS Health work is preserved where compatible and adapted to the common architecture.
- Production claims require build, test, deployment, route, and health verification evidence.

## 3. Repository Architecture

Target monorepo structure:

```text
apps/
  web/
    src/
      app/
        router/
        shell/
        providers/
        errors/
      modules/
        home/
        finance/
          accounting/
        health/
      shared/
        components/
        layouts/
        hooks/
        utils/
        types/
packages/
  core/
    auth/
    tenancy/
    rbac/
    audit/
    validation/
    data-access/
    ui/
  accounting/
    ledger/
    chart-of-accounts/
    journals/
    receivables/
    payables/
    banking/
    reconciliation/
    close/
    reporting/
  health/
    ...existing health domain packages...
data/
  demo/
    accounting/
  research/
    ...existing governed health research data...
tests/
  unit/
  integration/
  e2e/
```

The current monolithic `apps/web/src/App.tsx` must be decomposed into focused route and module files rather than becoming the long-term application container.

## 4. ATLAS Core

### 4.1 Application Shell

The global shell owns:

- ATLAS identity and official visual language.
- Desktop sidebar.
- Tablet and mobile navigation.
- Top application header.
- Breadcrumbs.
- Organization/tenant context display.
- Module switcher.
- Global loading, empty, permission-denied, offline/degraded, and error states.
- Route-level error boundary.

The shell must not contain Accounting business logic.

### 4.2 Routing

Initial canonical routes:

- `/`
- `/finance`
- `/finance/accounting`
- `/finance/accounting/general-ledger`
- `/finance/accounting/chart-of-accounts`
- `/finance/accounting/journal-entries`
- `/finance/accounting/accounts-receivable`
- `/finance/accounting/accounts-payable`
- `/finance/accounting/bank-cash`
- `/finance/accounting/reconciliation`
- `/finance/accounting/fixed-assets`
- `/finance/accounting/period-close`
- `/finance/accounting/reports`
- `/finance/accounting/audit-trail`
- `/finance/accounting/settings`
- `/health`
- existing supported Health subroutes

Unknown routes must return an intentional not-found screen, never a blank page.

### 4.3 Tenancy Contract

Every domain record that can vary by company must be scoped by:

- `tenant_id`
- `organization_id`

Client-side filters are not sufficient for production data isolation. Any future persistent backend must enforce the same boundaries server-side or in database policies.

### 4.4 RBAC Contract

Initial shared permission vocabulary:

- `accounting.read`
- `accounting.write`
- `accounting.post`
- `accounting.close`
- `accounting.admin`
- `audit.read`

UI visibility and action availability must derive from permissions. Permission checks in UI do not replace backend authorization.

### 4.5 Audit Contract

Sensitive accounting changes must emit an audit event contract containing:

- `id`
- `tenant_id`
- `organization_id`
- `actor_id`
- `action`
- `entity_type`
- `entity_id`
- `before`
- `after`
- `timestamp`
- `correlation_id`

For the first frontend-only milestone, audit events may be held in an explicit in-memory/demo adapter only if clearly labeled non-production. Production persistence is a separate gate.

## 5. Accounting Module

### 5.1 Accounting Dashboard

The dashboard may show only values derived from the active accounting dataset. No decorative financial metrics.

Initial cards:

- Cash balance
- Accounts receivable balance
- Accounts payable balance
- Current-period net activity
- Unposted journal count
- Reconciliation status
- Close status

If no dataset is configured, render an empty/configuration state instead of zeros that imply real activity.

### 5.2 Chart of Accounts

Capabilities:

- Account list.
- Search.
- Type/status filters.
- Sort.
- Account detail.
- Create/edit when permission allows.
- Activate/deactivate instead of destructive deletion when historical references exist.

Initial account fields:

- `id`
- `tenant_id`
- `organization_id`
- `code`
- `name`
- `account_type`
- `normal_balance`
- `parent_account_id`
- `currency`
- `is_active`

### 5.3 General Ledger

Capabilities:

- Ledger transaction view.
- Date/account/source filters.
- Debit and credit columns.
- Running balance where appropriate.
- Drill-down to source journal entry.
- Export contract prepared for CSV; actual download must be implemented before the control is enabled.

### 5.4 Journal Entries

Lifecycle:

`Draft -> Validated -> Posted -> Reversed`

A journal entry must remain balanced before posting.

Fields:

- header: id, date, reference, description, source, status, currency
- lines: account_id, description, debit, credit, dimensions

Rules:

- Sum(debits) must equal Sum(credits).
- Posted entries are immutable except through a governed reversal flow.
- Posting requires `accounting.post`.
- Closing-period rules must block posting into a locked period unless an explicit authorized reopen workflow exists later.

### 5.5 Accounts Receivable

Initial scope:

- Customer balances.
- Invoice list and detail.
- Status filters.
- Aging buckets.
- Payment application state.
- Link accounting impact to journals.

No external payment gateway is represented as connected until an authorized integration exists.

### 5.6 Accounts Payable

Initial scope:

- Vendor balances.
- Bill list and detail.
- Due-date and status filters.
- Aging.
- Payment status.
- Link accounting impact to journals.

No banking or payment execution is simulated.

### 5.7 Bank & Cash

Initial scope:

- Cash/bank account registry.
- Statement transaction workspace.
- Book transaction workspace.
- Imported/demo statement adapter with explicit source label.
- Navigation into reconciliation.

A connected-bank badge may appear only when a real authorized connection is verified.

### 5.8 Reconciliation

Capabilities:

- Select account and statement period.
- Compare statement and book transactions.
- Match/unmatch transactions.
- Display calculated difference.
- Complete reconciliation only when the difference is zero and required items are resolved.

### 5.9 Fixed Assets

Initial scope:

- Asset register.
- Cost, acquisition date, useful life, method, accumulated depreciation, book value.
- Depreciation schedule calculation as a deterministic accounting utility.

Posting depreciation into the ledger is disabled until the journal-posting integration for that workflow is implemented and tested.

### 5.10 Period Close

Initial close checklist:

- All required journals posted.
- Required reconciliations completed.
- AR/AP review acknowledged.
- Close authorization present.
- Period locked after successful close.

Closing requires `accounting.close`.

### 5.11 Reports

Initial computed reports:

- Trial Balance.
- Profit & Loss.
- Balance Sheet.
- General Ledger detail.
- AR Aging.
- AP Aging.

Reports must be computed from the same accounting data contracts used by ledgers and journals. No separate hard-coded report totals.

### 5.12 Audit Trail

Provide a filterable view of registered accounting audit events with actor, action, entity, timestamp, and correlation information available from the adapter.

### 5.13 Accounting Settings

Initial settings are limited to actual implemented behavior:

- Fiscal year start.
- Base currency.
- Accounting basis display (`accrual` or `cash`) when supported by the active dataset/logic.
- Default AR/AP control accounts.

Settings that have no implemented effect must not be exposed as working controls.

## 6. Accounting Data Contracts

The frontend milestone uses deterministic typed repositories/adapters rather than scattered component state.

Required domain types:

- `AccountingContext`
- `Account`
- `JournalEntry`
- `JournalLine`
- `Customer`
- `Vendor`
- `Invoice`
- `Bill`
- `PaymentApplication`
- `BankAccount`
- `BankTransaction`
- `Reconciliation`
- `FixedAsset`
- `AccountingPeriod`
- `AuditEvent`

A demo repository may seed coherent test data, but all demo data must be labeled and must preserve double-entry consistency.

## 7. Health Integration

The existing Health routes and research logic are retained, but their application-level shell and routing responsibilities move under ATLAS Core.

Health-specific evidence, graph, reconstruction, and curability logic remain in Health-owned packages.

No Accounting package may import Health domain logic and no Health package may import Accounting domain logic. Cross-module communication later occurs through core contracts/events, not direct circular dependencies.

## 8. Error Handling and States

Every data-bearing page must handle:

- loading
- empty
- ready
- validation error
- permission denied
- unavailable/degraded adapter

Mutating forms must surface success and failure states and preserve user input after recoverable validation errors.

## 9. Testing Strategy

### Unit

- journal balancing and posting rules
- account hierarchy validation
- report calculations
- reconciliation difference
- depreciation calculations
- permission predicates
- tenant/organization scoping helpers

### Integration

- routes render inside the common shell
- journal posting updates ledger/report adapters consistently
- AR/AP entries reconcile to accounting impact
- close blocks invalid state
- Health routes continue to resolve after shell migration

### E2E

At minimum:

1. Open ATLAS home and navigate to Accounting.
2. Search/filter Chart of Accounts.
3. Create a balanced draft journal.
4. Reject an unbalanced journal.
5. Post an authorized journal.
6. Verify posted journal appears in General Ledger and reports.
7. Reconcile a demo bank statement to zero difference.
8. Close a valid demo period with permission.
9. Verify restricted actions are unavailable without permission.
10. Navigate from Accounting to Health and back without route failure.

Responsive checks are required for desktop, tablet, and mobile navigation.

## 10. Delivery Gates

A milestone is not complete until all applicable gates pass:

1. Repository structure contains all referenced files and imports.
2. Dependency install succeeds.
3. Type check succeeds.
4. Unit tests pass.
5. Integration tests pass.
6. E2E critical flows pass.
7. Production build succeeds.
8. No visible dead links or placeholder actions.
9. No fabricated live/connected status.
10. No secrets committed.
11. Authorization-sensitive actions are permission-gated.
12. Tenant/organization scope is preserved by active adapters.
13. Deployment workflow succeeds when production credentials are authorized.
14. `/healthz` or equivalent production health verification succeeds before declaring production ready.
15. Key production routes are manually or automatically smoke-tested after deployment.

## 11. Scope Boundary for This Implementation Cycle

This design defines the shared Core and the first Accounting milestone. Payroll, HR, CRM, Inventory, POS, ATLAS Pay, external banking, Stripe, tax filing, live ERP synchronization, and production datastore integration are not implemented in this cycle unless required only as interfaces/contracts needed by Accounting.

The next module may begin only after the Core + Accounting milestone has independently passed its defined gates.

## 12. Success Criteria

The milestone succeeds when ATLAS behaves as one coherent application, Accounting is a navigable and internally consistent working module rather than a marketing mockup, Health remains accessible inside the same shell, accounting calculations derive from coherent typed data, permissions govern sensitive actions, and the build/test/deployment status can be demonstrated with evidence rather than assertion.
