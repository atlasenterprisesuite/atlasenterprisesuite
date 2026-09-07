# ATLAS Supabase v2 — Verified Data-Layer Status

**Project:** `atlas-core-v2`  
**Supabase project ref:** `qawxltbplsxcjvwxdkes`  
**Region:** `us-east-1`  
**Verification date:** 2026-09-07  
**Repository integration branch:** `release/atlas-a-z`

## Truth state

This document records executable evidence for the clean ATLAS Supabase v2 data layer. It does **not** claim that the full ATLAS application, GitHub CI, deployment, or production traffic is verified.

The previous Supabase projects remain unchanged and are not the canonical target for the new v2 architecture. New work should target `atlas-core-v2` unless a later approved migration supersedes this decision.

## Canonical scope

The v2 foundation makes `tenant_id + org_id` explicit and mandatory for scoped business data. Accounting v1 does not preserve the legacy nullable-organization contract.

Foundation hierarchy:

`auth.users → tenants → organizations → organization_members → RBAC/RLS → audit_logs → module_registry`

## Implemented Foundation / Identity

- tenants and organizations
- memberships
- permission catalog and role permissions
- organization permission overrides
- RLS membership isolation
- centralized audit log
- module registry / organization modules
- service-role-only transactional tenant bootstrap
- JWT-protected `atlas-bootstrap-tenant` Edge Function
- authenticated `atlas_identity_context()` returning real tenant + organization + role + effective permissions
- Foundation and Identity self-checks

## Implemented Accounting v1

### Ledger Core

- `accounting_settings`
- `chart_of_accounts`
- `journal_entries`
- `journal_lines`
- exact double-entry posting validation
- posted/reversed journal immutability
- reversal journals instead of editing history
- server-derived actor/time
- governed RPCs with audit
- no direct authenticated DML on ledger core tables

### AR / AP

- customers / vendors
- invoices / invoice lines
- customer payments
- bills / bill lines
- vendor payments
- invoice and bill postings route through governed journals
- bill approval required before posting
- overpayments rejected
- tax posting fails closed when `tax_amount <> 0` until ATLAS Tax supplies a governed tax-accounting contract

### Bank / Cash / Reconciliation

- bank accounts
- bank transactions
- reconciliation sessions / items
- source evidence immutable after capture
- classification stored separately from source evidence
- provider state restricted to `not_configured`, `configured`, `live`, `unavailable`
- `live` requires provider reference and source evidence
- provider-state changes and provider ingestion are `service_role` only
- reconciliation matches to posted ledger lines and requires exact statement/ledger ending balance before close

### Assets / Close / Reports

- fixed assets
- depreciation events
- straight-line depreciation posted through the ledger
- no free editable accumulated-depreciation balance
- accounting periods
- close tasks with required evidence
- period close blocks unresolved tasks, draft journals, and open reconciliations
- period reopen requires `accounting.admin` plus reason and audit
- Trial Balance
- General Ledger
- Profit & Loss
- Balance Sheet with synthetic current-earnings equity row
- reports derive from journal entries / journal lines rather than report snapshots

## Executable verification evidence

Latest aggregate query combined:

- `atlas_foundation_self_check()`
- `atlas_identity_self_check()`
- `atlas_accounting_self_check()`
- `atlas_accounting_arap_self_check()`
- `atlas_accounting_bank_self_check()`
- `atlas_accounting_assets_close_self_check()`

Result at verification time:

- total checks: **58**
- passed: **58**
- failed: **0**

Latest Supabase Security Advisor result: **0 findings**.

Latest Performance Advisor result: only `unused_index` INFO notices on the fresh database. These indexes are retained until real workload evidence exists; they are not removed merely to silence a no-traffic advisory.

Supabase unused-index guidance: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

## Migration manifest

1. `20260907174239 atlas_foundation_v1`
2. `20260907174346 harden_foundation_security_v1`
3. `20260907174412 optimize_foundation_indexes_v1`
4. `20260907174455 service_bootstrap_tenant_v1`
5. `20260907174702 atlas_foundation_self_check_v1`
6. `20260907174738 atlas_identity_context_v1`
7. `20260907174751 atlas_identity_self_check_v1`
8. `20260907192123 atlas_accounting_ledger_core_v1`
9. `20260907192348 atlas_accounting_ledger_governance_v1`
10. `20260907192503 atlas_accounting_fk_index_alignment_v1`
11. `20260907192544 atlas_accounting_self_check_v1`
12. `20260907192735 atlas_accounting_ar_ap_v1`
13. `20260907193004 atlas_accounting_ar_ap_governance_v1`
14. `20260907193100 atlas_accounting_ar_ap_self_check_v1`
15. `20260907193251 atlas_accounting_bank_reconciliation_v1`
16. `20260907193417 atlas_accounting_bank_governance_v1`
17. `20260907193459 atlas_accounting_bank_self_check_v1`
18. `20260907193647 atlas_accounting_assets_close_v1`
19. `20260907193824 atlas_accounting_assets_close_reports_governance_v1`
20. `20260907193846 atlas_accounting_pnl_date_scope_fix_v1`
21. `20260907193928 atlas_accounting_assets_close_self_check_v1`

## Generated TypeScript contract

Supabase TypeScript generation was run after Accounting v1. The generated contract confirms mandatory `tenant_id` and `org_id` fields on v2 Accounting tables and exposes `atlas_identity_context()` with both identifiers.

The generated contract is not yet wired into the current frontend runtime. Existing `AtlasContext.tsx` / `atlasIdentitySource.ts` still reflect the older organization-only runtime model. Runtime conversion must be performed with executable TypeScript tests. GitHub-hosted Actions currently fail before runner assignment, so production TypeScript is intentionally not changed merely to bypass that verification gap.

## Known gates before production claim

1. Bootstrap at least one real authenticated user into v2 through the JWT-protected bootstrap path.
2. Run authenticated end-to-end transactions against v2: account creation, balanced journal posting, reversal, invoice/bill posting, payments, reconciliation, depreciation, period close/reopen, and report reads.
3. Run cross-tenant negative tests with two distinct tenants/orgs and confirm isolation.
4. Wire generated Supabase types + `atlas_identity_context()` into the A-Z frontend/Core and execute TypeScript tests/typecheck/build.
5. Recover GitHub Actions runner allocation and execute the repository CI matrix.
6. Do not merge PR #13 to `main` until broader A-Z release gates are satisfied.

## Release interpretation

**Verified now:** Supabase v2 Foundation/Identity/Accounting structural and governance invariants on the new project.

**Not verified yet:** authenticated end-to-end application behavior, frontend integration, GitHub CI, deployment, or production readiness.