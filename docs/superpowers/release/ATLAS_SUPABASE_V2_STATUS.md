# ATLAS Supabase v2 — Verified Data-Layer Status

**Project:** `atlas-core-v2`  
**Supabase project ref:** `qawxltbplsxcjvwxdkes`  
**Region:** `us-east-1`  
**Verification date:** 2026-09-08  
**Repository integration branch:** `release/atlas-a-z`

## Truth state

This document records executable evidence for the ATLAS Supabase v2 data layer. It does **not** claim that the full ATLAS application, GitHub CI, Cloudflare deployment, production traffic, or overall production readiness is verified.

The canonical v2 backend target is `atlas-core-v2`. `main` remains outside this integration work; repository changes are staged on `release/atlas-a-z` and PR #13 remains the master integration lane.

## Canonical scope

Scoped business data uses explicit `tenant_id + org_id` boundaries.

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
- authenticated `atlas_identity_context()` returning tenant + organization + role + effective permissions
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
- governed reversal journals
- server-derived actor/time
- audited governed RPCs
- no direct authenticated DML on ledger core tables

### AR / AP

- customers / vendors
- invoices / invoice lines
- customer payments
- bills / bill lines
- vendor payments
- invoice and bill postings through governed journals
- bill approval before posting
- overpayment rejection
- tax posting fails closed when `tax_amount <> 0` until ATLAS Tax supplies a governed tax-accounting contract

### Bank / Cash / Reconciliation

- bank accounts and transactions
- reconciliation sessions / items
- immutable captured source evidence
- classification separate from source evidence
- provider state restricted to `not_configured`, `configured`, `live`, `unavailable`
- provider-state changes and provider ingestion restricted to `service_role`
- reconciliation requires posted ledger evidence and exact statement/ledger ending balance before close

### Assets / Close / Reports

- fixed assets and depreciation events
- straight-line depreciation posted through ledger journals
- accounting periods and evidence-backed close tasks
- close blocks unresolved tasks, draft journals and open reconciliations
- governed period reopen with `accounting.admin`, reason and audit
- Trial Balance
- General Ledger
- Profit & Loss
- Balance Sheet with synthetic Current Earnings equity row

## Revenue Ops v1 — verified foundation/governance slice

Applied to `atlas-core-v2`:

- CRM accounts, contacts and opportunities
- sales orders
- inventory items and movements
- POS transactions
- projects
- 10 Revenue Ops permissions across CRM, Sales, Inventory, POS and Projects
- five module-registry entries, currently `preview`
- RLS on all eight Revenue Ops tables
- authenticated direct INSERT/UPDATE/DELETE/TRUNCATE revoked
- governed RPCs for account creation, opportunity creation/transition, sales-order creation, inventory movements and POS transaction creation
- audit events for governed mutations

Security hardening follows the Accounting pattern:

`public SECURITY INVOKER wrapper → private SECURITY DEFINER implementation`

The six public Revenue Ops RPCs are no longer exposed as `SECURITY DEFINER`. The private implementations retain the elevated mutation boundary while `anon` cannot execute them.

This is a verified data-layer/governance slice, **not** a claim that every Revenue Ops UI, workflow, external provider, inventory lifecycle, POS settlement path or project workflow is production-complete.

## ATLAS Backend Gate

`atlas_backend_gate()` is the canonical service-role-only aggregate data-layer gate.

Fresh execution on 2026-09-08:

| Component | Passed | Failed |
| --- | ---: | ---: |
| Foundation | 7 | 0 |
| Identity | 3 | 0 |
| Accounting Ledger | 12 | 0 |
| Accounting AR/AP | 12 | 0 |
| Accounting Bank | 11 | 0 |
| Accounting Assets/Close | 13 | 0 |
| Revenue Ops | 11 | 0 |
| **Total** | **69** | **0** |

The Revenue Ops component includes structural/RLS/RBAC/RPC checks plus a dedicated check that public mutation RPCs are `SECURITY INVOKER` and private implementations are governed `SECURITY DEFINER` functions.

Latest Supabase Security Advisor result: **0 findings**.

Latest synthetic-fixture cleanup verification after the Revenue Ops E2E showed:

- auth users: 0
- tenants: 0
- organizations: 0
- memberships: 0
- Revenue Ops accounts: 0
- opportunities: 0
- sales orders: 0
- audit fixtures: 0

## Authenticated tenant-isolation E2E

Reusable test:

`supabase/v2/tests/tenant-isolation.e2e.sql`

Verified with two independent tenant/org scopes:

- authenticated identity resolution
- own-scope Accounting writes
- RLS read isolation
- blocked cross-tenant writes
- transaction rollback cleanup

## Accounting lifecycle E2E

Reusable test:

`supabase/v2/tests/accounting-lifecycle.e2e.sql`

Detailed evidence:

`docs/superpowers/release/ATLAS_SUPABASE_V2_ACCOUNTING_E2E.md`

The lifecycle executed inside a transaction ending with `ROLLBACK` and covered Chart of Accounts/settings, balanced posting, reversal, AR/AP, payments, bank reconciliation, depreciation, period close/reopen and financial-report reads.

## Revenue Ops E2E and security regression

Reusable tests:

- `supabase/v2/tests/revenue-ops.e2e.sql`
- `supabase/v2/tests/revenue-ops-security.e2e.sql`

TDD evidence:

1. Revenue Ops acceptance test was executed before the capability existed and failed on missing `revenue_accounts`.
2. After applying Revenue Ops, own-scope CRM/sales mutations and RLS visibility passed while a cross-tenant account write was blocked.
3. Supabase Security Advisor then identified six public authenticated `SECURITY DEFINER` RPCs.
4. A regression test was added and failed with `Revenue Ops exposes 6 SECURITY DEFINER RPC(s) in public schema`.
5. The RPC architecture was hardened to public invoker wrappers plus private governed implementations.
6. The regression test and full Revenue Ops cross-tenant E2E were rerun successfully.
7. Security Advisor returned to **0 findings**.

All E2E fixtures were rolled back.

## Exact migration history

### Historical recovery set

The original 25 applied v2 migrations were recovered from `supabase_migrations.schema_migrations.statements` and mirrored byte-for-byte in:

`supabase/v2/migrations/`

Historical evidence manifest:

`supabase/v2/MIGRATION_MIRROR.md`

Result for the historical recovery set: **25/25 exact Git blob matches; 0 mismatches**.

### Revenue Ops applied ledger additions

The canonical Supabase ledger now additionally contains these five migrations, and the repository files use the exact ledger timestamps and exact Git blobs:

| Version | Migration | Git blob SHA-1 |
| --- | --- | --- |
| `20260908205643` | `atlas_revenue_ops_core_v1` | `e46dd52496de80089b992b860589c1da87830ea4` |
| `20260908205719` | `atlas_revenue_ops_governance_v1` | `c79283b03dcb6a0636ea4eefa872193bbfa15037` |
| `20260908205740` | `atlas_revenue_ops_self_check_v1` | `177768192219d7722120fd0d80d338e58f89dadf` |
| `20260908205751` | `extend_backend_gate_revenue_ops_v1` | `0e995514716e65f1b92205c0ae57447424fce262` |
| `20260908210237` | `harden_revenue_ops_rpc_security_v1` | `84947b48a7e975f21c1449d42b8334b0a6c924c1` |

Current applied Supabase migration ledger count represented by these two sets: **30 migrations**.

## Pending Release Train

Release Train / Release Queue work exists in A-Z but is **not applied to `atlas-core-v2` and is not considered verified**.

Its SQL blob is quarantined at:

`supabase/v2/pending/20260908203000_atlas_release_train_v1.sql`

Blob SHA:

`dd615a26271dc5624c666daf4ae3b9050c35d31a`

The corresponding path under `supabase/v2/migrations/` is intentionally absent, preventing a future migration replay from treating this pending work as an approved applied migration.

Release Train must pass its own replay/E2E/security gates before it can move back into the active migration chain.

## Generated TypeScript / runtime contract

Generated Supabase types confirm mandatory `tenant_id` and `org_id` fields for the v2 Accounting contract and expose `atlas_identity_context()` with both identifiers.

The A-Z identity runtime is converted to the tenant-scoped contract and tests exist for tenant mapping and fail-closed behavior.

Full generated `Database` type adoption across every repository/provider remains a contract-hardening gate.

## Forge / CI state

A-Z contains ATLAS Forge with the canonical pipeline:

`npm ci → typecheck → unit → integration → dependency audit → build`

Current verified limitation:

- GitHub Hosted Actions has previously failed before assigning an `ubuntu-latest` runner (`runner_id = 0`, `steps = []`).
- no SentinelX Linux host was enrolled at the latest check
- database Backend Gate/E2E evidence does not substitute for repository TypeScript/test/audit/build execution

Do not interpret database success as full repository CI success.

## Known gates before production claim

1. Replay the exact applied migration chain in a fresh compatible **non-production** Supabase environment.
2. Run Backend Gate, tenant-isolation, Accounting lifecycle and Revenue Ops E2E/security tests against that replayed environment.
3. Confirm replayed schema/generated types match the expected v2 contract.
4. Complete generated Supabase `Database` type adoption across v2 repositories/providers.
5. Review and independently verify the pending Release Train before moving its SQL into active migrations.
6. Bootstrap and verify real authenticated production identities only when production onboarding is authorized.
7. Enroll/start a real ATLAS Forge Linux runner or recover GitHub Actions runner allocation and execute the full repository pipeline.
8. Run full A-Z cross-module CI and consensus gates.
9. Verify Cloudflare deployment, domains, TLS, required routes and `/healthz` against the intended canonical commit.
10. Do not merge PR #13 to `main` until broader A-Z release gates are satisfied.

Automated `supabase db push` remains disabled until clean non-production replay evidence exists.

## Release interpretation

**Verified now:** Supabase v2 Foundation/Identity/Accounting plus the Revenue Ops v1 foundation/governance slice; tenant isolation; Accounting lifecycle; Revenue Ops cross-tenant/security regression; Backend Gate **69/69**; zero current Supabase Security Advisor findings; exact 25-migration historical mirror plus five exact Revenue Ops ledger additions.

**Pending/unverified:** Release Train migration, clean empty-environment replay of the current applied chain, complete generated-type adoption, full repository CI/build, Cloudflare deployment, production traffic and overall production readiness.
