# ATLAS Supabase v2 — Verified Data-Layer Status

**Project:** `atlas-core-v2`  
**Supabase project ref:** `qawxltbplsxcjvwxdkes`  
**Region:** `us-east-1`  
**Verification date:** 2026-09-07  
**Repository integration branch:** `release/atlas-a-z`

## Truth state

This document records executable evidence for the clean ATLAS Supabase v2 data layer. It does **not** claim that the full ATLAS application, GitHub CI, Cloudflare deployment, or production traffic is verified.

The previous Supabase projects remain unchanged and are not the canonical target for the v2 architecture. New work targets `atlas-core-v2` unless a later approved migration supersedes this decision.

## Canonical scope

The v2 foundation makes `tenant_id + org_id` explicit and mandatory for scoped business data.

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
- A-Z web runtime carries `tenantId + organizationId` in ready identity state
- A-Z identity source resolves scope and permissions from `atlas_identity_context()` rather than rebuilding tenancy client-side

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

Latest service-role execution on `atlas-core-v2`:

| Component | Passed | Failed |
| --- | ---: | ---: |
| Foundation | 7 | 0 |
| Identity | 3 | 0 |
| Accounting Ledger | 12 | 0 |
| Accounting AR/AP | 12 | 0 |
| Accounting Bank | 11 | 0 |
| Accounting Assets/Close | 13 | 0 |
| **Total** | **58** | **0** |

The Accounting self-checks run as locked-down `SECURITY DEFINER` functions with `EXECUTE` revoked from public/anon/authenticated and granted only to `service_role`.

Latest Supabase Security Advisor result: **0 findings**.

Latest Performance Advisor result contains only `unused_index` INFO notices on the fresh database. Those indexes remain until workload evidence supports removal; no index is deleted merely to silence a no-traffic advisory.

Supabase guidance: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

## Authenticated tenant-isolation E2E

Reusable test:

`supabase/v2/tests/tenant-isolation.e2e.sql`

The executed test verified two independent tenant/org scopes, authenticated identity resolution, own-scope Accounting writes, RLS read isolation, blocked cross-tenant writes, and rollback cleanup.

Post-run cleanup evidence showed zero persisted synthetic users, tenants, organizations, memberships, test accounts, and audit fixtures.

## Accounting lifecycle E2E

Reusable test:

`supabase/v2/tests/accounting-lifecycle.e2e.sql`

Detailed execution evidence:

`docs/superpowers/release/ATLAS_SUPABASE_V2_ACCOUNTING_E2E.md`

The corrected complete lifecycle executed successfully against `atlas-core-v2` inside a transaction ending with `ROLLBACK`. It exercised, among other checks:

- tenant/org bootstrap and authenticated identity
- Chart of Accounts and Accounting settings
- balanced journal posting and governed reversal
- customer/invoice/payment lifecycle
- vendor/bill/approval/payment lifecycle
- bank inflow/outflow, matching and reconciliation close
- fixed asset creation and month-end straight-line depreciation
- close task evidence, period close, closed-period posting rejection and governed reopen
- Trial Balance equality
- expected P&L values
- Balance Sheet equation including Current Earnings
- non-empty General Ledger

Fresh post-run checks confirmed no synthetic Accounting or identity fixtures persisted.

## Exact migration mirror

The complete applied v2 migration history is now mirrored in:

`supabase/v2/migrations/`

Evidence manifest:

`supabase/v2/MIGRATION_MIRROR.md`

The source SQL was recovered from `supabase_migrations.schema_migrations.statements` and every repository migration file was compared byte-for-byte using the Git blob SHA-1 algorithm.

Result: **25/25 exact matches; 0 mismatches.**

No migration was replayed, rolled back, or changed on the canonical `atlas-core-v2` database during recovery.

### Migration manifest

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

## Generated TypeScript / runtime contract

Supabase TypeScript generation confirms mandatory `tenant_id` and `org_id` fields on v2 Accounting tables and exposes `atlas_identity_context()` with both identifiers.

The A-Z identity runtime is converted to the v2 tenant-scoped contract and tests exist for tenant mapping and fail-closed behavior.

The full generated `Database` type surface is not yet adopted across every repository/provider. This remains a contract-hardening gate.

## Forge / CI state

A-Z contains ATLAS Forge with the canonical local pipeline:

`npm ci → typecheck → unit → integration → dependency audit → build`

Current hosted-runner truth state:

- GitHub Hosted Actions still fails before assigning an `ubuntu-latest` runner (`runner_id = 0`, `steps = []`).
- The same pre-runner failure reproduced on PR #46, so no migration/test/build step ran in that red check.
- No SentinelX Linux host is currently enrolled.
- Backend Gate and database E2E evidence do not substitute for the repository TypeScript/test/audit/build pipeline.

## Known gates before production claim

1. Replay the exact 25-migration chain in a fresh compatible **non-production** Supabase environment.
2. Run Backend Gate, tenant-isolation E2E and Accounting lifecycle E2E against the replayed environment.
3. Confirm replayed schema/generated types match the expected v2 contract.
4. Complete generated Supabase `Database` type adoption across v2 repositories/providers.
5. Bootstrap and verify real authenticated production identities through the governed path when production onboarding is authorized.
6. Enroll/start a real ATLAS Forge Linux runner or recover GitHub Actions runner allocation and execute the full repository pipeline.
7. Run full A-Z cross-module CI and consensus gates.
8. Verify Cloudflare deployment, domains, TLS, required routes and `/healthz` against the intended canonical commit.
9. Do not merge PR #13 to `main` until the broader A-Z release gates are satisfied.

Automated `supabase db push` remains disabled until clean non-production replay evidence exists.

## Release interpretation

**Verified now:** Supabase v2 Foundation/Identity/Accounting structural invariants; tenant-scoped runtime contract; Backend Gate 58/58; authenticated tenant isolation; database-level Accounting lifecycle; exact 25/25 migration-history mirror; zero current Supabase Security Advisor findings.

**Not verified yet:** clean empty-environment migration replay, complete generated type adoption, full repository CI/build, Cloudflare deployment, production traffic, or overall production readiness.
