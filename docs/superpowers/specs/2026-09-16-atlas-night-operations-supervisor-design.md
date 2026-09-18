# ATLAS Night Operations Supervisor — Architecture Design

Date: 2026-09-16
Status: Approved design baseline from user-provided Night Operations Supervisor protocol
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Branch: `atlas/night-operations-supervisor-design`
Owner: ATLAS Sovereign AI Orchestrator

## 1. Purpose

ATLAS Night Operations Supervisor is a governed overnight execution subsystem that processes an authorized queue of ATLAS tasks, resumes from durable checkpoints, executes only permitted work, verifies outcomes using recorded evidence, and classifies each item as completed, blocked, failed, cancelled, or requiring attention without fabricating success.

This subsystem extends the existing ATLAS Sovereign AI Orchestrator. It does not introduce a second workflow authority, a parallel tenant model, or a second source of truth.

## 2. Existing architecture to preserve

The existing Orchestrator remains authoritative for task state, scope, permissions, evidence, approvals, audit, CI correlation, and deployment eligibility.

Existing state-machine semantics remain intact. Production deployment remains governed by the existing CI and human-approval gates. The night supervisor may execute eligible work and request transitions, but it may not bypass approval or claim CI, deployment, provider connectivity, or persistence that was not independently observed.

The existing `PersistencePort` abstraction is extended rather than replaced. A night execution runtime MUST NOT advertise production readiness until its configured persistence adapter is durable and verified.

## 3. Scope

The first production-capable slice provides:

- an authorized night queue linked to canonical `AtlasTask` records;
- exclusive acquisition through leases;
- heartbeat and lease expiry;
- durable checkpoints;
- idempotency keys for retryable material operations;
- retry classification with exponential backoff and jitter;
- per-task context isolation;
- append-oriented execution audit;
- evidence-based completion verification;
- archive eligibility separate from task completion;
- a morning executive digest;
- recovery by a replacement worker after lease expiry.

## 4. Non-goals

The first slice does not:

- scrape or control ChatGPT conversation history through an undocumented interface;
- archive external chats unless a supported authorized integration exposes that capability;
- bypass RBAC, CI, human approval, or production release policies;
- create a second deployment mechanism;
- invent metrics, test results, provider status, or evidence;
- automatically perform irreversible actions solely because execution occurs at night.

External conversations may be represented in the queue only after an authorized connector or ATLAS-owned ingestion path creates a canonical task/reference.

## 5. Night queue model

```ts
export type NightQueueStatus =
  | 'queued'
  | 'leased'
  | 'running'
  | 'completed_autonomous'
  | 'requires_attention'
  | 'failed'
  | 'cancelled';

export interface NightQueueItem {
  schemaVersion: 1;
  queueItemId: string;
  taskId: string;
  sourceThreadId: string | null;
  scope: {
    tenantId: string;
    organizationId: string;
  };
  status: NightQueueStatus;
  priority: number;
  attempt: number;
  maxAttempts: number;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  heartbeatAt: string | null;
  checkpointId: string | null;
  archivePolicy: 'never' | 'eligible_on_verified_completion';
  archiveEligible: boolean;
  nextEligibleAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

A queue item references, but never replaces, the canonical `AtlasTask`.

## 6. Checkpoint model

```ts
export interface NightCheckpoint {
  schemaVersion: 1;
  checkpointId: string;
  queueItemId: string;
  taskId: string;
  scope: {
    tenantId: string;
    organizationId: string;
  };
  stepKey: string;
  idempotencyKey: string;
  completedOperations: string[];
  evidenceRefs: string[];
  retryCount: number;
  lastSuccessfulOperation: string | null;
  createdAt: string;
}
```

Checkpoints are append-oriented. Recovery resumes from the newest valid checkpoint for the same queue item and scope.

## 7. Lease and heartbeat rules

Only one worker may own an unexpired lease for a queue item.

Acquisition must be atomic at the persistence boundary. A worker must renew its heartbeat before the configured lease expires. A replacement worker may claim the item only after expiry.

Lease loss is fail-closed: the previous worker must stop material actions after detecting that ownership was lost.

## 8. Idempotency

Every material operation that could be retried MUST carry an idempotency key derived from stable identifiers such as `queueItemId`, `taskId`, operation name, and logical step.

The persistence/tool boundary must prevent duplicate side effects for a previously successful idempotency key.

## 9. Retry policy

Errors are classified as transient or permanent.

Transient examples:

- HTTP 429;
- HTTP 5xx;
- provider timeout;
- temporary network failure;
- temporary dependency unavailability.

Transient failures use bounded exponential backoff with jitter and honor `Retry-After` when available. Retry metadata is persisted before sleeping/releasing the item.

Permanent authorization, validation, scope, malformed-data, or unsupported-operation failures do not loop indefinitely. They transition to `requires_attention` or `failed` according to policy.

## 10. Context isolation

Each queue item is executed in an isolated task context assembled from canonical task data, explicitly linked evidence, authorized artifacts, and the latest checkpoint.

Context from a completed/failed queue item is discarded before the next item begins. Cross-task data is reusable only through explicit persisted references authorized by scope and permissions.

## 11. Completion verification

`completed_autonomous` is permitted only when all applicable criteria are independently verifiable and pass:

- no unresolved blockers;
- no required actions remain;
- required persistence succeeded;
- required tests succeeded with recorded evidence;
- required external state is observed rather than inferred;
- evidence references are attached;
- canonical task state is consistent with reality.

A model statement such as “done”, “fixed”, or “deployed” is never sufficient evidence.

## 12. Requires-attention classification

A queue item becomes `requires_attention` when further autonomous progress is unsafe or impossible, including:

- explicit human authorization required;
- missing credential;
- irreversible/destructive ambiguity;
- unsupported external action;
- conflicting records;
- retry exhaustion;
- inability to verify the claimed final state;
- scope or permission mismatch.

The recorded event must include:

- exact cause;
- last successful operation;
- latest checkpoint reference;
- evidence references;
- minimum human action required.

Processing then continues with the next eligible queue item.

## 13. Archive eligibility

Task completion and conversation archival are separate decisions.

`archiveEligible=true` is allowed only when:

1. the item is `completed_autonomous`;
2. verification passed;
3. open blocker count is zero;
4. `archivePolicy` allows automatic eligibility;
5. the target system exposes an authorized archival action.

If no supported archival integration exists, ATLAS records eligibility but MUST NOT claim that the external chat was archived.

## 14. Audit events

Add append-oriented events conceptually including:

- `night.session.started`;
- `night.queue.claimed`;
- `night.lease.renewed`;
- `night.checkpoint.recorded`;
- `night.operation.started`;
- `night.operation.completed`;
- `night.operation.failed`;
- `night.retry.scheduled`;
- `night.item.completed_autonomous`;
- `night.item.requires_attention`;
- `night.item.archive_eligible`;
- `night.session.completed`.

Events record actor/worker, scope, queue item, task, outcome, timestamps, correlation identifiers, and evidence references. Secrets are excluded or redacted.

## 15. Morning digest

At session close, ATLAS produces a persisted digest containing:

- session id;
- window start/end;
- total queued;
- total examined;
- total claimed;
- total completed autonomously;
- total archive-eligible;
- total actually archived when a supported integration confirms it;
- total pending;
- total requiring attention;
- total failed;
- retries;
- blocker categories;
- human actions required;
- audit/evidence references.

The digest must not hide failures or collapse unverified states into success.

## 16. Persistence extensions

Extend the persistence boundary with explicit night-operation repositories/functions rather than overloading task persistence ambiguously. The durable implementation must support atomic lease acquisition and scoped reads/writes.

Conceptual interface:

```ts
export interface NightOperationsPersistencePort {
  readonly durable: boolean;
  enqueueNightItem(item: NightQueueItem): Promise<void>;
  claimNextNightItem(scope: TenantScope, workerId: string, now: string, leaseUntil: string): Promise<NightQueueItem | null>;
  renewNightLease(scope: TenantScope, queueItemId: string, workerId: string, now: string, leaseUntil: string): Promise<boolean>;
  saveNightItem(item: NightQueueItem): Promise<void>;
  appendNightCheckpoint(checkpoint: NightCheckpoint): Promise<void>;
  getLatestNightCheckpoint(scope: TenantScope, queueItemId: string): Promise<NightCheckpoint | null>;
  appendNightAudit(event: AtlasEvent): Promise<void>;
}
```

## 17. Worker flow

```text
scheduler trigger
  -> create night session
  -> claim next eligible queue item atomically
  -> validate scope + permissions + canonical task
  -> load latest checkpoint
  -> build isolated context
  -> execute next permitted operation
  -> persist evidence
  -> append checkpoint
  -> renew heartbeat/lease
  -> verify completion criteria
     -> completed_autonomous + optional archive eligibility
     -> requires_attention
     -> retry scheduled
     -> failed/cancelled
  -> release/finish item
  -> claim next item
  -> persist morning digest
  -> close session
```

## 18. Scheduling boundary

Scheduling wakes the supervisor; scheduling is not the source of truth for progress. All resumability lives in durable ATLAS persistence.

A missed or duplicated scheduler invocation must not duplicate material work because leases and idempotency are authoritative.

## 19. Security and governance

Every read/write is scoped by tenant and organization. Sensitive tool operations re-check permissions at execution time. Night mode grants no additional privilege.

Production deployment, financial movement, credential changes, destructive deletion, legal submission, and other high-impact operations remain subject to their normal governance policies and human approval requirements.

## 20. Readiness gates

Night Operations may be labeled production-ready only after evidence shows:

1. durable persistence configured and migration-tested;
2. atomic lease acquisition tested under concurrency;
3. recovery from worker termination tested;
4. duplicate scheduler invocation tested;
5. idempotency tested for material operations;
6. transient retry/backoff tested;
7. permanent failure classification tested;
8. scope/RBAC isolation tested;
9. audit events verified;
10. morning digest verified;
11. existing unit/integration/typecheck/build gates pass;
12. no production/human-approval bypass is introduced.

## 21. Success criteria

The design is complete when ATLAS can process a real authorized queue overnight, survive interruption, resume without duplicate side effects, distinguish verified completion from attention-required states, produce an auditable morning digest, and never claim external archival, CI success, provider connectivity, persistence, or deployment without evidence.