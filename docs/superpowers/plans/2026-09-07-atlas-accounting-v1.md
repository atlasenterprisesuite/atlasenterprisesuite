# ATLAS Accounting v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build tenant-scoped, double-entry Accounting v1 on `atlas-core-v2` with governed posting, reversals, AR/AP, bank reconciliation, assets, close, reports, RLS, audit, and executable self-checks.

**Architecture:** Foundation v1 remains the source for tenant/org identity, RBAC, RLS membership, and audit. Accounting stores every business record under mandatory `tenant_id + org_id`, routes sensitive writes through permission-gated SQL functions, and derives all reports from posted journals rather than duplicated balances.

**Tech Stack:** Supabase/PostgreSQL 17, Row Level Security, PL/pgSQL governed RPCs, Supabase Advisors, generated TypeScript database types, existing ATLAS TypeScript accounting package.

**Spec:** `docs/superpowers/specs/2026-09-07-atlas-accounting-v1-design.md`

## Global Constraints
- Every accounting business table has `tenant_id uuid not null` and `org_id uuid not null`.
- Every scoped table has a composite FK to `organizations(id, tenant_id)`.
- Use `numeric` for money; never floating point persistence.
- Posted journals are immutable; corrections use reversals.
- Reports derive from posted journals.
- Sensitive mutations derive actor from server-side auth and write Foundation audit events.
- RLS is enabled from the first migration.
- Direct client DML is denied unless explicitly designed and tested.
- Do not claim GitHub CI green while the hosted-runner incident is unresolved.

---

### Task 1: Ledger Core RED contract

**Files:**
- Database: `atlas-core-v2`
- No production schema changes in this task.

**Interfaces:**
- Consumes: Foundation v1 `organizations`, `organization_members`, `identity_permissions`, `identity_role_permissions`, `has_identity_permission`, `audit_logs`.
- Produces: failing executable evidence that Ledger Core does not yet exist.

- [ ] **Step 1: Run a read-only schema assertion**

```sql
select
  to_regclass('public.accounting_settings') is not null as settings_exists,
  to_regclass('public.chart_of_accounts') is not null as coa_exists,
  to_regclass('public.journal_entries') is not null as journals_exist,
  to_regclass('public.journal_lines') is not null as lines_exist;
```

Expected before implementation: all four values are `false`.

- [ ] **Step 2: Record RED evidence**
Document the failed capability in the execution notes before applying DDL.

### Task 2: Ledger Core schema, permissions, and RLS

**Files:**
- Database migration: `atlas_accounting_ledger_core_v1`

**Interfaces:**
- Consumes: Foundation tenancy and RBAC.
- Produces tables: `accounting_settings`, `chart_of_accounts`, `journal_entries`, `journal_lines`, plus permission catalog entries.

- [ ] **Step 1: Add permission catalog rows**
Insert idempotently:
`accounting.read`, `accounting.write`, `accounting.post`, `accounting.approve`, `accounting.close`, `accounting.admin`.
Map owner/admin to the full set; map accountant to read/write/post/approve/close; viewer to read only when the role exists in Foundation.

- [ ] **Step 2: Create `accounting_settings`**
Required fields: scope, base currency, fiscal year start month/day, `accrual` basis, default AR/AP account references, timestamps.
Enforce uppercase 3-letter currency and one row per tenant+org.

- [ ] **Step 3: Create `chart_of_accounts`**
Required fields: scope, account number, name, account type, normal balance, active, system-account, timestamps.
Enforce unique `(tenant_id, org_id, account_number)` and valid account type / normal-balance checks.

- [ ] **Step 4: Create `journal_entries`**
Fields: scope, entry number, entry date, memo, status, source type/id, created_by, posted_by/at, reverses entry id, reversed_by entry id, timestamps.
Enforce unique entry number per tenant+org and allowed statuses.

- [ ] **Step 5: Create `journal_lines`**
Fields: scope, journal entry id, line number, account id, description, debit, credit, dimensions JSONB, created_at.
Enforce positive debit xor positive credit and unique line number within one journal.

- [ ] **Step 6: Enable RLS and SELECT policies**
Authenticated members with `accounting.read` may read their own tenant+org accounting records.
No direct authenticated INSERT/UPDATE/DELETE policy on posted-governed ledger tables.

- [ ] **Step 7: Add required FK indexes**
Cover every foreign key and common scope/date lookup.

### Task 3: Governed chart/settings writes

**Files:**
- Database migration: `atlas_accounting_ledger_writes_v1`

**Interfaces:**
- Produces RPCs for settings/account creation and updates.

- [ ] **Step 1: Implement membership/permission assertions**
Use `has_identity_permission(p_tenant_id, p_org_id, ...)`; never accept an actor parameter when `auth.uid()` is available.

- [ ] **Step 2: Implement settings upsert RPC**
Require `accounting.admin`. Validate currency and account references belong to same scope. Write audit event.

- [ ] **Step 3: Implement create/update account RPCs**
Require `accounting.write`; system-account mutation requires `accounting.admin`. Write before/after audit.

- [ ] **Step 4: Revoke public/anon execution**
Grant only `authenticated` for intended client RPCs.

### Task 4: Governed journal draft/post/reversal

**Files:**
- Database migration: `atlas_accounting_journal_governance_v1`

**Interfaces:**
- Produces: `create_accounting_journal_draft`, `replace_accounting_journal_lines`, `post_accounting_journal`, `reverse_accounting_journal`.

- [ ] **Step 1: Draft creation**
Require `accounting.write`; generate or validate scope-unique entry number; derive creator from `auth.uid()`.

- [ ] **Step 2: Replace draft lines**
Require `accounting.write`; reject non-draft journals; validate every account belongs to same scope; require at least two supplied lines in the final set.

- [ ] **Step 3: Post journal**
Require `accounting.post`; lock journal row; reject non-draft; require >=2 lines; require debit=credit exactly; reject invalid/closed accounting period if periods exist; stamp `posted_by/posted_at`; audit.

- [ ] **Step 4: Prevent mutation of posted journals**
Create trigger protecting posted/reversed journal headers and lines from direct mutation except controlled reversal state transition performed by governed function context.

- [ ] **Step 5: Reverse journal**
Require `accounting.post`; create a new draft with swapped debit/credit, post it atomically, link original and reversal, mark original `reversed`, preserve original lines, audit both entities.

### Task 5: Ledger Core self-check GREEN

**Files:**
- Database migration: `atlas_accounting_self_check_v1`

**Interfaces:**
- Produces function: `atlas_accounting_self_check()` returning `(check_name text, passed boolean, detail text)`.

- [ ] **Step 1: Verify schema and scope**
Check all four tables exist, RLS enabled, tenant/org not nullable, composite org FKs present.

- [ ] **Step 2: Verify grants**
Check authenticated has no direct table writes and intended RPC execute grants only.

- [ ] **Step 3: Verify journal constraints/governance**
Check posting/reversal functions exist, posted immutability trigger exists, account uniqueness exists, money columns are numeric.

- [ ] **Step 4: Execute self-check**
Expected: every row `passed=true`.

- [ ] **Step 5: Run Supabase Security and Performance Advisors**
Security expected: zero unresolved lints.
Performance expected: no actionable warning except unused-index notices expected on a fresh database.

### Task 6: AR/AP subledgers

**Files:**
- Database migrations: `atlas_accounting_ar_ap_v1`, `atlas_accounting_ar_ap_governance_v1`

**Interfaces:**
- Produces: customers, vendors, invoices/lines, customer payments, bills/lines, vendor payments, governed write/posting functions.
- Consumes: Ledger Core journals/accounts.

- [ ] **Step 1: Run RED existence assertions**
Assert all AR/AP tables are absent before DDL.

- [ ] **Step 2: Create scoped tables + RLS**
All scope columns non-null; all financial amounts numeric; statuses constrained.

- [ ] **Step 3: Govern invoice/bill/payment writes**
Require accounting permissions; derive actor; audit.

- [ ] **Step 4: Post subledger financial effects through Ledger Core**
No independent GL balance storage.

- [ ] **Step 5: Extend self-check and advisors**
All AR/AP checks must pass before Bank/Cash starts.

### Task 7: Bank/Cash and Reconciliation

**Files:**
- Database migrations: `atlas_accounting_bank_reconciliation_v1`, `atlas_accounting_bank_governance_v1`

**Interfaces:**
- Produces bank accounts/transactions/reconciliation sessions/items.

- [ ] **Step 1: RED assertions**
Verify tables absent.

- [ ] **Step 2: Create scoped source-evidence tables**
Connection state restricted to truthful values; provider metadata cannot imply live state without explicit state field.

- [ ] **Step 3: Create governed reconciliation operations**
Do not silently rewrite imported source transaction evidence.

- [ ] **Step 4: Extend self-check and advisors**
Require all checks pass before Assets/Close.

### Task 8: Assets, Period Close, and Reports

**Files:**
- Database migrations: `atlas_accounting_assets_close_v1`, `atlas_accounting_reports_v1`

**Interfaces:**
- Produces fixed assets, depreciation events, periods, close tasks, Trial Balance, GL, P&L, Balance Sheet functions/views.

- [ ] **Step 1: RED assertions**
Verify target tables/report functions absent.

- [ ] **Step 2: Create fixed assets/depreciation events**
Store acquisition facts; derive accumulated depreciation from events/postings.

- [ ] **Step 3: Create periods/close tasks**
Closed periods reject posting. Reopen requires `accounting.admin` + reason + audit.

- [ ] **Step 4: Create report RPCs/views from posted journal lines only**
Trial Balance, GL, P&L, Balance Sheet must not depend on editable report snapshots.

- [ ] **Step 5: Final accounting self-check + advisors**
All checks pass; security zero unresolved; performance only expected unused indexes.

### Task 9: Repository contract alignment

**Files:**
- Modify after executable DB verification: `apps/web/src/app/AtlasContext.tsx`
- Modify: `apps/web/src/lib/supabase/atlasIdentitySource.ts`
- Add generated DB type file in the canonical Supabase integration directory.
- Update accounting repository/types only after tests can execute.

**Interfaces:**
- Produces frontend identity with real `tenantId` and generated schema types.

- [ ] **Step 1: Add failing TypeScript tests requiring `tenantId`**
Do not modify production TypeScript until the RED test can actually execute.

- [ ] **Step 2: Implement tenant-aware identity**
Resolve identity via `atlas_identity_context()` and propagate tenant+org.

- [ ] **Step 3: Replace nullable accounting organization contracts**
Move v2 runtime paths to mandatory scope while preserving clearly labeled legacy compatibility only where necessary.

- [ ] **Step 4: Run repository typecheck/tests/build when GitHub runners or self-hosted verifier is executable**
Do not mark repository integration green before executable evidence exists.

### Task 10: Final verification and release evidence

- [ ] Run `atlas_foundation_self_check()` and require 7/7 pass.
- [ ] Run Identity self-check and require all pass.
- [ ] Run final `atlas_accounting_self_check()` and require all pass.
- [ ] Run Supabase Security Advisor and require zero unresolved findings.
- [ ] Run Performance Advisor and classify any remaining notices.
- [ ] Generate TypeScript database types from `atlas-core-v2`.
- [ ] Record the exact Supabase project ref and verification state in PR #13 without exposing service credentials.
- [ ] Keep `main` untouched until the broader A-Z release gates are satisfied.