# ATLAS Accounting v1 — Supabase v2 Design

## Status
Approved by the user on 2026-09-07 for implementation on the clean `atlas-core-v2` Supabase project.

## Goal
Build a governed, tenant-scoped accounting platform on top of ATLAS Foundation v1 so that every accounting record is isolated by `tenant_id + org_id`, every sensitive mutation is permission-gated and audited, and all financial reports derive from the posted double-entry ledger.

## Global invariants
- Every accounting business table carries `tenant_id uuid not null` and `org_id uuid not null`.
- Every scoped table uses a composite foreign key to `organizations(id, tenant_id)`.
- No accounting record may exist outside a real ATLAS tenant and organization.
- Client-provided actor IDs are not trusted when `auth.uid()` can determine the actor.
- RLS is enabled from the first migration.
- Sensitive writes use governed RPCs rather than unrestricted direct DML.
- Posted journals are immutable; corrections use reversal entries.
- A posting is valid only when the period is open, there are at least two lines, and total debit exactly equals total credit.
- Money uses PostgreSQL `numeric`, never floating-point storage.
- Reports are derived from posted journals; no report table becomes an independent source of truth.
- External provider state must be truthful: `not_configured`, `configured`, `live`, or `unavailable` only when evidence supports the state.
- Every governed mutation writes to Foundation `audit_logs` with actor, scope, action, entity, before/after state, and correlation ID.

## Permission model
Accounting extends the Foundation catalog with:
- `accounting.read`
- `accounting.write`
- `accounting.post`
- `accounting.approve`
- `accounting.close`
- `accounting.admin`

Owner and admin roles receive permissions through the same RBAC engine and do not bypass RLS.

## Phase A — Ledger Core
Tables:
- `accounting_settings`
- `chart_of_accounts`
- `journal_entries`
- `journal_lines`

Settings hold base currency, fiscal year start, accounting basis (`accrual` for v1), and optional default AR/AP accounts.

Chart of accounts stores an account number, name, account type, normal balance, active flag, and system-account flag. Account numbers are unique within one tenant+organization.

Journal entries use states `draft`, `posted`, `reversed`, and `void`. Journal lines are debit-or-credit lines attached to one journal and one scoped account.

Posting must occur through a governed RPC that:
1. requires authenticated membership and `accounting.post`;
2. verifies the journal belongs to the supplied tenant+organization;
3. verifies the journal is still draft;
4. verifies the posting date belongs to an open accounting period if periods have been configured for that date;
5. verifies at least two lines;
6. verifies each line has exactly one positive side (debit xor credit);
7. verifies total debits exactly equal total credits;
8. stamps `posted_by` and `posted_at` from server-side identity/time;
9. writes an audit event.

Reversal creates a new balancing journal that points to the original and then marks the original `reversed`; the original posted lines are never edited.

## Phase B — AR/AP
Tables:
- `customers`
- `vendors`
- `invoices`
- `invoice_lines`
- `customer_payments`
- `bills`
- `bill_lines`
- `vendor_payments`

AR/AP are subledgers. Their financial effect is authoritative only after the associated journal is posted. Payment and bill/invoice mutations remain scoped and audited.

## Phase C — Bank/Cash and Reconciliation
Tables:
- `bank_accounts`
- `bank_transactions`
- `reconciliation_sessions`
- `reconciliation_items`

Provider connections expose truthful connection state. Imported bank transactions are source evidence and are not silently rewritten during categorization or reconciliation. Reconciliation resolves differences explicitly and may create a governed journal when needed.

## Phase D — Assets, Close, Reports
Tables:
- `fixed_assets`
- `asset_depreciation_events`
- `accounting_periods`
- `accounting_close_tasks`

Fixed assets store cost, salvage value, useful life, acquisition/disposal dates, method, and status. Accumulated depreciation is derived from governed schedules/postings rather than maintained as a free editable balance.

Period close blocks new postings into a closed period. Reopening requires `accounting.admin`, an explicit reason, and audit evidence.

Reports are derived views/RPCs:
- Trial Balance
- General Ledger
- Profit & Loss
- Balance Sheet

## Currency policy
V1 supports one base currency per organization. Currency codes are stored in uppercase ISO-style 3-letter form. FX conversion is explicitly outside Accounting v1 until a separate governed exchange-rate source is implemented.

## Verification
Every phase ships with an `atlas_accounting_self_check()`-style verification surface or an equivalent phase-specific self-check. Acceptance requires:
- required tables and columns exist;
- `tenant_id` and `org_id` are non-null and scoped;
- RLS is enabled;
- direct client writes are limited to explicitly allowed operations;
- governed RPC grants are correct;
- posting/reversal/close invariants are encoded server-side;
- Security Advisor has no unresolved findings;
- Performance Advisor has no unresolved actionable warnings other than expected unused-index notices on a fresh empty database.

GitHub Actions red statuses caused by runner-allocation failure are not treated as code-test failures. Supabase self-checks provide executable evidence for the data layer until GitHub-hosted runners recover.