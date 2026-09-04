# ATLAS A-Z Closure Program

> **For agentic workers:** This is the program-level execution map. Each independent domain wave must use its own approved implementation plan before code changes. Execute continuously on `release/atlas-a-z`; do not merge to `main` until the final closure gate.

**Goal:** Consolidate every approved ATLAS domain into one tested release branch and perform one final production merge/deploy after all release gates pass.

**Architecture:** The program uses `packages/core` as the shared governance layer, typed domain packages for business rules/data adapters, and one React application shell under `apps/web`. Existing feature branches are treated as source material and reconciled into the release branch only after their tests and current-branch compatibility pass.

**Tech Stack:** TypeScript, React 18, React Router, Vite, Vitest, Testing Library, npm workspaces, Supabase where already designed/authorized, Vercel production workflow currently present in the canonical repository.

**Spec:** `docs/superpowers/specs/2026-09-04-atlas-a-z-closure-design.md`

## Global Constraints

- Work on `release/atlas-a-z`; keep `main` production-stable until final closure.
- No fake live/provider/financial/clinical state.
- No visible dead controls or dead routes.
- Tenant + organization scope is mandatory for mutable business data.
- RBAC and audit are shared Core contracts.
- Existing verified behavior is preserved unless a newer implementation passes stronger tests.
- Absorb tested work from existing PRs instead of duplicating it.
- Every wave must end green before the next wave is considered accepted into the release branch.
- Final deployment happens from the final `main` SHA after complete closure.

---

## Program Task 1: Establish the release integration branch and master PR

**Files:**
- Create: `docs/superpowers/specs/2026-09-04-atlas-a-z-closure-design.md`
- Create: `docs/superpowers/plans/2026-09-04-atlas-a-z-closure-program.md`

**Produces:** one long-lived integration branch and one draft PR to `main` so pull-request CI evaluates every release-branch commit without triggering the production push workflow.

- [x] Branch `release/atlas-a-z` from `main` SHA `eef8411cb8819d1142d8abc4ed43ec9ce30e6b9e`.
- [x] Commit umbrella design.
- [x] Commit this program map.
- [ ] Open draft PR `release/atlas-a-z -> main`.
- [ ] Record baseline check results before source-branch absorption.

---

## Program Task 2: Wave 0/1, Core + Accounting convergence

**Detailed plan:** `docs/superpowers/plans/2026-09-03-atlas-core-accounting-implementation.md`

**Primary source branch:** PR #8 `feat/atlas-core-accounting`, head observed at `1deb8b7772739318bf507a01e827f6d23f0f491a` with baseline CI success.

**Current-main behavior to preserve:** verified Accounts Payable slice, current Vercel route/health configuration, MiFi/Health planning documents added after PR #8 diverged.

- [ ] Compare PR #8 file graph with current release tree.
- [ ] Import Core contracts, Accounting domain/repository code, governed Supabase migrations, UI and tests into the release branch without deleting newer non-conflicting main files.
- [ ] Run/observe `npm ci`, audit, typecheck, unit, integration and build gates on the release PR.
- [ ] Fix compatibility regressions on the release branch rather than modifying `main`.
- [ ] Complete remaining Accounting tasks from the existing plan: dashboard/COA/journals/GL, AR/AP, bank/reconciliation, assets/close/reports/audit/settings, critical E2E and release gate.
- [ ] Mark Accounting complete only when its route matrix and domain tests are green.

---

## Program Task 3: Wave 5 foundation, Health convergence

**Detailed plans/specs:**
- `docs/superpowers/plans/2026-09-03-atlas-health-adventhealth-implementation.md`
- `docs/superpowers/specs/2026-09-03-atlas-health-adventhealth-ecosystem-design.md`
- `docs/superpowers/specs/2026-09-03-atlas-health-disease-reconstruction-lab-design.md`

**Source branches:** PR #12 `feat/atlas-health-core-prereq-20260904`; PR #6 `feat/atlas-health-disease-reconstruction-lab`.

- [ ] Import only Health-owned package/data/UI/test files after Core/Accounting is stable.
- [ ] Resolve Core/router conflicts in favor of the release branch shared shell.
- [ ] Run Health evidence, permission, source-state, catalog, route, typecheck and build gates.
- [ ] Integrate Disease Reconstruction Lab only after its evidence-safety/falsification tests pass against the same shell.
- [ ] Keep unverified clinical/provider integrations in explicit readiness states.

---

## Program Task 4: Wave 4 early platform capabilities already implemented elsewhere

**Source branches:** PR #7 `feat/atlas-automations-shortcuts`; PR #5 `feat/site-review-center-foundation`.

- [ ] Rebase conceptually onto release Core contracts by selective import, not by replacing the release tree.
- [ ] Convert local RBAC previews to shared Core permission vocabulary where required.
- [ ] Preserve explicit `not_configured` states for external crawling/Search Console/Core Web Vitals.
- [ ] Ensure Automations uses Trigger -> Conditions -> Actions -> Permissions -> Result and emits audit records.
- [ ] Add route and cross-module shell tests.

---

## Program Task 5: Wave 2 People Operations

**Required domain plan before implementation:** `docs/superpowers/plans/2026-09-04-atlas-people-operations.md`.

**Deliverables:** Payroll, HR, Time & Attendance, Recruiting, Candidate Assessments, English Assessment, Compensation, Benefits & Deductions, Employee Self-Service.

- [ ] Create typed people/payroll contracts with tenant scope and permissions.
- [ ] Implement deterministic payroll calculation utilities and approval lifecycle without representing tax filing/payment rails as connected.
- [ ] Implement HR employee/job lifecycle and timecard workflow.
- [ ] Implement recruiting/assessment flows and scored results with auditability.
- [ ] Mount responsive routes and critical integration tests.

---

## Program Task 6: Wave 3 Revenue and Operations

**Required domain plan before implementation:** `docs/superpowers/plans/2026-09-04-atlas-revenue-operations.md`.

**Deliverables:** CRM, Sales, Customers, Vendors, Purchasing, Inventory, POS, Projects, operational Analytics.

- [ ] Shared customer/vendor/item/location identifiers and scoped repositories.
- [ ] CRM lead/opportunity lifecycle and measurable outcome metrics derived from data.
- [ ] Purchasing -> receipt -> inventory movement flow.
- [ ] POS catalog/order/register/device contracts with explicit payment/device provider readiness.
- [ ] Project/task/milestone workflow and operational analytics derived from domain events.

---

## Program Task 7: Wave 4 remaining Platform Services

**Required domain plan before implementation:** `docs/superpowers/plans/2026-09-04-atlas-platform-services.md`.

**Deliverables:** Drive, Knowledge, Voice, Connect, Communications, Creator Studio, Sites, Security, Settings, global observability.

- [ ] Implement shared provider/readiness registry.
- [ ] Implement Drive/Knowledge local governed repositories and search contracts.
- [ ] Implement Voice/Connect interfaces without claiming carrier/telephony control until authorized adapters exist.
- [ ] Integrate Creator Studio and Sites into the same shell.
- [ ] Centralize Security/Settings/readiness/audit surfaces.

---

## Program Task 8: Wave 6 Mobility, physical operations and connectivity

**Existing plan:** `docs/superpowers/plans/2026-09-04-atlas-mifi-control.md` for MiFi.

**Additional required plan:** `docs/superpowers/plans/2026-09-04-atlas-mobility-physical-ops.md`.

**Deliverables:** Ride OS, GPS 4D, Parks Global, AutoWash OS, Insurance Hub, Telecom, MiFi Control.

- [ ] Implement typed adapter capability contracts for devices/providers.
- [ ] Implement operational workflows that can run deterministically without fake hardware/provider connectivity.
- [ ] Gate real commands behind verified adapter capability and permissions.
- [ ] Add mobility/operations route and state tests.

---

## Program Task 9: Wave 7 financial rails and specialized surfaces

**Required domain plan before implementation:** `docs/superpowers/plans/2026-09-04-atlas-specialized-surfaces.md`.

**Deliverables:** ATLAS Pay, supported payment adapters, Venezuela corporate/operations surface, approved specialized modules present in the final registry.

- [ ] Separate bookkeeping state from payment execution state.
- [ ] Require authorized provider adapters for real transfers/charges.
- [ ] Keep legal/corporate records as governed records, not legal-status claims.
- [ ] Add route and permission tests.

---

## Program Task 10: Wave 8 final closure and production release

**Required plan before final merge:** `docs/superpowers/plans/2026-09-04-atlas-final-release.md`.

- [ ] Enumerate the final canonical module registry and verify every active route.
- [ ] Scan for dead links, disabled-but-present fake controls, placeholder copy, fake metrics and leaked secrets.
- [ ] Run full dependency audit, typecheck, unit, integration, E2E and build matrix.
- [ ] Verify responsive shell and primary workflows.
- [ ] Resolve or close absorbed stale PRs with traceable comments.
- [ ] Establish required `main` checks/branch protection once the final gate names are stable.
- [ ] Merge `release/atlas-a-z` into `main` only after all final checks are green.
- [ ] Allow the production workflow to deploy the exact final SHA.
- [ ] Verify `/healthz` plus one production route from every active module family.
- [ ] Record final release SHA and evidence; only then declare ATLAS A-Z production complete.
