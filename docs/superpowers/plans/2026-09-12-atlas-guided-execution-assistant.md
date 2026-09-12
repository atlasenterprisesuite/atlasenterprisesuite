# ATLAS Guided Execution Assistant Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ATLAS Assistant read the exact same persisted Guided Execution state and answer/handle `continue`, `resume`, `what is next?`, and `where did we stop?` without creating a second conversational workflow truth or bypassing execution permissions.

**Architecture:** Add a pure assistant projection over `GuidedExecutionState`, then a small contextual Assistant panel inside Guided Execution. Commands resolve to a summary, target task/step, blocker, approval requirement, or navigation intent. This slice does not add arbitrary model/tool execution; external mutations remain owned by module/provider adapters and the execution server boundary.

**Tech Stack:** TypeScript 5.7, React 18.3, Vitest 3.2, Testing Library, existing Guided Execution API/read model.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-guided-execution-design.md`

## Global Constraints

- Execute after the Core Web plan; the Manager pilot may run before or after this plan, but both must consume the same `GuidedExecutionState` contract.
- Assistant state is derived from the canonical execution response; do not persist a separate chat progress object.
- `continue` and `resume` never mean implicit permission or approval.
- This plan does not execute payments, payroll, accounting posts, tax filing, health actions, security changes, infrastructure mutations, AWS actions, or paid provider calls.
- If a step requires a module/provider adapter that is not available, Assistant returns that dependency truthfully rather than simulating execution.
- No merge or deploy in this plan.

## File Map

- `apps/web/src/execution/assistant.ts` — pure command/summary resolver.
- `apps/web/src/execution/ExecutionAssistantPanel.tsx` — contextual UI consuming the same state as the page.
- `apps/web/src/execution/GuidedExecutionPage.tsx` — pass canonical state/selection callbacks to Assistant panel.
- `tests/unit/guided-execution-assistant.test.ts` — deterministic command resolution.
- `tests/integration/guided-execution-assistant.test.tsx` — UI selection/approval/blocker behavior.

---

### Task 1: Define deterministic Assistant snapshots and command resolution

**Files:**
- Create: `apps/web/src/execution/assistant.ts`
- Test: `tests/unit/guided-execution-assistant.test.ts`

**Interfaces:**
- Consumes: `GuidedExecutionState`, selectors from `view-model.ts`.
- Produces: `buildExecutionAssistantSnapshot(state)`, `resolveExecutionAssistantCommand(command, state)`.

- [ ] **Step 1: Write failing command tests**

```ts
import { describe, expect, it } from 'vitest';
import { buildExecutionAssistantSnapshot, resolveExecutionAssistantCommand } from '../../apps/web/src/execution/assistant';

describe('Guided Execution Assistant', () => {
  it('reports the persisted blocker instead of inventing a next execution', () => {
    const state = makeGuidedState({ currentStatus: 'blocked', blockedReason: 'cloudflare_not_verified' });
    const snapshot = buildExecutionAssistantSnapshot(state);
    expect(snapshot.status).toBe('blocked');
    expect(snapshot.blockedReason).toBe('cloudflare_not_verified');
  });

  it('resolves continue to the current permitted step without executing it', () => {
    const state = makeGuidedState({ currentStepId: 'step-2', stepStatus: 'ready' });
    expect(resolveExecutionAssistantCommand('continue', state)).toEqual(expect.objectContaining({
      kind: 'focus_step',
      stepId: 'step-2',
      executesExternalAction: false
    }));
  });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/unit/guided-execution-assistant.test.ts
```

- [ ] **Step 3: Implement the snapshot contract**

```ts
export type ExecutionAssistantSnapshot = {
  workflowId: string;
  status: string;
  currentTaskId: string | null;
  currentStepId: string | null;
  currentTaskTitle: string | null;
  currentAction: string | null;
  nextAction: string | null;
  blockedReason: string | null;
  pendingApprovalId: string | null;
  verifiedEvidenceCount: number;
};
```

Populate exclusively from the passed `GuidedExecutionState` and pure selectors.

- [ ] **Step 4: Implement command normalization**

Normalize lowercase trimmed commands into four supported intents:

```ts
const CONTINUE = new Set(['continue', 'continua', 'continuar', 'resume', 'reanudar']);
const NEXT = new Set(['what is next', "what's next", 'que sigue', 'qué sigue']);
const STOPPED = new Set(['where did we stop', 'donde paramos', 'dónde paramos']);
```

Resolution order for `continue/resume`:

```text
awaiting approval -> show_approval
blocked -> show_blocker
failed -> show_failure
current ready/running step -> focus_step
completed workflow -> completed
otherwise -> show_next_action
```

Every result includes `executesExternalAction: false` in this slice.

- [ ] **Step 5: Run tests and commit**

```bash
npx vitest run tests/unit/guided-execution-assistant.test.ts
git add apps/web/src/execution/assistant.ts tests/unit/guided-execution-assistant.test.ts
git commit -m "feat: derive Assistant state from execution workflows"
```

---

### Task 2: Add the contextual ATLAS Assistant panel to Guided Execution

**Files:**
- Create: `apps/web/src/execution/ExecutionAssistantPanel.tsx`
- Modify: `apps/web/src/execution/GuidedExecutionPage.tsx`
- Test: `tests/integration/guided-execution-assistant.test.tsx`

**Interfaces:**
- Consumes: snapshot/resolver from Task 1; selected-step callback from Guided Execution page.
- Produces: visible operational summary and command buttons that navigate within the same workflow state.

- [ ] **Step 1: Write failing panel tests**

```tsx
it('uses the same blocked state shown by the workflow', () => {
  render(<ExecutionAssistantPanel state={makeGuidedState({ blockedReason: 'cloudflare_not_verified' })} onSelectStep={vi.fn()} />);
  expect(screen.getByText(/cloudflare_not_verified/i)).toBeInTheDocument();
});

it('Continue selects the canonical current step', () => {
  const onSelectStep = vi.fn();
  render(<ExecutionAssistantPanel state={makeGuidedState({ currentStepId: 'step-2' })} onSelectStep={onSelectStep} />);
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(onSelectStep).toHaveBeenCalledWith('step-2');
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/integration/guided-execution-assistant.test.tsx
```

- [ ] **Step 3: Implement the panel**

Render:

```tsx
<aside className="execution-assistant" aria-label="ATLAS Assistant">
  <p className="eyebrow">ATLAS Assistant</p>
  <h2>Execution companion</h2>
  <p role="status">{summary}</p>
  <div className="execution-assistant-actions">
    <button type="button" onClick={() => runCommand('continue')}>Continue</button>
    <button type="button" onClick={() => runCommand('what is next')}>What is next?</button>
    <button type="button" onClick={() => runCommand('where did we stop')}>Where did we stop?</button>
  </div>
</aside>
```

For `show_approval`, select the step associated with the pending approval. For `show_blocker` and `show_failure`, select the current step and announce the canonical reason. Do not call a provider or transition endpoint from these buttons.

- [ ] **Step 4: Wire it to the same page state**

`GuidedExecutionPage` passes its exact `data` object and existing `setSelectedStepId` callback. Do not clone workflow truth into an Assistant-specific React store.

- [ ] **Step 5: Run integration tests and commit**

```bash
npx vitest run tests/integration/guided-execution-assistant.test.tsx tests/integration/guided-execution-route.test.tsx
git add apps/web/src/execution/ExecutionAssistantPanel.tsx apps/web/src/execution/GuidedExecutionPage.tsx tests/integration/guided-execution-assistant.test.tsx
git commit -m "feat: add Guided Execution Assistant companion"
```

---

### Task 3: Prove approval, blocker, failure, completed, and next-action semantics

**Files:**
- Modify: `tests/unit/guided-execution-assistant.test.ts`
- Modify: `tests/integration/guided-execution-assistant.test.tsx`
- Modify production code only if a test exposes a defect.

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: complete deterministic behavior for the approved command set.

- [ ] **Step 1: Add an approval case**

```ts
expect(resolveExecutionAssistantCommand('continue', makeGuidedState({ status: 'awaiting_approval' })))
  .toEqual(expect.objectContaining({ kind: 'show_approval', executesExternalAction: false }));
```

- [ ] **Step 2: Add a completed case**

```ts
expect(resolveExecutionAssistantCommand('what is next', makeGuidedState({ workflowStatus: 'completed' })))
  .toEqual(expect.objectContaining({ kind: 'completed', nextAction: null }));
```

- [ ] **Step 3: Add a failure case**

```ts
expect(resolveExecutionAssistantCommand('continue', makeGuidedState({ stepStatus: 'failed' })))
  .toEqual(expect.objectContaining({ kind: 'show_failure', executesExternalAction: false }));
```

- [ ] **Step 4: Add a no-adapter case**

For an action such as `launch_ec2`, assert the Assistant message says the execution adapter is unavailable/blocked and never returns an executable external action.

- [ ] **Step 5: Run tests and commit**

```bash
npx vitest run tests/unit/guided-execution-assistant.test.ts tests/integration/guided-execution-assistant.test.tsx
git add tests/unit/guided-execution-assistant.test.ts tests/integration/guided-execution-assistant.test.tsx apps/web/src/execution/assistant.ts apps/web/src/execution/ExecutionAssistantPanel.tsx
git commit -m "test: verify Assistant execution semantics"
```

---

### Task 4: Verify accessibility, same-source state, and full repository integrity

**Files:**
- Modify: `tests/integration/guided-execution-assistant.test.tsx`
- Modify production code only if required by failing tests.

**Interfaces:**
- Consumes: complete Assistant integration.
- Produces: final proof that Assistant and Guided Execution share canonical state.

- [ ] **Step 1: Prove same-source updates**

Rerender the panel with a reloaded canonical state changing `blocked` -> `completed`; assert the Assistant summary changes from blocker to completed without any Assistant-specific persistence write.

- [ ] **Step 2: Prove keyboard operation and state announcement**

Tab through `Continue`, `What is next?`, and `Where did we stop?`; assert native buttons and `role=status` output. No mouse-only handler is permitted.

- [ ] **Step 3: Run Guided Execution + Assistant test set**

```bash
npx vitest run tests/unit/guided-execution-assistant.test.ts tests/integration/guided-execution-assistant.test.tsx tests/integration/guided-execution-accessibility.test.tsx tests/integration/guided-execution-route.test.tsx
```

- [ ] **Step 4: Run full verification**

```bash
npm run typecheck
npm test
npm run build
```

- [ ] **Step 5: Commit final verification changes**

```bash
git add tests/integration/guided-execution-assistant.test.tsx
git commit -m "test: verify Guided Execution Assistant integration"
```

## Completion Gate

This plan is complete when ATLAS Assistant can truthfully answer where the workflow stopped, what comes next, and what `continue/resume` means from the exact persisted execution state; it surfaces blockers, approvals, failures and completion correctly; it selects/navigates to the canonical step; it never treats conversation as authorization; and it performs no external provider mutation in this slice.
