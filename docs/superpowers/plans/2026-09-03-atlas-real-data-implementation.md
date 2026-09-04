# ATLAS Real Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all runtime demo identity/data from ATLAS Core + Accounting and connect the application architecture to the existing real Supabase `atlas-core` backend.

**Architecture:** Runtime identity comes from Supabase Auth, active organization membership, and the canonical `organizations` table. Runtime accounting repositories read the existing organization-scoped accounting tables and rely on existing RLS policies; test-only fixtures are injected through interfaces and never imported by runtime code.

**Tech Stack:** React 19, TypeScript, React Router, Vite, Vitest, Testing Library, Supabase JS, PostgreSQL/RLS.

**Spec:** `docs/superpowers/specs/2026-09-03-atlas-real-data-amendment.md`

## Global Constraints

- No runtime demo users, organizations, financial records, seeds, fabricated metrics, or fake connected states.
- Test fixtures are permitted only inside `tests/`.
- Reuse the active Supabase project `ggmanzcgtlrvqfoccgsh` and existing tables; do not create parallel accounting tables.
- RLS remains the server-side authorization authority.
- Missing configuration/session/organization/data must render explicit truthful states.
- No service-role key or secret is committed to the repository.
- Client configuration uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

---

### Task R3: Replace demo ATLAS shell identity with real runtime identity states

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/app/AtlasContext.tsx`
- Modify: `apps/web/src/app/AtlasShell.tsx`
- Modify: `apps/web/src/app/router/AppRouter.tsx`
- Create: `apps/web/src/lib/supabase/client.ts`
- Create: `apps/web/src/lib/supabase/atlasIdentitySource.ts`
- Create: `apps/web/src/app/AtlasAccessState.tsx`
- Modify: `tests/integration/routes.test.tsx`

**Interfaces:**
- Produces `AtlasIdentityState = loading | configuration_required | authentication_required | organization_required | ready | error`.
- Produces `AtlasIdentitySource.resolve(): Promise<AtlasIdentityState>`.
- `ready` contains real `userId`, `organizationId`, `organizationName`, `role`, and derived UI capabilities that mirror verified RLS role rules.

- [ ] Write tests proving the runtime shell has no `Demo environment`, no hard-coded demo IDs, and each non-ready identity state renders a truthful access screen.
- [ ] Run the route test and verify RED against the existing demo provider.
- [ ] Add `@supabase/supabase-js` and a client factory that returns `configuration_required` when either Vite variable is absent.
- [ ] Implement identity resolution: `auth.getUser()` -> active `organization_members` row -> `organizations` row. Do not fabricate a membership when none exists.
- [ ] Move `AtlasProvider` outside `AppRouter`; production `main.tsx` supplies the real source, while integration tests inject explicit test-only ready states.
- [ ] Make `AtlasShell` render business navigation only for `ready` identity. Preserve Finance/Accounting/Health route behavior after readiness is injected in tests.
- [ ] Run `npm run typecheck`, integration tests, Core tests, and `npm run build`.
- [ ] Commit as `feat: replace demo shell identity with real Supabase states`.

---

### Task R4: Implement real Accounting repository over canonical Supabase tables

**Files:**
- Create: `packages/accounting/package.json`
- Create: `packages/accounting/src/types.ts`
- Create: `packages/accounting/src/validation.ts`
- Create: `packages/accounting/src/repository.ts`
- Create: `packages/accounting/src/supabaseRepository.ts`
- Create: `packages/accounting/src/index.ts`
- Create: `tests/unit/accounting-validation.test.ts`
- Create: `tests/integration/accounting-repository.test.ts`
- Modify: `.github/workflows/atlas-core-accounting-ci.yml`

**Interfaces:**
- `AccountingRepository.listAccounts(orgId)` reads `chart_of_accounts`.
- `listJournals(orgId)` reads `journal_entries` and `journal_lines`.
- `listCustomers(orgId)` reads `customers`.
- `listVendors(orgId)` reads `vendors`.
- `listInvoices(orgId)` reads `invoices`.
- `listPayments(orgId)` reads `payments`.
- `listAuditEvents(orgId)` reads `audit_logs` when authorized.
- Every repository method rejects an empty organization ID before querying.

- [ ] Write failing domain validation tests for journal line amount rules and balanced journal totals.
- [ ] Write failing repository contract tests using a test-only injected gateway; no test fixture is imported by runtime application code.
- [ ] Implement domain types aligned to the verified existing database columns (`org_id`, `account_number`, `entry_number`, `entry_date`, `debit`, `credit`, and related fields).
- [ ] Implement `SupabaseAccountingRepository` with explicit `.eq('org_id', orgId)` filters in addition to RLS defense-in-depth.
- [ ] Preserve zero-row results as empty arrays. Never substitute seeds.
- [ ] Add a CI source-safety scan that fails if runtime code references `DemoAccountingRepository`, `data/demo`, `seed.ts`, `tenant-demo`, `org-demo`, or `Demo environment`.
- [ ] Run unit tests, repository tests, integration routes, typecheck, and build.
- [ ] Commit as `feat: add real Supabase accounting repository`.

---

### Task R5: Wire real Accounting reads into the UI

**Files:**
- Modify: `apps/web/src/modules/accounting/AccountingPlaceholder.tsx`
- Create: `apps/web/src/modules/accounting/AccountingDataProvider.tsx`
- Create: `apps/web/src/modules/accounting/AccountingEmptyState.tsx`
- Modify: `apps/web/src/app/router/AppRouter.tsx`
- Test: `tests/integration/routes.test.tsx`

**Interfaces:**
- Consumes `ready` ATLAS identity and `AccountingRepository`.
- Displays real counts/records only from the active organization.
- Displays `No accounting records` when canonical tables return zero rows.

- [ ] Write failing UI tests for real empty and populated repository responses.
- [ ] Implement organization-scoped reads with loading/error/empty/ready states.
- [ ] Do not enable posting, payment, bank execution, or close actions in this task.
- [ ] Run all gates and commit `feat: wire Accounting UI to real organization data`.

## Verification Gate

Before calling this amendment complete:

```bash
npm run typecheck
npm test -- tests/unit/core.test.ts
npm test -- tests/unit/accounting-validation.test.ts
npm test -- tests/integration/accounting-repository.test.ts
npm test -- tests/integration/routes.test.tsx
npm run build
```

CI must also pass the runtime demo-string/source scan. A live-backend connection claim additionally requires successful authenticated runtime access to Supabase with a real organization membership.
