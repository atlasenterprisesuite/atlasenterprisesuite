# ATLAS Release Train + Release Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the governed ATLAS Release Controller and server-side Release Queue so all approved module families can develop in parallel while one immutable candidate is deployed once and activated sequentially by verified waves.

**Architecture:** Add a focused `packages/release-control` domain package for lifecycle/dependency rules; persist catalog, global lock, candidates, queue items, evidence, operators and transition audit in canonical Supabase v2; ingest executable evidence from ATLAS Forge through service-only RPCs; bind the React runtime to the exact deployed candidate SHA; fail closed for inactive/mismatched modules; and expose a permission-gated Release Controller UI. Deployment and activation remain separate operations.

**Tech Stack:** TypeScript, React 19, React Router, Vite, Vitest, Testing Library, Supabase/PostgreSQL v2, ATLAS Core RBAC/audit contracts, ATLAS Forge, Cloudflare production delivery.

**Spec:** `docs/superpowers/specs/2026-09-08-atlas-release-train-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`.
- Integration axis: `release/atlas-a-z`; `main` remains production-stable until a verified immutable candidate is promoted.
- Canonical backend: Supabase v2. Do not introduce a second release backend or revive Vercel as a required production dependency.
- GitHub remains source/review/release authority; ATLAS Forge provides executable evidence while hosted Actions remain pre-runner blocked.
- Independent waves may develop and integrate in parallel. Only production activation is sequential.
- `VERIFIED` requires executable evidence; `RELEASE_READY` requires `VERIFIED` plus migration/security/provider readiness.
- Deploying code does not activate a module. Missing/mismatched runtime release state fails closed.
- No browser bundle may contain service-role credentials or write release/evidence tables directly.
- Provider-dependent capabilities remain disabled and labeled `PROVIDER_REQUIRED` until verified.
- Health, money movement, mobility/device commands, and identity/security changes retain stronger gates.
- This plan does not authorize production migration application, opening the production lock, activating a production wave, merging PR #13, or deploying to production.

---

## File Map

### Domain
- Create `packages/release-control/src/types.ts`
- Create `packages/release-control/src/catalog.ts`
- Create `packages/release-control/src/lifecycle.ts`
- Create `packages/release-control/src/repository.ts`
- Create `packages/release-control/src/supabaseRepository.ts`
- Create `packages/release-control/src/index.ts`

### Supabase v2
- Create `supabase/v2/migrations/20260908203000_atlas_release_train_v1.sql`
- Create `supabase/v2/tests/release-train.e2e.sql`
- Modify `supabase/v2/MIGRATION_MANIFEST.md`

### Web
- Create `apps/web/src/app/release/ReleaseRegistryProvider.tsx`
- Create `apps/web/src/app/release/ReleaseGate.tsx`
- Create `apps/web/src/app/release/moduleCodes.ts`
- Create `apps/web/src/modules/release/ReleaseControllerPage.tsx`
- Create `apps/web/src/modules/release/ReleaseControllerRoute.tsx`
- Modify `apps/web/src/main.tsx`
- Modify `apps/web/src/app/router/AppRouter.tsx`
- Modify `apps/web/src/app/AtlasShell.tsx`
- Modify `apps/web/src/styles.css`

### Forge / CI
- Create `forge/releaseEvidence.ts`
- Create `scripts/release-evidence-ingest.ts`
- Modify `forge/index.ts`
- Create `.github/workflows/atlas-release-train-ci.yml`

### Tests
- Create `tests/unit/release-control-lifecycle.test.ts`
- Create `tests/unit/release-control-catalog.test.ts`
- Create `tests/integration/release-control-repository.test.ts`
- Create `tests/integration/release-gate-ui.test.tsx`
- Create `tests/integration/release-controller-ui.test.tsx`
- Create `tests/forge/release-evidence.test.ts`

---

### Task 1: Pure release contracts and catalog

**Interfaces:**

```ts
export type ReleaseLifecycleStatus =
  | 'developing' | 'integrated' | 'test_pending' | 'verified'
  | 'release_ready' | 'queued' | 'activating' | 'live' | 'prod_verified';

export type ReleaseExceptionState = 'blocked' | 'provider_required' | 'rollback' | null;

export type ReleaseEvidenceKind =
  | 'typecheck' | 'unit' | 'integration' | 'security' | 'build'
  | 'migration_replay' | 'backend_gate' | 'deployment' | 'smoke';

export type ReleaseModuleDefinition = {
  moduleCode: string;
  moduleFamily: string;
  releaseWave: number;
  dependencies: readonly string[];
};

export function canTransitionReleaseStatus(
  from: ReleaseLifecycleStatus,
  to: ReleaseLifecycleStatus,
): boolean;

export function unmetDependencies(
  dependencies: readonly string[],
  states: ReadonlyMap<string, ReleaseLifecycleStatus>,
  activatingTogether?: ReadonlySet<string>,
): string[];
```

- [ ] Write `tests/unit/release-control-lifecycle.test.ts` first and assert adjacent transitions, no `test_pending -> release_ready` jump, `live -> prod_verified`, and dependency failure unless a dependency is `prod_verified` or included in `activatingTogether`.
- [ ] Run `npm test -- tests/unit/release-control-lifecycle.test.ts` and verify RED.
- [ ] Implement `types.ts` and `lifecycle.ts` minimally.
- [ ] Write `tests/unit/release-control-catalog.test.ts` and assert unique module codes, waves 0–7, and dependency codes all exist.
- [ ] Define `RELEASE_CATALOG` in `catalog.ts` with at least:

```ts
[
 ['core',0],['identity',0],['rbac',0],['audit',0],['security',0],['settings',0],['atlas-manager',0],['observability',0],['release-controller',0],
 ['finance',1],['accounting',1],['gl',1],['ap',1],['ar',1],['bank-cash',1],['reconciliation',1],
 ['hr',2],['time',2],['payroll',2],['recruiting',2],['assessments',2],['compensation',2],['benefits',2],['self-service',2],
 ['crm',3],['sales',3],['customers',3],['vendors',3],['purchasing',3],['inventory',3],['pos',3],['projects',3],['analytics',3],
 ['drive',4],['knowledge',4],['voice',4],['connect',4],['communications',4],['creator-studio',4],['sites',4],
 ['health',5],
 ['ride',6],['gps-4d',6],['telecom',6],['parks',6],['autowash',6],['insurance',6],
 ['atlas-pay',7],['venezuela',7],['specialized',7]
]
```

- [ ] Use family-level dependencies: every non-foundation family depends on required Wave 0 codes; ATLAS Pay additionally depends on Accounting; Revenue Ops modules that post bookkeeping events additionally depend on Accounting.
- [ ] Export from `index.ts`.
- [ ] Run targeted tests + `npm run typecheck`; if no executable environment exists, keep status `TEST_PENDING` rather than claiming PASS.
- [ ] Commit: `feat: add release train lifecycle contracts`.

---

### Task 2: Supabase v2 release-control schema and global lock

**Produces:**
- `atlas_release_control` — singleton/global lock + active candidate reference.
- `atlas_release_operators` — explicit release operators; no hardcoded email/user seed.
- `atlas_release_modules` — static catalog metadata.
- `atlas_release_candidates` — immutable candidate SHA/status.
- `atlas_release_queue_items` — per-candidate module lifecycle/exception/readiness/activation state.
- `atlas_release_evidence` — immutable evidence bound to candidate + module.
- `atlas_release_events` — append-only transition/audit evidence.

**Required RPCs:**
- authenticated operator: `atlas_release_freeze_candidate`, `atlas_release_queue_module`, `atlas_release_set_exception`, `atlas_release_open_lock`, `atlas_release_close_lock`, `atlas_release_begin_activation`, `atlas_release_mark_live`, `atlas_release_deactivate_wave`.
- service-only: `atlas_release_record_evidence`, `atlas_release_record_candidate_deployment`, `atlas_release_record_smoke_result`.
- read functions: `atlas_release_runtime_state(candidate_sha text)`, `atlas_release_operator_state()`.

- [ ] Write `supabase/v2/tests/release-train.e2e.sql` before migration. Use transaction + rollback and assert non-operators cannot mutate, direct table writes are denied, service evidence cannot be forged by authenticated clients, lock defaults closed, inactive modules return false, candidate SHA cannot change after freeze, dependencies block activation, and prior verified waves survive a later wave deactivation.
- [ ] Run against an empty compatible non-production v2 environment and verify RED.
- [ ] Create migration with constraints:

```sql
check (candidate_sha ~ '^[0-9a-f]{40}$');
check (release_wave between 0 and 7);
unique (candidate_id, module_code);
```

- [ ] Keep `lifecycle_status` separate from nullable `exception_state`; `activation_enabled` defaults false.
- [ ] Add a frozen-candidate guard so `candidate_sha` cannot change after `frozen_at` is set.
- [ ] Enable RLS on every release table. Client gets only minimum read projection; direct client DML is denied.
- [ ] Implement `atlas_release_is_operator(auth.uid())`; all operator RPCs use `security definer`, fixed `search_path`, and this check.
- [ ] Do not grant evidence/deployment/smoke recording RPCs to `anon` or `authenticated`.
- [ ] Enforce verification in SQL: `verified` requires successful `typecheck`, `unit`, `integration`, `security`, `build`; `release_ready` additionally requires required migration/backend gates and no unresolved security blocker.
- [ ] `atlas_release_record_candidate_deployment` must bind deployment evidence to the exact frozen SHA and move candidate state to deployed; browser/operator UI cannot self-declare deployment.
- [ ] `atlas_release_mark_live` requires deployed candidate + open lock + activating state.
- [ ] `atlas_release_mark_prod_verified` is intentionally service/evidence-driven through successful `smoke` evidence; the browser must not directly mark production verified.
- [ ] Seed static catalog idempotently without overwriting runtime state.
- [ ] Run release E2E + existing v2 Backend Gate + tenant isolation in non-production replay environment.
- [ ] Append the migration to `MIGRATION_MANIFEST.md` only after SQL is final.
- [ ] Commit: `feat: add governed release queue schema`.

---

### Task 3: Repository and controller service

**Interfaces:**

```ts
export type ReleaseRuntimeModuleState = {
  moduleCode: string;
  activationEnabled: boolean;
  lifecycleStatus: ReleaseLifecycleStatus;
  exceptionState: ReleaseExceptionState;
};

export interface ReleaseRepository {
  getRuntimeState(candidateSha: string): Promise<ReleaseRuntimeModuleState[]>;
  getOperatorState(): Promise<{ isOperator: boolean }>;
  listQueue(): Promise<ReleaseQueueItem[]>;
  freezeCandidate(input: { candidateSha: string }): Promise<string>;
  queueModule(input: { candidateId: string; moduleCode: string }): Promise<void>;
  setException(input: { candidateId: string; moduleCode: string; state: ReleaseExceptionState; reason: string | null }): Promise<void>;
  openLock(input: { candidateId: string }): Promise<void>;
  closeLock(input: { candidateId: string; reason: string }): Promise<void>;
  beginActivation(input: { candidateId: string; moduleCode: string }): Promise<void>;
  markLive(input: { candidateId: string; moduleCode: string }): Promise<void>;
  deactivateWave(input: { candidateId: string; wave: number; reason: string }): Promise<void>;
}
```

- [ ] Write `tests/integration/release-control-repository.test.ts` first with fake repository/RPC data. Assert unmet dependencies reject activation and no client API accepts arbitrary CI/deployment/smoke evidence.
- [ ] Verify RED.
- [ ] Implement `repository.ts` with `ReleaseControllerService` using Task 1 pure rules before RPC calls.
- [ ] Implement `supabaseRepository.ts`: reads use read RPC/views; every mutation uses named RPCs; never `.insert()`/`.update()` release tables from browser-oriented code.
- [ ] Fail closed on malformed/unknown rows or RPC errors; never default activation to true.
- [ ] Run targeted tests + typecheck.
- [ ] Commit: `feat: add release controller repository`.

---

### Task 4: Candidate-bound runtime gating

**Runtime contract:** the deployed web bundle must provide `VITE_ATLAS_RELEASE_SHA`, a 40-character lowercase Git SHA. The Release Registry requests state for exactly that SHA. Missing SHA, malformed SHA, unknown candidate, candidate mismatch, or unavailable registry => protected modules inactive.

- [ ] Write `tests/integration/release-gate-ui.test.tsx` first: active route renders; inactive route shows `Release pending`; inactive link hidden; unavailable registry fails closed; SHA mismatch fails closed.
- [ ] Verify RED.
- [ ] Implement `ReleaseRegistryProvider.tsx` with one state load, no per-link database calls.
- [ ] Implement `ReleaseGate.tsx`.
- [ ] Define route-family mapping in `moduleCodes.ts` for current implemented families (Finance/Accounting, People, Health, Telecom, Voice) and future catalog codes.
- [ ] Modify `main.tsx` to inject the release repository/provider.
- [ ] Modify `AppRouter.tsx` to wrap releasable module routes. Keep `/healthz` outside React gating.
- [ ] Modify `AtlasShell.tsx` to hide inactive module links.
- [ ] Do not gate the minimum operator path needed to access `/release`; that route has its own operator authorization.
- [ ] Run UI tests + typecheck.
- [ ] Commit: `feat: gate runtime by deployed release SHA`.

---

### Task 5: Release Controller UI

- [ ] Write `tests/integration/release-controller-ui.test.tsx` first and assert: non-operator Access denied; operator sees waves 0–7; no activation when evidence/dependencies fail; provider-required state is truthful; open-lock control absent unless candidate is frozen/deployed and prerequisites are satisfied; no button can mark `PROD_VERIFIED` directly.
- [ ] Verify RED.
- [ ] Implement `ReleaseControllerRoute.tsx` using `getOperatorState()`.
- [ ] Implement `ReleaseControllerPage.tsx` read-only first: candidate SHA, lock, waves, module lifecycle, exception, CI/evidence, migration, provider, security, activation, production verification.
- [ ] Add governed controls only for freeze/queue/exception/open-close lock/begin activation/deactivate; refresh backend after every mutation and never optimistically claim state.
- [ ] Add `/release` to router and operator-only nav entry.
- [ ] Add responsive CSS preserving queue order and blocker visibility on mobile/tablet/desktop.
- [ ] Run tests + typecheck.
- [ ] Commit: `feat: add ATLAS release controller UI`.

---

### Task 6: Forge evidence + service-only ingestion

**Envelope:**

```ts
export type ReleaseEvidenceEnvelope = {
  candidateSha: string;
  moduleCode: string;
  evidenceKind: ReleaseEvidenceKind;
  result: 'passed' | 'failed';
  source: 'atlas-forge';
  sourceRef: string;
  executedAt: string;
  payload: Record<string, unknown>;
};
```

- [ ] Write `tests/forge/release-evidence.test.ts` first. Reject failed/skipped steps as success, invalid SHA, unknown module code, secret-like payload keys, and evidence not bound to a candidate.
- [ ] Verify RED.
- [ ] Implement `forge/releaseEvidence.ts` normalizer.
- [ ] Export from `forge/index.ts`.
- [ ] Implement `scripts/release-evidence-ingest.ts` using only server-side environment credentials; refuse to log credentials; call only `atlas_release_record_evidence`/deployment/smoke service RPCs.
- [ ] Run `npm test -- tests/forge/release-evidence.test.ts`, `npm run test:forge`, and `npm run forge:ci:local` when executable.
- [ ] Commit: `feat: connect Forge evidence to release queue`.

---

### Task 7: Dedicated Release Train CI

- [ ] Create `.github/workflows/atlas-release-train-ci.yml` for pushes to `release/atlas-a-z` and PRs to `main`.
- [ ] Use Node 22; checkout; install; typecheck; release unit/integration/UI tests; Forge evidence tests; truth-state/secret scan; build.
- [ ] Truth scan must fail on hardcoded `activationEnabled: true`, fabricated `prod_verified`, service-role credentials, or provider-required capabilities described as connected/live.
- [ ] Workflow must never apply migrations or activate production.
- [ ] Observe honestly: if GitHub reports `runner_id: 0` and `steps: []`, keep release-control `TEST_PENDING`; do not change app code to satisfy a job that never started.
- [ ] Commit: `ci: add release train gate`.

---

### Task 8: Reconcile A-Z policy to parallel development

- [ ] Modify `docs/superpowers/plans/2026-09-04-atlas-a-z-closure-program.md` and replace the old serialized-wave rule with:

> Independent waves may be developed and integrated in parallel. A wave must satisfy executable gates before `VERIFIED`/`RELEASE_READY`, and dependency/production gates before activation.

- [ ] Modify `docs/superpowers/release/ATLAS_AZ_STATUS.md` to report `implemented`, `test_pending`, `verified`, `release_ready`, `queued`, `live`, and `prod_verified` separately.
- [ ] Update PR #13 body after repository docs are committed: reference Release Train spec/plan, preserve current Supabase v2 + Cloudflare truth state, and state development is parallel while activation is sequential.
- [ ] Commit: `docs: adopt parallel A-Z release train policy`.

---

### Task 9: End-to-end verification without production activation

- [ ] Execute:

```bash
npm run typecheck
npm test -- tests/unit/release-control-lifecycle.test.ts tests/unit/release-control-catalog.test.ts
npm test -- tests/integration/release-control-repository.test.ts tests/integration/release-gate-ui.test.tsx tests/integration/release-controller-ui.test.tsx
npm test -- tests/forge/release-evidence.test.ts
npm run test:forge
npm run build
```

- [ ] Replay the complete exact Supabase v2 migration chain, including `20260908203000_atlas_release_train_v1.sql`, in an empty compatible non-production environment.
- [ ] Run Backend Gate, tenant isolation, Accounting lifecycle E2E, and `release-train.e2e.sql` against the replayed environment.
- [ ] Verify fail-closed runtime with lock closed: inactive routes hidden/blocked; `/release` denied to non-operators; no activation without evidence; SHA mismatch blocked.
- [ ] If all gates actually pass, release-control/modules may move to `VERIFIED`/`RELEASE_READY` in the queue. Do **not** apply to production, open the production lock, activate waves, merge PR #13, or deploy without the separate production gates and authorization.
- [ ] Fix only defects revealed by the matrix; no new feature scope in this task.
- [ ] Commit verification fixes, if any: `fix: close release train verification gaps`.

---

## Completion Criteria

The Release Train subsystem is complete only when all of the following are proven by executable evidence:

1. lifecycle/dependency rules are deterministic and tested;
2. Supabase v2 persists global lock, immutable candidates, queue/evidence/operator/activation state with RLS and audited RPCs;
3. browser code cannot fabricate verification, deployment or smoke evidence;
4. runtime gating is bound to the exact deployed candidate SHA and fails closed;
5. Forge can create and service-ingest candidate-bound evidence;
6. Release Controller exposes truthful queue/wave/evidence/blocker state and only governed controls;
7. A-Z documentation no longer serializes independent development waves;
8. clean v2 replay + Backend Gate + release E2E + app typecheck/tests/build actually execute and pass;
9. no production launch occurs merely because this controller exists.
