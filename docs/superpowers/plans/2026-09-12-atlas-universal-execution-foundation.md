# ATLAS Universal Execution Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first production-grade shared execution foundation for ATLAS: a module-neutral task/workflow engine with governed state transitions, evidence and approval contracts, cross-module adapters, Supabase persistence/RLS, and an authenticated server-side execution API.

**Architecture:** Add a new private workspace package, `@atlas/execution`, containing pure TypeScript domain contracts and orchestration primitives. Persist workflow state in dedicated Supabase tables protected by organization membership RLS, and expose mutations through a new authenticated `atlas-execution` Edge Function so browsers and modules do not bypass authorization or audit requirements. This plan deliberately stops before universal UI and ATLAS Assistant/Voice adoption; those consumers will use the stable contracts created here.

**Tech Stack:** TypeScript 5.7, npm workspaces, Vitest 3, Supabase/Postgres with RLS, Supabase Edge Functions (Deno + `@supabase/supabase-js@2`).

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-universal-execution-engine-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`; target branch: `feat/universal-execution-engine`.
- Reuse existing ATLAS tenancy, organization membership, Supabase, Vitest, and Edge Function patterns before introducing dependencies.
- Never create shadow business records in the execution tables; store references to authoritative domain records.
- Never fabricate evidence, provider state, approval state, execution state, metrics, users, balances, employees, patients, or external acknowledgements.
- A task may enter `completed` only after completion criteria, dependencies, approvals, evidence, and verification requirements pass.
- All organization-scoped persistence must enforce tenant isolation through RLS and server-side authorization.
- Secrets, provider credentials, tokens, passwords, certificates, and recovery codes must never be stored in execution payloads or audit events.
- High-risk or irreversible actions must fail closed into `awaiting_approval` when policy requires approval.
- Use TDD for every engine behavior: failing test -> minimal implementation -> passing test -> focused commit.
- Full verification before integration: `npm run typecheck`, `npm test`, `npm run build`.

---

## File Map

The implementation should create these focused units:

- `packages/execution/package.json` — workspace metadata only.
- `packages/execution/src/types.ts` — canonical task/workflow/step/evidence/approval/audit types and status constants.
- `packages/execution/src/state-machine.ts` — legal state transitions and completion gating.
- `packages/execution/src/progress.ts` — dependency resolution and current/next step selection.
- `packages/execution/src/context.ts` — safe cross-module handoff envelopes.
- `packages/execution/src/evidence.ts` — evidence requirement evaluation.
- `packages/execution/src/approvals.ts` — approval binding and decision validation.
- `packages/execution/src/adapter.ts` — module adapter contract and registry.
- `packages/execution/src/store.ts` — persistence interface plus deterministic in-memory test implementation.
- `packages/execution/src/engine.ts` — orchestration service coordinating adapters, store, transitions, evidence, and approvals.
- `packages/execution/src/index.ts` — public exports.
- `supabase/migrations/20260912_universal_execution_engine.sql` — execution persistence, indexes, RLS, grants, and audit append-only rules.
- `supabase/functions/atlas-execution/index.ts` — authenticated organization-scoped server API.
- `tests/unit/execution-types.test.ts` — canonical vocabulary and source-of-truth constraints.
- `tests/unit/execution-state-machine.test.ts` — legal/illegal transitions and completion gating.
- `tests/unit/execution-progress.test.ts` — dependency/current/next behavior and context handoff.
- `tests/unit/execution-approval-evidence.test.ts` — approval binding and evidence rules.
- `tests/unit/execution-engine.test.ts` — adapter registry and orchestration behavior.
- `tests/integration/execution-schema-contract.test.ts` — SQL/RLS/grant/audit schema contract.
- `tests/integration/execution-edge-contract.test.ts` — authenticated Edge Function boundary contract.
- `tests/integration/execution-cross-module-workflow.test.ts` — end-to-end HR -> Payroll handoff using fake domain adapters and the real execution engine.

---

### Task 1: Create the canonical execution domain package

**Files:**
- Create: `packages/execution/package.json`
- Create: `packages/execution/src/types.ts`
- Create: `packages/execution/src/index.ts`
- Test: `tests/unit/execution-types.test.ts`

**Interfaces:**
- Consumes: no earlier task interfaces.
- Produces: `ExecutionStatus`, `ExecutionTask`, `ExecutionStep`, `ExecutionWorkflow`, `ExecutionEvidence`, `ExecutionApproval`, `ExecutionAuditEvent`, `ExecutionScope`, `ExecutionActor`, `EXECUTION_STATUSES`, `USER_FACING_EXECUTION_STATUSES`.

- [ ] **Step 1: Write the failing vocabulary test**

Create `tests/unit/execution-types.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  EXECUTION_STATUSES,
  USER_FACING_EXECUTION_STATUSES,
  type ExecutionTask
} from '../../packages/execution/src';

describe('ATLAS execution domain vocabulary', () => {
  it('exports the universal user-facing states without arbitrary module status strings', () => {
    expect(USER_FACING_EXECUTION_STATUSES).toEqual([
      'now',
      'next',
      'blocked',
      'awaiting_approval',
      'completed'
    ]);
    expect(EXECUTION_STATUSES).toContain('failed');
    expect(EXECUTION_STATUSES).toContain('cancelled');
  });

  it('keeps authoritative domain records as references instead of shadow data', () => {
    const task: ExecutionTask = {
      id: 'task-1',
      scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
      module: 'hr',
      ownerUserId: 'user-1',
      title: 'Provision payroll enrollment',
      intent: 'Complete employee onboarding',
      goal: 'Create payroll enrollment from the authoritative HR employee',
      status: 'now',
      priority: 'high',
      currentStepId: 'step-1',
      nextAction: 'Validate payroll prerequisites',
      blockedReason: null,
      permissionsRequired: ['payroll.write'],
      source: { type: 'employee', id: 'employee-42' },
      parentTaskId: null,
      workflowId: 'workflow-1',
      version: 1,
      createdAt: '2026-09-12T12:00:00.000Z',
      updatedAt: '2026-09-12T12:00:00.000Z',
      completedAt: null
    };

    expect(task.source).toEqual({ type: 'employee', id: 'employee-42' });
    expect(task).not.toHaveProperty('employeeRecord');
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx vitest run tests/unit/execution-types.test.ts
```

Expected: FAIL because `packages/execution/src` does not exist.

- [ ] **Step 3: Add the workspace package and canonical types**

Create `packages/execution/package.json`:

```json
{
  "name": "@atlas/execution",
  "private": true,
  "version": "0.1.0",
  "type": "module"
}
```

Create `packages/execution/src/types.ts` with these exact public contracts:

```ts
export const USER_FACING_EXECUTION_STATUSES = [
  'now',
  'next',
  'blocked',
  'awaiting_approval',
  'completed'
] as const;

export const EXECUTION_STATUSES = [
  'draft',
  ...USER_FACING_EXECUTION_STATUSES,
  'delegated',
  'automatable',
  'discarded',
  'failed',
  'cancelled'
] as const;

export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];
export type ExecutionPriority = 'low' | 'normal' | 'high' | 'critical';
export type StepStatus = 'pending' | 'ready' | 'running' | 'blocked' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';

export type ExecutionScope = {
  tenantId: string;
  organizationId: string;
};

export type ExecutionActor = {
  userId: string;
  scope: ExecutionScope;
  permissions: readonly string[];
};

export type DomainReference = {
  type: string;
  id: string;
};

export type ExecutionTask = {
  id: string;
  scope: ExecutionScope;
  module: string;
  ownerUserId: string | null;
  title: string;
  intent: string;
  goal: string;
  status: ExecutionStatus;
  priority: ExecutionPriority;
  currentStepId: string | null;
  nextAction: string | null;
  blockedReason: string | null;
  permissionsRequired: string[];
  source: DomainReference | null;
  parentTaskId: string | null;
  workflowId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type ExecutionStep = {
  id: string;
  taskId: string;
  sequence: number;
  module: string;
  actionType: string;
  actionPayload: Record<string, unknown>;
  status: StepStatus;
  completionCriteria: string[];
  permissionsRequired: string[];
  dependencyIds: string[];
  evidenceRequirement: string[];
  startedAt: string | null;
  completedAt: string | null;
};

export type ExecutionWorkflow = {
  id: string;
  scope: ExecutionScope;
  workflowType: string;
  ownerModule: string;
  status: ExecutionStatus;
  currentTaskId: string | null;
  currentModule: string;
  context: Record<string, unknown>;
  createdByUserId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type ExecutionEvidence = {
  id: string;
  taskId: string;
  stepId: string | null;
  kind: string;
  reference: string;
  verified: boolean;
  createdAt: string;
};

export type ExecutionApproval = {
  id: string;
  taskId: string;
  workflowId: string;
  module: string;
  requestedBy: string;
  approvalType: string;
  requiredPermission: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  payloadVersion: number;
  payloadDigest: string;
  status: ApprovalStatus;
  decidedBy: string | null;
  decisionReason: string | null;
  createdAt: string;
  decidedAt: string | null;
};

export type ExecutionAuditEvent = {
  id: string;
  scope: ExecutionScope;
  actorUserId: string;
  taskId: string | null;
  workflowId: string | null;
  module: string;
  action: string;
  previousState: string | null;
  resultingState: string | null;
  evidenceIds: string[];
  correlationId: string | null;
  createdAt: string;
};
```

Create `packages/execution/src/index.ts`:

```ts
export * from './types';
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npx vitest run tests/unit/execution-types.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the domain model**

```bash
git add packages/execution tests/unit/execution-types.test.ts
git commit -m "feat: add execution domain model"
```

---

### Task 2: Enforce task state transitions and completion evidence

**Files:**
- Create: `packages/execution/src/state-machine.ts`
- Modify: `packages/execution/src/index.ts`
- Test: `tests/unit/execution-state-machine.test.ts`

**Interfaces:**
- Consumes: `ExecutionStatus`, `ExecutionTask`, `ExecutionStep`, `ExecutionEvidence`, `ExecutionApproval` from Task 1.
- Produces: `canTransitionTask(from, to)`, `assertTaskTransition(from, to)`, `evaluateTaskCompletion(input)`.

- [ ] **Step 1: Write failing transition/completion tests**

Create `tests/unit/execution-state-machine.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { assertTaskTransition, evaluateTaskCompletion } from '../../packages/execution/src';

describe('ATLAS execution state machine', () => {
  it('rejects direct completion from draft', () => {
    expect(() => assertTaskTransition('draft', 'completed')).toThrow('invalid_execution_transition:draft->completed');
  });

  it('allows an actionable task to become blocked or await approval', () => {
    expect(() => assertTaskTransition('now', 'blocked')).not.toThrow();
    expect(() => assertTaskTransition('now', 'awaiting_approval')).not.toThrow();
  });

  it('refuses completion without verified evidence and required approvals', () => {
    expect(evaluateTaskCompletion({
      steps: [{ id: 'step-1', status: 'completed', evidenceRequirement: ['domain_record'] }],
      evidence: [{ id: 'ev-1', kind: 'domain_record', verified: false }],
      approvals: [{ status: 'approved', payloadVersion: 1, payloadDigest: 'abc' }],
      unresolvedDependencies: []
    })).toEqual({ eligible: false, reasons: ['unverified_evidence:domain_record'] });
  });

  it('permits completion only when every gate passes', () => {
    expect(evaluateTaskCompletion({
      steps: [{ id: 'step-1', status: 'completed', evidenceRequirement: ['domain_record'] }],
      evidence: [{ id: 'ev-1', kind: 'domain_record', verified: true }],
      approvals: [{ status: 'approved', payloadVersion: 1, payloadDigest: 'abc' }],
      unresolvedDependencies: []
    })).toEqual({ eligible: true, reasons: [] });
  });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/unit/execution-state-machine.test.ts
```

Expected: FAIL because the exported functions do not exist.

- [ ] **Step 3: Implement the minimal state machine**

Create `packages/execution/src/state-machine.ts`:

```ts
import type { ApprovalStatus, ExecutionStatus, StepStatus } from './types';

const transitions: Record<ExecutionStatus, readonly ExecutionStatus[]> = {
  draft: ['now', 'next', 'delegated', 'automatable', 'discarded', 'cancelled'],
  now: ['next', 'blocked', 'awaiting_approval', 'failed', 'completed', 'cancelled'],
  next: ['now', 'blocked', 'awaiting_approval', 'cancelled'],
  blocked: ['now', 'next', 'awaiting_approval', 'cancelled'],
  awaiting_approval: ['now', 'blocked', 'discarded', 'cancelled'],
  completed: [],
  delegated: ['now', 'blocked', 'completed', 'cancelled'],
  automatable: ['now', 'blocked', 'awaiting_approval', 'failed', 'completed', 'cancelled'],
  discarded: [],
  failed: ['now', 'blocked', 'cancelled'],
  cancelled: []
};

export function canTransitionTask(from: ExecutionStatus, to: ExecutionStatus) {
  return transitions[from].includes(to);
}

export function assertTaskTransition(from: ExecutionStatus, to: ExecutionStatus) {
  if (!canTransitionTask(from, to)) {
    throw new Error(`invalid_execution_transition:${from}->${to}`);
  }
}

export function evaluateTaskCompletion(input: {
  steps: Array<{ id: string; status: StepStatus; evidenceRequirement: string[] }>;
  evidence: Array<{ id: string; kind: string; verified: boolean }>;
  approvals: Array<{ status: ApprovalStatus; payloadVersion: number; payloadDigest: string }>;
  unresolvedDependencies: string[];
}) {
  const reasons: string[] = [];

  for (const step of input.steps) {
    if (step.status !== 'completed' && step.status !== 'cancelled') {
      reasons.push(`incomplete_step:${step.id}`);
    }
    for (const kind of step.evidenceRequirement) {
      const match = input.evidence.find((item) => item.kind === kind);
      if (!match) reasons.push(`missing_evidence:${kind}`);
      else if (!match.verified) reasons.push(`unverified_evidence:${kind}`);
    }
  }

  if (input.approvals.some((approval) => approval.status !== 'approved')) {
    reasons.push('approval_not_satisfied');
  }
  for (const dependency of input.unresolvedDependencies) {
    reasons.push(`unresolved_dependency:${dependency}`);
  }

  return { eligible: reasons.length === 0, reasons };
}
```

Update `packages/execution/src/index.ts`:

```ts
export * from './types';
export * from './state-machine';
```

- [ ] **Step 4: Run and verify GREEN**

```bash
npx vitest run tests/unit/execution-state-machine.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/execution/src tests/unit/execution-state-machine.test.ts
git commit -m "feat: govern execution task transitions"
```

---

### Task 3: Resolve dependencies, current action, and cross-module context

**Files:**
- Create: `packages/execution/src/progress.ts`
- Create: `packages/execution/src/context.ts`
- Modify: `packages/execution/src/index.ts`
- Test: `tests/unit/execution-progress.test.ts`

**Interfaces:**
- Consumes: `ExecutionScope`, `ExecutionStep`, `DomainReference`.
- Produces: `resolveCurrentStep(steps, completedDependencyIds)`, `buildContextHandoff(input)` and `assertSameScope(a, b)`.

- [ ] **Step 1: Write failing progress and handoff tests**

```ts
import { describe, expect, it } from 'vitest';
import { buildContextHandoff, resolveCurrentStep } from '../../packages/execution/src';

const baseSteps = [
  {
    id: 'hr-verify', taskId: 'task-1', sequence: 1, module: 'hr', actionType: 'verify_employee',
    actionPayload: {}, status: 'completed' as const, completionCriteria: [], permissionsRequired: [],
    dependencyIds: [], evidenceRequirement: [], startedAt: null, completedAt: '2026-09-12T12:00:00.000Z'
  },
  {
    id: 'payroll-enroll', taskId: 'task-1', sequence: 2, module: 'payroll', actionType: 'enroll_employee',
    actionPayload: {}, status: 'pending' as const, completionCriteria: [], permissionsRequired: ['payroll.write'],
    dependencyIds: ['hr-verify'], evidenceRequirement: ['payroll_record'], startedAt: null, completedAt: null
  }
];

describe('ATLAS execution progress', () => {
  it('selects the first dependency-satisfied unfinished step', () => {
    expect(resolveCurrentStep(baseSteps, new Set(['hr-verify']))?.id).toBe('payroll-enroll');
  });

  it('does not advance while a dependency is unresolved', () => {
    expect(resolveCurrentStep(baseSteps, new Set())).toBeNull();
  });

  it('hands off references and next action without copying source records', () => {
    expect(buildContextHandoff({
      workflowId: 'workflow-1',
      fromModule: 'hr',
      toModule: 'payroll',
      scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
      references: [{ type: 'employee', id: 'employee-42' }],
      nextAction: 'Enroll employee in payroll'
    })).toEqual({
      workflowId: 'workflow-1',
      fromModule: 'hr',
      toModule: 'payroll',
      scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
      references: [{ type: 'employee', id: 'employee-42' }],
      nextAction: 'Enroll employee in payroll'
    });
  });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/unit/execution-progress.test.ts
```

Expected: FAIL because progress/context exports are absent.

- [ ] **Step 3: Implement dependency selection and handoff**

Create `packages/execution/src/progress.ts`:

```ts
import type { ExecutionStep } from './types';

export function resolveCurrentStep(
  steps: readonly ExecutionStep[],
  completedDependencyIds: ReadonlySet<string>
) {
  return [...steps]
    .sort((a, b) => a.sequence - b.sequence)
    .find((step) => {
      if (step.status === 'completed' || step.status === 'cancelled') return false;
      return step.dependencyIds.every((id) => completedDependencyIds.has(id));
    }) ?? null;
}
```

Create `packages/execution/src/context.ts`:

```ts
import type { DomainReference, ExecutionScope } from './types';

export function assertSameScope(a: ExecutionScope, b: ExecutionScope) {
  if (a.tenantId !== b.tenantId || a.organizationId !== b.organizationId) {
    throw new Error('execution_scope_mismatch');
  }
}

export function buildContextHandoff(input: {
  workflowId: string;
  fromModule: string;
  toModule: string;
  scope: ExecutionScope;
  references: DomainReference[];
  nextAction: string;
}) {
  return {
    workflowId: input.workflowId,
    fromModule: input.fromModule,
    toModule: input.toModule,
    scope: { ...input.scope },
    references: input.references.map((reference) => ({ ...reference })),
    nextAction: input.nextAction
  };
}
```

Update `packages/execution/src/index.ts` to export both modules.

- [ ] **Step 4: Run and verify GREEN**

```bash
npx vitest run tests/unit/execution-progress.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/execution/src tests/unit/execution-progress.test.ts
git commit -m "feat: resolve execution progress and handoffs"
```

---

### Task 4: Bind approvals to reviewed payloads and enforce evidence requirements

**Files:**
- Create: `packages/execution/src/approvals.ts`
- Create: `packages/execution/src/evidence.ts`
- Modify: `packages/execution/src/index.ts`
- Test: `tests/unit/execution-approval-evidence.test.ts`

**Interfaces:**
- Consumes: `ExecutionApproval`, `ExecutionEvidence`.
- Produces: `canonicalizeApprovalPayload(value)`, `digestApprovalPayload(value)`, `approvalMatchesPayload(approval, version, digest)`, `missingEvidence(requiredKinds, evidence)`.

- [ ] **Step 1: Write failing approval/evidence tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  approvalMatchesPayload,
  digestApprovalPayload,
  missingEvidence
} from '../../packages/execution/src';

describe('ATLAS execution approval and evidence contracts', () => {
  it('produces the same digest for equivalent object key order', async () => {
    const a = await digestApprovalPayload({ amount: 100, vendor: 'v-1' });
    const b = await digestApprovalPayload({ vendor: 'v-1', amount: 100 });
    expect(a).toBe(b);
  });

  it('rejects stale approval reuse after payload mutation', () => {
    expect(approvalMatchesPayload(
      { payloadVersion: 2, payloadDigest: 'approved-digest', status: 'approved' },
      3,
      'changed-digest'
    )).toBe(false);
  });

  it('returns only missing or unverified evidence kinds', () => {
    expect(missingEvidence(
      ['domain_record', 'validation'],
      [
        { kind: 'domain_record', verified: true },
        { kind: 'validation', verified: false }
      ]
    )).toEqual(['validation']);
  });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/unit/execution-approval-evidence.test.ts
```

Expected: FAIL because approval/evidence helpers are absent.

- [ ] **Step 3: Implement deterministic binding and evidence checks**

Create `packages/execution/src/approvals.ts`:

```ts
function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, sortValue(item)])
    );
  }
  return value;
}

export function canonicalizeApprovalPayload(value: unknown) {
  return JSON.stringify(sortValue(value));
}

export async function digestApprovalPayload(value: unknown) {
  const bytes = new TextEncoder().encode(canonicalizeApprovalPayload(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((item) => item.toString(16).padStart(2, '0'))
    .join('');
}

export function approvalMatchesPayload(
  approval: { payloadVersion: number; payloadDigest: string; status: string },
  version: number,
  digest: string
) {
  return approval.status === 'approved'
    && approval.payloadVersion === version
    && approval.payloadDigest === digest;
}
```

Create `packages/execution/src/evidence.ts`:

```ts
export function missingEvidence(
  requiredKinds: readonly string[],
  evidence: readonly Array<{ kind: string; verified: boolean }>
) {
  return requiredKinds.filter((kind) => {
    const match = evidence.find((item) => item.kind === kind);
    return !match || !match.verified;
  });
}
```

Export both from `packages/execution/src/index.ts`.

- [ ] **Step 4: Run and verify GREEN**

```bash
npx vitest run tests/unit/execution-approval-evidence.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/execution/src tests/unit/execution-approval-evidence.test.ts
git commit -m "feat: bind execution approvals and evidence"
```

---

### Task 5: Add module adapters, persistence interface, and orchestration engine

**Files:**
- Create: `packages/execution/src/adapter.ts`
- Create: `packages/execution/src/store.ts`
- Create: `packages/execution/src/engine.ts`
- Modify: `packages/execution/src/index.ts`
- Test: `tests/unit/execution-engine.test.ts`

**Interfaces:**
- Consumes: Tasks 1-4 public contracts.
- Produces: `ExecutionModuleAdapter`, `ExecutionAdapterRegistry`, `ExecutionStore`, `MemoryExecutionStore`, `ExecutionEngine`, `ContinueTaskResult`.

- [ ] **Step 1: Write failing orchestration tests**

Create `tests/unit/execution-engine.test.ts` with these cases:

```ts
import { describe, expect, it } from 'vitest';
import {
  ExecutionAdapterRegistry,
  ExecutionEngine,
  MemoryExecutionStore,
  type ExecutionModuleAdapter
} from '../../packages/execution/src';

const payrollAdapter: ExecutionModuleAdapter = {
  module: 'payroll',
  canHandle: (actionType) => actionType === 'enroll_employee',
  validate: async () => ({ ok: true, errors: [] }),
  authorize: async (actor) => ({ ok: actor.permissions.includes('payroll.write'), reason: 'payroll.write_required' }),
  execute: async () => ({ ok: true, result: { payrollEnrollmentId: 'payroll-77' } }),
  verify: async () => ({ ok: true, evidence: [{ kind: 'payroll_record', reference: 'payroll-77', verified: true }] }),
  suggestNext: async () => 'Review benefits enrollment'
};

describe('ATLAS ExecutionEngine', () => {
  it('blocks execution when actor authorization is missing', async () => {
    const store = MemoryExecutionStore.seeded();
    const registry = new ExecutionAdapterRegistry([payrollAdapter]);
    const engine = new ExecutionEngine(store, registry);

    const result = await engine.continueTask('task-1', {
      userId: 'user-1',
      scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
      permissions: []
    });

    expect(result).toEqual({ state: 'blocked', reason: 'payroll.write_required' });
  });

  it('executes, verifies, stores evidence, and advances the next action', async () => {
    const store = MemoryExecutionStore.seeded();
    const registry = new ExecutionAdapterRegistry([payrollAdapter]);
    const engine = new ExecutionEngine(store, registry);

    const result = await engine.continueTask('task-1', {
      userId: 'user-1',
      scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
      permissions: ['payroll.write']
    });

    expect(result.state).toBe('completed_step');
    expect((await store.listEvidence('task-1')).map((item) => item.reference)).toContain('payroll-77');
    expect((await store.getTask('task-1'))?.nextAction).toBe('Review benefits enrollment');
  });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/unit/execution-engine.test.ts
```

Expected: FAIL because adapter/store/engine exports are absent.

- [ ] **Step 3: Define the module adapter contract**

Create `packages/execution/src/adapter.ts`:

```ts
import type { ExecutionActor, ExecutionEvidence, ExecutionStep } from './types';

export type AdapterValidation = { ok: boolean; errors: string[] };
export type AdapterAuthorization = { ok: boolean; reason: string | null };
export type AdapterExecution = { ok: boolean; result: Record<string, unknown>; errorCode?: string };
export type AdapterVerification = {
  ok: boolean;
  evidence: Array<Pick<ExecutionEvidence, 'kind' | 'reference' | 'verified'>>;
  reason?: string;
};

export interface ExecutionModuleAdapter {
  module: string;
  canHandle(actionType: string): boolean;
  validate(step: ExecutionStep): Promise<AdapterValidation>;
  authorize(actor: ExecutionActor, step: ExecutionStep): Promise<AdapterAuthorization>;
  execute(step: ExecutionStep): Promise<AdapterExecution>;
  verify(step: ExecutionStep, execution: AdapterExecution): Promise<AdapterVerification>;
  suggestNext(step: ExecutionStep, execution: AdapterExecution): Promise<string | null>;
}

export class ExecutionAdapterRegistry {
  constructor(private readonly adapters: ExecutionModuleAdapter[]) {}

  resolve(module: string, actionType: string) {
    const adapter = this.adapters.find((item) => item.module === module && item.canHandle(actionType));
    if (!adapter) throw new Error(`execution_adapter_not_found:${module}:${actionType}`);
    return adapter;
  }
}
```

- [ ] **Step 4: Add the store contract and deterministic memory implementation**

Create `packages/execution/src/store.ts` with this public interface:

```ts
import type {
  ExecutionApproval,
  ExecutionAuditEvent,
  ExecutionEvidence,
  ExecutionStep,
  ExecutionTask
} from './types';

export interface ExecutionStore {
  getTask(taskId: string): Promise<ExecutionTask | null>;
  saveTask(task: ExecutionTask): Promise<void>;
  listSteps(taskId: string): Promise<ExecutionStep[]>;
  saveStep(step: ExecutionStep): Promise<void>;
  listEvidence(taskId: string): Promise<ExecutionEvidence[]>;
  appendEvidence(evidence: ExecutionEvidence): Promise<void>;
  listApprovals(taskId: string): Promise<ExecutionApproval[]>;
  appendAudit(event: ExecutionAuditEvent): Promise<void>;
}
```

Then implement `MemoryExecutionStore` in the same file using `Map`/arrays, deep-cloning on reads/writes. Add a static `seeded()` fixture containing one `task-1` payroll task and one pending `enroll_employee` step scoped to `tenant-1/org-1`; do not add fabricated production data or export the fixture outside tests.

- [ ] **Step 5: Implement orchestration**

Create `packages/execution/src/engine.ts` with this control flow:

```ts
import { randomUUID } from 'node:crypto';
import { assertSameScope } from './context';
import { resolveCurrentStep } from './progress';
import type { ExecutionActor } from './types';
import type { ExecutionAdapterRegistry } from './adapter';
import type { ExecutionStore } from './store';

export type ContinueTaskResult =
  | { state: 'blocked'; reason: string }
  | { state: 'completed_step'; stepId: string }
  | { state: 'no_action'; reason: string };

export class ExecutionEngine {
  constructor(
    private readonly store: ExecutionStore,
    private readonly registry: ExecutionAdapterRegistry
  ) {}

  async continueTask(taskId: string, actor: ExecutionActor): Promise<ContinueTaskResult> {
    const task = await this.store.getTask(taskId);
    if (!task) return { state: 'no_action', reason: 'task_not_found' };
    assertSameScope(task.scope, actor.scope);

    const steps = await this.store.listSteps(taskId);
    const completed = new Set(steps.filter((step) => step.status === 'completed').map((step) => step.id));
    const step = resolveCurrentStep(steps, completed);
    if (!step) return { state: 'no_action', reason: 'no_dependency_satisfied_step' };

    const adapter = this.registry.resolve(step.module, step.actionType);
    const validation = await adapter.validate(step);
    if (!validation.ok) return { state: 'blocked', reason: validation.errors[0] ?? 'validation_failed' };

    const authorization = await adapter.authorize(actor, step);
    if (!authorization.ok) return { state: 'blocked', reason: authorization.reason ?? 'authorization_failed' };

    const execution = await adapter.execute(step);
    if (!execution.ok) return { state: 'blocked', reason: execution.errorCode ?? 'execution_failed' };

    const verification = await adapter.verify(step, execution);
    if (!verification.ok) return { state: 'blocked', reason: verification.reason ?? 'verification_failed' };

    const completedAt = new Date().toISOString();
    await this.store.saveStep({ ...step, status: 'completed', completedAt });
    for (const item of verification.evidence) {
      await this.store.appendEvidence({
        id: randomUUID(),
        taskId,
        stepId: step.id,
        kind: item.kind,
        reference: item.reference,
        verified: item.verified,
        createdAt: completedAt
      });
    }

    const nextAction = await adapter.suggestNext(step, execution);
    await this.store.saveTask({ ...task, nextAction, updatedAt: completedAt, version: task.version + 1 });
    return { state: 'completed_step', stepId: step.id };
  }
}
```

If browser compatibility rejects `node:crypto` during the web build, replace UUID generation with `crypto.randomUUID()`; do not add a UUID dependency.

Export `adapter`, `store`, and `engine` from `packages/execution/src/index.ts`.

- [ ] **Step 6: Run and verify GREEN**

```bash
npx vitest run tests/unit/execution-engine.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/execution/src tests/unit/execution-engine.test.ts
git commit -m "feat: orchestrate execution through module adapters"
```

---

### Task 6: Persist execution state in Supabase with tenant-safe RLS

**Files:**
- Create: `supabase/migrations/20260912_universal_execution_engine.sql`
- Test: `tests/integration/execution-schema-contract.test.ts`

**Interfaces:**
- Consumes: canonical fields/statuses from Tasks 1-5.
- Produces: `execution_workflows`, `execution_tasks`, `execution_steps`, `execution_dependencies`, `execution_evidence`, `execution_approvals`, `execution_audit_events` tables.

- [ ] **Step 1: Write the failing SQL contract test**

Create `tests/integration/execution-schema-contract.test.ts`:

```ts
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationUrl = new URL('../../supabase/migrations/20260912_universal_execution_engine.sql', import.meta.url);

async function migration() {
  return readFile(migrationUrl, 'utf8');
}

describe('ATLAS Universal Execution Supabase schema', () => {
  it('creates the seven canonical execution tables', async () => {
    const sql = await migration();
    for (const table of [
      'execution_workflows', 'execution_tasks', 'execution_steps', 'execution_dependencies',
      'execution_evidence', 'execution_approvals', 'execution_audit_events'
    ]) {
      expect(sql).toContain(`create table if not exists public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it('scopes member reads through active organization membership', async () => {
    const sql = await migration();
    expect(sql).toContain('from public.organization_members om');
    expect(sql).toContain("om.status = 'active'");
    expect(sql).toContain('om.user_id = (select auth.uid())');
  });

  it('does not grant direct authenticated mutation of execution state', async () => {
    const sql = await migration();
    expect(sql).toContain('revoke all on public.execution_tasks from authenticated');
    expect(sql).toContain('grant select on public.execution_tasks to authenticated');
    expect(sql).not.toContain('grant insert on public.execution_tasks to authenticated');
    expect(sql).not.toContain('grant update on public.execution_tasks to authenticated');
  });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/integration/execution-schema-contract.test.ts
```

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Create the migration**

The migration must implement the seven tables with these invariants:

```sql
create table if not exists public.execution_workflows (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  tenant_id text not null check (length(trim(tenant_id)) > 0),
  workflow_type text not null check (length(trim(workflow_type)) > 0),
  owner_module text not null check (length(trim(owner_module)) > 0),
  status text not null check (status in ('draft','now','next','blocked','awaiting_approval','completed','delegated','automatable','discarded','failed','cancelled')),
  current_task_id uuid,
  current_module text not null,
  context jsonb not null default '{}'::jsonb,
  created_by uuid not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
```

Create the remaining tables from the spec using foreign keys back to workflow/task/step IDs, text checks for status vocabulary, JSONB only for bounded action/context payloads, and no credential/secret columns.

Create indexes at minimum on:

```sql
create index if not exists execution_tasks_org_status_owner_idx
  on public.execution_tasks (org_id, status, owner_user_id, updated_at desc);
create index if not exists execution_tasks_org_module_idx
  on public.execution_tasks (org_id, module, updated_at desc);
create index if not exists execution_steps_task_sequence_idx
  on public.execution_steps (task_id, sequence);
create index if not exists execution_approvals_org_status_idx
  on public.execution_approvals (org_id, status, created_at desc);
create index if not exists execution_audit_org_created_idx
  on public.execution_audit_events (org_id, created_at desc);
```

Enable RLS on every execution table. Use the repository's current optimized membership form:

```sql
using (
  exists (
    select 1
    from public.organization_members om
    where om.org_id = execution_tasks.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
)
```

Repeat the policy for each table using that table's `org_id`. Then explicitly:

```sql
revoke all on public.execution_tasks from authenticated;
grant select on public.execution_tasks to authenticated;
```

Repeat revoke-all/grant-select for all seven tables. Do not grant browser-side insert/update/delete.

For `execution_audit_events`, add a comment documenting append-only application semantics and do not create any authenticated update/delete policy.

- [ ] **Step 4: Run the SQL contract test and verify GREEN**

```bash
npx vitest run tests/integration/execution-schema-contract.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run adjacent hospitality RLS contract tests**

```bash
npx vitest run tests/integration/hospitality-edge-contract.test.ts tests/unit/hospitality-room-access.test.ts
```

Expected: PASS; execution changes must not weaken existing RLS assumptions.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260912_universal_execution_engine.sql tests/integration/execution-schema-contract.test.ts
git commit -m "feat: persist execution workflows with RLS"
```

---

### Task 7: Add the authenticated server-side `atlas-execution` API

**Files:**
- Create: `supabase/functions/atlas-execution/index.ts`
- Test: `tests/integration/execution-edge-contract.test.ts`

**Interfaces:**
- Consumes: Supabase tables from Task 6 and the repository's existing Edge Function auth pattern.
- Produces POST operations: `get_state`, `create_task`, `transition_task`, `record_evidence`, `request_approval`, `decide_approval`.

- [ ] **Step 1: Write the failing Edge Function contract test**

Create `tests/integration/execution-edge-contract.test.ts`:

```ts
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const functionUrl = new URL('../../supabase/functions/atlas-execution/index.ts', import.meta.url);

async function source() {
  return readFile(functionUrl, 'utf8');
}

describe('ATLAS execution edge boundary', () => {
  it('requires authentication and organization membership', async () => {
    const code = await source();
    expect(code).toContain("error: 'authentication_required'");
    expect(code).toContain(".from('organization_members')");
    expect(code).toContain(".eq('status', 'active')");
  });

  it('does not expose service credentials in response payloads', async () => {
    const code = await source();
    expect(code).toContain("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')");
    expect(code).not.toContain('service_role_key:');
  });

  it('supports the six governed operations', async () => {
    const code = await source();
    for (const operation of [
      'get_state', 'create_task', 'transition_task', 'record_evidence', 'request_approval', 'decide_approval'
    ]) expect(code).toContain(`'${operation}'`);
  });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/integration/execution-edge-contract.test.ts
```

Expected: FAIL because the Edge Function does not exist.

- [ ] **Step 3: Create the authenticated function shell**

Start `supabase/functions/atlas-execution/index.ts` with the repository's established pattern:

```ts
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const PUBLISHABLE_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const ALLOWED_ORIGINS = new Set([
  'https://atlasenterprisesuite.com',
  'https://www.atlasenterprisesuite.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    'access-control-allow-origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.atlasenterprisesuite.com',
    'access-control-allow-headers': 'authorization, apikey, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'vary': 'Origin',
    'x-content-type-options': 'nosniff'
  };
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders(req) });
}
```

Use a user-scoped client to validate JWT and active organization membership. Instantiate the service-role client only after auth + membership pass.

- [ ] **Step 4: Implement the governed operations**

Use a single discriminated operation field from the JSON body:

```ts
const operation = String(body?.operation || '');
const supported = new Set([
  'get_state',
  'create_task',
  'transition_task',
  'record_evidence',
  'request_approval',
  'decide_approval'
]);
if (!supported.has(operation)) return json(req, { ok: false, error: 'unsupported_operation' }, 400);
```

Operation rules:

- `get_state`: read workflow/tasks/steps/evidence/approvals filtered by `org_id`; return references and state only.
- `create_task`: require non-empty `module`, `title`, `intent`, `goal`, valid `status`, `workflow_id`, and `version=1`; insert with caller organization.
- `transition_task`: load current row, verify expected `version`, reject illegal state transitions using the same transition map as `packages/execution/src/state-machine.ts`, update status/version/updated_at, and append an audit event.
- `record_evidence`: accept only `{task_id, step_id, kind, reference, verified}`; never accept binary credential material or arbitrary secret fields.
- `request_approval`: compute SHA-256 over the canonical reviewed payload plus `payload_version`, insert pending approval, transition the task to `awaiting_approval` when legal, append audit.
- `decide_approval`: require the caller to hold the requested permission according to the existing organization membership/role data available in the repository; bind the decision to the exact pending approval row; never approve a mutated payload version/digest.

Every mutating operation must write `execution_audit_events` with actor, organization, module, action, previous/resulting state, and correlation ID when supplied.

Return explicit errors such as `version_conflict`, `invalid_transition`, `membership_required`, `permission_required`, and `approval_binding_mismatch`; do not downgrade them to success.

- [ ] **Step 5: Run and verify GREEN**

```bash
npx vitest run tests/integration/execution-edge-contract.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/atlas-execution tests/integration/execution-edge-contract.test.ts
git commit -m "feat: add authenticated execution API"
```

---

### Task 8: Prove cross-module lineage and resumability end to end

**Files:**
- Test: `tests/integration/execution-cross-module-workflow.test.ts`
- Modify only if the failing integration test exposes a defect in: `packages/execution/src/engine.ts`, `packages/execution/src/progress.ts`, `packages/execution/src/context.ts`, or `packages/execution/src/store.ts`.

**Interfaces:**
- Consumes: all package contracts from Tasks 1-5.
- Produces: verified behavioral proof that a single workflow can hand off an authoritative HR employee reference to Payroll without duplicating the employee record and can resume after a blocker.

- [ ] **Step 1: Write the failing cross-module workflow test**

Create `tests/integration/execution-cross-module-workflow.test.ts` containing one workflow with:

```ts
const sourceReference = { type: 'employee', id: 'employee-42' };
```

and two fake adapters:

```ts
const hrAdapter = {
  module: 'hr',
  canHandle: (type: string) => type === 'verify_employee',
  validate: async () => ({ ok: true, errors: [] }),
  authorize: async () => ({ ok: true, reason: null }),
  execute: async () => ({ ok: true, result: { employeeId: sourceReference.id } }),
  verify: async () => ({ ok: true, evidence: [{ kind: 'employee_verified', reference: sourceReference.id, verified: true }] }),
  suggestNext: async () => 'Enroll employee in payroll'
};

let payrollReady = false;
const payrollAdapter = {
  module: 'payroll',
  canHandle: (type: string) => type === 'enroll_employee',
  validate: async () => payrollReady
    ? ({ ok: true, errors: [] })
    : ({ ok: false, errors: ['payroll_configuration_required'] }),
  authorize: async () => ({ ok: true, reason: null }),
  execute: async () => ({ ok: true, result: { payrollEnrollmentId: 'payroll-77' } }),
  verify: async () => ({ ok: true, evidence: [{ kind: 'payroll_record', reference: 'payroll-77', verified: true }] }),
  suggestNext: async () => 'Review benefits enrollment'
};
```

The assertions must prove:

```ts
expect(firstPayrollAttempt).toEqual({ state: 'blocked', reason: 'payroll_configuration_required' });
payrollReady = true;
expect((await engine.continueTask('payroll-task', actor)).state).toBe('completed_step');
expect((await store.getTask('payroll-task'))?.source).toEqual(sourceReference);
expect(JSON.stringify(await store.getTask('payroll-task'))).not.toContain('employeeRecord');
expect((await store.listEvidence('payroll-task')).some((item) => item.reference === 'payroll-77')).toBe(true);
```

- [ ] **Step 2: Run and verify RED for the actual missing behavior**

```bash
npx vitest run tests/integration/execution-cross-module-workflow.test.ts
```

Expected: the first run should expose any missing seeding/resume/step selection behavior. Do not weaken assertions to make the test pass.

- [ ] **Step 3: Implement only the minimal corrections required by the test**

Allowed corrections are limited to:

- adding explicit seed methods to `MemoryExecutionStore` (`putTask`, `putStep`) so integration tests can build workflows without production fixtures;
- ensuring a failed validation does not mark a step completed;
- ensuring a later retry re-evaluates the same pending step;
- preserving `task.source` across updates;
- preserving scope checks on every retry.

Do not introduce HR or Payroll business tables in `packages/execution`.

- [ ] **Step 4: Run the integration test and verify GREEN**

```bash
npx vitest run tests/integration/execution-cross-module-workflow.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run all execution-focused tests**

```bash
npx vitest run \
  tests/unit/execution-types.test.ts \
  tests/unit/execution-state-machine.test.ts \
  tests/unit/execution-progress.test.ts \
  tests/unit/execution-approval-evidence.test.ts \
  tests/unit/execution-engine.test.ts \
  tests/integration/execution-schema-contract.test.ts \
  tests/integration/execution-edge-contract.test.ts \
  tests/integration/execution-cross-module-workflow.test.ts
```

Expected: all PASS.

- [ ] **Step 6: Commit the cross-module proof**

```bash
git add packages/execution/src tests/integration/execution-cross-module-workflow.test.ts
git commit -m "test: prove resumable cross-module execution"
```

---

### Task 9: Full repository verification and evidence capture

**Files:**
- Modify code only if a verification failure is causally introduced by this branch.
- Do not perform unrelated cleanup.

**Interfaces:**
- Consumes: completed Tasks 1-8.
- Produces: merge-readiness evidence for the foundation, not a production deployment claim.

- [ ] **Step 1: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 2: Run the complete test suite**

```bash
npm test
```

Expected: exit 0.

- [ ] **Step 3: Build the production web bundle**

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 4: Inspect branch diff for secret or fake-production regressions**

Run:

```bash
git diff main...HEAD -- packages/execution supabase/migrations supabase/functions/atlas-execution tests
```

Verify manually from the diff:

- no service-role key, API token, password, private certificate, or recovery code was committed;
- no fake `live`, `connected`, `approved`, or `completed` state is hard-coded as production truth;
- no HR/Payroll/Accounting/Health business source record was duplicated into execution storage;
- direct authenticated mutation grants are absent from execution tables.

- [ ] **Step 5: Capture final branch state**

```bash
git status --short
git log --oneline --decorate -12
```

Expected: clean worktree and focused commits for this plan.

- [ ] **Step 6: Do not merge or deploy automatically**

Stop with evidence and prepare the branch/PR for independent review. Merge and production deployment remain separate approval gates.

---

## Follow-on Plans After This Foundation

These are intentionally separate reviewable slices and are not implemented by this plan:

1. `ATLAS Universal Execution UI + Approval Center` — shared Now/Next/Blocked/Awaiting Approval/Completed surfaces, responsive navigation, evidence display, approval decisions, and module embedding.
2. `ATLAS Assistant + Voice Execution Integration` — “Where did we stop?”, “Continue”, “What is blocked?”, “Do everything permitted”, and approval-only summaries reading the same persisted execution state.
3. `ATLAS Module Adoption` — adapters for Accounting/AP/AR/Finance, HR/Payroll/Benefits, CRM/Sales/Inventory/POS, Health, Ride, Hospitality, Creator/Studio, and other modules, each preserving its own domain source of truth.

The foundation is considered successful when Tasks 1-9 pass and the branch has evidence for typecheck, full tests, build, RLS contract, authenticated execution boundary, cross-module lineage, resumability, and no secret/fake-state regressions. It is not production-ready until migration deployment, Edge Function deployment, live Supabase verification, UI/Assistant adoption, and production verification are separately completed.