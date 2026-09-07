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
- A-Z web runtime now carries `tenantId + organizationId` in ready identity state
- A-Z identity source now resolves scope and permissions from `atlas_identity_context()` rather than rebuilding tenancy client-side

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

## ATLAS Backend Gate

`atlas_backend_gate()` is the canonical service-role-only aggregate data-layer gate.

It consolidates:

- `atlas_foundation_self_check()`
- `atlas_identity_self_check()`
- `atlas_accounting_self_check()`
- `atlas_accounting_arap_self_check()`
- `atlas_accounting_bank_self_check()`
- `atlas_accounting_assets_close_self_check()`

Latest service-role execution:

| Component | Passed | Failed |
| --- | ---: | ---: |
| Foundation | 7 | 0 |
| Identity | 3 | 0 |
| Accounting Ledger | 12 | 0 |
| Accounting AR/AP | 12 | 0 |
| Accounting Bank | 11 | 0 |
| Accounting Assets/Close | 13 | 0 |
| **Total** | **58** | **0** |

The first service-role execution exposed a real tooling defect: Accounting self-checks inspected private function definitions but lacked the execution context required to inspect the private schema. This was corrected without granting clients access to the private schema. The Accounting self-checks now run as locked-down `SECURITY DEFINER` functions with `EXECUTE` revoked from public/anon/authenticated and granted only to `service_role`.

Latest Supabase Security Advisor result after this change: **0 findings**.

Latest Performance Advisor result before this change contained only `unused_index` INFO notices on the fresh database. These indexes are retained until real workload evidence exists; they are not removed merely to silence a no-traffic advisory.

## Authenticated tenant-isolation E2E

A reusable pure-SQL test is versioned at:

`supabase/v2/tests/tenant-isolation.e2e.sql`

The test creates two synthetic users and two independent tenant/org scopes, then verifies:

1. `bootstrap_atlas_tenant_service(...)` is not executable by `authenticated`.
2. Each synthetic authenticated user resolves the correct `auth.uid()`.
3. `atlas_identity_context()` returns the correct `tenant_id + organization_id + owner role`.
4. `accounting.write` resolves for each owner.
5. Each user can create an Accounting account inside its own scope.
6. RLS exposes only the caller's tenant account rows.
7. User A cannot create an Accounting account inside User B's tenant/org; the RPC fails closed with a permission error.
8. User B independently sees only its own scope.
9. The script ends with `ROLLBACK`.

The exact pure-SQL test was executed against `atlas-core-v2` and completed without SQL errors. A post-run check confirmed the database returned to:

- auth users: **0**
- tenants: **0**
- organizations: **0**
- memberships: **0**
- test accounts: **0**
- test audit rows: **0**

No synthetic E2E fixture remains persisted.

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
22. `20260907203112 fix_identity_rls_recursion_v1`
23. `20260907203250 fix_audit_correlation_uuid_v1`
24. `20260907205806 atlas_backend_gate_v1`
25. `20260907205840 harden_accounting_self_checks_service_execution_v1`

The latest two migrations are also versioned under `supabase/v2/migrations/` on A-Z. Earlier v2 migrations were applied directly to the clean project during construction and still need a complete repository mirror before disaster-recovery reproducibility can be called complete.

## Generated TypeScript / runtime contract

Supabase TypeScript generation was run after Accounting v1. The generated contract confirms mandatory `tenant_id` and `org_id` fields on v2 Accounting tables and exposes `atlas_identity_context()` with both identifiers.

The A-Z identity runtime has now been converted to the v2 tenant-scoped contract and tests were added for tenant mapping and fail-closed behavior.

The full generated `Database` type surface is not yet mirrored and wired across every repository/provider. That remains a separate contract-hardening task.

## Forge / CI state

A-Z contains ATLAS Forge with the canonical local pipeline:

`npm ci → typecheck → unit → integration → dependency audit → build`

Forge records SHA evidence and requires a clean working tree for local CI. However:

- GitHub Hosted Actions still fails before assigning an `ubuntu-latest` runner (`runner_id = 0`, no steps executed).
- No SentinelX Linux host is currently enrolled, so this session cannot start `atlas-forge-api` / `atlas-forge-runner` on the user's server yet.
- The Supabase Backend Gate is therefore the current independent **data-layer** verification path; it is not a substitute for TypeScript tests, dependency audit, or frontend build.

## Known gates before production claim

1. Bootstrap at least one real authenticated user into v2 through the JWT-protected bootstrap path.
2. Expand authenticated E2E beyond identity/account creation to balanced journal posting, reversal, invoice/bill posting, payments, reconciliation, depreciation, period close/reopen, and report reads.
3. Mirror the complete v2 migration history into the canonical repository.
4. Wire generated Supabase `Database` types across all v2 repositories/providers.
5. Enroll/start a real ATLAS Forge Linux runner or recover GitHub Actions runner allocation, then execute the full repository pipeline.
6. Run full A-Z cross-module CI and consensus gates.
7. Do not merge PR #13 to `main` until broader A-Z release gates are satisfied.

## Release interpretation

**Verified now:** clean Supabase v2 Foundation/Identity/Accounting structural invariants, tenant-scoped Identity runtime contract, service-role Backend Gate, authenticated own-scope account write/read, and negative cross-tenant read/write isolation.

**Not verified yet:** full Accounting transaction lifecycle E2E, complete generated type adoption, full repository CI/build, deployment, production traffic, or production readiness.
