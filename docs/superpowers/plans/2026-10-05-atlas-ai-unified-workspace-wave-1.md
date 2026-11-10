# ATLAS AI Unified Workspace Wave 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first production-safe ATLAS AI Unified Workspace foundation by unifying navigation across the existing Assistant, Work, Studio, AI Universe, Create, Library, Provider Readiness, and Voice surfaces without creating new data stores, provider registries, or placeholder routes.

**Architecture:** Extend the existing canonical `ATLAS_NAVIGATION_GRAPH` and `AtlasShell`; do not create a second navigation registry or replacement shell. Wave 1 derives an AI-workspace projection from the canonical graph, renders a responsive contextual navigation surface, preserves existing route/auth ownership, and expands the existing fail-closed production verification matrix to the real AI routes already implemented. Domain pages retain ownership of provider readiness, authorization, execution, persistence, and evidence.

**Tech Stack:** React 18.3.1, React Router, TypeScript 5.7, Vite 6.4.3, Vitest 5.0.1, Testing Library, existing ATLAS navigation/identity/RBAC contracts, GitHub Actions, Supabase authorized production verifier, Cloudflare Worker deployment.

**Spec:** `docs/superpowers/specs/2026-10-05-atlas-ai-unified-workspace-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`; integration target: `main`.
- At implementation start, branch from the then-current `main`. The spec branch was created from an earlier main SHA and must not be used as a stale product-code base.
- Reuse `apps/web/src/navigation/atlasNavigation.ts` as the single navigation graph. Do not create an independent `apps/web/src/ai-workspace/navigation.ts`.
- Reuse `apps/web/src/components/AtlasShell.tsx`. Wave 1 adds contextual navigation; it does not replace the global shell.
- Wave 1 exposes only implemented routes: `/assistant`, `/work`, `/studio`, `/studio/ai-universe`, `/studio/create`, `/studio/library`, `/studio/providers`, `/voice`, plus the existing `/studio/voice` compatibility surface.
- Do not add clickable placeholders for `/projects`, `/research`, `/skills`, `/agents`, `/canvas`, `/notebooks`, `/pages`, `/apps`, `/scheduled`, `/vision`, or `/developer`.
- Preserve `RequireAtlasIdentity`, organization/session scope, RLS, provider-readiness, cost-policy, audit, and fail-closed boundaries. Navigation visibility never grants permission.
- No browser component may claim a provider, action, asset, deployment, or route is ready from static metadata alone.
- Do not add an organization switcher in Wave 1. A future switcher must use a backend-authoritative selected organization on every request and invalidate organization-scoped caches.
- Keep Wave 1 search route-only. Future resource search must enforce tenant/RBAC filtering in the authoritative backend before result rows leave the backend.
- Do not implement Skills, Agents, Scheduled execution, external-action orchestration, or paid provider execution in this wave.
- Do not add new npm dependencies unless a proven blocker requires one.
- Desktop, tablet, and mobile representations derive from the same canonical AI-workspace projection.
- Production verification remains fail-closed and reuses the existing global verification contract, authorized Supabase verifier, Cloudflare exact-SHA workflow, health endpoint, HSTS/CSP checks, and canonical domain.
- No `href="#"`, console-only controls, fabricated metrics, fake readiness, or “Coming Soon” actions.

## Review Hardening Incorporated

1. **Navigation authority:** AI navigation is a projection of `ATLAS_NAVIGATION_GRAPH`, not a second registry.
2. **Search authorization:** Wave 1 searches routes only; later resource search is server-authorized before data is returned.
3. **Organization authority:** no client-only active-organization switcher is introduced.
4. **Agents/Skills versioning:** deferred; executable definitions must use immutable published versions/digests, never editable drafts.
5. **Scheduled reauthorization:** deferred; every future run must re-check membership, tenant access, app authorization, cost policy, approval state, and provider readiness immediately before execution.
6. **External idempotency:** deferred; future external side effects require a persisted execution intent/idempotency key before the provider call.

## Review Focus

- Unknown descendants fail closed; `/studio/create/missing` must not resolve as Create.
- `/studio/create?type=image` keeps its query for navigation while active matching uses pathname `/studio/create`.
- `/voice` remains the canonical Voice module; `/studio/voice` resolves to the same workspace purpose without a second Voice source of truth.
- No Wave 2–4 route becomes clickable merely because the design spec names it.
- Existing global route search, Assistant route context, module navigation, mobile drawer, accessibility, and identity display remain functional.
- Contextual AI navigation shows no fake readiness badges; destination pages remain authoritative.
- Production checks verify every real Wave 1 AI route against the exact deployed main SHA.

---

### Task 1: Derive Wave 1 AI navigation from the canonical graph

**Files:**
- Modify: `apps/web/src/navigation/atlasNavigation.ts`
- Modify: `tests/unit/atlas-navigation-intelligence.test.ts`
- Modify: `scripts/verify-navigation-intelligence.mjs`

**Produces:** one ordered Wave 1 AI projection and exact alias resolver derived from `ATLAS_NAVIGATION_GRAPH`.

- [ ] **Step 1 — RED:** Extend `tests/unit/atlas-navigation-intelligence.test.ts` to require:
  - canonical existing nodes `assistant`, `work`, `studio`, `voice`;
  - child nodes `ai-universe`, `studio-create`, `creator-library`, `provider-readiness` in the same graph;
  - real routes `/studio/ai-universe`, `/studio/create?type=image`, `/studio/library`, `/studio/providers`;
  - `/studio/voice` as an exact alias of the canonical Voice workspace purpose;
  - `/studio/create/missing`, `/projects`, `/skills`, and unknown paths unresolved;
  - resolvable parent IDs and no duplicate navigation IDs/exact canonical route keys.

Suggested exports:

```ts
export const ATLAS_AI_WORKSPACE_NODE_IDS = [
  'assistant', 'work', 'studio', 'ai-universe',
  'studio-create', 'creator-library', 'provider-readiness', 'voice'
] as const;
export const ATLAS_AI_WORKSPACE_NAVIGATION: readonly AtlasNavigationNode[];
export function getAtlasAIWorkspaceNode(pathname: string): AtlasNavigationNode | undefined;
export function isAtlasAIWorkspacePath(pathname: string): boolean;
```

- [ ] **Step 2:** Run:

```bash
npx vitest run tests/unit/atlas-navigation-intelligence.test.ts
```

Expected: FAIL because the Wave 1 child nodes/projection/resolver do not exist.

- [ ] **Step 3 — GREEN:** In `atlasNavigation.ts`, add only the required static child nodes, attach them to `studio`, keep the four canonical module nodes sourced from `ATLAS_MODULES`, add exact aliases where required, and derive `ATLAS_AI_WORKSPACE_NAVIGATION` from the canonical graph by stable IDs. Strip query/hash for matching only; preserve `to` for navigation. Never use broad prefix matching for aliases.

- [ ] **Step 4:** Extend `scripts/verify-navigation-intelligence.mjs` so it fails if the AI projection is independent of the canonical graph, required Wave 1 IDs are missing, represented routes cannot be found in canonical routing sources, planned later-wave IDs leak into Wave 1, or alias matching becomes prefix-open. Preserve all existing checks.

- [ ] **Step 5:** Run:

```bash
npx vitest run tests/unit/atlas-navigation-intelligence.test.ts
npm run verify:navigation
```

Expected: PASS.

- [ ] **Step 6:** Commit: `feat(ai): derive workspace navigation from canonical graph`

---

### Task 2: Add responsive contextual AI navigation to the existing AtlasShell

**Files:**
- Create: `apps/web/src/components/ai/AIWorkspaceNav.tsx`
- Modify: `apps/web/src/components/AtlasShell.tsx`
- Modify: `apps/web/src/styles.css`
- Create: `tests/integration/atlas-ai-workspace-shell.test.tsx`
- Modify: `tests/integration/atlas-shell-responsive.test.tsx`

- [ ] **Step 1 — RED:** Create Testing Library coverage proving the contextual nav renders on `/assistant`, `/work`, `/studio`, `/studio/ai-universe`, `/studio/create`, `/studio/library`, `/studio/providers`, `/voice`, `/studio/voice`; does not render on `/finance`; derives every item from the canonical projection; marks Create active on `/studio/create`; preserves `?type=image`; excludes later-wave destinations; and uses accessible real links.

- [ ] **Step 2:** Run:

```bash
npx vitest run tests/integration/atlas-ai-workspace-shell.test.tsx tests/integration/atlas-shell-responsive.test.tsx
```

Expected: FAIL because `AIWorkspaceNav` does not exist.

- [ ] **Step 3 — GREEN:** Implement `AIWorkspaceNav` with `NavLink`, `ATLAS_AI_WORKSPACE_NAVIGATION`, and `getAtlasAIWorkspaceNode(location.pathname)`. Use `<nav aria-label="ATLAS AI workspace">`. Do not add readiness badges or inert actions.

- [ ] **Step 4:** Integrate it contextually into `AtlasShell` using `isAtlasAIWorkspacePath(location.pathname)`. Preserve the existing global sidebar, route search, organization display, top actions, accessibility tooling, and `AtlasAssistant`; preserve Voice assistant-surface ownership and existing session resolution.

- [ ] **Step 5:** Add responsive styling: compact secondary bar on desktop/tablet, scrollable/wrapping bar on mobile, visible keyboard focus, reduced-motion-safe behavior, and no color-only state semantics. Do not add a second full-screen mobile drawer.

- [ ] **Step 6:** Run:

```bash
npx vitest run tests/integration/atlas-ai-workspace-shell.test.tsx tests/integration/atlas-shell-responsive.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7:** Commit: `feat(ai): add responsive unified workspace navigation`

---

### Task 3: Lock route ownership and authentication boundaries

**Files:**
- Create: `tests/integration/atlas-ai-workspace-routes.test.ts`
- Modify: `scripts/verify-navigation-intelligence.mjs`
- Modify routing product files only if the test exposes a real inconsistency.

- [ ] **Step 1 — RED:** Create a source-contract test that asserts `/assistant`, `/work`/`/work/*`, and `/voice`/`/voice/*` retain their existing `RequireAtlasIdentity` routing; Studio Wave 1 child routes remain represented by the current Studio auth model; every Wave 1 destination is backed by a real route; no later-wave route is required; `AIWorkspaceNav.tsx` contains no placeholder action; and `scripts/verify-navigation-intelligence.mjs` exports/evaluates an explicit Wave 1 route-representation check such as `aiWorkspaceRoutesRepresented`.

- [ ] **Step 2:** Run:

```bash
npx vitest run tests/integration/atlas-ai-workspace-routes.test.ts
```

Expected: FAIL specifically because the verifier does not yet expose the new `aiWorkspaceRoutesRepresented` contract.

- [ ] **Step 3 — GREEN:** Extend the existing verifier to evaluate the full Wave 1 route set against `App.tsx`, `resolveAtlasExtension.tsx`, and established route sources. Repair `App.tsx`/resolver only if the test proves a real missing/unprotected route. Do not create wrapper pages merely to satisfy the test.

- [ ] **Step 4:** Run:

```bash
npx vitest run tests/integration/atlas-ai-workspace-routes.test.ts tests/unit/atlas-navigation-intelligence.test.ts
npm run verify:navigation
```

Expected: PASS.

- [ ] **Step 5:** Commit: `test(ai): lock down existing workspace routes`

---

### Task 4: Preserve discovery, trails, aliases, and Creator query intent

**Files:**
- Modify: `tests/unit/atlas-navigation-intelligence.test.ts`
- Modify: `apps/web/src/navigation/atlasNavigation.ts` only if tests expose a gap.

- [ ] **Step 1 — RED:** Add cases requiring:
  - `searchAtlasNavigation('AI chat')` → Assistant;
  - `searchAtlasNavigation('image')`/`create` → Create;
  - `searchAtlasNavigation('provider readiness')` → `/studio/providers`;
  - `/studio/library` trail → Home → Creator/Studio → Library;
  - `/studio/ai-universe` has a Studio parent;
  - `/studio/create` resolves to Create while its link remains `/studio/create?type=image`;
  - `/studio/create/missing` remains unresolved;
  - all prior accounting/GPS/accessibility/search cases still pass.

- [ ] **Step 2:** Run `npx vitest run tests/unit/atlas-navigation-intelligence.test.ts` and verify RED if normalization/search does not yet cover the new child nodes.

- [ ] **Step 3 — GREEN:** Implement only the normalization/search changes needed by the failing cases. Keep search route-only; do not aggregate tenant data.

- [ ] **Step 4:** Run:

```bash
npx vitest run tests/unit/atlas-navigation-intelligence.test.ts
npm run verify:navigation
```

Expected: PASS.

- [ ] **Step 5:** Commit: `test(ai): preserve workspace discovery and trails`

---

### Task 5: Add Wave 1 AI routes to fail-closed exact-SHA production verification

**Files:**
- Create: `tests/unit/atlas-ai-production-verification.test.ts`
- Modify: `data/ops/global-production-verification.json`
- Modify: `supabase/functions/atlas-cloudflare-production-http-verify/index.ts`
- Modify: `.github/workflows/cloudflare-deploy.yml`
- Modify: `.github/workflows/global-production-verify.yml` only if its existing authorized-verifier result contract needs the new aggregate.

**Wave 1 route set:**

```text
/assistant
/work
/studio
/studio/ai-universe
/studio/create
/studio/library
/studio/providers
/studio/voice
/voice
```

`/assistant`, `/work`, `/studio`, and `/voice` already exist in the global production route contract. The missing Studio child routes must be added and then verified as part of one Wave 1 aggregate.

- [ ] **Step 1 — RED:** Create `tests/unit/atlas-ai-production-verification.test.ts` asserting:
  - global mode remains fail-closed;
  - every Wave 1 route occurs exactly once in the applicable production route set;
  - the authorized verifier explicitly probes every Wave 1 route;
  - the verifier exposes `ai_workspace_routes_reachable` (or an equivalently explicit named boolean) true only when every Wave 1 route succeeds;
  - exact deployment version evidence remains required;
  - Cloudflare direct-Wrangler verification probes the same route set and fails on any missing route;
  - existing Work/global/CRM/network production assertions remain intact.

- [ ] **Step 2:** Run:

```bash
npx vitest run tests/unit/atlas-ai-production-verification.test.ts
```

Expected: FAIL because `/studio/ai-universe`, `/studio/create`, `/studio/library`, `/studio/providers`, and `/studio/voice` are not yet all represented/probed.

- [ ] **Step 3 — GREEN:** Increment the global contract version once and add only the missing Wave 1 routes. Preserve canonical origin, `/api/v1/health`, HSTS, CSP, and `default_mode: "fail-closed"`.

- [ ] **Step 4:** Increment the authorized verifier version; add the missing probes; compute a fail-closed AI-workspace aggregate; include the routes in exact-version verification; preserve GitHub OIDC scope, same-origin redirect safety, Work, CRM/network, canonical route, and deployment-manifest checks.

- [ ] **Step 5:** Extend `.github/workflows/cloudflare-deploy.yml` to use its existing `probe_worker` helper for every Wave 1 route, assert each route’s version tag equals `$GITHUB_SHA`, emit `ai_workspace_routes_reachable=true` only after all pass, and fail when direct or authorized runtime verification reports false. If `global-production-verify.yml` consumes named booleans, add the matching assertion there instead of creating another workflow.

- [ ] **Step 6:** Run:

```bash
npx vitest run tests/unit/atlas-ai-production-verification.test.ts tests/unit/work-production-verification.test.ts
npm run verify:navigation
```

Expected: PASS.

- [ ] **Step 7:** Commit: `ci(ai): verify unified workspace production routes`

---

### Task 6: Full verification, implementation PR, CI, merge, deploy, and E2E proof

**Files:** No planned product files; repair only failures proven by tests/CI.

- [ ] **Step 1:** Before Task 1 implementation, create `feat/atlas-ai-unified-workspace-wave-1` from the then-current `main`. Bring approved docs into the implementation history without force-updating shared branches; resolve conflicts against newer main rather than overwriting newer code.

- [ ] **Step 2:** Run the focused suite:

```bash
npx vitest run \
  tests/unit/atlas-navigation-intelligence.test.ts \
  tests/integration/atlas-ai-workspace-shell.test.tsx \
  tests/integration/atlas-shell-responsive.test.tsx \
  tests/integration/atlas-ai-workspace-routes.test.ts \
  tests/unit/atlas-ai-production-verification.test.ts \
  tests/unit/work-production-verification.test.ts
```

- [ ] **Step 3:** Run canonical gates:

```bash
npm ci
npm run verify:navigation
npm run typecheck
npm test
npm run build
npm run verify:all
```

Expected: all executable required gates PASS. Classify runner/provider outages truthfully; do not infer application success/failure without executed evidence.

- [ ] **Step 4:** Open implementation PR titled `feat(ai): unify ATLAS AI workspace navigation`. State that Wave 1 reuses existing routes/owners, creates no later-wave placeholders, creates no second navigation/provider/data architecture, expands production verification, and list actual focused/full gate results.

- [ ] **Step 5:** Required CI must be green on the exact implementation head. Repair real failures/review findings and rerun focused plus full gates.

- [ ] **Step 6:** Merge only the verified exact head into `main`; never force-push main.

- [ ] **Step 7:** Verify the canonical `cloudflare-deploy.yml` flow deploys the merged main SHA and exact version headers/AI aggregate match it.

- [ ] **Step 8:** Run canonical fail-closed public verification, including `npm run verify:production:global` and/or the credentialed exact-SHA workflow where production credentials are required.

Required P0 evidence:
- `https://www.atlasenterprisesuite.com/` reachable;
- `/api/v1/health` healthy;
- HSTS and CSP present;
- every Wave 1 route reaches the deployed ATLAS shell;
- exact-version workflow proves the merged SHA on all checked routes;
- no route passes through fabricated readiness/placeholder content;
- existing Work, CRM, Network, Finance, Health, and canonical production gates remain green.

Any P0 route, security-header, health, or exact-SHA failure is blocking until repaired and rerun.

- [ ] **Step 9:** Record branch/commit SHAs, implementation PR, CI evidence, merge SHA, Cloudflare deployment evidence, production verification, and any non-blocking P1 warnings.

---

## Deferred Waves — Mandatory Security Contracts

### Wave 2 — Projects / Research / Skills / Agents / Canvas / Notebooks / Pages / Apps
- Resource search is tenant/RBAC-filtered server-side before rows are returned.
- Organization/context switching is backend-authoritative and invalidates organization-scoped caches.
- Skills use immutable approved/published versions/digests; edits create a new draft/version requiring approval.
- Agents execute immutable published versions and pin exact skill/app-policy versions/digests.

### Wave 3 — Scheduled / Live / Vision / unified history
- Every scheduled run reauthorizes membership, tenant access, app/plugin authorization, cost policy, approvals, and provider readiness immediately before action.
- Revocation between task creation and run time blocks execution and records evidence.

### Any wave creating external side effects
- Persist execution intent and unique idempotency key before the provider/network side effect.
- Retries reuse the same idempotency identity and reconcile provider evidence instead of silently repeating an action.

### Wave 4 — Developer convergence
- Developer actions reuse existing GitHub/Deploy/release-control policy and production evidence; no alternate deployment authority is created.
