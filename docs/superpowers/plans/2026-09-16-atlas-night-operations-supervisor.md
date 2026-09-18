# ATLAS Night Operations Supervisor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing ATLAS Sovereign AI Orchestrator with a durable overnight work queue, leases, checkpoints, retries, evidence-based completion, archive eligibility, audit events, and a morning digest without bypassing existing governance.

**Architecture:** Keep `AtlasTask` as the canonical workflow record. Add a focused night-operations package/runtime boundary that stores queue/session/checkpoint state behind a durable persistence interface, while the Orchestrator remains authoritative for permissions and task state. A scheduler only wakes workers; atomic leases, idempotency, checkpoints, retries, verification, and audit live inside ATLAS.

**Tech Stack:** TypeScript, existing npm workspace, Node runtime, current ATLAS Orchestrator packages, existing test runner and repository verification scripts.

**Spec:** `docs/superpowers/specs/2026-09-16-atlas-night-operations-supervisor-design.md`

## Global Constraints

- Reuse existing tenant and organization scope primitives.
- Do not create a second canonical task model.
- Do not claim external chat archival unless a supported authorized integration confirms it.
- Do not bypass RBAC, CI, human approval, production release, or destructive-action safeguards.
- Night runtime readiness must remain false unless configured persistence is durable.
- Every retryable material operation must be idempotent.
- Completion requires recorded evidence; model text alone is never evidence.
- Scheduler duplication must not duplicate material work.

---

### Task 1: Add canonical night-operations contracts

**Files:**
- Create: `packages/task-protocol/src/nightOperations.ts`
- Modify: `packages/task-protocol/src/index.ts`
- Test: `tests/orchestrator/nightOperationsContracts.test.ts`

**Interfaces:**
- Produces: `NightQueueStatus`, `NightArchivePolicy`, `NightQueueItem`, `NightCheckpoint`, `NightSessionSummary`.
- Consumes: existing `TenantScope` shape and `AtlasTask` identifiers.

- [ ] **Step 1: Write the failing contract test**

Create tests that compile representative queue/checkpoint/session objects and reject invalid status literals through TypeScript coverage. Include a runtime helper test for archive eligibility if validation helpers already exist in `task-protocol`.

```ts
import type { NightQueueItem } from '../../packages/task-protocol/src';

const item: NightQueueItem = {
  schemaVersion: 1,
  queueItemId: 'NQ-1',
  taskId: 'ATL-1',
  sourceThreadId: null,
  scope: { tenantId: 't1', organizationId: 'o1' },
  status: 'queued',
  priority: 100,
  attempt: 0,
  maxAttempts: 5,
  leaseOwner: null,
  leaseExpiresAt: null,
  heartbeatAt: null,
  checkpointId: null,
  archivePolicy: 'never',
  archiveEligible: false,
  nextEligibleAt: null,
  createdAt: '2026-09-16T00:00:00.000Z',
  updatedAt: '2026-09-16T00:00:00.000Z'
};

expect(item.status).toBe('queued');
```

- [ ] **Step 2: Run the focused test/typecheck and verify failure**

Run the repository test command targeting `nightOperationsContracts.test.ts` plus `npm run typecheck`.

Expected: imports fail because the night-operation types do not yet exist.

- [ ] **Step 3: Implement minimal contracts**

Create exactly the types specified by the design, including:

```ts
export type NightQueueStatus =
  | 'queued'
  | 'leased'
  | 'running'
  | 'completed_autonomous'
  | 'requires_attention'
  | 'failed'
  | 'cancelled';

export type NightArchivePolicy = 'never' | 'eligible_on_verified_completion';
```

Define `NightQueueItem`, `NightCheckpoint`, and `NightSessionSummary` with `schemaVersion: 1` and tenant/organization scope.

- [ ] **Step 4: Export the contracts and rerun tests**

Export them from `packages/task-protocol/src/index.ts` and run the focused test plus typecheck.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/task-protocol/src/nightOperations.ts packages/task-protocol/src/index.ts tests/orchestrator/nightOperationsContracts.test.ts
git commit -m "feat(orchestrator): add night operations contracts"
```

---

### Task 2: Add night-operations persistence port and in-memory reference adapter

**Files:**
- Create: `packages/ai-core/src/nightOperationsPersistence.ts`
- Create: `packages/ai-core/src/inMemoryNightOperationsPersistence.ts`
- Modify: `packages/ai-core/src/index.ts`
- Test: `tests/orchestrator/nightOperationsPersistence.test.ts`

**Interfaces:**
- Produces: `NightOperationsPersistencePort` and `InMemoryNightOperationsPersistence`.
- Consumes: `NightQueueItem`, `NightCheckpoint`, `NightSessionSummary`, `TenantScope`.

- [ ] **Step 1: Write failing tests for queue storage and scope isolation**

Cover enqueue/read behavior and verify a different tenant/org cannot claim or read another scope's queue item.

- [ ] **Step 2: Write failing concurrent-lease test**

Create two simultaneous `claimNextNightItem(...)` calls against one queued item and assert exactly one worker receives it.

- [ ] **Step 3: Run focused tests and confirm failure**

Expected: persistence interfaces/classes missing.

- [ ] **Step 4: Implement the persistence contract**

Expose methods:

```ts
export interface NightOperationsPersistencePort {
  readonly durable: boolean;
  enqueueNightItem(item: NightQueueItem): Promise<void>;
  claimNextNightItem(scope: TenantScope, workerId: string, now: string, leaseUntil: string): Promise<NightQueueItem | null>;
  renewNightLease(scope: TenantScope, queueItemId: string, workerId: string, now: string, leaseUntil: string): Promise<boolean>;
  saveNightItem(item: NightQueueItem): Promise<void>;
  appendNightCheckpoint(checkpoint: NightCheckpoint): Promise<void>;
  getLatestNightCheckpoint(scope: TenantScope, queueItemId: string): Promise<NightCheckpoint | null>;
  saveNightSessionSummary(summary: NightSessionSummary): Promise<void>;
  getNightSessionSummary(scope: TenantScope, sessionId: string): Promise<NightSessionSummary | null>;
}
```

- [ ] **Step 5: Implement in-memory adapter for tests only**

Set `durable = false`. Make claim atomic within the adapter's process and reject scope mismatch. Preserve clone semantics consistent with existing in-memory persistence.

- [ ] **Step 6: Rerun tests and typecheck**

Expected: PASS, including exactly-one-winner lease test.

- [ ] **Step 7: Commit**

```bash
git add packages/ai-core/src/nightOperationsPersistence.ts packages/ai-core/src/inMemoryNightOperationsPersistence.ts packages/ai-core/src/index.ts tests/orchestrator/nightOperationsPersistence.test.ts
git commit -m "feat(orchestrator): add night queue persistence boundary"
```

---

### Task 3: Implement lease, heartbeat, retry, and checkpoint policy helpers

**Files:**
- Create: `packages/ai-core/src/nightOperationsPolicy.ts`
- Test: `tests/orchestrator/nightOperationsPolicy.test.ts`

**Interfaces:**
- Produces: `computeRetryDelayMs`, `classifyNightFailure`, `isLeaseExpired`, `makeNightIdempotencyKey`, `isArchiveEligible`.
- Consumes: queue item contract and execution evidence flags.

- [ ] **Step 1: Write retry/backoff tests**

Assert bounded exponential backoff, jitter range, `Retry-After` override behavior, and max-attempt exhaustion.

- [ ] **Step 2: Write lease/idempotency/archive tests**

Cover expired lease, stable idempotency keys for the same logical operation, and archive eligibility only when verified completion + archive policy + zero blockers are all true.

- [ ] **Step 3: Run tests and verify failure**

Expected: helpers missing.

- [ ] **Step 4: Implement helpers without provider-specific logic**

Example stable key input:

```ts
makeNightIdempotencyKey({
  queueItemId,
  taskId,
  operation: 'persist-evidence',
  stepKey
});
```

The output must be deterministic for identical logical inputs.

- [ ] **Step 5: Rerun tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ai-core/src/nightOperationsPolicy.ts tests/orchestrator/nightOperationsPolicy.test.ts
git commit -m "feat(orchestrator): add night execution policies"
```

---

### Task 4: Implement the Night Operations Supervisor worker

**Files:**
- Create: `apps/atlas-orchestrator/src/workers/nightOperationsSupervisor.ts`
- Modify: `apps/atlas-orchestrator/src/runtime/container.ts`
- Test: `tests/orchestrator/nightOperationsSupervisor.test.ts`

**Interfaces:**
- Produces: `NightOperationsSupervisor` with `runSession(...)` and `processNext(...)`.
- Consumes: existing `AtlasOrchestrator`, canonical task persistence, `NightOperationsPersistencePort`, governance/tool execution boundaries, policy helpers.

- [ ] **Step 1: Write failing happy-path test**

Seed one eligible queue item linked to a canonical task, execute a deterministic fake operation, record evidence/checkpoint, verify success, and assert final queue status becomes `completed_autonomous`.

- [ ] **Step 2: Write failing requires-attention test**

Simulate a missing credential or explicit human approval requirement and assert the worker records `requires_attention`, cause, last successful operation, checkpoint/evidence references, then proceeds to the next item.

- [ ] **Step 3: Write failing lease-loss test**

Simulate lease renewal returning false and assert no further material operation is executed.

- [ ] **Step 4: Run focused tests and verify failure**

Expected: worker missing.

- [ ] **Step 5: Implement supervisor loop**

Required sequence per item:

```text
claim -> validate scope/task/permissions -> load checkpoint -> isolate context
-> execute one permitted logical step -> persist evidence -> checkpoint
-> renew lease -> verify -> classify -> continue
```

The worker must not mutate production approval state directly and must not infer deployment or archival success.

- [ ] **Step 6: Inject supervisor through runtime container**

Add optional night persistence dependency without changing existing runtime defaults. If omitted, use the in-memory non-durable adapter only for local/test runtime.

- [ ] **Step 7: Rerun focused tests, integration tests, and typecheck**

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/atlas-orchestrator/src/workers/nightOperationsSupervisor.ts apps/atlas-orchestrator/src/runtime/container.ts tests/orchestrator/nightOperationsSupervisor.test.ts
git commit -m "feat(orchestrator): add night operations supervisor worker"
```

---

### Task 5: Add session audit and morning digest generation

**Files:**
- Create: `apps/atlas-orchestrator/src/workers/nightDigest.ts`
- Modify: `apps/atlas-orchestrator/src/workers/nightOperationsSupervisor.ts`
- Test: `tests/orchestrator/nightDigest.test.ts`

**Interfaces:**
- Produces: `buildNightSessionSummary(...)`.
- Consumes: append-oriented audit events and final queue item outcomes.

- [ ] **Step 1: Write failing digest aggregation test**

Use a fixture with completed, requires-attention, failed, pending, retried, archive-eligible, and actually-archived items. Assert each count is distinct and unverified archival never increments the archived count.

- [ ] **Step 2: Write failing audit completeness test**

Assert session start/end, queue claim, checkpoint, retry, completion/attention, and digest events contain scope, session id, task/queue identifiers, timestamps, and evidence references where applicable.

- [ ] **Step 3: Run focused tests and verify failure**

- [ ] **Step 4: Implement digest builder and session-close persistence**

Persist the digest through `saveNightSessionSummary` and append the corresponding canonical audit event.

- [ ] **Step 5: Rerun tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/atlas-orchestrator/src/workers/nightDigest.ts apps/atlas-orchestrator/src/workers/nightOperationsSupervisor.ts tests/orchestrator/nightDigest.test.ts
git commit -m "feat(orchestrator): add night audit digest"
```

---

### Task 6: Add scheduler-safe runtime entry point and readiness gating

**Files:**
- Create: `apps/atlas-orchestrator/src/nightRunner.ts`
- Modify: `apps/atlas-orchestrator/src/runtime/readiness.ts`
- Modify: `apps/atlas-orchestrator/src/http.ts`
- Test: `tests/orchestrator/nightRunner.test.ts`
- Test: `tests/orchestrator/readiness.test.ts`

**Interfaces:**
- Produces: one-shot `runNightSession()` entry point suitable for cron/job runners.
- Consumes: `NightOperationsSupervisor`, runtime container, durable persistence readiness.

- [ ] **Step 1: Write failing duplicate-trigger test**

Invoke two session runners against the same queue and assert leases/idempotency prevent duplicate material effects.

- [ ] **Step 2: Write failing readiness test**

Assert night-operations readiness is false whenever night persistence is non-durable, even if the HTTP service itself is alive.

- [ ] **Step 3: Implement one-shot runner**

The scheduler entry point must wake the supervisor, process until queue exhaustion/window end/global unsafe condition, persist the digest, and exit. It must not store progress in scheduler memory.

- [ ] **Step 4: Extend readiness response**

Expose machine-readable night readiness without changing the existing fail-closed durable-persistence principle.

- [ ] **Step 5: Run focused tests and integration tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/atlas-orchestrator/src/nightRunner.ts apps/atlas-orchestrator/src/runtime/readiness.ts apps/atlas-orchestrator/src/http.ts tests/orchestrator/nightRunner.test.ts tests/orchestrator/readiness.test.ts
git commit -m "feat(orchestrator): add scheduler-safe night runner"
```

---

### Task 7: Add a real durable persistence adapter using the authorized ATLAS data platform

**Files:**
- Create/Modify only after confirming the currently authorized ATLAS durable data adapter and its migration conventions.
- Test: `tests/orchestrator/nightOperationsDurablePersistence.test.ts`

**Interfaces:**
- Produces: a durable `NightOperationsPersistencePort` implementation with atomic lease claim semantics.
- Consumes: existing authorized ATLAS persistence client and migration system.

- [ ] **Step 1: Inspect current durable persistence integration in the repository**

Use the existing authorized ATLAS database/client. Do not introduce a new database vendor.

- [ ] **Step 2: Write failing integration test for atomic lease acquisition**

Run two concurrent claims against the actual test database and assert one winner.

- [ ] **Step 3: Write failing restart/recovery test**

Persist a checkpoint, recreate the runtime, and assert processing resumes from the persisted checkpoint without re-running an already-successful idempotent operation.

- [ ] **Step 4: Implement schema/migration and durable adapter**

Store queue items, checkpoints, session summaries, and any idempotency records necessary to guarantee no duplicate side effects.

- [ ] **Step 5: Run migration/integration tests**

Expected: PASS.

- [ ] **Step 6: Commit**

Commit migration, adapter, and tests together with a message such as:

```bash
git commit -m "feat(orchestrator): persist night operations durably"
```

---

### Task 8: Final verification, documentation, and release handoff

**Files:**
- Modify: `docs/superpowers/specs/2026-09-16-atlas-night-operations-supervisor-design.md` only if implementation evidence requires a factual clarification.
- Create: `docs/superpowers/handoffs/2026-09-16-atlas-night-operations-supervisor.md`

**Interfaces:**
- Produces: verifiable implementation handoff with commit/test/readiness evidence.

- [ ] **Step 1: Run repository verification**

Run the repository's full verification command, including dependency audit, typecheck, unit, integration, edge/python verification when applicable, and production build.

- [ ] **Step 2: Verify failure modes explicitly**

Exercise: lease loss, duplicate scheduler trigger, transient retry, retry exhaustion, missing credential, human approval required, scope mismatch, restart recovery, non-durable readiness, unverified external archival.

- [ ] **Step 3: Verify no governance bypass**

Confirm an overnight worker cannot grant production approval, fabricate CI success, mark an external chat archived without connector confirmation, or execute an unauthorized destructive action.

- [ ] **Step 4: Record evidence in handoff document**

Include exact commands, pass/fail results, commit SHAs, known external dependencies, and production-readiness status. Do not use “100% functional” unless every required gate is evidenced.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/handoffs/2026-09-16-atlas-night-operations-supervisor.md
git commit -m "docs: record night operations verification handoff"
```

## Plan self-review

- Spec coverage: queue, leases, heartbeat, checkpoints, idempotency, retries, context isolation, verification, requires-attention classification, archive eligibility, audit, digest, scheduler boundary, durable persistence, security, and readiness all map to tasks above.
- Placeholder scan: Task 7 intentionally requires inspection of the repository's currently authorized durable adapter before naming files; this is a safety constraint from the spec, not deferred product scope. The implementer must resolve existing conventions before code changes and may not introduce a second data platform.
- Type consistency: names used in all tasks match Task 1/2 interfaces: `NightQueueItem`, `NightCheckpoint`, `NightSessionSummary`, `NightOperationsPersistencePort`, `NightOperationsSupervisor`.