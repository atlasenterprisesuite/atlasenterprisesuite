# ATLAS AI Unified Workspace Wave 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first production-safe ATLAS AI Unified Workspace foundation by unifying navigation across existing Assistant, Work, Studio, AI Universe, Create, Library, Provider Readiness, and Voice surfaces without creating new data stores, provider registries, or placeholder routes.

**Architecture:** Extend the existing canonical `ATLAS_NAVIGATION_GRAPH` and existing `AtlasShell`; do not create a second navigation registry or replacement shell. Wave 1 derives an AI-workspace projection from the canonical graph, renders a responsive contextual navigation surface, preserves every existing route/auth boundary, and expands the existing fail-closed production verification matrix to the real AI routes already implemented. Domain pages keep ownership of provider readiness, data loading, authorization, execution, persistence, and evidence.

**Tech Stack:** React 18.3.1, React Router, TypeScript 5.7, Vite 6.4.3, Vitest 5.0.1, Testing Library, existing ATLAS navigation/identity/RBAC contracts, GitHub Actions, Supabase authorized production verifier, Cloudflare Worker deployment.

**Spec:** `docs/superpowers/specs/2026-10-05-atlas-ai-unified-workspace-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`; canonical integration branch: `main`.
- At implementation start, branch from the then-current `main`. The spec branch was created from an earlier main SHA and must not be used as a stale product-code base.
- Reuse `apps/web/src/navigation/atlasNavigation.ts` as the one navigation graph. Do not create an independent `apps/web/src/ai-workspace/navigation.ts` or any competing route source of truth.
- Reuse `apps/web/src/components/AtlasShell.tsx`. Wave 1 adds a contextual workspace navigation component; it does not replace the global shell.
- Wave 1 exposes only routes that already have real implementations: `/assistant`, `/work`, `/studio`, `/studio/ai-universe`, `/studio/create`, `/studio/library`, `/studio/providers`, `/voice`, and the existing `/studio/voice` compatibility surface.
- Do not add clickable placeholders for `/projects`, `/research`, `/skills`, `/agents`, `/canvas`, `/notebooks`, `/pages`, `/apps`, `/scheduled`, `/vision`, or `/developer` in Wave 1.
- Preserve existing `RequireAtlasIdentity`, organization/session, RLS, provider-readiness, cost-policy, audit, and fail-closed boundaries. Navigation visibility never grants permission.
- No browser component may claim a provider, model, action, asset, deployment, or route is ready based on static metadata alone.
- Do not add an organization switcher in Wave 1. A future switcher must use an authoritative selected-organization ID on every backend request and clear organization-scoped caches on switch.
- Keep Wave 1 global search route-only. Do not aggregate conversations, assets, projects, notebooks, skills, agents, or other tenant data in browser-side search. Future resource search must enforce tenant/RBAC filtering in the authoritative backend before results are returned to the client.
- Do not implement Skills, Agents, Scheduled execution, external-action orchestration, or paid provider execution in this wave. Later plans must incorporate immutable published versions, execution-time reauthorization, and persisted idempotency intent before any external side effect.
- Do not add new npm dependencies unless a real implementation blocker proves one is required.
- Desktop, tablet, and mobile representations must derive from the same canonical AI-workspace projection.
- Production verification remains fail-closed and uses the existing global verification contract, authorized Supabase verifier, Cloudflare exact-SHA workflow, health endpoint, HSTS/CSP checks, and canonical domain.
- No `href="#"`, console-only controls, fabricated metrics, fake loading, fake readiness, or “Coming Soon” actions.

## Reviewer Hardening Incorporated

The implementation must preserve these review decisions:

1. **Navigation authority:** AI navigation is a projection of `ATLAS_NAVIGATION_GRAPH`, not a second registry.
2. **Search authorization:** Wave 1 searches routes only; later resource search must be server-authorized before data leaves the backend.
3. **Organization authority:** no client-only active-organization switcher is introduced.
4. **Agents/Skills versioning:** deferred to their implementation wave; executable definitions must be immutable published versions/digests, never editable drafts.
5. **Scheduled reauthorization:** deferred; each future run must re-check current membership, tenant access, app authorization, cost policy, and approval state immediately before execution.
6. **External idempotency:** deferred; future provider/action calls require a persisted intent/idempotency key before the external call.

## Review Focus

- Unknown and descendant routes fail closed; `/studio/create/missing` must not resolve as Create.
- Query-bearing destinations such as `/studio/create?type=image` preserve their query when navigating while active-state matching uses the pathname `/studio/create`.
- `/voice` remains the canonical Voice module; `/studio/voice` may resolve as the same workspace purpose without creating a second Voice source of truth.
- No Wave 2–4 route becomes clickable merely because the design spec names it.
- Existing global route search, Assistant route context, module navigation, mobile drawer, accessibility, and identity display continue working.
- The contextual AI workspace nav adds no fake readiness badges; individual pages remain authoritative for capability state.
- Production checks must verify every real Wave 1 AI route against the exact deployed main SHA.

---

### Task 1: Derive the Wave 1 AI workspace from the canonical navigation graph

**Files:**
- Modify: `apps/web/src/navigation/atlasNavigation.ts`
- Modify: `tests/unit/atlas-navigation-intelligence.test.ts`
- Modify: `scripts/verify-navigation-intelligence.mjs`

**Interfaces:**
- Consumes: existing `ATLAS_MODULES`, `ATLAS_NAVIGATION_GRAPH`, route normalization, and canonical module nodes.
- Produces: a canonical AI-workspace projection and exact alias resolver without introducing a second registry.

- [ ] **Step 1: Write failing navigation tests**

Extend `tests/unit/atlas-navigation-intelligence.test.ts` to require:

- the ordered Wave 1 workspace destinations to be derived from canonical graph nodes;
- existing `assistant`, `work`, `studio`, and `voice` module nodes to remain the parent/canonical module entries;
- child nodes for `AI Universe`, `Create`, `Library`, and `Provider Readiness` to live in the same `ATLAS_NAVIGATION_GRAPH` and point to real Studio routes;
- `Create` to navigate to `/studio/create?type=image` while matching pathname `/studio/create`;
- `/studio/voice` to resolve to the existing Voice workspace purpose/alias rather than a duplicate independent Voice node;
- `/studio/create/missing`, `/projects`, `/skills`, and arbitrary unknown routes to return no AI-workspace match;
- all AI child `parentId` references to be resolvable;
- no duplicate navigation IDs or exact canonical route keys.

Suggested exported contract:

```ts
export const ATLAS_AI_WORKSPACE_NODE_IDS = [
  'assistant',
  'work',
  'studio',
  'ai-universe',
  'studio-create',
  'creator-library',
  'provider-readiness',
  'voice'
] as const;

export const ATLAS_AI_WORKSPACE_NAVIGATION: readonly AtlasNavigationNode[];
export function getAtlasAIWorkspaceNode(pathname: string): AtlasNavigationNode | undefined;
export function isAtlasAIWorkspacePath(pathname: string): boolean;
```

Extend `AtlasNavigationNode` only as needed with fields such as `aliases?: readonly string[]`; do not introduce a separate navigation type hierarchy solely for Wave 1.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
npx vitest run tests/unit/atlas-navigation-intelligence.test.ts
```

Expected: FAIL because the Wave 1 child nodes/projection/resolver do not yet exist.

- [ ] **Step 3: Implement the smallest canonical graph extension**

In `apps/web/src/navigation/atlasNavigation.ts`:

- add static child nodes for `/studio/ai-universe`, `/studio/create?type=image`, `/studio/library`, and `/studio/providers`;
- attach them to the existing `studio` parent;
- keep `assistant`, `work`, `studio`, and `voice` sourced from `ATLAS_MODULES`;
- add exact aliases only where an already-existing compatibility route requires them, including `/studio/voice` for the canonical Voice workspace purpose;
- derive `ATLAS_AI_WORKSPACE_NAVIGATION` from `ATLAS_NAVIGATION_GRAPH` by stable node IDs;
- normalize matching by pathname, stripping query/hash for matching only while preserving the destination `to` value for navigation;
- require exact alias/path matches; never use a broad prefix that would make unknown descendants look valid.

Do not modify provider readiness, data APIs, auth, or execution code.

- [ ] **Step 4: Strengthen the static navigation verifier**

Update `scripts/verify-navigation-intelligence.mjs` so it fails when:

- the AI-workspace projection is not derived from the canonical graph;
- required Wave 1 node IDs are missing;
- a child node points to a route not represented by `App.tsx`, `resolveAtlasExtension.tsx`, or an established canonical route;
- planned Wave 2–4 routes are inserted into the Wave 1 projection;
- alias resolution becomes prefix-open instead of exact/fail-closed.

Keep all existing navigation verifier checks.

- [ ] **Step 5: Run focused verification and verify GREEN**

```bash
npx vitest run tests/unit/atlas-navigation-intelligence.test.ts
npm run verify:navigation
```

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message:

```text
feat(ai): derive workspace navigation from canonical graph
```

---

### Task 2: Add responsive contextual AI workspace navigation to the existing AtlasShell

**Files:**
- Create: `apps/web/src/components/ai/AIWorkspaceNav.tsx`
- Modify: `apps/web/src/components/AtlasShell.tsx`
- Modify: `apps/web/src/styles.css`
- Create: `tests/integration/atlas-ai-workspace-shell.test.tsx`
- Modify: `tests/integration/atlas-shell-responsive.test.tsx`

**Interfaces:**
- Consumes: `ATLAS_AI_WORKSPACE_NAVIGATION`, `getAtlasAIWorkspaceNode`, `isAtlasAIWorkspacePath`, React Router location/navigation.
- Produces: one contextual, accessible, responsive AI workspace navigation surface inside the existing shell.

- [ ] **Step 1: Write the failing shell tests**

Create `tests/integration/atlas-ai-workspace-shell.test.tsx` with Testing Library + `MemoryRouter` coverage that verifies:

- the contextual nav renders on `/assistant`, `/work`, `/studio`, `/studio/ai-universe`, `/studio/create`, `/studio/library`, `/studio/providers`, `/voice`, and `/studio/voice`;
- it does not render on unrelated routes such as `/finance`;
- every item comes from the canonical Wave 1 projection;
- `/studio/create` marks Create active and its link preserves `?type=image`;
- the nav does not contain Projects, Skills, Agents, Scheduled, Vision, Developer, or other unimplemented Wave 2–4 destinations;
- the nav has an accessible label and active-route semantics;
- navigation controls are real links, not placeholders.

Extend `tests/integration/atlas-shell-responsive.test.tsx` to require a responsive AI-workspace navigation contract without weakening the existing mobile drawer checks.

- [ ] **Step 2: Run the focused shell tests and verify RED**

```bash
npx vitest run tests/integration/atlas-ai-workspace-shell.test.tsx tests/integration/atlas-shell-responsive.test.tsx
```

Expected: FAIL because `AIWorkspaceNav` is not implemented.

- [ ] **Step 3: Implement `AIWorkspaceNav`**

Create `apps/web/src/components/ai/AIWorkspaceNav.tsx`:

- render `NavLink` items from `ATLAS_AI_WORKSPACE_NAVIGATION` only;
- determine selected state with `getAtlasAIWorkspaceNode(location.pathname)`;
- do not show readiness/connected badges;
- use semantic `<nav aria-label="ATLAS AI workspace">`;
- preserve destination queries;
- expose no click handler that only logs or simulates navigation.

- [ ] **Step 4: Integrate into the existing shell**

Modify `AtlasShell.tsx` so:

- `AIWorkspaceNav` renders contextually when `isAtlasAIWorkspacePath(location.pathname)` is true;
- the existing global sidebar, search, organization display, top actions, accessibility tooling, and `AtlasAssistant` remain intact;
- Voice’s existing assistant-surface ownership rule remains intact;
- no second account/session resolver is introduced.

- [ ] **Step 5: Add responsive styling**

In `styles.css`:

- desktop/tablet: render a compact secondary workspace bar beneath the existing topbar or immediately before main content;
- mobile: allow horizontal scrolling/wrapping without introducing a second full-screen drawer;
- preserve keyboard focus visibility;
- provide reduced-motion-safe transitions using existing accessibility classes/media behavior;
- do not encode state by color alone.

- [ ] **Step 6: Run focused tests and verify GREEN**

```bash
npx vitest run tests/integration/atlas-ai-workspace-shell.test.tsx tests/integration/atlas-shell-responsive.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

Commit message:

```text
feat(ai): add responsive unified workspace navigation
```

---

### Task 3: Lock existing route ownership and authentication boundaries

**Files:**
- Create: `tests/integration/atlas-ai-workspace-routes.test.ts`
- Modify: `scripts/verify-navigation-intelligence.mjs`
- Modify product routing files only if the new test exposes a real existing inconsistency; do not rewrite routes preemptively.

**Interfaces:**
- Consumes: `apps/web/src/App.tsx`, `apps/web/src/extensions/resolveAtlasExtension.tsx`, existing `RequireAtlasIdentity` boundaries.
- Produces: a regression contract proving Wave 1 navigation points only to implemented and protected surfaces.

- [ ] **Step 1: Write the failing route contract**

Create `tests/integration/atlas-ai-workspace-routes.test.ts` that reads the canonical routing sources and asserts:

- `/assistant` resolves through the existing authenticated Assistant route;
- `/work` and `/work/*` remain behind existing Work identity protection;
- `/voice` and `/voice/*` remain behind existing Voice identity protection;
- `/studio`, `/studio/ai-universe`, `/studio/create`, `/studio/library`, `/studio/providers`, and `/studio/voice` remain represented by the current Studio routing/auth model;
- every canonical Wave 1 AI destination is backed by a represented route;
- no Wave 2–4 route is required by the Wave 1 nav contract;
- `AIWorkspaceNav.tsx` contains no `href="#"` or inert fake actions.

- [ ] **Step 2: Run the route test and verify RED where the verifier lacks the new contract**

```bash
npx vitest run tests/integration/atlas-ai-workspace-routes.test.ts
```

Expected: FAIL until the navigation verifier exposes/validates the full Wave 1 route set.

- [ ] **Step 3: Extend route verification, not route architecture**

Update `scripts/verify-navigation-intelligence.mjs` to evaluate Wave 1 route representation against current `App.tsx`, `resolveAtlasExtension.tsx`, and canonical route sources.

Only if the test proves an existing real route is unprotected or missing may `App.tsx`/`resolveAtlasExtension.tsx` be repaired. Preserve route ownership and page components; do not create wrapper pages merely to satisfy the test.

- [ ] **Step 4: Run route + navigation gates**

```bash
npx vitest run tests/integration/atlas-ai-workspace-routes.test.ts tests/unit/atlas-navigation-intelligence.test.ts
npm run verify:navigation
```

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message:

```text
test(ai): lock down existing workspace routes
```

---

### Task 4: Preserve discovery, trails, aliases, and Creator query intent

**Files:**
- Modify: `tests/unit/atlas-navigation-intelligence.test.ts`
- Modify: `apps/web/src/navigation/atlasNavigation.ts` only if the new tests expose a gap.

**Interfaces:**
- Consumes: canonical graph search/trail helpers plus Wave 1 AI resolver.
- Produces: deterministic route discovery and breadcrumbs without weakening fail-closed exact matching.

- [ ] **Step 1: Add failing discovery/trail cases**

Add tests for:

- `searchAtlasNavigation('AI chat')` returns Assistant;
- `searchAtlasNavigation('image')` and/or `searchAtlasNavigation('create')` discovers the real Create node;
- `searchAtlasNavigation('provider readiness')` discovers `/studio/providers`;
- `getAtlasNavigationTrail('/studio/library')` produces a real Home → Creator/Studio → Library trail;
- `getAtlasNavigationTrail('/studio/ai-universe')` has a valid Studio parent;
- `getAtlasAIWorkspaceNode('/studio/create')` returns the Create node while its navigation destination remains `/studio/create?type=image`;
- `/studio/create/missing` and unknown descendants remain unresolved;
- all pre-existing accounting/GPS/accessibility/search cases continue passing.

- [ ] **Step 2: Run the navigation unit test**

```bash
npx vitest run tests/unit/atlas-navigation-intelligence.test.ts
```

Expected: RED if search/trail normalization does not yet account for the new canonical child nodes.

- [ ] **Step 3: Implement only the normalization/search changes required by the tests**

Keep the existing scoring model unless a concrete failing case requires a small extension. Do not turn route search into tenant-data search.

- [ ] **Step 4: Verify all navigation intelligence**

```bash
npx vitest run tests/unit/atlas-navigation-intelligence.test.ts
npm run verify:navigation
```

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message:

```text
test(ai): preserve workspace discovery and trails
```

---

### Task 5: Add the real Wave 1 AI routes to fail-closed exact-SHA production verification

**Files:**
- Create: `tests/unit/atlas-ai-production-verification.test.ts`
- Modify: `data/ops/global-production-verification.json`
- Modify: `supabase/functions/atlas-cloudflare-production-http-verify/index.ts`
- Modify: `.github/workflows/cloudflare-deploy.yml`
- Modify: `.github/workflows/global-production-verify.yml` only if its authorized-verifier result contract needs an explicit AI-workspace aggregate field.

**Interfaces:**
- Consumes: current global production contract, authorized Supabase HTTP verifier, Cloudflare exact-SHA workflow, canonical public origin.
- Produces: fail-closed production evidence for every real Wave 1 AI surface.

Wave 1 production route set:

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

The first four canonical top-level routes already participate in existing verification in part; this task adds the missing Studio child surfaces and treats the complete set as one governed contract.

- [ ] **Step 1: Write the failing production-verification test**

Create `tests/unit/atlas-ai-production-verification.test.ts` that reads the JSON contract, authorized verifier source, and Cloudflare workflow and asserts:

- the global contract remains `fail-closed`;
- all Wave 1 AI routes are present exactly once in the appropriate public verification route set;
- the authorized verifier probes every Wave 1 AI route;
- its aggregate result includes a dedicated `ai_workspace_routes_reachable` (or equivalently explicit named boolean) that is true only when every Wave 1 route returns the expected shell response;
- exact deployment version evidence (`x-atlas-version-id` / `x-atlas-version-tag` and production commit verification) remains required;
- Cloudflare direct-Wrangler verification probes all Wave 1 routes and fails when any one cannot be verified;
- existing Work/global/CRM/network production assertions are not removed.

- [ ] **Step 2: Run the focused production test and verify RED**

```bash
npx vitest run tests/unit/atlas-ai-production-verification.test.ts
```

Expected: FAIL because `/studio/ai-universe`, `/studio/create`, `/studio/library`, `/studio/providers`, and `/studio/voice` are not all represented in the current production matrix/verifiers.

- [ ] **Step 3: Extend the global contract**

Modify `data/ops/global-production-verification.json`:

- increment the contract version once;
- add the missing real Wave 1 routes without duplicating existing entries;
- preserve `https://www.atlasenterprisesuite.com`, `/api/v1/health`, HSTS, CSP, and `default_mode: "fail-closed"`.

- [ ] **Step 4: Extend the authorized production verifier**

Modify `supabase/functions/atlas-cloudflare-production-http-verify/index.ts`:

- increment its verifier version;
- add explicit probes for all missing Wave 1 Studio child routes;
- compute a single fail-closed AI-workspace route aggregate from all real Wave 1 routes;
- include those probes in exact-version verification so a stale/mixed deployment cannot pass;
- preserve same-origin redirect safety, GitHub OIDC scope, existing canonical route probes, Work checks, CRM/network checks, and deployment-manifest verification.

- [ ] **Step 5: Extend Cloudflare exact-SHA verification**

Modify `.github/workflows/cloudflare-deploy.yml` so the direct deployment path:

- calls the existing `probe_worker` helper for every Wave 1 AI route;
- asserts each returned version tag equals `$GITHUB_SHA`;
- emits `ai_workspace_routes_reachable=true` only after all AI route checks pass;
- makes the workflow fail closed if the authorized runtime or direct Worker check reports the AI workspace route aggregate false.

If `.github/workflows/global-production-verify.yml` consumes named authorized-verifier booleans, add the matching AI-workspace assertion there instead of inventing another verification workflow.

- [ ] **Step 6: Run focused production and regression tests**

```bash
npx vitest run tests/unit/atlas-ai-production-verification.test.ts tests/unit/work-production-verification.test.ts
npm run verify:navigation
```

Expected: PASS.

- [ ] **Step 7: Commit**

Commit message:

```text
ci(ai): verify unified workspace production routes
```

---

### Task 6: Full repository verification, implementation PR, CI, merge, deploy, and E2E production proof

**Files:**
- No planned product files. Repair only real failures proven by tests/CI.

**Interfaces:**
- Consumes: complete Wave 1 feature branch.
- Produces: mergeable implementation PR plus exact-SHA production verification evidence.

- [ ] **Step 1: Start implementation from fresh main before Task 1**

At execution time, fetch the current canonical `main` and create the implementation branch from that SHA, for example:

```text
feat/atlas-ai-unified-workspace-wave-1
```

Bring the approved spec/plan documentation into the implementation history without force-updating shared branches. Resolve real conflicts against current main; never overwrite newer working code with the older spec-branch base.

- [ ] **Step 2: Run the focused Wave 1 suite**

```bash
npx vitest run \
  tests/unit/atlas-navigation-intelligence.test.ts \
  tests/integration/atlas-ai-workspace-shell.test.tsx \
  tests/integration/atlas-shell-responsive.test.tsx \
  tests/integration/atlas-ai-workspace-routes.test.ts \
  tests/unit/atlas-ai-production-verification.test.ts \
  tests/unit/work-production-verification.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run canonical repository gates**

```bash
npm ci
npm run verify:navigation
npm run typecheck
npm test
npm run build
npm run verify:all
```

Expected: all required gates PASS. If a pre-runner/provider outage prevents execution, classify it truthfully; do not call application code green or red without executable evidence.

- [ ] **Step 4: Open the implementation PR**

Title:

```text
feat(ai): unify ATLAS AI workspace navigation
```

PR body must state:

- Wave 1 reuses existing routes and runtime owners;
- no Projects/Skills/Agents/Scheduled/etc. placeholders were introduced;
- no second navigation/provider/data architecture was created;
- production verification was expanded to the real Wave 1 route set;
- focused and full verification commands/results;
- any external/provider gate still outstanding.

- [ ] **Step 5: Verify required CI and repair real failures**

Required checks must be green on the exact implementation head before merge. Address review comments and test failures on the feature branch, rerunning the affected and full gates. Do not dismiss a real security/tenancy/navigation finding merely to make CI pass.

- [ ] **Step 6: Merge through the canonical Git path**

Merge only the verified exact head into `main`, preserving auditable history. Do not force-push main.

- [ ] **Step 7: Verify Cloudflare deployment of the merged exact SHA**

Use the canonical `cloudflare-deploy.yml` flow. Confirm the production Worker/static asset deployment reports the merged `main` SHA through the ATLAS version headers and that its AI-workspace aggregate is true.

- [ ] **Step 8: Run public fail-closed verification**

Run the repository's canonical production verification path, including:

```bash
npm run verify:production:global
```

and/or the exact-SHA authorized GitHub/Cloudflare workflow path where required for production credentials.

Required P0 evidence:

- `https://www.atlasenterprisesuite.com/` reachable;
- `/api/v1/health` returns the expected healthy payload;
- HSTS and CSP present;
- all Wave 1 AI routes reach the deployed ATLAS shell;
- every route checked by exact-version workflow reports the merged SHA/version evidence;
- no AI route passes via fabricated readiness or placeholder content;
- existing Work, CRM, Network, Finance, Health, and canonical production gates remain green.

Any P0 route, security-header, health, or exact-SHA failure is blocking. Do not mark deployment verified until repaired and rerun.

- [ ] **Step 9: Record final evidence**

Completion report must include:

- implementation branch and commit SHA(s);
- implementation PR number;
- required CI results;
- merge SHA;
- Cloudflare deployment/workflow evidence;
- production-verification evidence for the canonical domain and Wave 1 AI route set;
- any P1 warning that does not invalidate the P0 result.

---

## Deferred Waves — Mandatory Security Contracts

These items are intentionally not implemented in Wave 1. Their future implementation plans must include the following hard requirements from design review:

### Wave 2 — Projects / Research / Skills / Agents / Canvas / Notebooks / Pages / Apps

- Resource search is authorized and tenant-filtered server-side before result rows are returned.
- An organization/context switch is backend-authoritative; all queries/mutations carry the selected organization and scoped caches are invalidated on switch.
- Skills use immutable approved/published versions or content digests; edits create a new draft/version and require re-approval.
- Agents execute only immutable published versions and pin exact skill/app policy versions/digests.

### Wave 3 — Scheduled / Live / Vision / unified history

- Each scheduled run reauthorizes current membership, tenant access, app/plugin authorization, cost policy, approvals, and provider readiness immediately before action.
- Revocation between task creation and run time blocks execution and records truthful evidence.

### Any wave that creates external side effects

- Persist execution intent and unique idempotency key before the provider/network side effect.
- Retries reuse the same idempotency identity and reconcile provider evidence instead of silently repeating an external action.

### Wave 4 — Developer convergence

- Developer actions reuse existing GitHub/Deploy/release-control policy and production evidence; no alternate deployment authority is created.
