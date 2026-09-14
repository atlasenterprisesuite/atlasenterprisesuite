# ATLAS Guardian Core Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce the ATLAS Guardian Doctrine inside the canonical Universal Execution Engine and `atlas-execution` server contract so permissions, approvals, tenant scope, verification, evidence, and audit fail closed.

**Architecture:** Extend the existing `packages/execution` contracts only. Add one pure Guardian preflight that evaluates canonical task/step permissions and approval binding; wire it into `ExecutionEngine`; reuse the existing `missingEvidence`, approval digest, adapter authorization, and audit contracts. The Supabase Edge function must reuse the same reviewed-action payload rather than maintain a duplicate binding definition.

**Tech Stack:** TypeScript 5.7, Vitest 3.2, Supabase Edge Functions/Deno, existing `packages/execution`.

**Spec:** `docs/superpowers/specs/2026-09-13-atlas-guardian-doctrine-design.md`

## Global Constraints

- Repository: `atlasenterprisesuite/atlasenterprisesuite`.
- Execution branch: `feat/atlas-guardian-doctrine`, created from current `main` in an isolated worktree.
- No second workflow engine, policy store, Approval Center, tenant model, audit store, or evidence store.
- `execution.approve` in `ExecutionStep.permissionsRequired` means approval is required; the executor does not need to be the approver.
- Every other task/step permission must be held by the executor before adapter resolution.
- Cross-tenant or cross-organization execution throws `execution_scope_mismatch` before adapter resolution.
- Approved actions bind to current `task.version` plus exact task/workflow/module/step/actionType/actionPayload.
- Required evidence must be present and verified before a step can be marked completed.
- Blocked, failed, and completed material outcomes added here emit `ExecutionAuditEvent` records.
- Budget, provider-capability, autonomy, and browser-envelope policy remain owned by `docs/superpowers/plans/2026-09-12-atlas-work-sovereign-router-policy.md`.
- No merge or production deploy in this plan.

## File Map

- `packages/execution/src/guardian.ts` — reviewed-action binding + Guardian preflight.
- `packages/execution/src/index.ts` — exports.
- `packages/execution/src/store.ts` — in-memory approval/audit test helpers.
- `packages/execution/src/engine.ts` — preflight, evidence gate, audit.
- `supabase/functions/atlas-execution/normalize.ts` — persisted row -> canonical execution types.
- `supabase/functions/atlas-execution/index.ts` — shared Guardian reviewed-action binding.
- `tests/unit/guardian-preflight.test.ts` — preflight matrix.
- `tests/unit/execution-engine-guardian.test.ts` — engine invariants.
- `tests/unit/atlas-execution-guardian-contract.test.ts` — Edge contract regression.

---

### Task 1: Add canonical Guardian preflight

**Files:**
- Create: `packages/execution/src/guardian.ts`
- Modify: `packages/execution/src/index.ts`
- Test: `tests/unit/guardian-preflight.test.ts`

**Interfaces:**
- Consumes: `ExecutionActor`, `ExecutionTask`, `ExecutionStep`, `ExecutionApproval`, `assertSameScope`, `digestApprovalPayload`, `approvalMatchesPayload`.
- Produces: `GuardianPreflightDecision`, `guardianReviewedAction`, `evaluateGuardianPreflight`.

- [ ] **Step 1: Write failing tests**

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

async function approvedFixture() {
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
    const { task, step } = await approvedFixture();
    const wrong: ExecutionActor = {
      ...actor(['payroll.write']),
      scope: { tenantId: 'tenant-2', organizationId: 'org-1' }
    };
    await expect(evaluateGuardianPreflight({ actor: wrong, task, step, approvals: [] }))
      .rejects.toThrow('execution_scope_mismatch');
  });

  it('blocks a missing step permission', async () => {
    const { task, step } = await approvedFixture();
    task.status = 'now';
    step.permissionsRequired = ['payroll.write'];
    await expect(evaluateGuardianPreflight({ actor: actor([]), task, step, approvals: [] }))
      .resolves.toEqual({ allowed: false, reason: 'missing_step_permission:payroll.write' });
  });

  it('requires approval without requiring executor execution.approve permission', async () => {
    const { task, step } = await approvedFixture();
    await expect(evaluateGuardianPreflight({ actor: actor(['payroll.write']), task, step, approvals: [] }))
      .resolves.toEqual({ allowed: false, reason: 'approval_required' });
  });

  it('accepts an exact approved binding', async () => {
    const { task, step, approval } = await approvedFixture();
    await expect(evaluateGuardianPreflight({ actor: actor(['payroll.write']), task, step, approvals: [approval] }))
      .resolves.toEqual({ allowed: true, reason: 'guardian_preflight_passed', approvalId: 'approval-1' });
  });

  it('rejects a stale binding after payload mutation', async () => {
    const { task, step, approval } = await approvedFixture();
    step.actionPayload = { employeeId: 'employee-99' };
    await expect(evaluateGuardianPreflight({ actor: actor(['payroll.write']), task, step, approvals: [approval] }))
      .resolves.toEqual({ allowed: false, reason: 'approval_binding_mismatch' });
  });
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/guardian-preflight.test.ts
```

Expected: FAIL because Guardian exports do not exist.

- [ ] **Step 3: Implement `guardian.ts`**

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

  const requiresApproval = input.task.status === 'awaiting_approval'
    || input.step.status === 'awaiting_approval'
    || input.step.permissionsRequired.includes('execution.approve');
  if (!requiresApproval) {
    return { allowed: true, reason: 'guardian_preflight_passed', approvalId: null };
  }

  const digest = await digestApprovalPayload({
    payloadVersion: input.task.version,
    payload: guardianReviewedAction(input.task, input.step)
  });
  const approval = input.approvals.find((candidate) =>
    candidate.taskId === input.task.id
    && candidate.workflowId === input.task.workflowId
    && candidate.module === input.step.module
    && approvalMatchesPayload(candidate, input.task.version, digest)
  );
  if (approval) {
    return { allowed: true, reason: 'guardian_preflight_passed', approvalId: approval.id };
  }

  const stale = input.approvals.some((candidate) =>
    candidate.taskId === input.task.id && candidate.status === 'approved'
  );
  return { allowed: false, reason: stale ? 'approval_binding_mismatch' : 'approval_required' };
}
```

Add to `packages/execution/src/index.ts`:

```ts
export * from './guardian';
```

- [ ] **Step 4: Verify GREEN**

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

### Task 2: Enforce Guardian preflight, evidence, and audit in `ExecutionEngine`

**Files:**
- Modify: `packages/execution/src/store.ts`
- Modify: `packages/execution/src/engine.ts`
- Create: `tests/unit/execution-engine-guardian.test.ts`

**Interfaces:**
- Consumes: `evaluateGuardianPreflight`, `missingEvidence`, existing adapter/store interfaces.
- Produces: fail-closed engine behavior and audit evidence.

- [ ] **Step 1: Write failing engine tests**

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

function adapter(input: {
  execute?: ExecutionModuleAdapter['execute'];
  verify?: ExecutionModuleAdapter['verify'];
} = {}): ExecutionModuleAdapter {
  return {
    module: 'payroll',
    canHandle: () => true,
    validate: async () => ({ ok: true, errors: [] }),
    authorize: async () => ({ ok: true, reason: null }),
    execute: input.execute ?? (async () => ({ ok: true, result: {} })),
    verify: input.verify ?? (async () => ({
      ok: true,
      evidence: [{ kind: 'payroll_record', reference: 'payroll://42', verified: true }]
    })),
    suggestNext: async () => null
  };
}

describe('ExecutionEngine Guardian enforcement', () => {
  it('blocks missing step permission before execute and audits the block', async () => {
    const store = MemoryExecutionStore.seeded();
    const step = (await store.listSteps('task-1'))[0];
    step.permissionsRequired = ['payroll.write', 'payroll.submit'];
    store.putStep(step);
    const execute = vi.fn(async () => ({ ok: true, result: {} }));
    const engine = new ExecutionEngine(store, new ExecutionAdapterRegistry([adapter({ execute })]));

    await expect(engine.continueTask('task-1', actor)).resolves.toEqual({
      state: 'blocked', reason: 'missing_step_permission:payroll.submit'
    });
    expect(execute).not.toHaveBeenCalled();
    expect((await store.listAuditEvents('task-1')).at(-1)?.action).toBe('execution.guardian.blocked');
  });

  it('fails closed before adapter resolution across tenant scope', async () => {
    const store = MemoryExecutionStore.seeded();
    const execute = vi.fn(async () => ({ ok: true, result: {} }));
    const engine = new ExecutionEngine(store, new ExecutionAdapterRegistry([adapter({ execute })]));
    const wrongActor = { ...actor, scope: { tenantId: 'tenant-2', organizationId: 'org-1' } };

    await expect(engine.continueTask('task-1', wrongActor)).rejects.toThrow('execution_scope_mismatch');
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not complete when required evidence is missing', async () => {
    const store = MemoryExecutionStore.seeded();
    const engine = new ExecutionEngine(store, new ExecutionAdapterRegistry([adapter({
      verify: async () => ({ ok: true, evidence: [] })
    })]));

    await expect(engine.continueTask('task-1', actor)).resolves.toEqual({
      state: 'failed', reason: 'required_evidence_missing:payroll_record'
    });
    expect((await store.listSteps('task-1'))[0].status).toBe('failed');
    expect((await store.getTask('task-1'))?.status).not.toBe('completed');
  });

  it('completes with verified evidence and records evidence ids in audit', async () => {
    const store = MemoryExecutionStore.seeded();
    const engine = new ExecutionEngine(store, new ExecutionAdapterRegistry([adapter()]));

    await expect(engine.continueTask('task-1', actor)).resolves.toEqual({
      state: 'completed_step', stepId: 'step-1'
    });
    const evidence = await store.listEvidence('task-1');
    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({ kind: 'payroll_record', verified: true });
    const audit = await store.listAuditEvents('task-1');
    expect(audit.at(-1)).toMatchObject({
      actorUserId: 'executor-1', workflowId: 'workflow-1', module: 'payroll',
      action: 'execution.step.completed', resultingState: 'completed'
    });
    expect(audit.at(-1)?.evidenceIds).toEqual([evidence[0].id]);
  });
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/execution-engine-guardian.test.ts
```

Expected: FAIL because audit helpers and Guardian/evidence wiring are absent.

- [ ] **Step 3: Add deterministic in-memory helpers**

In `MemoryExecutionStore`:

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

Do not add these methods to `ExecutionStore`; they are test/diagnostic helpers only.

- [ ] **Step 4: Replace engine task-only permission check with Guardian preflight**

Add imports:

```ts
import { evaluateGuardianPreflight } from './guardian';
import { missingEvidence } from './evidence';
```

After resolving the current step and before `registry.resolve`:

```ts
const approvals = await this.store.listApprovals(taskId);
const guardian = await evaluateGuardianPreflight({ actor, task, step, approvals });
if (!guardian.allowed) {
  const createdAt = new Date().toISOString();
  await this.store.appendAudit({
    id: crypto.randomUUID(), scope: task.scope, actorUserId: actor.userId,
    taskId: task.id, workflowId: task.workflowId, module: step.module,
    action: 'execution.guardian.blocked', previousState: task.status,
    resultingState: 'blocked', evidenceIds: [], correlationId: null, createdAt
  });
  return { state: 'blocked', reason: guardian.reason };
}
```

Delete the existing task-only permission loop so permission evaluation occurs once.

- [ ] **Step 5: Enforce required evidence before completion**

Immediately after successful `adapter.verify`:

```ts
const missing = missingEvidence(step.evidenceRequirement, verification.evidence);
if (missing.length > 0) {
  const createdAt = new Date().toISOString();
  await this.store.saveStep({ ...step, status: 'failed' });
  await this.store.appendAudit({
    id: crypto.randomUUID(), scope: task.scope, actorUserId: actor.userId,
    taskId: task.id, workflowId: task.workflowId, module: step.module,
    action: 'execution.step.verification_failed', previousState: step.status,
    resultingState: 'failed', evidenceIds: [], correlationId: null, createdAt
  });
  return { state: 'failed', reason: `required_evidence_missing:${missing[0]}` };
}
```

- [ ] **Step 6: Persist evidence first, then audit successful completion**

Replace the existing direct evidence loop with:

```ts
const persistedEvidence = verification.evidence.map((item) => ({
  id: crypto.randomUUID(), taskId, stepId: step.id,
  kind: item.kind, reference: item.reference, verified: item.verified,
  createdAt: completedAt
}));
for (const item of persistedEvidence) await this.store.appendEvidence(item);

await this.store.appendAudit({
  id: crypto.randomUUID(), scope: task.scope, actorUserId: actor.userId,
  taskId: task.id, workflowId: task.workflowId, module: step.module,
  action: 'execution.step.completed', previousState: step.status,
  resultingState: 'completed', evidenceIds: persistedEvidence.map((item) => item.id),
  correlationId: null, createdAt: completedAt
});
```

For adapter validation/authorization denial append `execution.guardian.blocked`; for provider execute/verify failure append `execution.step.failed` before returning.

- [ ] **Step 7: Normalize post-approval task status**

When another step remains:

```ts
const nextTaskStatus = nextStep
  ? (task.status === 'awaiting_approval' ? 'now' : task.status)
  : 'completed';
```

Use `status: nextTaskStatus` in `saveTask`.

- [ ] **Step 8: Verify GREEN and regressions**

```bash
npx vitest run \
  tests/unit/execution-engine-guardian.test.ts \
  tests/unit/execution-engine-regressions.test.ts \
  tests/unit/guardian-preflight.test.ts \
  tests/unit/execution-state-machine.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/execution/src/store.ts packages/execution/src/engine.ts tests/unit/execution-engine-guardian.test.ts
git commit -m "feat: enforce Guardian invariants in execution engine"
```

---

### Task 3: Share Guardian approval binding with the Edge function

**Files:**
- Create: `supabase/functions/atlas-execution/normalize.ts`
- Modify: `supabase/functions/atlas-execution/index.ts`
- Create: `tests/unit/atlas-execution-guardian-contract.test.ts`

**Interfaces:**
- Consumes: `guardianReviewedAction`, persisted task/step rows.
- Produces: `normalizeExecutionTaskRow`, `normalizeExecutionStepRow`; Edge approval request/decision use the canonical reviewed-action payload.

- [ ] **Step 1: Write the failing Edge contract test**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('supabase/functions/atlas-execution/index.ts', 'utf8');

describe('atlas-execution Guardian contract', () => {
  it('uses shared Guardian approval binding', () => {
    expect(source).toContain("guardianReviewedAction");
    expect(source).toContain("normalizeExecutionTaskRow");
    expect(source).toContain("normalizeExecutionStepRow");
    expect(source).not.toContain('function reviewedAction(');
  });

  it('retains fail-closed completion and approval guards', () => {
    expect(source).toContain('approval_binding_mismatch');
    expect(source).toContain('completion_requirements_not_met');
    expect(source).toContain('verified_evidence_resolver_required');
  });

  it('keeps material approval audit events', () => {
    expect(source).toContain('execution.approval.requested');
    expect(source).toContain('execution.approval.${decision}');
  });

  it('scopes canonical reads by organization', () => {
    const matches = source.match(/\.eq\('org_id', (?:orgId|context\.orgId)\)/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(8);
  });
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/atlas-execution-guardian-contract.test.ts
```

Expected: FAIL because Edge still defines local `reviewedAction`.

- [ ] **Step 3: Create exact row normalizers**

Create `supabase/functions/atlas-execution/normalize.ts`:

```ts
import type {
  ExecutionPriority,
  ExecutionStatus,
  ExecutionStep,
  ExecutionTask,
  StepStatus
} from '../../../packages/execution/src/types.ts';

export function normalizeExecutionTaskRow(row: Record<string, unknown>, orgId: string): ExecutionTask {
  return {
    id: String(row.id),
    scope: { tenantId: String(row.tenant_id), organizationId: orgId },
    module: String(row.module),
    ownerUserId: row.owner_user_id ? String(row.owner_user_id) : null,
    title: String(row.title || ''), intent: String(row.intent || ''), goal: String(row.goal || ''),
    status: String(row.status) as ExecutionStatus,
    priority: String(row.priority || 'normal') as ExecutionPriority,
    currentStepId: row.current_step_id ? String(row.current_step_id) : null,
    nextAction: row.next_action ? String(row.next_action) : null,
    blockedReason: row.blocked_reason ? String(row.blocked_reason) : null,
    permissionsRequired: Array.isArray(row.permissions_required) ? row.permissions_required.map(String) : [],
    source: row.source_type && row.source_id ? { type: String(row.source_type), id: String(row.source_id) } : null,
    parentTaskId: row.parent_task_id ? String(row.parent_task_id) : null,
    workflowId: String(row.workflow_id), version: Number(row.version),
    createdAt: String(row.created_at || ''), updatedAt: String(row.updated_at || ''),
    completedAt: row.completed_at ? String(row.completed_at) : null
  };
}

export function normalizeExecutionStepRow(row: Record<string, unknown>, taskId: string): ExecutionStep {
  return {
    id: String(row.id), taskId, sequence: Number(row.sequence || 0), module: String(row.module),
    actionType: String(row.action_type),
    actionPayload: row.action_payload && typeof row.action_payload === 'object'
      ? row.action_payload as Record<string, unknown> : {},
    status: String(row.status) as StepStatus,
    completionCriteria: Array.isArray(row.completion_criteria) ? row.completion_criteria.map(String) : [],
    permissionsRequired: Array.isArray(row.permissions_required) ? row.permissions_required.map(String) : [],
    dependencyIds: [],
    evidenceRequirement: Array.isArray(row.evidence_requirement) ? row.evidence_requirement.map(String) : [],
    startedAt: row.started_at ? String(row.started_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null
  };
}
```

- [ ] **Step 4: Replace local `reviewedAction` in Edge**

Add imports:

```ts
import { guardianReviewedAction } from '../../../packages/execution/src/guardian.ts';
import { normalizeExecutionStepRow, normalizeExecutionTaskRow } from './normalize.ts';
```

Delete the local `reviewedAction` function. In `requestApproval`:

```ts
const reviewedPayload = guardianReviewedAction(
  normalizeExecutionTaskRow(task as Record<string, unknown>, context.orgId),
  normalizeExecutionStepRow(step as Record<string, unknown>, String(task.id))
);
const payloadDigest = await digestApprovalPayload({ payloadVersion: bindingVersion, payload: reviewedPayload });
```

In `decideApproval`:

```ts
const currentDigest = await digestApprovalPayload({
  payloadVersion: currentVersion,
  payload: guardianReviewedAction(
    normalizeExecutionTaskRow(task as Record<string, unknown>, context.orgId),
    normalizeExecutionStepRow(step as Record<string, unknown>, String(task.id))
  )
});
```

- [ ] **Step 5: Verify GREEN**

```bash
npx vitest run tests/unit/atlas-execution-guardian-contract.test.ts tests/unit/guardian-preflight.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/atlas-execution/normalize.ts supabase/functions/atlas-execution/index.ts tests/unit/atlas-execution-guardian-contract.test.ts
git commit -m "refactor: share Guardian approval binding with edge execution"
```

---

### Task 4: Final core verification

**Files:**
- No production file changes.

- [ ] **Step 1: Exact dependency install**

```bash
npm ci
```

Expected: exit 0.

- [ ] **Step 2: Security threshold**

```bash
npm audit --audit-level=high
```

Expected: exit 0.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 4: Unit tests**

```bash
npm run test:unit
```

Expected: exit 0.

- [ ] **Step 5: Integration tests**

```bash
npm run test:integration
```

Expected: exit 0.

- [ ] **Step 6: Production build**

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 7: Record exact verified SHA**

```bash
git rev-parse HEAD
git status --short
```

Expected: SHA printed and clean worktree. Do not claim core Guardian integration unless every command above passed on that SHA.
