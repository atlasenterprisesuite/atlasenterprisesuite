# ATLAS Guardian Execution Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Guardian Doctrine state understandable in Guided Execution and ATLAS Assistant without giving the browser or Assistant authority to grant permission, fabricate provider state, or declare completion without canonical evidence.

**Architecture:** Add one pure read-only projection, `GuardianDisplayState`, over existing `GuidedExecutionState`; do not persist another workflow state machine. Guided Execution renders that projection plus the canonical organization, permission, approval, and evidence requirements. ATLAS Assistant consumes the same projection and remains explanatory/navigation-only with `executesExternalAction: false`.

**Tech Stack:** React 18.3, TypeScript 5.7, Vitest 3.2, Testing Library 16, existing Guided Execution components.

**Spec:** `docs/superpowers/specs/2026-09-13-atlas-guardian-doctrine-design.md`

## Global Constraints

- Execute after `docs/superpowers/plans/2026-09-13-atlas-guardian-core-enforcement.md` passes review.
- No persisted Guardian status table, second execution state machine, second Approval Center, or Assistant-owned truth store.
- Display only canonical execution data or a server-authoritative policy result.
- Never infer or synthesize `Connected`, `Healthy`, `Completed`, `Paid`, `Filed`, `Submitted`, `Deployed`, `Booked`, or equivalent success state.
- `workflow.status === 'completed'` renders `Completed with evidence` only when every required evidence kind is present and verified; otherwise render `Recovery required`.
- Product UI remains enterprise-neutral; no religious imagery or customer belief statement is introduced by this plan.
- Assistant commands never mutate providers, approve actions, or expand authorization.
- Guardian state must have textual semantics, keyboard access, screen-reader output, and non-color-only status.
- No merge or production deploy in this plan.

## File Map

- `apps/web/src/execution/guardian-state.ts` — derived Guardian user-facing state.
- `apps/web/src/execution/GuardianStatusCard.tsx` — accessible execution safeguard facts.
- `apps/web/src/execution/GuidedExecutionPage.tsx` — render canonical Guardian projection.
- `apps/web/src/execution/assistant.ts` — Assistant Guardian explanation.
- `apps/web/src/execution/ExecutionAssistantPanel.tsx` — read-only Why? command.
- `apps/web/src/execution/execution.css` — existing-token layout/focus rules.
- `tests/unit/guided-execution-guardian-state.test.ts` — state matrix.
- `tests/unit/guided-execution-assistant-guardian.test.ts` — Assistant boundary.
- `tests/integration/guided-execution-guardian-experience.test.tsx` — route/UI/a11y regression.

---

### Task 1: Derive truthful Guardian display state

**Files:**
- Create: `apps/web/src/execution/guardian-state.ts`
- Create: `tests/unit/guided-execution-guardian-state.test.ts`

**Interfaces:**
- Consumes: `GuidedExecutionState`, `activeTask`, `activeStep`, `stepBlockers`.
- Produces: `GuardianDisplayStateName`, `GuardianDisplayState`, `deriveGuardianDisplayState`.

- [ ] **Step 1: Write failing state tests**

```ts
import { describe, expect, it } from 'vitest';
import { deriveGuardianDisplayState } from '../../apps/web/src/execution/guardian-state';
import { makeApproval, makeGuidedState } from '../fixtures/guidedExecution';

describe('Guardian display state', () => {
  it('reports ready for a canonical ready step', () => {
    const state = makeGuidedState({ stepStatuses: ['completed', 'ready', 'blocked'] });
    expect(deriveGuardianDisplayState(state).state).toBe('ready');
  });

  it('reports awaiting approval from persisted approval state', () => {
    const state = makeGuidedState({
      taskStatus: 'awaiting_approval',
      approvals: [makeApproval({ status: 'pending' })]
    });
    expect(deriveGuardianDisplayState(state).state).toBe('awaiting_approval');
  });

  it('reports verification pending when completed current work lacks verified evidence', () => {
    const state = makeGuidedState({ currentStepId: 'step-2', stepStatuses: ['completed', 'completed', 'blocked'] });
    expect(deriveGuardianDisplayState(state).state).toBe('verification_pending');
  });

  it('reports recovery required for false completed state without evidence', () => {
    const state = makeGuidedState({
      workflowStatus: 'completed', taskStatus: 'completed', currentStepId: null,
      stepStatuses: ['completed', 'completed', 'completed']
    });
    expect(deriveGuardianDisplayState(state).state).toBe('recovery_required');
  });

  it('reports completed with evidence only when required evidence is verified', () => {
    const state = makeGuidedState({
      workflowStatus: 'completed', taskStatus: 'completed', currentStepId: null,
      stepStatuses: ['completed', 'completed', 'completed']
    });
    state.evidence.push({
      id: 'evidence-1', taskId: 'task-1', stepId: null, kind: 'infra_verification',
      reference: 'atlas://evidence/readiness', verified: true, createdAt: '2026-09-13T20:00:00Z'
    });
    expect(deriveGuardianDisplayState(state).state).toBe('completed_with_evidence');
  });
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/guided-execution-guardian-state.test.ts
```

Expected: FAIL because `guardian-state.ts` does not exist.

- [ ] **Step 3: Implement `guardian-state.ts`**

```ts
import type { GuidedExecutionState } from './types';
import { activeStep, activeTask, stepBlockers } from './view-model';

export type GuardianDisplayStateName =
  | 'ready'
  | 'needs_information'
  | 'needs_permission'
  | 'awaiting_approval'
  | 'blocked_by_policy'
  | 'executing'
  | 'verification_pending'
  | 'completed_with_evidence'
  | 'failed'
  | 'partially_completed'
  | 'recovery_required';

export type GuardianDisplayState = {
  state: GuardianDisplayStateName;
  label: string;
  reason: string;
  taskId: string | null;
  stepId: string | null;
  verifiedEvidenceCount: number;
};

const LABELS: Record<GuardianDisplayStateName, string> = {
  ready: 'Ready',
  needs_information: 'Needs information',
  needs_permission: 'Needs permission',
  awaiting_approval: 'Awaiting approval',
  blocked_by_policy: 'Blocked by policy',
  executing: 'Executing',
  verification_pending: 'Verification pending',
  completed_with_evidence: 'Completed with evidence',
  failed: 'Failed',
  partially_completed: 'Partially completed',
  recovery_required: 'Recovery required'
};

function requiredEvidenceMissing(state: GuidedExecutionState) {
  return state.steps.flatMap((step) => step.evidenceRequirement.filter((kind) =>
    !state.evidence.some((evidence) =>
      evidence.verified
      && evidence.kind === kind
      && evidence.taskId === step.taskId
      && (evidence.stepId === step.id || evidence.stepId === null)
    )
  ));
}

function result(
  state: GuardianDisplayStateName,
  reason: string,
  taskId: string | null,
  stepId: string | null,
  verifiedEvidenceCount: number
): GuardianDisplayState {
  return { state, label: LABELS[state], reason, taskId, stepId, verifiedEvidenceCount };
}

export function deriveGuardianDisplayState(state: GuidedExecutionState): GuardianDisplayState {
  const task = activeTask(state);
  const step = activeStep(state);
  const missing = requiredEvidenceMissing(state);
  const verified = state.evidence.filter((item) => item.verified).length;
  const pendingApproval = state.approvals.some((item) => item.status === 'pending');
  const blockers = step ? stepBlockers(state, step.id) : [];
  const blocker = task?.blockedReason ?? blockers[0] ?? '';
  const completedSteps = state.steps.filter((item) => item.status === 'completed').length;

  if (state.workflow.status === 'completed') {
    return missing.length
      ? result('recovery_required', `Required evidence is missing: ${missing[0]}.`, task?.id ?? null, step?.id ?? null, verified)
      : result('completed_with_evidence', 'Canonical completion is backed by all required verified evidence.', task?.id ?? null, step?.id ?? null, verified);
  }
  if (pendingApproval || task?.status === 'awaiting_approval' || step?.status === 'awaiting_approval') {
    return result('awaiting_approval', 'A persisted approval is required before execution can continue.', task?.id ?? null, step?.id ?? null, verified);
  }
  if (task?.status === 'failed' || step?.status === 'failed') {
    return completedSteps > 0
      ? result('partially_completed', 'Some persisted work completed before the current failure.', task?.id ?? null, step?.id ?? null, verified)
      : result('failed', 'The current persisted execution state failed.', task?.id ?? null, step?.id ?? null, verified);
  }
  if (/permission/i.test(blocker)) {
    return result('needs_permission', blocker, task?.id ?? null, step?.id ?? null, verified);
  }
  if (/^(policy:|budget_|execution_envelope_|provider_policy_)/i.test(blocker)) {
    return result('blocked_by_policy', blocker, task?.id ?? null, step?.id ?? null, verified);
  }
  if (step?.status === 'completed' && missing.length) {
    return result('verification_pending', `Required evidence is missing: ${missing[0]}.`, task?.id ?? null, step.id, verified);
  }
  if (step?.status === 'running') {
    return result('executing', 'The current persisted step is executing.', task?.id ?? null, step.id, verified);
  }
  if (blocker && /required$/i.test(blocker)) {
    return result('needs_information', blocker, task?.id ?? null, step?.id ?? null, verified);
  }
  return result('ready', 'The current persisted step is ready for its authorized execution path.', task?.id ?? null, step?.id ?? null, verified);
}
```

- [ ] **Step 4: Verify GREEN and commit**

```bash
npx vitest run tests/unit/guided-execution-guardian-state.test.ts
git add apps/web/src/execution/guardian-state.ts tests/unit/guided-execution-guardian-state.test.ts
git commit -m "feat: derive truthful Guardian execution states"
```

---

### Task 2: Render accessible execution safeguards in Guided Execution

**Files:**
- Create: `apps/web/src/execution/GuardianStatusCard.tsx`
- Modify: `apps/web/src/execution/GuidedExecutionPage.tsx`
- Modify: `apps/web/src/execution/execution.css`
- Create: `tests/integration/guided-execution-guardian-experience.test.tsx`

**Interfaces:**
- Consumes: `deriveGuardianDisplayState(state)`, selected task/step, workflow organization ID.
- Produces: read-only safeguard status, scope, permissions, evidence requirement.

- [ ] **Step 1: Write failing route/UI test**

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../apps/web/src/App';
import { loadGuidedExecutionAudit, loadGuidedExecutionState } from '../../apps/web/src/execution/api';
import { makeApproval, makeGuidedState } from '../fixtures/guidedExecution';

vi.mock('../../apps/web/src/execution/api', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/execution/api')>('../../apps/web/src/execution/api');
  return { ...actual, loadGuidedExecutionState: vi.fn(), loadGuidedExecutionAudit: vi.fn() };
});

vi.mock('../../apps/web/src/lib/atlasSession', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/lib/atlasSession')>('../../apps/web/src/lib/atlasSession');
  return { ...actual, getActiveAtlasOrganization: vi.fn(async () => ({ id: 'org-1', role: 'owner' })) };
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('atlas_access_token', 'test-token');
  vi.mocked(loadGuidedExecutionAudit).mockResolvedValue([]);
});

describe('Guardian execution experience', () => {
  it('renders truthful safeguard status and canonical scope facts', async () => {
    vi.mocked(loadGuidedExecutionState).mockResolvedValue(makeGuidedState());
    render(<MemoryRouter initialEntries={['/execution/wf-1']}><App /></MemoryRouter>);

    const status = await screen.findByRole('status', { name: /execution safeguards/i });
    expect(status).toHaveTextContent('Ready');
    expect(screen.getByText('Organization scope').parentElement).toHaveTextContent('org-1');
    expect(screen.getByText('Required permissions').parentElement).toHaveTextContent('execution.read');
    expect(screen.getByText('Evidence required').parentElement).toHaveTextContent('infra_verification');
    expect(screen.queryByText(/^Connected$/i)).not.toBeInTheDocument();
  });

  it('renders awaiting approval without adding a bypass control', async () => {
    vi.mocked(loadGuidedExecutionState).mockResolvedValue(makeGuidedState({
      taskStatus: 'awaiting_approval', approvals: [makeApproval({ status: 'pending' })]
    }));
    render(<MemoryRouter initialEntries={['/execution/wf-1']}><App /></MemoryRouter>);

    expect(await screen.findByRole('status', { name: /execution safeguards/i })).toHaveTextContent('Awaiting approval');
    expect(screen.queryByRole('button', { name: /execute without approval/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/integration/guided-execution-guardian-experience.test.tsx
```

Expected: FAIL because safeguard status card is absent.

- [ ] **Step 3: Implement `GuardianStatusCard.tsx`**

```tsx
import type { GuardianDisplayState } from './guardian-state';

export function GuardianStatusCard({
  status,
  organizationId,
  permissionsRequired,
  evidenceRequired
}: {
  status: GuardianDisplayState;
  organizationId: string;
  permissionsRequired: string[];
  evidenceRequired: string[];
}) {
  return (
    <section className="execution-guardian-card" aria-labelledby="execution-guardian-title">
      <div role="status" aria-live="polite" aria-label="Execution safeguards">
        <span className="execution-meta-label">Execution safeguards</span>
        <strong id="execution-guardian-title">{status.label}</strong>
        <p>{status.reason}</p>
      </div>
      <dl className="execution-guardian-facts">
        <div><dt>Organization scope</dt><dd><code>{organizationId}</code></dd></div>
        <div><dt>Required permissions</dt><dd>{permissionsRequired.length ? permissionsRequired.join(', ') : 'None persisted'}</dd></div>
        <div><dt>Evidence required</dt><dd>{evidenceRequired.length ? evidenceRequired.join(', ') : 'No evidence requirement persisted'}</dd></div>
      </dl>
    </section>
  );
}
```

- [ ] **Step 4: Wire it into `GuidedExecutionPage.tsx`**

Add imports:

```ts
import { deriveGuardianDisplayState } from './guardian-state';
import { GuardianStatusCard } from './GuardianStatusCard';
```

After selected task/step resolution:

```ts
const guardianStatus = deriveGuardianDisplayState(data);
```

Immediately after `<WorkflowHeader ... />` render:

```tsx
<GuardianStatusCard
  status={guardianStatus}
  organizationId={data.workflow.organizationId}
  permissionsRequired={selectedStep?.permissionsRequired ?? selectedTask?.permissionsRequired ?? []}
  evidenceRequired={selectedStep?.evidenceRequirement ?? []}
/>
```

This component has no mutation callbacks.

- [ ] **Step 5: Add structural/accessibility CSS only**

```css
.execution-guardian-card { display: grid; gap: 1rem; }
.execution-guardian-facts { display: grid; gap: .75rem; margin: 0; }
.execution-guardian-facts div { display: grid; gap: .25rem; }
.execution-guardian-card :focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .execution-guardian-card { scroll-behavior: auto; }
}
```

Do not add new brand colors.

- [ ] **Step 6: Verify GREEN and commit**

```bash
npx vitest run tests/integration/guided-execution-guardian-experience.test.tsx tests/integration/guided-execution-route.test.tsx
npm run typecheck
git add apps/web/src/execution/GuardianStatusCard.tsx apps/web/src/execution/GuidedExecutionPage.tsx apps/web/src/execution/execution.css tests/integration/guided-execution-guardian-experience.test.tsx
git commit -m "feat: surface Guardian execution safeguards"
```

---

### Task 3: Make ATLAS Assistant Guardian-aware without authority escalation

**Files:**
- Modify: `apps/web/src/execution/assistant.ts`
- Modify: `apps/web/src/execution/ExecutionAssistantPanel.tsx`
- Create: `tests/unit/guided-execution-assistant-guardian.test.ts`

**Interfaces:**
- Consumes: `deriveGuardianDisplayState`.
- Produces: `guardianState` snapshot property and `explain_guardian` result.

- [ ] **Step 1: Write failing Assistant tests**

```ts
import { describe, expect, it } from 'vitest';
import { buildExecutionAssistantSnapshot, resolveExecutionAssistantCommand } from '../../apps/web/src/execution/assistant';
import { makeApproval, makeGuidedState } from '../fixtures/guidedExecution';

describe('Guided Execution Assistant Guardian boundary', () => {
  it('never upgrades pending approval into authorization', () => {
    const state = makeGuidedState({
      taskStatus: 'awaiting_approval', approvals: [makeApproval({ status: 'pending' })]
    });
    const result = resolveExecutionAssistantCommand('continue', state);
    expect(result.kind).toBe('show_approval');
    expect(result.executesExternalAction).toBe(false);
  });

  it('reports recovery required instead of false completion', () => {
    const state = makeGuidedState({
      workflowStatus: 'completed', taskStatus: 'completed', currentStepId: null,
      stepStatuses: ['completed', 'completed', 'completed']
    });
    expect(buildExecutionAssistantSnapshot(state).guardianState).toBe('recovery_required');
    const result = resolveExecutionAssistantCommand('why', state);
    expect(result.kind).toBe('explain_guardian');
    expect(result.executesExternalAction).toBe(false);
    expect(result.message).toMatch(/required evidence/i);
  });
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/guided-execution-assistant-guardian.test.ts
```

Expected: FAIL because snapshot/result type is not Guardian-aware.

- [ ] **Step 3: Extend Assistant types and command resolver**

In `assistant.ts` add:

```ts
import { deriveGuardianDisplayState, type GuardianDisplayStateName } from './guardian-state';
const WHY = new Set(['why', 'why is this blocked', 'por que', 'por qué']);
```

Add to `ExecutionAssistantSnapshot`:

```ts
guardianState: GuardianDisplayStateName;
```

Add to the result union:

```ts
| (AssistantBaseResult & {
    kind: 'explain_guardian';
    guardianState: GuardianDisplayStateName;
    stepId: string | null;
  })
```

In `buildExecutionAssistantSnapshot`:

```ts
const guardian = deriveGuardianDisplayState(state);
```

and return:

```ts
guardianState: guardian.state,
```

At the start of `resolveExecutionAssistantCommand` after normalization:

```ts
if (WHY.has(normalized)) {
  const guardian = deriveGuardianDisplayState(state);
  return {
    kind: 'explain_guardian',
    guardianState: guardian.state,
    stepId: guardian.stepId,
    message: guardian.reason,
    executesExternalAction: false
  };
}
```

- [ ] **Step 4: Make completion result evidence-aware**

Replace unconditional completed handling with:

```ts
const guardian = deriveGuardianDisplayState(state);
if (state.workflow.status === 'completed') {
  if (guardian.state === 'completed_with_evidence') return completedResult();
  return {
    kind: 'explain_guardian',
    guardianState: guardian.state,
    stepId: guardian.stepId,
    message: guardian.reason,
    executesExternalAction: false
  };
}
```

Apply this logic in both `continueResult` and the `NEXT` branch.

- [ ] **Step 5: Add the read-only `Why?` button**

In `ExecutionAssistantPanel` extend `selectableStep` to include `explain_guardian`, then add:

```tsx
<button className="execution-action" type="button" onClick={() => runCommand('why')}>Why?</button>
```

No new mutation callback is added.

- [ ] **Step 6: Verify GREEN and commit**

```bash
npx vitest run \
  tests/unit/guided-execution-assistant-guardian.test.ts \
  tests/unit/guided-execution-assistant.test.ts \
  tests/integration/guided-execution-assistant.test.tsx
npm run typecheck
git add apps/web/src/execution/assistant.ts apps/web/src/execution/ExecutionAssistantPanel.tsx tests/unit/guided-execution-assistant-guardian.test.ts
git commit -m "feat: make ATLAS Assistant Guardian-aware"
```

---

### Task 4: Verify Guardian accessibility and repository regressions

**Files:**
- Modify: `tests/integration/guided-execution-guardian-experience.test.tsx`

**Interfaces:**
- Produces: semantic, keyboard, and non-color-only regression evidence.

- [ ] **Step 1: Add semantic and keyboard assertions**

Add `userEvent` to the existing integration test imports:

```ts
import userEvent from '@testing-library/user-event';
```

Add test:

```tsx
it('keeps Guardian controls keyboard-readable and non-mutating', async () => {
  vi.mocked(loadGuidedExecutionState).mockResolvedValue(makeGuidedState());
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/execution/wf-1']}><App /></MemoryRouter>);

  const status = await screen.findByRole('status', { name: /execution safeguards/i });
  expect(status).toHaveAttribute('aria-live', 'polite');
  const why = screen.getByRole('button', { name: 'Why?' });
  expect(why).toBeEnabled();
  await user.click(why);
  expect(screen.getByLabelText('ATLAS Assistant')).toHaveTextContent(/persisted|ready|evidence|approval/i);
  expect(screen.queryByRole('button', { name: /authorize automatically/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Add non-color-only recovery assertion**

```tsx
it('shows recovery required as text when completion lacks evidence', async () => {
  vi.mocked(loadGuidedExecutionState).mockResolvedValue(makeGuidedState({
    workflowStatus: 'completed', taskStatus: 'completed', currentStepId: null,
    stepStatuses: ['completed', 'completed', 'completed']
  }));
  render(<MemoryRouter initialEntries={['/execution/wf-1']}><App /></MemoryRouter>);

  expect(await screen.findByRole('status', { name: /execution safeguards/i })).toHaveTextContent('Recovery required');
});
```

- [ ] **Step 3: Run exact Guided Execution regression set**

```bash
npx vitest run \
  tests/unit/guided-execution-guardian-state.test.ts \
  tests/unit/guided-execution-assistant-guardian.test.ts \
  tests/unit/guided-execution-view-model.test.ts \
  tests/unit/guided-execution-assistant.test.ts \
  tests/integration/guided-execution-guardian-experience.test.tsx \
  tests/integration/guided-execution-route.test.tsx \
  tests/integration/guided-execution-audit.test.tsx \
  tests/integration/guided-execution-approval.test.tsx \
  tests/integration/guided-execution-assistant.test.tsx \
  tests/integration/guided-execution-accessibility.test.tsx \
  tests/integration/guided-execution-regression.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit accessibility regression**

```bash
git add tests/integration/guided-execution-guardian-experience.test.tsx
git commit -m "test: verify Guardian execution accessibility"
```

- [ ] **Step 5: Full repository verification**

```bash
npm ci
npm audit --audit-level=high
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
git rev-parse HEAD
git status --short
```

Expected: every command exits 0 and worktree is clean. Do not claim Guardian experience completion unless the full verification set passed on the exact printed SHA.
