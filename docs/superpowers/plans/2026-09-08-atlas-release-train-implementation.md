# ATLAS Release Train + Release Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the governed ATLAS Release Controller and server-side Release Queue so all module families can develop in parallel while one immutable candidate is deployed once and activated sequentially by verified waves.

**Architecture:** Add a focused `packages/release-control` domain package for lifecycle/dependency rules; persist release catalog, candidates, queue items, evidence, operators and transition audit in canonical Supabase v2; ingest executable evidence from ATLAS Forge through a service-only path; expose a fail-closed runtime activation registry to the React shell; and provide a permission-gated Release Controller UI. Code deployment remains distinct from module activation, and activation never advances without stored evidence.

**Tech Stack:** TypeScript, React 19, React Router, Vite, Vitest, Testing Library, Supabase/PostgreSQL v2, ATLAS Core RBAC/audit contracts, ATLAS Forge, Cloudflare production delivery.

**Spec:** `docs/superpowers/specs/2026-09-08-atlas-release-train-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`.
- Integration axis: `release/atlas-a-z`; keep `main` production-stable until a verified immutable candidate is promoted.
- Canonical backend target: Supabase v2; do not create a second backend or revive legacy Vercel as a required production dependency.
- GitHub is source/review/release authority; ATLAS Forge is executable evidence infrastructure while hosted Actions remain pre-runner blocked.
- Development waves may advance in parallel; production activation remains sequential and dependency-aware.
- A module cannot become `VERIFIED` without executable evidence, or `RELEASE_READY` unless required verification passed.
- Deploying code never implies activation; unreleased module surfaces must fail closed in the runtime registry.
- No browser/client path may possess service-role credentials or be able to fabricate CI/migration/deployment evidence.
- Provider-dependent capabilities remain disabled and truthfully labeled `PROVIDER_REQUIRED` until verified.
- Health, money movement, mobility/device control, and identity/security changes retain their stronger gates.
- No production migration application, release-lock opening, module activation, `main` merge, or production deploy is part of this implementation plan unless the corresponding gates have actually executed and authorization exists.

---

## File Structure

### Domain package
- `packages/release-control/src/types.ts` — lifecycle/status/evidence/catalog contracts.
- `packages/release-control/src/catalog.ts` — canonical module-to-wave/dependency manifest.
- `packages/release-control/src/lifecycle.ts` — pure transition and dependency rules.
- `packages/release-control/src/repository.ts` — repository interface and service orchestration.
- `packages/release-control/src/supabaseRepository.ts` — Supabase v2 read/RPC adapter.
- `packages/release-control/src/index.ts` — public exports.

### Supabase v2
- `supabase/v2/migrations/20260908203000_atlas_release_train_v1.sql` — tables, RLS, runtime read functions, operator-gated transition RPCs and service-only evidence ingestion.
- `supabase/v2/tests/release-train.e2e.sql` — database lifecycle, authorization, evidence and activation isolation checks.
- `supabase/v2/MIGRATION_MANIFEST.md` — append the new migration only after the migration file is final.

### Web runtime and controller
- `apps/web/src/app/release/ReleaseRegistryProvider.tsx` — runtime activation state.
- `apps/web/src/app/release/ReleaseGate.tsx` — fail-closed route guard.
- `apps/web/src/app/release/moduleCodes.ts` — route-family to release-module mapping.
- `apps/web/src/modules/release/ReleaseControllerPage.tsx` — queue/wave/evidence controller UI.
- `apps/web/src/modules/release/ReleaseControllerRoute.tsx` — operator gate.
- Modify `apps/web/src/app/router/AppRouter.tsx` — wrap releasable families and add `/release`.
- Modify `apps/web/src/app/AtlasShell.tsx` — hide inactive families and show Release Controller only to operators.
- Modify `apps/web/src/main.tsx` — construct/inject release repository/provider.
- Modify `apps/web/src/styles.css` — responsive controller states only.

### Forge / CI / scripts
- `forge/releaseEvidence.ts` — normalize Forge run results into release evidence envelopes.
- `scripts/release-evidence-ingest.ts` — service-context evidence ingestion CLI.
- `.github/workflows/atlas-release-train-ci.yml` — hosted gate when runners exist.

### Tests
- `tests/unit/release-control-lifecycle.test.ts`
- `tests/unit/release-control-catalog.test.ts`
- `tests/integration/release-control-repository.test.ts`
- `tests/integration/release-gate-ui.test.tsx`
- `tests/integration/release-controller-ui.test.tsx`
- `tests/forge/release-evidence.test.ts`

---

### Task 1: Canonical release lifecycle and module catalog

**Files:**
- Create: `packages/release-control/src/types.ts`
- Create: `packages/release-control/src/catalog.ts`
- Create: `packages/release-control/src/lifecycle.ts`
- Create: `packages/release-control/src/index.ts`
- Test: `tests/unit/release-control-lifecycle.test.ts`
- Test: `tests/unit/release-control-catalog.test.ts`

**Interfaces:**
- Produces: `ReleaseLifecycleStatus`, `ReleaseExceptionState`, `ReleaseEvidenceKind`, `ReleaseModuleDefinition`, `RELEASE_CATALOG`, `canTransitionReleaseStatus()`, `unmetDependencies()`.
- No I/O in this task.

- [ ] **Step 1: Write lifecycle tests first**

```ts
import { describe, expect, it } from 'vitest';
import { canTransitionReleaseStatus, unmetDependencies } from '../../packages/release-control/src';

describe('release lifecycle', () => {
  it('requires executable verification before release readiness', () => {
    expect(canTransitionReleaseStatus('test_pending', 'verified')).toBe(true);
    expect(canTransitionReleaseStatus('test_pending', 'release_ready')).toBe(false);
    expect(canTransitionReleaseStatus('verified', 'release_ready')).toBe(true);
  });

  it('requires dependencies to be production verified before activation', () => {
    expect(unmetDependencies(['core', 'identity'], new Map([
      ['core', 'prod_verified'],
      ['identity', 'live'],
    ]))).toEqual(['identity']);
  });
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm test -- tests/unit/release-control-lifecycle.test.ts tests/unit/release-control-catalog.test.ts`

Expected: FAIL because `packages/release-control/src` does not exist.

- [ ] **Step 3: Implement exact lifecycle contracts**

`ReleaseLifecycleStatus` must be:

```ts
export type ReleaseLifecycleStatus =
  | 'developing'
  | 'integrated'
  | 'test_pending'
  | 'verified'
  | 'release_ready'
  | 'queued'
  | 'activating'
  | 'live'
  | 'prod_verified';

export type ReleaseExceptionState = 'blocked' | 'provider_required' | 'rollback' | null;
```

Allow only adjacent forward transitions, plus `live -> prod_verified`. Rollback is an exception state, not a fake lifecycle success. `unmetDependencies()` treats only `prod_verified` as satisfied unless dependencies are explicitly included in the same activation transaction.

- [ ] **Step 4: Define the initial catalog with deterministic waves**

`RELEASE_CATALOG` must include at minimum these codes and waves:

```ts
[
  ['core', 0], ['identity', 0], ['rbac', 0], ['audit', 0], ['security', 0],
  ['settings', 0], ['atlas-manager', 0], ['observability', 0], ['release-controller', 0],
  ['finance', 1], ['accounting', 1], ['gl', 1], ['ap', 1], ['ar', 1], ['bank-cash', 1], ['reconciliation', 1],
  ['hr', 2], ['time', 2], ['payroll', 2], ['recruiting', 2], ['assessments', 2], ['compensation', 2], ['benefits', 2], ['self-service', 2],
  ['crm', 3], ['sales', 3], ['customers', 3], ['vendors', 3], ['purchasing', 3], ['inventory', 3], ['pos', 3], ['projects', 3], ['analytics', 3],
  ['drive', 4], ['knowledge', 4], ['voice', 4], ['connect', 4], ['communications', 4], ['creator-studio', 4], ['sites', 4],
  ['health', 5],
  ['ride', 6], ['gps-4d', 6], ['telecom', 6], ['parks', 6], ['autowash', 6], ['insurance', 6],
  ['atlas-pay', 7], ['venezuela', 7], ['specialized', 7]
]
```

Set dependencies at family boundaries: Finance depends on Foundation; People depends on Foundation; Revenue Ops depends on Foundation plus Accounting where bookkeeping integration is required; Platform depends on Foundation; Health depends on Foundation; Mobility depends on Foundation; ATLAS Pay depends on Foundation + Accounting.

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test -- tests/unit/release-control-lifecycle.test.ts tests/unit/release-control-catalog.test.ts && npm run typecheck`

Expected: PASS when an executable runner exists. If no runner/environment exists, record `TEST_PENDING`; do not claim PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/release-control/src tests/unit/release-control-*.test.ts
git commit -m "feat: add release train lifecycle contracts"
```

---

### Task 2: Supabase v2 release registry, queue and evidence model

**Files:**
- Create: `supabase/v2/migrations/20260908203000_atlas_release_train_v1.sql`
- Create: `supabase/v2/tests/release-train.e2e.sql`
- Modify: `supabase/v2/MIGRATION_MANIFEST.md`

**Interfaces:**
- Produces tables: `atlas_release_operators`, `atlas_release_modules`, `atlas_release_candidates`, `atlas_release_queue_items`, `atlas_release_evidence`, `atlas_release_events`.
- Produces view/function: `atlas_release_runtime_state()`.
- Produces authenticated operator RPCs: `atlas_release_freeze_candidate`, `atlas_release_queue_module`, `atlas_release_set_exception`, `atlas_release_begin_activation`, `atlas_release_mark_live`, `atlas_release_mark_prod_verified`, `atlas_release_deactivate_wave`.
- Produces service-only evidence RPC: `atlas_release_record_evidence`.

- [ ] **Step 1: Write database E2E expectations before migration**

The SQL test must assert:
1. non-operator authenticated users can read runtime activation state but cannot mutate release state;
2. an operator cannot move `test_pending -> release_ready` without a successful required evidence set;
3. an operator cannot activate a module whose dependencies are not `prod_verified` or included in the same authorized wave activation;
4. service-only evidence insertion succeeds through the service path and is rejected from anonymous/authenticated direct table writes;
5. an inactive module returns `activation_enabled = false`;
6. deactivating a failed wave preserves previously `prod_verified` waves.

Use a transaction and rollback so no synthetic fixtures persist.

- [ ] **Step 2: Run E2E against an empty compatible non-production v2 database and verify RED**

Run with the existing Supabase v2 SQL-test harness used for `tenant-isolation.e2e.sql` and `accounting-lifecycle.e2e.sql`.

Expected: FAIL because release-train objects do not exist. Do not run this migration against production for the RED step.

- [ ] **Step 3: Implement normalized tables with constraints**

Required invariants:

```sql
check (candidate_sha ~ '^[0-9a-f]{40}$')
check (release_wave between 0 and 8)
unique (candidate_id, module_code)
```

Keep `lifecycle_status` separate from nullable `exception_state`. Do not encode `provider_required` as fake verification failure. `activation_enabled` defaults `false`.

- [ ] **Step 4: Implement security boundaries**

- Enable RLS on every release table.
- Runtime users get read-only access to the minimal activation-state projection needed by the client.
- Direct client inserts/updates/deletes on release tables are denied.
- Operator mutations go only through `security definer` RPCs with fixed `search_path` and an `atlas_release_is_operator(auth.uid())` check.
- `atlas_release_record_evidence` is not granted to `anon` or `authenticated`; only the service execution context may invoke it.
- Operator bootstrap is intentionally not seeded to a hardcoded email/user. It must be performed later through an authorized service path.

- [ ] **Step 5: Enforce evidence gates in SQL, not only React**

A transition to `verified` requires successful evidence for the module/candidate covering at least `typecheck`, `unit`, `integration`, `security`, and `build`, with stronger module-specific kinds allowed. `release_ready` requires `verified`. `begin_activation` requires `release_ready/queued`, frozen candidate SHA match, release lock state permitting activation, and dependencies satisfied.

- [ ] **Step 6: Seed catalog rows idempotently from the Task 1 codes**

Use `insert ... on conflict (module_code) do update` only for static metadata (`module_family`, `release_wave`, dependency codes). Never overwrite runtime lifecycle/evidence/activation state during catalog sync.

- [ ] **Step 7: Run E2E and Backend Gate**

Run the release E2E plus the existing v2 Backend Gate and tenant-isolation E2E in the non-production replay environment.

Expected: all executable checks PASS before marking this task verified.

- [ ] **Step 8: Update migration manifest only after final SQL is stable and commit**

```bash
git add supabase/v2/migrations/20260908203000_atlas_release_train_v1.sql supabase/v2/tests/release-train.e2e.sql supabase/v2/MIGRATION_MANIFEST.md
git commit -m "feat: add governed release queue schema"
```

---

### Task 3: Release repository and controller service

**Files:**
- Create: `packages/release-control/src/repository.ts`
- Create: `packages/release-control/src/supabaseRepository.ts`
- Modify: `packages/release-control/src/index.ts`
- Test: `tests/integration/release-control-repository.test.ts`

**Interfaces:**
- Produces `ReleaseRepository` with `listQueue()`, `getRuntimeState()`, `freezeCandidate()`, `queueModule()`, `setException()`, `beginActivation()`, `markLive()`, `markProdVerified()`, `deactivateWave()`.
- Produces `ReleaseControllerService` which validates pure lifecycle/dependency rules before invoking RPCs.

- [ ] **Step 1: Write repository contract tests with a fake RPC gateway**

```ts
const service = new ReleaseControllerService(fakeRepository);
await expect(service.beginActivation({ candidateId: 'c1', moduleCode: 'payroll' }))
  .rejects.toThrow('Unmet release dependencies');
```

Also assert that client methods never accept arbitrary evidence payloads as proof of verification.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/integration/release-control-repository.test.ts`

- [ ] **Step 3: Implement Supabase adapter using only RPCs for mutations**

Reads may use `atlas_release_runtime_state()` / read views; writes must call the named RPCs from Task 2. Never call `.update()` or `.insert()` on release tables from browser-oriented code.

- [ ] **Step 4: Add fail-closed error mapping**

Unknown/malformed rows or RPC failures return/throw an explicit unavailable state; they must never default `activation_enabled` to true.

- [ ] **Step 5: Run repository tests + typecheck and commit**

```bash
git add packages/release-control/src tests/integration/release-control-repository.test.ts
git commit -m "feat: add release controller repository"
```

---

### Task 4: Runtime release registry and route gating

**Files:**
- Create: `apps/web/src/app/release/ReleaseRegistryProvider.tsx`
- Create: `apps/web/src/app/release/ReleaseGate.tsx`
- Create: `apps/web/src/app/release/moduleCodes.ts`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/app/router/AppRouter.tsx`
- Modify: `apps/web/src/app/AtlasShell.tsx`
- Test: `tests/integration/release-gate-ui.test.tsx`

**Interfaces:**
- `ReleaseRegistryProvider` exposes `loading | unavailable | ready` and a `Map<moduleCode, activationEnabled>`.
- `ReleaseGate({ moduleCode, children })` renders children only when that module is active; unavailable registry fails closed.

- [ ] **Step 1: Write UI tests first**

Test three states:
- active module route renders normally;
- inactive module is hidden from navigation and direct route shows `Release pending` rather than the module;
- registry unavailable fails closed and never renders the protected module.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/integration/release-gate-ui.test.tsx`

- [ ] **Step 3: Implement provider with a single runtime-state load**

No per-card/per-link database calls. Normalize all missing module codes to inactive.

- [ ] **Step 4: Add route-family mapping**

At minimum map current implemented families: `accounting/finance`, `people`, `health`, `telecom`, `voice`, plus future family codes already in `RELEASE_CATALOG`. Keep `/healthz` outside React release gating.

- [ ] **Step 5: Wrap current releasable routes and hide inactive nav**

`Release Controller` remains accessible only through its own operator authorization path so operators can activate Wave 0. Do not expose disabled module links.

- [ ] **Step 6: Run route/UI tests + typecheck and commit**

```bash
git add apps/web/src/app/release apps/web/src/app/router/AppRouter.tsx apps/web/src/app/AtlasShell.tsx apps/web/src/main.tsx tests/integration/release-gate-ui.test.tsx
git commit -m "feat: gate modules by release activation"
```

---

### Task 5: Release Controller UI

**Files:**
- Create: `apps/web/src/modules/release/ReleaseControllerPage.tsx`
- Create: `apps/web/src/modules/release/ReleaseControllerRoute.tsx`
- Modify: `apps/web/src/app/router/AppRouter.tsx`
- Modify: `apps/web/src/app/AtlasShell.tsx`
- Modify: `apps/web/src/styles.css`
- Test: `tests/integration/release-controller-ui.test.tsx`

**Interfaces:**
- Consumes `ReleaseControllerService` and queue/runtime records from Task 3.
- Produces operator actions only for transitions that are permitted by backend-returned state.

- [ ] **Step 1: Write tests first**

Required assertions:
- non-operator sees `Access denied` and no activation buttons;
- operator sees waves ordered 0–8 and module lifecycle/evidence/provider/migration/security states;
- `Activate wave` is absent/disabled when any mandatory module lacks verification/dependencies;
- provider-required capabilities are labeled, not shown as connected;
- rollback/deactivate action appears only for an activating/live failed wave state.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/integration/release-controller-ui.test.tsx`

- [ ] **Step 3: Implement read-only queue first**

Show candidate SHA, global lock, wave, position, lifecycle, exception state, CI, migration, security, provider, activation and production verification. Do not calculate readiness from percentages.

- [ ] **Step 4: Add governed mutations**

Buttons call the service/RPC layer only. After every mutation refresh from Supabase; never optimistically claim `LIVE` or `PROD_VERIFIED` before backend confirmation.

- [ ] **Step 5: Make responsive states explicit**

Desktop/tablet/mobile must preserve queue ordering, blocker visibility and critical controls without horizontal-only dependency.

- [ ] **Step 6: Run UI tests + typecheck and commit**

```bash
git add apps/web/src/modules/release apps/web/src/app/router/AppRouter.tsx apps/web/src/app/AtlasShell.tsx apps/web/src/styles.css tests/integration/release-controller-ui.test.tsx
git commit -m "feat: add ATLAS release controller UI"
```

---

### Task 6: Forge evidence normalization and service-only ingestion

**Files:**
- Create: `forge/releaseEvidence.ts`
- Create: `scripts/release-evidence-ingest.ts`
- Modify: `forge/index.ts`
- Test: `tests/forge/release-evidence.test.ts`

**Interfaces:**
- `buildReleaseEvidenceEnvelope(run, candidateSha, moduleCodes)` returns immutable normalized evidence with source refs and SHA.
- CLI submits envelopes only with server-side Supabase credentials supplied by the execution environment.

- [ ] **Step 1: Write tests first**

Assert that failed/skipped steps cannot be normalized as success, candidate SHA must be 40-char lowercase hex, and module codes must exist in the release catalog.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/forge/release-evidence.test.ts`

- [ ] **Step 3: Normalize Forge evidence**

Evidence must include: `candidate_sha`, `module_code`, `evidence_kind`, `result`, `source='atlas-forge'`, `source_ref`, `executed_at`, and a JSON payload containing command/step identifiers but no secrets.

- [ ] **Step 4: Implement service-only CLI**

Require `SUPABASE_URL` and server-side service credential from environment; refuse browser bundles and refuse logging the credential. Call only `atlas_release_record_evidence`.

- [ ] **Step 5: Run Forge tests and local Forge smoke when available**

Run: `npm test -- tests/forge/release-evidence.test.ts && npm run test:forge && npm run forge:ci:local`

- [ ] **Step 6: Commit**

```bash
git add forge/releaseEvidence.ts forge/index.ts scripts/release-evidence-ingest.ts tests/forge/release-evidence.test.ts
git commit -m "feat: connect Forge evidence to release queue"
```

---

### Task 7: Dedicated Release Train CI gate

**Files:**
- Create: `.github/workflows/atlas-release-train-ci.yml`

**Interfaces:**
- Hosted gate validates release-control unit/integration/UI tests, truth-state scan, typecheck and build when a runner exists.
- It does not activate production or apply migrations.

- [ ] **Step 1: Add workflow triggered on `release/atlas-a-z` and PRs to `main`**

Use Node 22, checkout, dependency install, typecheck, targeted release tests, Forge evidence tests, truth-state/secret scan, and build.

- [ ] **Step 2: Add a truth-state scan**

Fail if release-controller runtime contains hardcoded `activation_enabled: true`, fake `PROD_VERIFIED`, service-role credentials, or UI text that represents a provider-required capability as connected.

- [ ] **Step 3: Observe hosted execution honestly**

If GitHub again reports `runner_id: 0` / `steps: []`, record infrastructure blockage and keep status `TEST_PENDING`. Do not alter application code to satisfy a job that never started.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/atlas-release-train-ci.yml
git commit -m "ci: add release train gate"
```

---

### Task 8: Reconcile the existing A-Z program to parallel development

**Files:**
- Modify: `docs/superpowers/plans/2026-09-04-atlas-a-z-closure-program.md`
- Modify: `docs/superpowers/release/ATLAS_AZ_STATUS.md`
- Modify: PR #13 body after repository docs are committed.

**Interfaces:**
- Documentation becomes consistent with the approved Release Train spec.

- [ ] **Step 1: Replace the obsolete sequencing rule**

Replace `Every wave must end green before the next wave is considered accepted into the release branch` with:

> Independent waves may be developed and integrated in parallel. A wave must satisfy its executable gates before `VERIFIED`/`RELEASE_READY`, and must satisfy dependency and production gates before activation.

- [ ] **Step 2: Add Release Queue as the promotion source of truth**

The A-Z status document must separate `implemented`, `test_pending`, `verified`, `release_ready`, `queued`, `live`, and `prod_verified`.

- [ ] **Step 3: Update PR #13 body**

Reference the approved spec and implementation plan, retain current Supabase v2/Cloudflare truth state, and state that release activation is sequential even though development is parallel.

- [ ] **Step 4: Commit documentation changes**

```bash
git add docs/superpowers/plans/2026-09-04-atlas-a-z-closure-program.md docs/superpowers/release/ATLAS_AZ_STATUS.md
git commit -m "docs: adopt parallel A-Z release train policy"
```

---

### Task 9: Release-train end-to-end verification without production activation

**Files:**
- Modify only defects discovered by the executable matrix; do not add new feature scope.

**Interfaces:**
- Produces a verified release-control subsystem, not a production launch.

- [ ] **Step 1: Run source matrix**

Run:

```bash
npm run typecheck
npm test -- tests/unit/release-control-lifecycle.test.ts tests/unit/release-control-catalog.test.ts
npm test -- tests/integration/release-control-repository.test.ts tests/integration/release-gate-ui.test.tsx tests/integration/release-controller-ui.test.tsx
npm test -- tests/forge/release-evidence.test.ts
npm run test:forge
npm run build
```

- [ ] **Step 2: Run clean Supabase v2 replay gate**

Replay the complete exact migration chain, including `20260908203000_atlas_release_train_v1.sql`, in an empty compatible non-production environment. Then run Backend Gate, tenant isolation, Accounting lifecycle, and `release-train.e2e.sql`.

- [ ] **Step 3: Verify runtime fail-closed behavior**

With a non-production candidate and release lock closed:
- disabled module routes remain inaccessible;
- navigation hides inactive modules;
- `/release` is denied to non-operators;
- operator UI cannot activate without evidence;
- prior production state is not represented as changed.

- [ ] **Step 4: Record evidence, do not launch**

If all gates pass, modules may advance to `VERIFIED`/`RELEASE_READY` in the queue. Do not open the production release lock, activate a production wave, apply the migration to production, merge #13, or deploy unless those separate production gates and authorization are satisfied.

- [ ] **Step 5: Final implementation commit if verification fixes were required**

```bash
git add -A
git commit -m "fix: close release train verification gaps"
```

---

## Completion Criteria

The Release Train implementation is complete only when:

1. lifecycle/dependency rules are deterministic and tested;
2. Supabase v2 persists queue/candidate/evidence/activation state with RLS and audited operator RPCs;
3. client code cannot fabricate verification/evidence or write release tables directly;
4. Forge can produce and service-ingest candidate-bound executable evidence;
5. runtime route/navigation gating fails closed for inactive modules;
6. Release Controller exposes truthful queue/wave/evidence/blocker states and governed controls;
7. A-Z documentation no longer serializes development waves;
8. clean v2 migration replay + Backend Gate + release E2E + app typecheck/tests/build actually execute and pass;
9. no production activation has occurred merely because the controller exists.
