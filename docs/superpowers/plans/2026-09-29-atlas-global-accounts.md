# ATLAS Global Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the canonical authenticated ATLAS Pay foundation with organization-scoped, evidence-backed global accounts, activity, compliance, and truthful external-provider capability states.

**Architecture:** ATLAS Pay is a new canonical Finance-area module built inside the existing React/Supabase architecture. Read-side data lives in organization-scoped Supabase tables protected by RLS, is loaded through the existing authenticated session helper, and is rendered through the current ATLAS shell/design system. Provider-dependent financial actions remain fail-closed and are not implemented as live money movement in this cycle.

**Tech Stack:** React 18, React Router 7, TypeScript 5.7, Supabase REST/RLS, Vitest 5, Vite 6, existing ATLAS CSS/design tokens.

**Spec:** `docs/superpowers/specs/2026-09-29-atlas-global-accounts-design.md`

## Global Constraints

- Canonical repository is `atlasenterprisesuite/atlasenterprisesuite`; target branch is `main`.
- Reuse existing ATLAS shell, module registry, navigation graph, session helpers, Supabase REST patterns, and `--atlas-*` design tokens.
- Every Pay route requires authenticated ATLAS identity.
- All persisted Pay data is scoped by `org_id` and protected by RLS.
- Monetary values persist as integer minor units.
- Never seed or fabricate production balances, account identifiers, provider readiness, compliance approval, or live financial capability.
- Provider-dependent actions remain external-gated until authenticated provider evidence exists.
- No provider secrets, raw card data, or full banking credentials may enter browser-visible data or source.
- Target WCAG 2.2 AA and the existing mobile/tablet/desktop/wide responsive contract.
- Full repository verification must pass before merge.

## Review Focus

- Missing/partially deployed Pay tables must render a safe unavailable state rather than crash or invent data; Task 3 tests this.
- A user switching organizations must not receive rows from the prior organization; Tasks 1 and 3 pin org-scoped queries/RLS.
- Null balances and stale `balance_as_of` values must not be rendered as current zero balances; Tasks 2 and 4 test this.
- Unknown provider/compliance status strings must degrade to evidence-needed/unavailable semantics rather than “verified”; Tasks 2 and 4 test normalization.
- Deep-linking directly to `/pay/accounts/:accountId` without identity must pass through the canonical identity gate; Task 5 tests route protection.

---

### Task 1: Add organization-scoped ATLAS Pay persistence

**Files:**
- Create: `supabase/migrations/20260929123000_atlas_pay_global_accounts.sql`
- Create: `tests/unit/atlas-pay-migration.test.ts`

**Interfaces:**
- Consumes: existing `organizations(id)`, `organization_members(org_id,user_id,status)`, and authenticated RLS conventions.
- Produces: tables `pay_capabilities`, `pay_accounts`, `pay_activity`, `pay_compliance_states` with authenticated read policies scoped to active organization membership.

- [ ] **Step 1: Write the failing migration contract test**

Test must assert that the migration contains all four table definitions, `org_id` foreign keys, RLS enablement, active-membership policies, authenticated-select grants, integer `bigint` amount fields, readiness vocabulary checks, and no seed `insert into public.pay_accounts` statements.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run tests/unit/atlas-pay-migration.test.ts`

Expected: FAIL because the migration file does not exist.

- [ ] **Step 3: Implement the migration**

Define:
- `pay_capabilities` with provider/country/currency/product/operation/readiness/eligibility/safe reason/verified timestamp;
- `pay_accounts` with masked identifier and nullable `available_balance_minor bigint`, `ledger_balance_minor bigint`, `balance_as_of`;
- `pay_activity` with nullable `amount_minor bigint`, `fee_minor bigint`, normalized status/type and timestamps;
- `pay_compliance_states` with provider-backed safe status/reason fields.

Add indexes by `org_id` and common ordering fields. Enable RLS and grant read access only when `organization_members.status = 'active'`. Revoke anon access.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npx vitest run tests/unit/atlas-pay-migration.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

`git add supabase/migrations/20260929123000_atlas_pay_global_accounts.sql tests/unit/atlas-pay-migration.test.ts && git commit -m "feat(pay): add global accounts persistence"`

### Task 2: Define Pay domain types and truthful normalization

**Files:**
- Create: `apps/web/src/modules/pay/payDomain.ts`
- Create: `tests/unit/atlas-pay-domain.test.ts`

**Interfaces:**
- Consumes: persisted Pay table row shapes from Task 1.
- Produces:
  - `PayReadinessState`;
  - `PayAccount`;
  - `PayCapability`;
  - `PayActivityItem`;
  - `PayComplianceState`;
  - `normalizePayReadiness(value: unknown): PayReadinessState`;
  - `isOperationalPayCapability(capability: PayCapability): boolean`;
  - `formatMinorAmount(amountMinor: number | null, currency: string): string | null`;
  - `isBalanceStale(balanceAsOf: string | null, nowMs?: number): boolean`.

- [ ] **Step 1: Write failing domain tests**

Cover readiness normalization, unknown status -> `unavailable` or evidence-needed semantics, operational capability only for verified/eligible states, null amount -> `null`, integer minor-unit currency formatting, and stale timestamp handling.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npx vitest run tests/unit/atlas-pay-domain.test.ts`

Expected: FAIL because the domain module is missing.

- [ ] **Step 3: Implement the domain module**

Use exact readiness vocabulary from the spec. Keep presentation helpers pure and provider-agnostic. Treat malformed/unknown external states conservatively.

- [ ] **Step 4: Run focused test and verify GREEN**

Run: `npx vitest run tests/unit/atlas-pay-domain.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

`git add apps/web/src/modules/pay/payDomain.ts tests/unit/atlas-pay-domain.test.ts && git commit -m "feat(pay): add truthful pay domain model"`

### Task 3: Add authenticated organization-scoped Pay data API

**Files:**
- Create: `apps/web/src/lib/payApi.ts`
- Create: `tests/unit/atlas-pay-api.test.ts`

**Interfaces:**
- Consumes:
  - `authorizedAtlasFetch(input, init?)`;
  - `getActiveAtlasOrganization()`;
  - Task 2 domain types.
- Produces:
  - `loadPayWorkspace(): Promise<PayWorkspaceSnapshot>`;
  - `loadPayAccounts(): Promise<PayAccountsSnapshot>`;
  - `loadPayAccount(accountId: string): Promise<PayAccount | null>`;
  - `loadPayActivity(filters?: PayActivityFilters): Promise<PayActivitySnapshot>`;
  - `loadPayCompliance(): Promise<PayComplianceSnapshot>`.

All snapshots use `source: 'supabase_rls_live'`, include `organizationId`, `loadedAt`, and explicit per-capability availability/error state.

- [ ] **Step 1: Write failing API contract tests**

Mock session helpers/fetch. Assert every request includes `org_id=eq.<active-org>`; account detail includes both org and id filters; activity filters append only supported server query fields; failed table/query responses return explicit unavailable/error state and empty rows, never sample data; organization changes produce new org filters.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npx vitest run tests/unit/atlas-pay-api.test.ts`

Expected: FAIL because `payApi.ts` is missing.

- [ ] **Step 3: Implement `payApi.ts`**

Follow the established `financeApi.ts` pattern. Centralize read capability/query handling and map database rows into Task 2 domain types without converting missing balances to zero.

- [ ] **Step 4: Run focused test and verify GREEN**

Run: `npx vitest run tests/unit/atlas-pay-api.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

`git add apps/web/src/lib/payApi.ts tests/unit/atlas-pay-api.test.ts && git commit -m "feat(pay): add tenant-scoped pay data API"`

### Task 4: Build the ATLAS Pay read-side experience

**Files:**
- Create: `apps/web/src/modules/pay/PayRoutes.tsx`
- Create: `apps/web/src/modules/pay/PayHome.tsx`
- Create: `apps/web/src/modules/pay/PayAccountsPage.tsx`
- Create: `apps/web/src/modules/pay/PayAccountDetailPage.tsx`
- Create: `apps/web/src/modules/pay/PayActivityPage.tsx`
- Create: `apps/web/src/modules/pay/PayCompliancePage.tsx`
- Create: `apps/web/src/modules/pay/PayStatusBadge.tsx`
- Create: `apps/web/src/modules/pay/pay.css`
- Create: `tests/unit/atlas-pay-ui.test.tsx`

**Interfaces:**
- Consumes: Task 2 domain helpers and Task 3 API loaders.
- Produces: authenticated route components for Pay home, accounts, account detail, activity and compliance.

- [ ] **Step 1: Write failing UI tests**

Render component states with mocked loaders and assert:
- empty/configuration state contains no invented balance;
- real multiple-currency accounts display only supplied rows;
- null balance is shown as unavailable, not zero;
- stale balance has a visible stale/evidence label;
- restricted capability disables its action;
- unknown compliance state is not labeled verified;
- account links use `/pay/accounts/:id`;
- loading/error/empty content has accessible labels or status semantics.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npx vitest run tests/unit/atlas-pay-ui.test.tsx`

Expected: FAIL because Pay UI files are missing.

- [ ] **Step 3: Implement Pay UI and styles**

Use `AtlasShell` + `RequireAtlasIdentity` in `PayRoutes`. Reuse existing global classes where suitable and isolate Pay-specific responsive layout in `pay.css`, consuming `--atlas-*` tokens. Use a global-coverage/currency-card composition inspired by the reference without copying it. Provider-dependent Send/Receive/Exchange/Cards controls must be real links only if there is an implemented destination; otherwise render disabled capability cards with the safe reason.

- [ ] **Step 4: Run focused test and verify GREEN**

Run: `npx vitest run tests/unit/atlas-pay-ui.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

`git add apps/web/src/modules/pay tests/unit/atlas-pay-ui.test.tsx && git commit -m "feat(pay): add global accounts workspace"`

### Task 5: Register and route ATLAS Pay canonically

**Files:**
- Modify: `apps/web/src/modules/registry.ts`
- Modify: `apps/web/src/navigation/atlasNavigation.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `tests/unit/atlas-suite-registry.test.ts`
- Create: `tests/unit/atlas-pay-routing.test.ts`

**Interfaces:**
- Consumes: Task 4 `PayRoutes`.
- Produces: canonical module registry entry `pay`, searchable navigation node(s), Enterprise/Finance entry links, and protected top-level routing.

- [ ] **Step 1: Write failing registry/routing tests**

Assert registry contains the exact module definition values from the spec; `ATLAS_NAVIGATION_GRAPH` resolves/searches Pay; App routes `/pay/*` to `PayRoutes`; Enterprise Home and Finance Home contain a Pay link; PayRoutes contains `RequireAtlasIdentity` and all five first-cycle routes including account detail.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run tests/unit/atlas-suite-registry.test.ts tests/unit/atlas-pay-routing.test.ts`

Expected: FAIL until registry/routes are wired.

- [ ] **Step 3: Wire registry, navigation and App**

Add module:
`{ id:'pay', title:'ATLAS Pay', navLabel:'Pay', area:'Finance', route:'/pay', readiness:'external-gated', requiresAuth:true, ... }`.

Add any static child navigation nodes needed for Accounts, Activity and Compliance with `parentId:'pay'`. Import and mount `PayRoutes` in the existing App router using the repository's nested-route pattern. Add visible Pay links to Enterprise Home and Finance Home.

- [ ] **Step 4: Run focused tests plus navigation verifier**

Run:
`npx vitest run tests/unit/atlas-suite-registry.test.ts tests/unit/atlas-pay-routing.test.ts && npm run verify:navigation`

Expected: PASS.

- [ ] **Step 5: Commit**

`git add apps/web/src/modules/registry.ts apps/web/src/navigation/atlasNavigation.ts apps/web/src/App.tsx tests/unit/atlas-suite-registry.test.ts tests/unit/atlas-pay-routing.test.ts && git commit -m "feat(pay): register canonical ATLAS Pay routes"`

### Task 6: Add fail-closed release verification for ATLAS Pay

**Files:**
- Create: `scripts/verify-atlas-pay.mjs`
- Modify: `package.json`
- Create: `tests/unit/atlas-pay-verifier.test.ts`

**Interfaces:**
- Consumes: source/migration files from Tasks 1–5.
- Produces: `npm run verify:pay`, a static release gate that fails if required Pay routes, auth boundary, tables/RLS, registry state, or truthfulness markers regress.

- [ ] **Step 1: Write failing verifier test**

Assert the script checks required source paths/markers, rejects missing `RequireAtlasIdentity`, verifies all four RLS tables, checks `external-gated`, and confirms the UI contains no hard-coded sample balances/account-number fixtures.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npx vitest run tests/unit/atlas-pay-verifier.test.ts`

Expected: FAIL until verifier/script registration exists.

- [ ] **Step 3: Implement verifier and package command**

Add `"verify:pay": "node scripts/verify-atlas-pay.mjs"`. Keep it deterministic and source-based; it must not claim live provider verification.

- [ ] **Step 4: Run Pay verifier and focused test**

Run: `npm run verify:pay && npx vitest run tests/unit/atlas-pay-verifier.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

`git add scripts/verify-atlas-pay.mjs package.json tests/unit/atlas-pay-verifier.test.ts && git commit -m "test(pay): add fail-closed release verifier"`

### Task 7: Run full verification and remediate regressions

**Files:**
- Modify only files required by failing checks.

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: branch-level verification evidence.

- [ ] **Step 1: Run typecheck and focused Pay suite**

Run:
`npm run typecheck && npx vitest run tests/unit/atlas-pay-*.test.ts tests/unit/atlas-pay-*.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run repository unit and integration suites**

Run:
`npm run test:unit && npm run test:integration`

Expected: PASS. Fix only regressions attributable to this branch.

- [ ] **Step 3: Run design, navigation, Pay verifier and build**

Run:
`npm run verify:design && npm run verify:navigation && npm run verify:pay && npm run build`

Expected: PASS.

- [ ] **Step 4: Run `npm run verify:all` when environment permits**

Expected: PASS, or record the exact pre-existing/environmental blocker without mislabeling the branch as fully verified.

- [ ] **Step 5: Commit verification fixes if any**

Use a focused message such as `fix(pay): close verification regressions`.

### Task 8: Open PR and verify CI without claiming provider readiness

**Files:** no product-code requirement unless CI exposes a branch-specific regression.

**Interfaces:**
- Consumes: verified branch from Task 7.
- Produces: reviewable PR targeting `main` with evidence and explicit external-provider boundary.

- [ ] **Step 1: Open PR**

Title: `feat(pay): add ATLAS Global Accounts foundation`.

Body must summarize routes, persistence/RLS, truthfulness behavior, tests run, and state clearly that live provider money movement remains external-gated.

- [ ] **Step 2: Inspect PR CI/check status**

Use GitHub workflow/status evidence for the PR head SHA.

- [ ] **Step 3: Repair branch-specific failures**

For each failing check, inspect logs, fix root cause, re-run the focused gate, commit, and re-check CI. Do not repeatedly rerun an unchanged failing workflow.

- [ ] **Step 4: Merge only when required branch checks are green and no unresolved review/security blockers remain**

Do not treat merge as production verification.

- [ ] **Step 5: Post-merge production verification boundary**

Run the repository's canonical Cloudflare/global production verification process. Verify the public/protected domain behavior and `/pay` route availability as permitted by access controls. If deployment, Supabase migration, authentication, or provider evidence is missing, report that precise boundary and do not claim ATLAS Pay production-live.
