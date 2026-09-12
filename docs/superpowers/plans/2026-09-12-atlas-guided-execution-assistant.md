# ATLAS Guided Execution Assistant Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ATLAS Assistant read the exact same persisted Guided Execution state and answer/handle `continue`, `resume`, `what is next?`, and `where did we stop?` without creating a second conversational workflow truth or bypassing execution permissions.

**Architecture:** Add a pure Assistant projection over `GuidedExecutionState`, then a contextual Assistant panel inside Guided Execution. Commands resolve to a summary, target task/step, blocker, approval requirement, failure, completion, or navigation intent. This slice does not add arbitrary model/tool execution; external mutations remain owned by module/provider adapters and the execution server boundary.

**Tech Stack:** TypeScript 5.7, React 18.3, Vitest 3.2, Testing Library, existing Guided Execution API/read model.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-guided-execution-design.md`

## Global Constraints

- Execute after `2026-09-12-atlas-guided-execution-core-web.md` is complete and reviewed.
- Reuse `tests/fixtures/guidedExecution.ts`; do not create incompatible duplicate fixture vocabulary.
- Assistant state is derived from the exact `GuidedExecutionState` already loaded by the page; do not persist a separate chat progress object.
- `continue` and `resume` never mean implicit permission, approval, provider connectivity, or external execution.
- This plan does not execute payments, payroll, accounting posts, tax filing, health actions, security changes, infrastructure mutations, AWS actions, or paid provider calls.
- If a step requires an unavailable module/provider adapter, Assistant surfaces the dependency truthfully rather than simulating execution.
- No merge or deploy in this plan.

## File Map

- `apps/web/src/execution/assistant.ts` — pure snapshot and command resolver.
- `apps/web/src/execution/ExecutionAssistantPanel.tsx` — contextual UI consuming the same state as Guided Execution.
- `apps/web/src/execution/GuidedExecutionPage.tsx` — passes canonical state and the existing selected-step callback.
- `tests/fixtures/guidedExecution.ts` — existing fixture builder from Core Web plan.
- `tests/unit/guided-execution-assistant.test.ts` — deterministic command resolution.
- `tests/integration/guided-execution-assistant.test.tsx` — UI selection, blocker, approval, failure, completion, accessibility.

---

### Task 1: Define deterministic Assistant snapshots and command resolution

**Files:**
- Create: `apps/web/src/execution/assistant.ts`
- Test: `tests/unit/guided-execution-assistant.test.ts`

**Interfaces:**
- Consumes: `GuidedExecutionState`, `activeTask`, `activeStep`, `deriveStepAction`, `makeGuidedState`.
- Produces: `buildExecutionAssistantSnapshot(state)`, `resolveExecutionAssistantCommand(command, state)`.

- [ ] **Step 1: Write failing command tests using the shared fixture vocabulary**

```ts
import { describe, expect, it } from 'vitest';
import { makeApproval, makeGuidedState } from '../fixtures/guidedExecution';
import { buildExecutionAssistantSnapshot, resolveExecutionAssistantCommand } from '../../apps/web/src/execution/assistant';

it('reports the persisted blocker instead of inventing a next execution', () => {
  const state = makeGuidedState({ taskStatus: 'blocked', blockedReason: 'cloudflare_not_verified', stepStatuses: ['completed', 'blocked', 'blocked'] });
  const snapshot = buildExecutionAssistantSnapshot(state);
  expect(snapshot.status).toBe('blocked');
  expect(snapshot.blockedReason).toBe('cloudflare_not_verified');
});

it('resolves continue to the canonical current step without executing it', () => {
  const state = makeGuidedState({ currentStepId: 'step-2', stepStatuses: ['completed', 'ready', 'blocked'] });
  expect(resolveExecutionAssistantCommand('continue', state)).toEqual(expect.objectContaining({
    kind: 'focus_step', stepId: 'step-2', executesExternalAction: false
  }));
});

it('surfaces a pending approval before any continuation', () => {
  const state = makeGuidedState({
    taskStatus: 'awaiting_approval',
    approvals: [makeApproval({ status: 'pending' })]
  });
  expect(resolveExecutionAssistantCommand('resume', state)).toEqual(expect.objectContaining({
    kind: 'show_approval', approvalId: 'approval-1', executesExternalAction: false
  }));
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

Populate every field exclusively from the passed `GuidedExecutionState` and Core Web pure selectors. Never read localStorage/sessionStorage or maintain Assistant-specific workflow state.

- [ ] **Step 4: Implement three command families with deterministic precedence**

```ts
const CONTINUE = new Set(['continue', 'continua', 'continuar', 'resume', 'reanudar']);
const NEXT = new Set(['what is next', "what's next", 'que sigue', 'qué sigue']);
const STOPPED = new Set(['where did we stop', 'donde paramos', 'dónde paramos']);
```

Normalize input with `trim().toLowerCase()`. For `continue/resume`, resolve in this order:

```text
pending approval / task awaiting_approval -> show_approval
active task blocked -> show_blocker
active step failed -> show_failure
workflow completed -> completed
active step ready/running -> focus_step
otherwise -> show_next_action
```

Every command result in this plan includes `executesExternalAction: false`.

- [ ] **Step 5: Handle unsupported phrases truthfully**

Return:

```ts
{ kind: 'unsupported', message: 'This execution command is not supported in the current workflow.', executesExternalAction: false }
```

Do not send unsupported text to a model or provider in this slice.

- [ ] **Step 6: Run tests and commit**

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
- Consumes: Task 1 resolver; exact page `data`; existing `setSelectedStepId` callback.
- Produces: visible operational summary and navigation-only command controls.

- [ ] **Step 1: Write failing panel tests**

```tsx
it('uses the same blocked state shown by the workflow', () => {
  const state = makeGuidedState({ taskStatus: 'blocked', blockedReason: 'cloudflare_not_verified', stepStatuses: ['completed', 'blocked', 'blocked'] });
  render(<ExecutionAssistantPanel state={state} onSelectStep={vi.fn()} />);
  expect(screen.getByText(/cloudflare_not_verified/i)).toBeInTheDocument();
});

it('Continue selects the canonical current step', () => {
  const onSelectStep = vi.fn();
  const state = makeGuidedState({ currentStepId: 'step-2', stepStatuses: ['completed', 'ready', 'blocked'] });
  render(<ExecutionAssistantPanel state={state} onSelectStep={onSelectStep} />);
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(onSelectStep).toHaveBeenCalledWith('step-2');
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/integration/guided-execution-assistant.test.tsx
```

- [ ] **Step 3: Implement the panel with native controls**

```tsx
<aside className="execution-assistant" aria-label="ATLAS Assistant">
  <p className="eyebrow">ATLAS Assistant</p>
  <h2>Execution companion</h2>
  <p role="status" aria-live="polite">{summary}</p>
  <div className="execution-assistant-actions">
    <button type="button" onClick={() => runCommand('continue')}>Continue</button>
    <button type="button" onClick={() => runCommand('what is next')}>What is next?</button>
    <button type="button" onClick={() => runCommand('where did we stop')}>Where did we stop?</button>
  </div>
</aside>
```

For `show_approval`, select the step belonging to the pending approval's task/current step. For `show_blocker`/`show_failure`, select the canonical current step and announce the stored reason/status. For `completed`, keep the current selection and announce that no next action exists. These buttons never call transition/provider endpoints.

- [ ] **Step 4: Wire the exact same page state**

`GuidedExecutionPage` passes `data` directly and the existing selected-step callback. Do not clone `data` into a second Assistant store or save it elsewhere.

- [ ] **Step 5: Run tests and commit**

```bash
npx vitest run tests/integration/guided-execution-assistant.test.tsx tests/integration/guided-execution-route.test.tsx
git add apps/web/src/execution/ExecutionAssistantPanel.tsx apps/web/src/execution/GuidedExecutionPage.tsx tests/integration/guided-execution-assistant.test.tsx
git commit -m "feat: add Guided Execution Assistant companion"
```

---

### Task 3: Prove blocker, approval, failure, completion, next-action, and unavailable-adapter semantics

**Files:**
- Modify: `tests/unit/guided-execution-assistant.test.ts`
- Modify: `tests/integration/guided-execution-assistant.test.tsx`
- Modify production code only if a failing test exposes a defect.

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: complete deterministic behavior for the approved command set.

- [ ] **Step 1: Add completed workflow case**

```ts
const completed = makeGuidedState({ workflowStatus: 'completed', taskStatus: 'completed', stepStatuses: ['completed', 'completed', 'completed'], currentStepId: 'step-3' });
expect(resolveExecutionAssistantCommand('what is next', completed))
  .toEqual(expect.objectContaining({ kind: 'completed', nextAction: null, executesExternalAction: false }));
```

- [ ] **Step 2: Add failure case**

```ts
const failed = makeGuidedState({ taskStatus: 'failed', stepStatuses: ['completed', 'failed', 'blocked'], currentStepId: 'step-2' });
expect(resolveExecutionAssistantCommand('continue', failed))
  .toEqual(expect.objectContaining({ kind: 'show_failure', stepId: 'step-2', executesExternalAction: false }));
```

- [ ] **Step 3: Add unavailable-adapter case**

```ts
const aws = makeGuidedState({ currentActionType: 'launch_ec2', taskStatus: 'blocked', blockedReason: 'AWS execution adapter not enabled', stepStatuses: ['completed', 'blocked', 'blocked'] });
const result = resolveExecutionAssistantCommand('continue', aws);
expect(result).toEqual(expect.objectContaining({ kind: 'show_blocker', executesExternalAction: false }));
expect(JSON.stringify(result)).toContain('AWS execution adapter not enabled');
```

- [ ] **Step 4: Add `where did we stop?` and next-action cases**

Assert STOPPED returns current task title/current action/current step ID. Assert NEXT returns the persisted `task.nextAction` or `completed` when none exists and workflow is complete; it must not synthesize a next provider action.

- [ ] **Step 5: Run tests and commit**

```bash
npx vitest run tests/unit/guided-execution-assistant.test.ts tests/integration/guided-execution-assistant.test.tsx
git add tests/unit/guided-execution-assistant.test.ts tests/integration/guided-execution-assistant.test.tsx apps/web/src/execution/assistant.ts apps/web/src/execution/ExecutionAssistantPanel.tsx
git commit -m "test: verify Assistant execution semantics"
```

---

### Task 4: Verify same-source updates, keyboard accessibility, and full repository integrity

**Files:**
- Modify: `tests/integration/guided-execution-assistant.test.tsx`
- Modify production code only if required by failing tests.

**Interfaces:**
- Consumes: complete Assistant integration.
- Produces: final evidence that Assistant and Guided Execution share canonical state.

- [ ] **Step 1: Prove same-source reload updates Assistant**

Render blocked state, then rerender the panel with a new `GuidedExecutionState` from `makeGuidedState({ workflowStatus:'completed', taskStatus:'completed', stepStatuses:['completed','completed','completed'], currentStepId:'step-3' })`. Assert the summary changes from blocker to completed without any Assistant persistence call.

- [ ] **Step 2: Prove keyboard operation and announcements**

Use `userEvent.tab()`/keyboard activation across Continue, What is next?, and Where did we stop?. Assert native buttons, visible focus through existing CSS, and `role="status" aria-live="polite"` output. No mouse-only handler is permitted.

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

Assistant integration is ready for review only when ATLAS Assistant truthfully answers where the workflow stopped, what comes next, and what `continue/resume` means from the exact persisted execution state; it surfaces blockers, pending approvals, failures, completion and unavailable adapters correctly; it selects/navigates to the canonical step; unsupported commands remain bounded; conversation never becomes authorization; full typecheck/test/build passes; and no external provider mutation, paid action, merge, or deploy occurs.
