# ATLAS Guardian Execution Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Guardian Doctrine state understandable in Guided Execution and ATLAS Assistant without giving the browser or Assistant authority to grant permission, fabricate provider state, or declare completion without canonical evidence.

**Architecture:** Derive a read-only `GuardianDisplayState` from the existing `GuidedExecutionState`; do not persist another workflow state machine. The Guided Execution header and selected-step surface render this derived state and the exact persisted scope/permissions/approval/evidence requirements. ATLAS Assistant consumes the same derived state and remains navigational/explanatory only (`executesExternalAction: false`).

**Tech Stack:** React 18.3, TypeScript 5.7, Vitest 3.2, Testing Library 16, existing Guided Execution components and CSS.

**Spec:** `docs/superpowers/specs/2026-09-13-atlas-guardian-doctrine-design.md`

## Global Constraints

- Execute after `docs/superpowers/plans/2026-09-13-atlas-guardian-core-enforcement.md` passes review.
- Do not introduce a persisted Guardian status table, a second execution state machine, a second Approval Center, or Assistant-owned workflow truth.
- Display only state derivable from canonical workflow/task/step/approval/evidence data or a server-authoritative Work policy result.
- Never render `Connected`, `Healthy`, `Completed`, `Paid`, `Filed`, `Submitted`, `Deployed`, `Booked`, or equivalent success language from AI inference alone.
- Workflow status `completed` is presented as `Completed with evidence` only when required evidence for every completed step is present and verified; otherwise surface `Recovery required`.
- Customer-facing text remains inclusive and enterprise-neutral. The St. Michael/Ephesians inspiration stays in internal doctrine documentation; no religious imagery or belief statement is required in the product UI.
- ATLAS Assistant may explain, navigate, summarize, and recommend safer alternatives; it must not execute or self-authorize privileged actions.
- Accessibility is functional: keyboard navigation, semantic status output, visible focus, screen-reader labels, reduced-motion compatibility, and equivalent text for visual status.
- Budget/provider/autonomy/envelope decisions, when available, come from the server-authoritative Work Soberano policy contract; the UI never recomputes authorization.
- No production deploy is part of this plan.

## File Map

- `apps/web/src/execution/guardian-state.ts` — pure derived Guardian user-facing status and reasons.
- `apps/web/src/execution/GuardianStatusCard.tsx` — accessible read-only presentation of scope, safeguards, and completion evidence.
- `apps/web/src/execution/WorkflowHeader.tsx` — render Guardian status alongside canonical workflow status.
- `apps/web/src/execution/StepDetailPanel.tsx` — render material permission, approval, evidence, and organization scope information.
- `apps/web/src/execution/GuidedExecutionPage.tsx` — pass canonical state/scope into Guardian presentation.
- `apps/web/src/execution/assistant.ts` — deterministic Guardian explanation results only.
- `apps/web/src/execution/ExecutionAssistantPanel.tsx` — expose Guardian explanation without mutation authority.
- `apps/web/src/execution/execution.css` — responsive/focus/status styles using existing ATLAS visual system.
- `tests/unit/guided-execution-guardian-state.test.ts` — derived state matrix.
- `tests/unit/guided-execution-assistant-guardian.test.ts` — Assistant boundaries and truthful completion.
- `tests/integration/guided-execution-guardian-experience.test.tsx` — rendered safeguards/accessibility behavior.

---

### Task 1: Derive truthful Guardian display states from canonical execution state

**Files:**
- Create: `apps/web/src/execution/guardian-state.ts`
- Create: `tests/unit/guided-execution-guardian-state.test.ts`

**Interfaces:**
- Consumes: `GuidedExecutionState`, `activeTask`, `activeStep`, `stepBlockers`.
- Produces: `GuardianDisplayState`, `deriveGuardianDisplayState(state)`.

- [ ] **Step 1: Write the failing state-matrix tests**

```ts
import { describe, expect, it } from 'vitest';
import { deriveGuardianDisplayState } from '../../apps/web/src/execution/guardian-state';
import type { GuidedExecutionState } from '../../apps/web/src/execution/types';

function baseState(): GuidedExecutionState {
  return {
    workflow: {
      id: 'workflow-1', organizationId: 'org-1', tenantId: 'tenant-1', workflowType: 'test',
      ownerModule: 'payroll', status: 'now', currentTaskId: 'task-1', currentModule: 'payroll',
      context: {}, version: 1
    },
    tasks: [{
      id: 'task-1', workflowId: 'workflow-1', module: 'payroll', title: 'Submit payroll', goal: 'Submit payroll safely',
      status: 'now', priority: 'high', currentStepId: 'step-1', nextAction: 'Submit payroll', blockedReason: null,
      permissionsRequired: ['payroll.write']
    }],
    steps: [{
      id: 'step-1', taskId: 'task-1', sequence: 1, module: 'payroll', actionType: 'submit_payroll',
      status: 'ready', completionCriteria: ['submission verified'], permissionsRequired: ['payroll.write'],
      evidenceRequirement: ['payroll_submission'], startedAt: null, completedAt: null
    }],
    dependencies: [], evidence: [], approvals: []
  };
}

describe('Guardian display state', () => {
  it('reports Ready for an executable persisted step', () => {
    expect(deriveGuardianDisplayState(baseState()).state).toBe('ready');
  });

  it('reports Awaiting approval for a persisted pending approval', () => {
    const state = baseState();
    state.tasks[0].status = 'awaiting_approval';
    state.approvals.push({
      id: 'approval-1', taskId: 'task-1', workflowId: 'workflow-1', module: 'payroll',
      approvalType: 'execution_review', requiredPermission: 'execution.approve', riskLevel: 'high',
      summary: 'Approve payroll', payloadVersion: 1, payloadDigest: 'digest', status: 'pending',
      decidedBy: null, decisionReason: null, createdAt: '2026-09-13T20:00:00Z', decidedAt: null
    });
    expect(deriveGuardianDisplayState(state).state).toBe('awaiting_approval');
  });

  it('reports Verification pending when a completed step lacks required verified evidence', () => {
    const state = baseState();
    state.steps[0].status = 'completed';
    expect(deriveGuardianDisplayState(state).state).toBe('verification_pending');
  });

  it('reports Recovery required instead of completed when workflow claims completion without required evidence', () => {
    const state = baseState();
    state.workflow.status = 'completed';
    state.tasks[0].status = 'completed';
    state.steps[0].status = 'completed';
    expect(deriveGuardianDisplayState(state).state).toBe('recovery_required');
  });

  it('reports Completed with evidence only with matching verified evidence', () => {
    const state = baseState();
    state.workflow.status = 'completed';
    state.tasks[0].status = 'completed';
    state.steps[0].status = 'completed';
    state.evidence.push({
      id: 'evidence-1', taskId: 'task-1', stepId: 'step-1', kind: 'payroll_submission',
      reference: 'payroll://submission/1', verified: true, createdAt: '2026-09-13T20:05:00Z'
    });
    expect(deriveGuardianDisplayState(state).state).toBe('completed_with_evidence');
  });
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/guided-execution-guardian-state.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure derived state**

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

function missingRequiredEvidence(state: GuidedExecutionState) {
  return state.steps.flatMap((step) => step.evidenceRequirement.filter((kind) =>
    !state.evidence.some((evidence) =>
      evidence.verified
      && evidence.kind === kind
      && evidence.taskId === step.taskId
      && (evidence.stepId === step.id || evidence.stepId === null)
    )
  ));
}
```

Decision order:

1. `workflow.status === 'completed'` + any missing required evidence -> `recovery_required`.
2. `workflow.status === 'completed'` + no missing required evidence -> `completed_with_evidence`.
3. Pending approval or task/step awaiting approval -> `awaiting_approval`.
4. Failed task/step + at least one other completed step -> `partially_completed`; otherwise `failed`.
5. Blocker containing `permission` or `missing_*_permission` -> `needs_permission`.
6. Blocker beginning `policy:`, `budget_`, `execution_envelope_`, or `provider_policy_` -> `blocked_by_policy`.
7. Completed current step with missing required evidence -> `verification_pending`.
8. Running current step -> `executing`.
9. Other persisted blockers ending in `_required` -> `needs_information`.
10. Otherwise -> `ready`.

Every returned `reason` must be derived from the persisted blocker/state or a fixed explanation of the evidence check; do not infer provider health.

- [ ] **Step 4: Verify GREEN and commit**

```bash
npx vitest run tests/unit/guided-execution-guardian-state.test.ts
git add apps/web/src/execution/guardian-state.ts tests/unit/guided-execution-guardian-state.test.ts
git commit -m "feat: derive truthful Guardian execution states"
```

---

### Task 2: Render execution safeguards and affected scope accessibly

**Files:**
- Create: `apps/web/src/execution/GuardianStatusCard.tsx`
- Modify: `apps/web/src/execution/WorkflowHeader.tsx`
- Modify: `apps/web/src/execution/StepDetailPanel.tsx`
- Modify: `apps/web/src/execution/GuidedExecutionPage.tsx`
- Modify: `apps/web/src/execution/execution.css`
- Create: `tests/integration/guided-execution-guardian-experience.test.tsx`

**Interfaces:**
- Consumes: `deriveGuardianDisplayState(state)`, selected `GuidedTask`, `GuidedStep`, canonical workflow scope.
- Produces: read-only, screen-reader-readable safeguard state and material execution facts.

- [ ] **Step 1: Write the failing integration test**

Render `GuidedExecutionPage` with mocked `loadGuidedExecutionState` returning the `baseState()` shape from Task 1 and assert:

```ts
expect(await screen.findByRole('status', { name: /execution safeguards/i })).toHaveTextContent('Ready');
expect(screen.getByText(/Organization scope/i)).toHaveTextContent('org-1');
expect(screen.getByText(/Required permissions/i).parentElement).toHaveTextContent('payroll.write');
expect(screen.getByText(/Evidence required/i).parentElement).toHaveTextContent('payroll_submission');
expect(screen.queryByText(/connected/i)).not.toBeInTheDocument();
```

Add an awaiting-approval fixture and assert the status says `Awaiting approval`, while the existing `ApprovalCard` remains the only approval decision surface.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/integration/guided-execution-guardian-experience.test.tsx
```

Expected: FAIL because `GuardianStatusCard` and scope/evidence summary are not rendered.

- [ ] **Step 3: Implement `GuardianStatusCard`**

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

This component is informational only: no approve, execute, retry, or provider mutation callbacks.

- [ ] **Step 4: Wire it into Guided Execution**

In `GuidedExecutionPage`, compute:

```ts
const guardianStatus = deriveGuardianDisplayState(data);
```

Pass `guardianStatus` and `data.workflow.organizationId` to `WorkflowHeader` or render `GuardianStatusCard` immediately after `WorkflowHeader`. For the selected step use the selected task/step arrays to show exact permissions/evidence. Do not duplicate ApprovalCard decision controls.

- [ ] **Step 5: Add responsive/focus styles using existing variables**

Add only structural rules to `execution.css`; keep existing ATLAS colors/tokens. Required behavior:

```css
.execution-guardian-card { display: grid; gap: 1rem; }
.execution-guardian-facts { display: grid; gap: .75rem; margin: 0; }
.execution-guardian-facts div { display: grid; gap: .25rem; }
.execution-guardian-card :focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .execution-guardian-card { scroll-behavior: auto; }
}
```

Do not specify new brand colors.

- [ ] **Step 6: Verify GREEN and commit**

```bash
npx vitest run tests/integration/guided-execution-guardian-experience.test.tsx
npm run typecheck
git add apps/web/src/execution/GuardianStatusCard.tsx apps/web/src/execution/WorkflowHeader.tsx apps/web/src/execution/StepDetailPanel.tsx apps/web/src/execution/GuidedExecutionPage.tsx apps/web/src/execution/execution.css tests/integration/guided-execution-guardian-experience.test.tsx
git commit -m "feat: surface Guardian execution safeguards"
```

---

### Task 3: Make ATLAS Assistant explain Guardian state without authority escalation

**Files:**
- Modify: `apps/web/src/execution/assistant.ts`
- Modify: `apps/web/src/execution/ExecutionAssistantPanel.tsx`
- Create: `tests/unit/guided-execution-assistant-guardian.test.ts`

**Interfaces:**
- Consumes: `deriveGuardianDisplayState(state)` and existing Assistant snapshot.
- Produces: `guardianState` in the snapshot and deterministic `explain_guardian` result; every result remains `executesExternalAction: false`.

- [ ] **Step 1: Write failing Assistant boundary tests**

```ts
import { expect, it } from 'vitest';
import { buildExecutionAssistantSnapshot, resolveExecutionAssistantCommand } from '../../apps/web/src/execution/assistant';

it('never upgrades a pending approval into authorization', () => {
  const state = awaitingApprovalState();
  const result = resolveExecutionAssistantCommand('continue', state);
  expect(result.kind).toBe('show_approval');
  expect(result.executesExternalAction).toBe(false);
});

it('does not call a false completed workflow complete when required evidence is absent', () => {
  const state = completedWithoutEvidenceState();
  const snapshot = buildExecutionAssistantSnapshot(state);
  expect(snapshot.guardianState).toBe('recovery_required');
  const result = resolveExecutionAssistantCommand('why', state);
  expect(result.executesExternalAction).toBe(false);
  expect(result.message).toMatch(/required evidence/i);
});
```

Use local fixture builders in the test; do not import test fixtures from another test file.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/guided-execution-assistant-guardian.test.ts
```

- [ ] **Step 3: Extend the Assistant snapshot and command union**

Add:

```ts
guardianState: GuardianDisplayStateName;
```

and one result variant:

```ts
| (AssistantBaseResult & {
    kind: 'explain_guardian';
    guardianState: GuardianDisplayStateName;
    stepId: string | null;
  })
```

Recognize only explicit explanation phrases:

```ts
const WHY = new Set(['why', 'why is this blocked', 'por que', 'por qué']);
```

For `WHY`, use `deriveGuardianDisplayState(state)` and return its persisted/derived reason. Do not create mutation callbacks, approval decisions, provider calls, or new authorization state.

- [ ] **Step 4: Make completion responses Guardian-aware**

Replace the current unconditional `workflow.status === 'completed'` response with:

```ts
const guardian = deriveGuardianDisplayState(state);
if (guardian.state === 'completed_with_evidence') return completedResult();
if (guardian.state === 'recovery_required') {
  return {
    kind: 'explain_guardian',
    guardianState: guardian.state,
    stepId: activeStep(state)?.id ?? null,
    message: guardian.reason,
    executesExternalAction: false
  };
}
```

This prevents Assistant language from overruling evidence truth.

- [ ] **Step 5: Add a `Why?` UI control**

In `ExecutionAssistantPanel` add:

```tsx
<button className="execution-action" type="button" onClick={() => runCommand('why')}>Why?</button>
```

Update `selectableStep` to allow `explain_guardian` to focus its persisted step when one exists. The button remains a local explanation/navigation action only.

- [ ] **Step 6: Verify GREEN and commit**

```bash
npx vitest run tests/unit/guided-execution-assistant-guardian.test.ts tests/unit/guided-execution-assistant.test.ts
npm run typecheck
git add apps/web/src/execution/assistant.ts apps/web/src/execution/ExecutionAssistantPanel.tsx tests/unit/guided-execution-assistant-guardian.test.ts
git commit -m "feat: make ATLAS Assistant Guardian-aware"
```

---

### Task 4: Verify accessibility-critical Guardian paths

**Files:**
- Modify: `tests/integration/guided-execution-guardian-experience.test.tsx`
- Modify: `apps/web/src/execution/GuardianStatusCard.tsx` only if the failing test requires a semantic correction.

**Interfaces:**
- Produces: keyboard/screen-reader regression evidence for status, approvals, explanation, and evidence navigation.

- [ ] **Step 1: Add semantic status assertions**

```ts
const status = await screen.findByRole('status', { name: /execution safeguards/i });
expect(status).toHaveAttribute('aria-live', 'polite');
expect(screen.getByRole('button', { name: 'Why?' })).toBeEnabled();
expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
```

- [ ] **Step 2: Add keyboard-order assertions**

Use `userEvent.setup()` and `user.tab()` from the first Assistant button through `Why?`; assert every actionable control becomes `document.activeElement` in DOM order and no non-interactive Guardian fact requires pointer-only access.

- [ ] **Step 3: Add non-color-only status assertions**

For `blocked_by_policy`, `awaiting_approval`, and `recovery_required` fixtures, assert the textual label is present. The test must not depend on CSS color classes to determine state.

- [ ] **Step 4: Verify focused accessibility suite**

```bash
npx vitest run tests/integration/guided-execution-guardian-experience.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/integration/guided-execution-guardian-experience.test.tsx apps/web/src/execution/GuardianStatusCard.tsx
git commit -m "test: verify Guardian execution accessibility"
```

If `GuardianStatusCard.tsx` required no correction, omit it from `git add`.

---

### Task 5: Final Guardian experience verification

- [ ] **Step 1: Run focused Guardian suites**

```bash
npx vitest run \
  tests/unit/guided-execution-guardian-state.test.ts \
  tests/unit/guided-execution-assistant-guardian.test.ts \
  tests/integration/guided-execution-guardian-experience.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run existing Guided Execution regressions**

```bash
npx vitest run tests/unit/guided-execution-view-model.test.ts tests/unit/guided-execution-assistant.test.ts tests/integration/guided-execution-route.test.tsx
```

If an exact existing filename differs, resolve it from the repository before execution and run the corresponding current Guided Execution route/UI test; do not silently skip the coverage.

- [ ] **Step 3: Run repository verification**

```bash
npm ci
npm audit --audit-level=high
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

Expected: every command exits 0.

- [ ] **Step 4: Record exact verification SHA**

```bash
git rev-parse HEAD
git status --short
```

Expected: clean worktree. Do not claim the Guardian experience is integrated unless the complete verification set passed on this exact SHA.
