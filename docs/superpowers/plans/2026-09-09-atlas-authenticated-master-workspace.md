# ATLAS Authenticated Master Workspace Implementation Plan

> **For Winder:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a secure `/identity` → `/app` authenticated workspace, a single governed 18-module product catalog, master/owner-aware shell behavior, route compatibility, and verified deployment gates without replacing the public site or fabricating module readiness.

**Architecture:** Reuse the A-Z React/Vite application, Supabase v2 identity context, existing People/Finance/Accounting/Revenue/Health/Voice/Release modules, and ATLAS Forge. Authentication stays in Supabase Auth. The shell and launcher share one typed module catalog. Canonical `/app/*` routes are added as aliases/adapters while legacy routes remain valid. Missing domain depth is split into later module-specific implementation plans.

**Tech Stack:** React 19, TypeScript, React Router, Supabase JS/Auth/Postgres/RLS/RPC, Vitest, Playwright, GitHub Actions/ATLAS Forge, Cloudflare release path.

---

## Task 1: Establish RED evidence for the identity boundary

**Files:**
- Verify: `tests/unit/atlas-identity-navigation.test.ts`
- Create: `tests/unit/atlas-auth-session.test.ts`
- Create: `tests/integration/atlas-authenticated-app.test.tsx`

**Step 1: Confirm the existing identity navigation test is RED**

The integration branch currently imports `apps/web/src/identity/IdentityPage` while that file is absent. Run the canonical test gate and confirm the failure is specifically the missing identity implementation, not an unrelated syntax/configuration error.

Run: `npm run test:unit -- tests/unit/atlas-identity-navigation.test.ts`
Expected: FAIL because `IdentityPage` cannot be resolved.

**Step 2: Add a focused auth-action test**

Test desired behavior through an injected identity source/session action contract:
- `signIn(email, password)` delegates to Supabase Auth.
- password is not returned or copied into identity state.
- `signOut()` delegates to Supabase Auth.

Run the focused test and confirm RED because session actions do not exist yet.

**Step 3: Add integration acceptance for `/app`**

Render the router with a fake authenticated identity source and assert:
- `/identity` is publicly reachable,
- unauthenticated `/app` shows/signposts identity authentication,
- authenticated `/app` renders the ATLAS product launcher.

Run and confirm RED because `/app` and the launcher do not exist.

**Step 4: Commit RED tests**

Commit message: `test(identity): define authenticated app boundary`

## Task 2: Restore the secure Identity page and session actions

**Files:**
- Create: `apps/web/src/identity/IdentityPage.tsx`
- Create: `apps/web/src/identity/identity.css`
- Modify: `apps/web/src/app/AtlasContext.tsx`
- Modify: `apps/web/src/lib/supabase/atlasIdentitySource.ts`
- Modify: `apps/web/src/app/router/AppRouter.tsx`
- Test: `tests/unit/atlas-identity-navigation.test.ts`
- Test: `tests/unit/atlas-auth-session.test.ts`

**Step 1: Implement minimal source session actions**

Extend `AtlasIdentitySource` with `signIn(email, password)` and `signOut()` methods backed by `client.auth.signInWithPassword` and `client.auth.signOut`. Do not include passwords in returned state, thrown messages, logs, analytics or application storage.

**Step 2: Add a separate session-actions context**

Keep existing `useAtlasContext()` compatible. Add `useAtlasSessionActions()` so current module consumers do not need refactoring.

**Step 3: Implement `/identity`**

Create the secure sign-in form with email/password inputs, loading/error states, safe return target handling, and redirect after successful identity resolution. Safe target prefixes must include `/app` plus supported legacy routes; external/protocol-relative/backslash/recursive identity targets fail closed.

**Step 4: Run focused tests**

Run:
- `npm run test:unit -- tests/unit/atlas-identity-navigation.test.ts`
- `npm run test:unit -- tests/unit/atlas-auth-session.test.ts`
Expected: PASS.

**Step 5: Commit**

Commit message: `feat(identity): restore secure authenticated entry`

## Task 3: Create the canonical 18-module catalog

**Files:**
- Create: `apps/web/src/app/modules/moduleCatalog.ts`
- Create: `tests/unit/atlas-module-catalog.test.ts`

**Step 1: Write RED catalog test**

Assert exactly 18 unique product IDs/display names and canonical `/app/*` routes for:
ATLAS HR, Payroll, Finance, ERP, Pay & Wallet, Health, Education, Analytics, Connect, Documents, Knowledge Atlas, Security, Identity, Projects, Studio, Workbench, RideOS, Global.

Also assert no duplicate route and no duplicate product ID.

Run: `npm run test:unit -- tests/unit/atlas-module-catalog.test.ts`
Expected: FAIL because catalog does not exist.

**Step 2: Implement minimal typed catalog**

Each entry contains product metadata, canonical route, legacy destination/adaptor where applicable, permission hints, organization module codes and implementation state. Do not label blocked provider modules as live.

**Step 3: Run catalog test**
Expected: PASS.

**Step 4: Commit**

Commit message: `feat(app): add canonical ATLAS module catalog`

## Task 4: Build `/app` launcher and unified shell navigation

**Files:**
- Modify: `apps/web/src/modules/home/EnterpriseHome.tsx`
- Modify: `apps/web/src/app/AtlasShell.tsx`
- Modify: `apps/web/src/styles.css`
- Test: `tests/integration/atlas-authenticated-app.test.tsx`
- Create: `tests/integration/atlas-module-launcher.test.tsx`

**Step 1: Write RED launcher test**

Authenticated home must render one tile for each catalog entry and links must use canonical `/app/*` routes. Shell navigation and launcher must both derive from the same catalog.

**Step 2: Implement responsive launcher**

Preserve ATLAS visual intent from the approved reference: dark enterprise surface, three-column desktop grid, responsive collapse, category label, product name, short truthful description, hover/focus/active states.

**Step 3: Update shell**

Use the same module catalog for primary navigation. Preserve deeper existing operational links in module-local navigation rather than duplicating product identities in the global sidebar. Add signed-in organization/role context and sign-out action.

**Step 4: Run tests**

Run:
- `npm run test:integration -- tests/integration/atlas-authenticated-app.test.tsx`
- `npm run test:integration -- tests/integration/atlas-module-launcher.test.tsx`
Expected: PASS.

**Step 5: Commit**

Commit message: `feat(app): build authenticated ATLAS launcher`

## Task 5: Add canonical `/app/*` routes without breaking legacy paths

**Files:**
- Modify: `apps/web/src/app/router/AppRouter.tsx`
- Create: `apps/web/src/app/modules/ModuleGatewayPage.tsx`
- Create: `tests/integration/atlas-app-routes.test.tsx`

**Step 1: Write RED route matrix test**

For each 18-module canonical path assert one of:
- directly renders an existing implementation,
- redirects to an existing deeper implementation while staying inside authenticated ATLAS,
- renders a governed module gateway that reports actual configuration/implementation state and links to implemented subfunctions.

Also assert legacy `/finance`, `/people`, `/health`, `/operations`, `/voice`, `/telecom/...` still resolve.

**Step 2: Map implemented domains**

Initial route adapters:
- `/app/hr` → People home
- `/app/payroll` → People Payroll
- `/app/finance` → Finance home
- `/app/erp` → Revenue Ops / Operations
- `/app/health/*` → Health routes
- `/app/projects` → Projects capability exposed from Revenue Ops
- `/app/workbench` → governed operational/developer hub linking Release, Automations, Site Review, Spatial and Telecom surfaces
- `/app/studio` → governed Studio gateway with existing Voice capability when authorized

Other canonical module routes render `ModuleGatewayPage` with truthful backend/module status and only implemented actions. They are not marked production-complete by the existence of the gateway.

**Step 3: Run route test**
Expected: PASS.

**Step 4: Commit**

Commit message: `feat(app): map canonical module routes`

## Task 6: Surface organization module state without authorization shortcuts

**Files:**
- Create: `apps/web/src/lib/supabase/moduleStateRepository.ts`
- Modify: `apps/web/src/app/AtlasContext.tsx` or add `AtlasModuleStateProvider.tsx`
- Modify: `apps/web/src/app/modules/ModuleGatewayPage.tsx`
- Modify: `apps/web/src/modules/home/EnterpriseHome.tsx`
- Create: `tests/unit/atlas-module-state.test.ts`

**Step 1: Write RED state test**

Verify module visibility/status fails closed when:
- required permission is absent,
- organization module is disabled,
- provider/config state is blocked/unverified.

Master/owner role may see configuration/admin surfaces permitted by RBAC, but it must not convert blocked provider state into live state.

**Step 2: Implement read-only module state repository**

Read `organization_modules` through RLS for the active org. Normalize launch states into explicit UI states such as `available`, `configuration_required`, `blocked`, `not_enabled`.

**Step 3: Run tests**
Expected: PASS.

**Step 4: Commit**

Commit message: `feat(app): enforce governed module availability`

## Task 7: Backend bootstrap contract for the first real owner

**Files:**
- Create: `supabase/v2/pending/20260909_atlas_initial_owner_bootstrap_contract.sql` only if a new governed contract is required after schema inspection
- Create: `docs/superpowers/release/ATLAS_INITIAL_OWNER_BOOTSTRAP.md`
- Create: `supabase/v2/tests/initial-owner-bootstrap.e2e.sql` if SQL/RPC is introduced

**Step 1: Preserve current truth**

`atlas-core-v2` currently has zero real auth users/tenants/orgs. Do not insert directly into `auth.users` and do not fabricate an authenticated user.

**Step 2: Define the secure activation flow**

Preferred path:
1. deploy `/identity` capable of Supabase sign-up/password setup only if the project auth policy explicitly permits it, or use Supabase-hosted recovery/invite flow when available;
2. Winder enters the password directly in the secure Auth UI;
3. after a verified auth user exists, create/bootstrap the ATLAS tenant/org through the existing service-role-only bootstrap contract;
4. grant `owner` plus approved permissions through governed backend data;
5. verify identity context and RLS.

If the current connector cannot perform the provider-side invite/recovery action, stop only at that exact human/provider dependency; continue all code/deployment work independently.

**Step 3: Test any new bootstrap SQL before application**

A new SQL contract must have a failing E2E first, then migration, then passing E2E and Security Advisor = 0 findings.

**Step 4: Commit documentation/contract**

Commit message: `docs(identity): define initial owner activation gate`

## Task 8: Full foundation verification

**Files:**
- No production changes unless a failing test identifies a defect.

**Step 1: Run static and unit gates**

Run:
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:integration`
- `npm run build`

Expected: all PASS with no warnings that invalidate release readiness.

**Step 2: Run ATLAS Forge locally/CI-equivalent**

Run: `npm run forge:ci:local`
Expected: PASS.

**Step 3: Commit only if verification-related fixes were required**

Use one focused commit per defect, each preceded by a failing regression test.

## Task 9: PR and release/atlas-a-z gate

**Files:**
- GitHub PR only.

**Step 1: Open PR**

Head: `feat/atlas-app-master-modules`  
Base: `release/atlas-a-z`

PR must explicitly list:
- implemented foundation behavior,
- truth-state limitations,
- backend activation gate,
- tests run,
- no claim of production deployment.

**Step 2: Wait for ATLAS Release PR Forge Gate**

The workflow `.github/workflows/atlas-release-pr-forge-gate.yml` runs the canonical Forge pipeline on PRs to `release/atlas-a-z`.

**Step 3: Fix only evidence-backed failures**

Use systematic debugging and TDD. Do not merge with failing gate.

**Step 4: Merge only after green review/gates**

## Task 10: Module-completion program after foundation

The 18 modules are too large for one reliable implementation plan. After this foundation merges, create and execute independent plans in this order, reusing existing A-Z code and backend contracts:

1. Finance + Accounting completion
2. HR + Payroll completion
3. ERP + Projects + Analytics completion
4. Identity + Security completion
5. Documents + Knowledge Atlas + Education completion
6. Pay & Wallet completion
7. Connect completion
8. Studio completion
9. Workbench completion
10. RideOS completion
11. Health completion gates
12. Global completion

Each module plan must define its own data model/repository or reuse path, permissions, CRUD/actions, empty/error states, unit/integration/E2E tests, provider dependencies and production verification. A module is not marked complete until its plan passes those gates.

## Task 11: Production promotion and Cloudflare verification

Only after the required module-completion plans and release train pass:

1. promote verified integration state to `main`,
2. run production deployment workflow,
3. verify Cloudflare deployment artifact,
4. verify custom domain routing,
5. verify `/identity`, `/app`, representative deep links and `/healthz`,
6. complete Winder's secure auth activation if still pending,
7. verify owner/master access while confirming RLS still blocks unauthorized scope,
8. record evidence in ATLAS Manager.

Never call production complete based only on source, build, or a GitHub workflow starting.