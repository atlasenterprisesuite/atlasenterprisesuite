# ATLAS Guardian Core Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce the ATLAS Guardian Doctrine inside the canonical Universal Execution Engine and `atlas-execution` server contract so permissions, approvals, verification, evidence, tenant scope, and audit cannot be bypassed or represented optimistically.

**Architecture:** Harden the existing `@atlas/execution` engine instead of adding a second policy or workflow system. A small pure Guardian preflight helper binds the current task/step payload to existing approvals; `ExecutionEngine` consumes that helper, the existing adapter authorization/verification interfaces, the existing evidence helper, and the existing audit store. The Supabase Edge function reuses the same reviewed-action payload contract so browser and in-memory/server execution cannot drift.

**Tech Stack:** TypeScript 5.7, Vitest 3.2, existing `packages/execution`, Supabase Edge Functions/Deno, existing approval digest/evidence/audit contracts.

**Spec:** `docs/superpowers/specs/2026-09-13-atlas-guardian-doctrine-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`.
- Implementation branch: `feat/atlas-guardian-doctrine` created from current `main` at execution time in an isolated worktree.
- Do not create a second workflow engine, approval center, audit store, tenant model, or shadow policy system.
- Preserve the existing `ExecutionStatus`, `StepStatus`, payload-digest approval binding, completion gate, and module ownership unless a failing test proves a contract must be strengthened.
- Treat `execution.approve` in `step.permissionsRequired` as an approval requirement, not as a requirement that the executor also be the approver.
- All other task/step permissions must be satisfied by the executing actor before adapter resolution or provider execution.
- Cross-tenant or cross-organization execution must fail closed with `execution_scope_mismatch`.
- An approved action is valid only for the exact current task version and reviewed action payload.
- A step with non-empty `evidenceRequirement` cannot be marked completed unless matching verification evidence is present and `verified === true`.
- Attempted execution, request acceptance, or adapter success without verification is not completion.
- Every material blocked, failed, and completed engine outcome added by this plan must emit the existing `ExecutionAuditEvent` shape.
- Budget, provider-capability, autonomy, and browser-envelope enforcement remain owned by the already-approved `docs/superpowers/plans/2026-09-12-atlas-work-sovereign-router-policy.md`; do not duplicate those controls here.
- No production deploy or provider mutation is part of this plan.

## File Map

- `packages/execution/src/guardian.ts` — pure reviewed-action binding and fail-closed Guardian preflight over canonical task/step/approval state.
- `packages/execution/src/index.ts` — export Guardian preflight contract.
- `packages/execution/src/store.ts` — Memory store test helpers for approvals/audit inspection; production interface remains canonical.
- `packages/execution/src/engine.ts` — consume Guardian preflight, enforce step permissions/evidence, and emit audit events.
- `supabase/functions/atlas-execution/index.ts` — reuse shared Guardian reviewed-action payload when requesting/deciding approvals.
- `tests/unit/guardian-preflight.test.ts` — scope, permission, approval, and stale-binding matrix.
- `tests/unit/execution-engine-guardian.test.ts` — engine mutation/verification/audit guarantees.
- `tests/unit/atlas-execution-guardian-contract.test.ts` — server contract regression for org scoping, shared approval binding, completion gate, and audit.

---

### Task 1: Add the canonical Guardian preflight contract

**Files:**
- Create: `packages/execution/src/guardian.ts`
- Modify: `packages/execution/src/index.ts`
- Test: `tests/unit/guardian-preflight.test.ts`

**Interfaces:**
- Consumes: `ExecutionActor`, `ExecutionTask`, `ExecutionStep`, `ExecutionApproval`, `assertSameScope`, `digestApprovalPayload`, `approvalMatchesPayload`.
- Produces: `GuardianPreflightDecision`, `guardianReviewedAction(task, step)`, `evaluateGuardianPreflight(input)`.

- [ ] **Step 1: Write the failing Guardian preflight tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  digestApprovalPayload,
  evaluateGuardianPreflight,
  guardianReviewedAction,
  MemoryExecutionStore,
  type ExecutionActor,
  type ExecutionApproval
} from '../../packages/execution/src';

const actor = (permissions: readonly string[]): ExecutionActor => ({
  userId: 'executor-1',
  scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
  permissions
});

async function approvedBinding() {
  const store = MemoryExecutionStore.seeded();
  const task = (await store.getTask('task-1'))!;
  const step = (await store.listSteps(task.id))[0];
  task.status = 'awaiting_approval';
  step.permissionsRequired = ['payroll.write', 'execution.approve'];
  const payloadDigest = await digestApprovalPayload({
    payloadVersion: task.version,
    payload: guardianReviewedAction(task, step)
  });
  const approval: ExecutionApproval = {
    id: 'approval-1', taskId: task.id, workflowId: task.workflowId, module: step.module,
    requestedBy: 'requester-1', approvalType: 'execution_review', requiredPermission: 'execution.approve',
    riskLevel: 'high', summary: 'Approve payroll enrollment', payloadVersion: task.version,
    payloadDigest, status: 'approved', decidedBy: 'approver-1', decisionReason: 'approved',
    createdAt: '2026-09-13T20:00:00.000Z', decidedAt: '2026-09-13T20:01:00.000Z'
  };
  return { task, step, approval };
}

describe('Guardian preflight', () => {
  it('fails closed across tenant scope', async () => {
    const { task, step } = await approvedBinding();
    const wrongScope = { ...actor(['payroll.write']), scope: { tenantId: 'tenant-2', organizationId: 'org-1' } };
    await expect(evaluateGuardianPreflight({ actor: wrongScope, task, step, approvals: [] }))
      .rejects.toThrow('execution_scope_mismatch');
  });

  it('blocks a missing domain step permission before execution', async () => {
    const { task, step } = await approvedBinding();
    task.status = 'now';
    step.permissionsRequired = ['payroll.write'];
    await expect(evaluateGuardianPreflight({ actor: actor([]), task, step, approvals: [] }))
      .resolves.toEqual({ allowed: false, reason: 'missing_step_permission:payroll.write' });
  });

  it('requires approval without requiring the executor to hold execution.approve', async () => {
    const { task, step } = await approvedBinding();
    await expect(evaluateGuardianPreflight({ actor: actor(['payroll.write']), task, step, approvals: [] }))
      .resolves.toEqual({ allowed: false, reason: 'approval_required' });
  });

  it('accepts an exact approved binding', async () => {
    const { task, step, approval } = await approvedBinding();
    await expect(evaluateGuardianPreflight({ actor: actor(['payroll.write']), task, step, approvals: [approval] }))
      .resolves.toEqual({ allowed: true, reason: 'guardian_preflight_passed', approvalId: 'approval-1' });
  });

  it('rejects a stale approval after action payload change', async () => {
    const { task, step, approval } = await approvedBinding();
    step.actionPayload = { employeeId: 'employee-99' };
    await expect(evaluateGuardianPreflight({ actor: actor(['payroll.write']), task, step, approvals: [approval] }))
      .resolves.toEqual({ allowed: false, reason: 'approval_binding_mismatch' });
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

```bash
npx vitest run tests/unit/guardian-preflight.test.ts
```

Expected: FAIL because `guardian.ts` exports do not exist.

- [ ] **Step 3: Implement the minimal shared preflight**

```ts
import { approvalMatchesPayload, digestApprovalPayload } from './approvals';
import { assertSameScope } from './context';
import type { ExecutionActor, ExecutionApproval, ExecutionStep, ExecutionTask } from './types';

export type GuardianPreflightDecision =
  | { allowed: true; reason: 'guardian_preflight_passed'; approvalId: string | null }
  | { allowed: false; reason: string };

export function guardianReviewedAction(task: ExecutionTask, step: ExecutionStep) {
  return {
    taskId: task.id,
    workflowId: task.workflowId,
    module: step.module,
    stepId: step.id,
    actionType: step.actionType,
    actionPayload: step.actionPayload
  };
}

export async function evaluateGuardianPreflight(input: {
  actor: ExecutionActor;
  task: ExecutionTask;
  step: ExecutionStep;
  approvals: ExecutionApproval[];
}): Promise<GuardianPreflightDecision> {
  assertSameScope(input.task.scope, input.actor.scope);

  for (const permission of input.task.permissionsRequired) {
    if (!input.actor.permissions.includes(permission)) {
      return { allowed: false, reason: `missing_task_permission:${permission}` };
    }
  }
  for (const permission of input.step.permissionsRequired) {
    if (permission === 'execution.approve') continue;
    if (!input.actor.permissions.includes(permission)) {
      return { allowed: false, reason: `missing_step_permission:${permission}` };
    }
  }

  const approvalRequired = input.task.status === 'awaiting_approval'
    || input.step.status === 'awaiting_approval'
    || input.step.permissionsRequired.includes('execution.approve');
  if (!approvalRequired) {
    return { allowed: true, reason: 'guardian_preflight_passed', approvalId: null };
  }

  const digest = await digestApprovalPayload({
    payloadVersion: input.task.version,
    payload: guardianReviewedAction(input.task, input.step)
  });
  const approved = input.approvals.find((approval) =>
    approval.taskId === input.task.id
    && approval.workflowId === input.task.workflowId
    && approval.module === input.step.module
    && approvalMatchesPayload(approval, input.task.version, digest)
  );
  if (approved) return { allowed: true, reason: 'guardian_preflight_passed', approvalId: approved.id };

  const staleApproved = input.approvals.some((approval) =>
    approval.taskId === input.task.id && approval.status === 'approved'
  );
  return { allowed: false, reason: staleApproved ? 'approval_binding_mismatch' : 'approval_required' };
}
```

Export it from `packages/execution/src/index.ts` with:

```ts
export * from './guardian';
```

- [ ] **Step 4: Run focused tests and verify GREEN**

```bash
npx vitest run tests/unit/guardian-preflight.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/execution/src/guardian.ts packages/execution/src/index.ts tests/unit/guardian-preflight.test.ts
git commit -m "feat: add canonical Guardian execution preflight"
```

---

### Task 2: Wire Guardian preflight and auditable outcomes into ExecutionEngine

**Files:**
- Modify: `packages/execution/src/store.ts`
- Modify: `packages/execution/src/engine.ts`
- Create: `tests/unit/execution-engine-guardian.test.ts`

**Interfaces:**
- Consumes: `evaluateGuardianPreflight`, existing adapter registry/store.
- Produces: engine-level blocked/failure/completion audit records and deterministic approval recovery.

- [ ] **Step 1: Write failing engine tests for preflight ordering and audit**

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  ExecutionAdapterRegistry,
  ExecutionEngine,
  MemoryExecutionStore,
  type ExecutionActor,
  type ExecutionModuleAdapter
} from '../../packages/execution/src';

const actor: ExecutionActor = {
  userId: 'executor-1',
  scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
  permissions: ['payroll.write']
};

function adapter(execute = vi.fn(async () => ({ ok: true, result: {} }))): ExecutionModuleAdapter {
  return {
    module: 'payroll', canHandle: () => true,
    validate: async () => ({ ok: true, errors: [] }),
    authorize: async () => ({ ok: true, reason: null }),
    execute,
    verify: async () => ({ ok: true, evidence: [] }),
    suggestNext: async () => null
  };
}

it('blocks a missing step permission before adapter execution and audits the block', async () => {
  const store = MemoryExecutionStore.seeded();
  const step = (await store.listSteps('task-1'))[0];
  step.permissionsRequired = ['payroll.write', 'payroll.submit'];
  store.putStep(step);
  const execute = vi.fn(async () => ({ ok: true, result: {} }));
  const engine = new ExecutionEngine(store, new ExecutionAdapterRegistry([adapter(execute)]));

  await expect(engine.continueTask('task-1', actor)).resolves.toEqual({
    state: 'blocked', reason: 'missing_step_permission:payroll.submit'
  });
  expect(execute).not.toHaveBeenCalled();
  expect((await store.listAuditEvents('task-1')).at(-1)?.action).toBe('execution.guardian.blocked');
});
```

Add a second test where task status is `awaiting_approval`; without an approved binding `execute` is not called and the result is `{ state:'blocked', reason:'approval_required' }`.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
npx vitest run tests/unit/execution-engine-guardian.test.ts
```

Expected: FAIL because `MemoryExecutionStore.listAuditEvents`, `putApproval`, and engine Guardian wiring do not exist.

- [ ] **Step 3: Add MemoryExecutionStore helpers without changing the ExecutionStore interface**

```ts
putApproval(approval: ExecutionApproval) {
  this.approvals.push(clone(approval));
}

async listAuditEvents(taskId?: string) {
  return this.auditEvents
    .filter((event) => !taskId || event.taskId === taskId)
    .map(clone);
}
```

These helpers are deterministic in-memory utilities; adapters and production persistence continue to depend only on the existing `ExecutionStore` interface.

- [ ] **Step 4: Evaluate Guardian preflight before adapter resolution**

In `ExecutionEngine.continueTask`, after loading the current step and before `registry.resolve(...)`:

```ts
const approvals = await this.store.listApprovals(taskId);
const guardian = await evaluateGuardianPreflight({ actor, task, step, approvals });
if (!guardian.allowed) {
  await this.store.appendAudit({
    id: crypto.randomUUID(), scope: task.scope, actorUserId: actor.userId,
    taskId: task.id, workflowId: task.workflowId, module: step.module,
    action: 'execution.guardian.blocked', previousState: task.status,
    resultingState: 'blocked', evidenceIds: [], correlationId: null,
    createdAt: new Date().toISOString()
  });
  return { state: 'blocked', reason: guardian.reason };
}
```

Remove the old task-permission loop from `engine.ts`; the Guardian helper now owns task + step permission evaluation once.

- [ ] **Step 5: Audit adapter authorization/execution/verification failures**

For each current return path after preflight, append one event before returning:

```ts
await this.store.appendAudit({
  id: crypto.randomUUID(), scope: task.scope, actorUserId: actor.userId,
  taskId: task.id, workflowId: task.workflowId, module: step.module,
  action: 'execution.step.failed', previousState: step.status,
  resultingState: 'failed', evidenceIds: [], correlationId: null,
  createdAt: new Date().toISOString()
});
```

Use `execution.guardian.blocked` for validation/authorization denial and `execution.step.failed` for provider execution or verification failure. Do not claim provider execution occurred when preflight blocked it.

- [ ] **Step 6: Restore task state after a satisfied approval**

When a valid approved binding permits execution and another step remains, persist task status as `now` instead of leaving it stuck in `awaiting_approval`:

```ts
const nextTaskStatus = nextStep
  ? (task.status === 'awaiting_approval' ? 'now' : task.status)
  : 'completed';
```

- [ ] **Step 7: Run tests and commit**

```bash
npx vitest run tests/unit/guardian-preflight.test.ts tests/unit/execution-engine-guardian.test.ts tests/unit/execution-engine-regressions.test.ts
git add packages/execution/src/store.ts packages/execution/src/engine.ts tests/unit/execution-engine-guardian.test.ts
git commit -m "feat: enforce Guardian preflight in execution engine"
```

---

### Task 3: Enforce verified evidence before engine completion

**Files:**
- Modify: `packages/execution/src/engine.ts`
- Modify: `tests/unit/execution-engine-guardian.test.ts`

**Interfaces:**
- Consumes: existing `missingEvidence(requiredKinds, evidence)`.
- Produces: no `completed_step` result for a step whose required evidence is missing or unverified.

- [ ] **Step 1: Add failing evidence tests**

```ts
it('does not complete a step when required verification evidence is missing', async () => {
  const store = MemoryExecutionStore.seeded();
  const engine = new ExecutionEngine(store, new ExecutionAdapterRegistry([{
    module: 'payroll', canHandle: () => true,
    validate: async () => ({ ok: true, errors: [] }),
    authorize: async () => ({ ok: true, reason: null }),
    execute: async () => ({ ok: true, result: {} }),
    verify: async () => ({ ok: true, evidence: [] }),
    suggestNext: async () => null
  }]));

  await expect(engine.continueTask('task-1', actor)).resolves.toEqual({
    state: 'failed', reason: 'required_evidence_missing:payroll_record'
  });
  expect((await store.listSteps('task-1'))[0].status).toBe('failed');
  expect((await store.getTask('task-1'))?.status).not.toBe('completed');
});

it('completes only when required evidence is verified', async () => {
  // Same adapter, but verify returns [{ kind:'payroll_record', reference:'payroll://enrollment/42', verified:true }].
  // Expect completed_step and persisted verified evidence.
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/execution-engine-guardian.test.ts
```

Expected: first test fails because current engine completes after `verification.ok === true` even with missing required evidence.

- [ ] **Step 3: Gate completion with the existing evidence helper**

After `adapter.verify(...)` succeeds and before persisting `completedStep`:

```ts
const missing = missingEvidence(step.evidenceRequirement, verification.evidence);
if (missing.length > 0) {
  await this.store.saveStep({ ...step, status: 'failed' });
  await this.store.appendAudit({
    id: crypto.randomUUID(), scope: task.scope, actorUserId: actor.userId,
    taskId: task.id, workflowId: task.workflowId, module: step.module,
    action: 'execution.step.verification_failed', previousState: step.status,
    resultingState: 'failed', evidenceIds: [], correlationId: null,
    createdAt: new Date().toISOString()
  });
  return { state: 'failed', reason: `required_evidence_missing:${missing[0]}` };
}
```

Do not append provider-returned evidence until this gate has passed; this avoids persisting an apparently successful completion package when the adapter failed its required-evidence contract.

- [ ] **Step 4: Audit successful completion with exact evidence IDs**

Build evidence rows first, append them, then append:

```ts
{
  action: 'execution.step.completed',
  previousState: step.status,
  resultingState: 'completed',
  evidenceIds: persistedEvidence.map((item) => item.id)
}
```

- [ ] **Step 5: Verify GREEN and commit**

```bash
npx vitest run tests/unit/execution-engine-guardian.test.ts tests/unit/execution-engine-regressions.test.ts tests/unit/execution-state-machine.test.ts
git add packages/execution/src/engine.ts tests/unit/execution-engine-guardian.test.ts
git commit -m "fix: require verified evidence before execution completion"
```

---

### Task 4: Make Supabase approval binding reuse the shared Guardian action payload

**Files:**
- Modify: `supabase/functions/atlas-execution/index.ts`
- Create: `tests/unit/atlas-execution-guardian-contract.test.ts`

**Interfaces:**
- Consumes: `guardianReviewedAction` from `packages/execution/src/guardian.ts`.
- Produces: one reviewed-action payload definition for engine and Edge approval binding.

- [ ] **Step 1: Write the failing server-contract regression test**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('supabase/functions/atlas-execution/index.ts', 'utf8');

describe('atlas-execution Guardian contract', () => {
  it('reuses the shared reviewed-action payload', () => {
    expect(source).toContain("guardianReviewedAction");
    expect(source).not.toContain('function reviewedAction(');
  });

  it('keeps organization scope on workflow, task, approval and step reads', () => {
    expect(source.match(/\.eq\('org_id', (?:orgId|context\.orgId)\)/g)?.length ?? 0).toBeGreaterThanOrEqual(8);
  });

  it('keeps stale approval and completion evidence fail-closed guards', () => {
    expect(source).toContain('approval_binding_mismatch');
    expect(source).toContain('completion_requirements_not_met');
    expect(source).toContain('verified_evidence_resolver_required');
  });

  it('audits approval decisions', () => {
    expect(source).toContain('execution.approval.${decision}');
  });
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/atlas-execution-guardian-contract.test.ts
```

Expected: FAIL because Edge currently defines its own `reviewedAction` helper.

- [ ] **Step 3: Replace the duplicate helper with the shared contract**

Import:

```ts
import { guardianReviewedAction } from '../../../packages/execution/src/guardian.ts';
```

At both request and decision digest sites, map persisted snake-case rows once into the canonical shape needed by `guardianReviewedAction`:

```ts
const reviewedPayload = guardianReviewedAction(
  {
    id: String(task.id), workflowId: String(task.workflow_id),
    scope: { tenantId: String(task.tenant_id), organizationId: context.orgId },
    module: String(task.module), ownerUserId: task.owner_user_id ? String(task.owner_user_id) : null,
    title: String(task.title || ''), intent: String(task.intent || ''), goal: String(task.goal || ''),
    status: String(task.status) as ExecutionStatus, priority: String(task.priority || 'normal') as any,
    currentStepId: task.current_step_id ? String(task.current_step_id) : null,
    nextAction: task.next_action ? String(task.next_action) : null,
    blockedReason: task.blocked_reason ? String(task.blocked_reason) : null,
    permissionsRequired: Array.isArray(task.permissions_required) ? task.permissions_required.map(String) : [],
    source: null, parentTaskId: task.parent_task_id ? String(task.parent_task_id) : null,
    version: Number(task.version), createdAt: String(task.created_at || ''), updatedAt: String(task.updated_at || ''),
    completedAt: task.completed_at ? String(task.completed_at) : null
  },
  {
    id: String(step.id), taskId: String(task.id), sequence: Number(step.sequence || 0), module: String(step.module),
    actionType: String(step.action_type),
    actionPayload: step.action_payload && typeof step.action_payload === 'object' ? step.action_payload as Record<string, unknown> : {},
    status: String(step.status) as any,
    completionCriteria: Array.isArray(step.completion_criteria) ? step.completion_criteria.map(String) : [],
    permissionsRequired: Array.isArray(step.permissions_required) ? step.permissions_required.map(String) : [],
    dependencyIds: [], evidenceRequirement: Array.isArray(step.evidence_requirement) ? step.evidence_requirement.map(String) : [],
    startedAt: step.started_at ? String(step.started_at) : null,
    completedAt: step.completed_at ? String(step.completed_at) : null
  }
);
```

If this mapping makes `index.ts` materially less readable, extract only this row-normalization into `supabase/functions/atlas-execution/normalize.ts`; do not create a second Guardian policy implementation.

- [ ] **Step 4: Re-run the server contract and package tests**

```bash
npx vitest run tests/unit/atlas-execution-guardian-contract.test.ts tests/unit/guardian-preflight.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/atlas-execution/index.ts supabase/functions/atlas-execution/normalize.ts tests/unit/atlas-execution-guardian-contract.test.ts packages/execution/src/guardian.ts
git commit -m "refactor: share Guardian approval binding contract"
```

If `normalize.ts` was not needed, omit it from `git add`.

---

### Task 5: Prove fail-closed scope, approval, evidence, and audit behavior together

**Files:**
- Modify: `tests/unit/execution-engine-guardian.test.ts`
- Modify: `tests/unit/atlas-execution-guardian-contract.test.ts`

**Interfaces:**
- Produces: acceptance-level regression evidence for the Guardian core.

- [ ] **Step 1: Add a cross-scope engine regression**

```ts
it('never resolves or executes an adapter across tenant scope', async () => {
  const store = MemoryExecutionStore.seeded();
  const execute = vi.fn(async () => ({ ok: true, result: {} }));
  const engine = new ExecutionEngine(store, new ExecutionAdapterRegistry([adapter(execute)]));
  const wrongActor = { ...actor, scope: { tenantId: 'other-tenant', organizationId: 'org-1' } };

  await expect(engine.continueTask('task-1', wrongActor)).rejects.toThrow('execution_scope_mismatch');
  expect(execute).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Add stale-approval execution regression**

Create a valid approved binding, then change the current step payload before `continueTask`; expect `{ state:'blocked', reason:'approval_binding_mismatch' }` and `execute` not called.

- [ ] **Step 3: Add audit completeness assertions**

For one successful step assert the final audit event contains:

```ts
expect(event).toMatchObject({
  actorUserId: 'executor-1',
  taskId: 'task-1',
  workflowId: 'workflow-1',
  module: 'payroll',
  action: 'execution.step.completed',
  resultingState: 'completed'
});
expect(event?.evidenceIds).toHaveLength(1);
```

- [ ] **Step 4: Run the Guardian core focused suite**

```bash
npx vitest run \
  tests/unit/guardian-preflight.test.ts \
  tests/unit/execution-engine-guardian.test.ts \
  tests/unit/execution-engine-regressions.test.ts \
  tests/unit/atlas-execution-guardian-contract.test.ts \
  tests/unit/execution-state-machine.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit regression evidence**

```bash
git add tests/unit/execution-engine-guardian.test.ts tests/unit/atlas-execution-guardian-contract.test.ts
git commit -m "test: prove Guardian core fail-closed invariants"
```

---

### Task 6: Final core verification

**Files:**
- No production file changes expected.

- [ ] **Step 1: Install exact locked dependencies**

```bash
npm ci
```

Expected: exit 0.

- [ ] **Step 2: Run security audit at the repository's production threshold**

```bash
npm audit --audit-level=high
```

Expected: exit 0 for high-or-greater vulnerabilities.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 4: Run unit tests**

```bash
npm run test:unit
```

Expected: exit 0.

- [ ] **Step 5: Run integration tests**

```bash
npm run test:integration
```

Expected: exit 0.

- [ ] **Step 6: Run production build**

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 7: Record the exact verified commit SHA**

```bash
git rev-parse HEAD
git status --short
```

Expected: clean worktree. Do not claim Guardian core completion unless all commands above ran successfully on this exact SHA.
