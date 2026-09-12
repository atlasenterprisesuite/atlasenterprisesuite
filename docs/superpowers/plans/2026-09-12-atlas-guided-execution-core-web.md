# ATLAS Guided Execution Core Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reusable `/execution/:workflowId` Guided Execution web surface over the existing Universal Execution Engine without introducing a second workflow state machine or fake execution state.

**Architecture:** Reuse `@atlas/execution`, the authenticated `atlas-execution` Edge Function, the existing ATLAS session/organization boundary, React Router, and the current ATLAS shell. Normalize the Edge Function's snake_case persistence payload once at the web boundary, then render task groups, steps, approvals, evidence, blockers, progress, and resumability from canonical persisted state.

**Tech Stack:** TypeScript 5.7, React 18.3, React Router 7.18, Vitest 3.2, Testing Library 16, jsdom, Supabase Edge Functions.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-guided-execution-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`.
- Feature branch: `feat/atlas-guided-execution`.
- Preserve the reconciled Universal Execution Foundation; do not rewrite `packages/execution` unless a failing Guided Execution contract proves a foundation defect.
- No AWS EC2 launch, terminate, key-pair creation, security-group mutation, or paid-provider action.
- No production deploy or merge in this plan.
- Workflow truth lives in the execution backend; React state is presentation state only.
- Every mutation must go through the authenticated server boundary and be reauthorized there.
- No UI may claim `connected`, `running`, `approved`, `completed`, or `live` without canonical state/evidence.
- Do not render raw `action_payload`, tokens, secrets, passwords, keys, certificates, recovery codes, or provider credentials.
- TDD cycle for every task: failing test -> minimal implementation -> focused passing test -> commit -> independent review.
- Final verification: `npm run typecheck`, `npm test`, `npm run build`.

## Pre-flight Gate

Before Task 1, confirm the branch contains the reconciled Universal Execution Foundation assets:

```bash
test -f packages/execution/src/types.ts
test -f packages/execution/src/progress.ts
test -f supabase/functions/atlas-execution/index.ts
test -f supabase/migrations/20260912_universal_execution_engine.sql
npm ci
npm run typecheck
npm test
npm run build
```

Expected: all file checks and baseline commands pass. If the feature branch is behind the approved foundation branch, reconcile by normal merge/rebase without force-resetting or discarding the Guided Execution design commit.

---

## File Map

- `apps/web/src/execution/types.ts` — normalized read model used by Guided Execution components.
- `apps/web/src/execution/api.ts` — authenticated `atlas-execution` client and normalization boundary.
- `apps/web/src/execution/view-model.ts` — pure selectors for grouping, progress, current step, and action semantics.
- `apps/web/src/execution/GuidedExecutionPage.tsx` — route-level data loading and state orchestration.
- `apps/web/src/execution/WorkflowHeader.tsx` — title, owner, status, priority, verified progress.
- `apps/web/src/execution/ExecutionBreadcrumbs.tsx` — return navigation and current execution location.
- `apps/web/src/execution/TaskGroup.tsx` — expandable task group.
- `apps/web/src/execution/ExecutionStepRow.tsx` — step status and selection.
- `apps/web/src/execution/StepDetailPanel.tsx` — requirements, dependencies, evidence, approvals, blocker/error.
- `apps/web/src/execution/EvidencePanel.tsx` — evidence references only; no sensitive payloads.
- `apps/web/src/execution/ApprovalCard.tsx` — existing approval state and permitted decisions.
- `apps/web/src/execution/StepActionBar.tsx` — only real supported actions.
- `apps/web/src/execution/execution.css` — responsive/accessibility styles.
- `apps/web/src/App.tsx` — authenticated `/execution/:workflowId` route.
- `apps/web/src/main.tsx` — import Guided Execution stylesheet.
- `apps/web/src/lib/atlasSession.ts` — expose the existing authenticated fetch primitive without changing its refresh semantics.
- `tests/unit/guided-execution-view-model.test.ts` — pure status/progress/action tests.
- `tests/unit/guided-execution-api.test.ts` — response normalization and request contract.
- `tests/integration/guided-execution-route.test.tsx` — route/load/error/selection behavior.
- `tests/integration/guided-execution-approval.test.tsx` — approval decision behavior.
- `tests/integration/guided-execution-accessibility.test.tsx` — keyboard/ARIA/state announcements.

---

### Task 1: Add the authenticated execution web client and normalized read model

**Files:**
- Create: `apps/web/src/execution/types.ts`
- Create: `apps/web/src/execution/api.ts`
- Modify: `apps/web/src/lib/atlasSession.ts`
- Test: `tests/unit/guided-execution-api.test.ts`

**Interfaces:**
- Consumes: `getActiveAtlasOrganization()` and the existing session refresh/auth behavior from `apps/web/src/lib/atlasSession.ts`; Edge operation `get_state` with `{ organization_id, workflow_id }`.
- Produces: `GuidedExecutionState`, `loadGuidedExecutionState(workflowId)`, `requestExecutionApproval(input)`, `decideExecutionApproval(input)`.

- [ ] **Step 1: Write the failing normalization/request tests**

Create `tests/unit/guided-execution-api.test.ts` with a mocked authenticated transport and assert that raw database fields are normalized once:

```ts
import { describe, expect, it } from 'vitest';
import { normalizeExecutionState } from '../../apps/web/src/execution/api';

describe('Guided Execution API normalization', () => {
  it('maps persisted snake_case state without inventing progress', () => {
    const state = normalizeExecutionState({
      ok: true,
      workflow: {
        id: 'wf-1', org_id: 'org-1', tenant_id: 'tenant-1',
        workflow_type: 'manager.infrastructure_readiness', owner_module: 'manager',
        status: 'now', current_task_id: 'task-1', current_module: 'manager',
        context: {}, created_by: 'user-1', version: 1,
        created_at: '2026-09-12T12:00:00Z', updated_at: '2026-09-12T12:00:00Z', completed_at: null
      },
      tasks: [{
        id: 'task-1', org_id: 'org-1', tenant_id: 'tenant-1', workflow_id: 'wf-1',
        module: 'manager', owner_user_id: 'user-1', title: 'Verify infrastructure readiness',
        intent: 'Verify required production path', goal: 'Produce evidence-backed readiness', status: 'now',
        priority: 'high', current_step_id: 'step-1', next_action: 'Verify GitHub', blocked_reason: null,
        permissions_required: ['execution.read'], source_type: null, source_id: null,
        parent_task_id: null, version: 1, created_at: '2026-09-12T12:00:00Z',
        updated_at: '2026-09-12T12:00:00Z', completed_at: null
      }],
      steps: [{
        id: 'step-1', task_id: 'task-1', sequence: 1, module: 'manager', action_type: 'verify_github',
        action_payload: {}, status: 'ready', completion_criteria: ['github verified'],
        permissions_required: ['execution.read'], evidence_requirement: ['infra_verification'],
        started_at: null, completed_at: null
      }],
      dependencies: [], evidence: [], approvals: []
    });

    expect(state.workflow.ownerModule).toBe('manager');
    expect(state.tasks[0].currentStepId).toBe('step-1');
    expect(state.steps[0].actionPayload).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

```bash
npx vitest run tests/unit/guided-execution-api.test.ts
```

Expected: FAIL because `apps/web/src/execution/api.ts` does not exist.

- [ ] **Step 3: Expose the existing authenticated transport without duplicating token refresh logic**

In `apps/web/src/lib/atlasSession.ts`, rename/export the existing internal helper as:

```ts
export async function authorizedAtlasFetch(path: string, init: RequestInit = {}) {
  // retain the existing token lookup, one-time 401 refresh, and request behavior verbatim
}
```

Update internal callers in the same file from `authorizedFetch(...)` to `authorizedAtlasFetch(...)`. Do not change storage keys, refresh behavior, Supabase URL, or public key behavior in this task.

- [ ] **Step 4: Implement normalized execution types and API client**

Create `apps/web/src/execution/types.ts` with UI-safe types that omit `actionPayload` from the read model:

```ts
import type { ApprovalStatus, ExecutionPriority, ExecutionStatus, StepStatus } from '../../../../packages/execution/src';

export type GuidedWorkflow = {
  id: string;
  organizationId: string;
  tenantId: string;
  workflowType: string;
  ownerModule: string;
  status: ExecutionStatus;
  currentTaskId: string | null;
  currentModule: string;
  version: number;
};

export type GuidedTask = {
  id: string;
  workflowId: string;
  module: string;
  title: string;
  goal: string;
  status: ExecutionStatus;
  priority: ExecutionPriority;
  currentStepId: string | null;
  nextAction: string | null;
  blockedReason: string | null;
  permissionsRequired: string[];
};

export type GuidedStep = {
  id: string;
  taskId: string;
  sequence: number;
  module: string;
  actionType: string;
  status: StepStatus;
  completionCriteria: string[];
  permissionsRequired: string[];
  evidenceRequirement: string[];
  startedAt: string | null;
  completedAt: string | null;
};

export type GuidedEvidence = { id: string; taskId: string; stepId: string | null; kind: string; reference: string; verified: boolean; createdAt: string };
export type GuidedApproval = { id: string; taskId: string; workflowId: string; module: string; approvalType: string; requiredPermission: string; riskLevel: 'low' | 'medium' | 'high' | 'critical'; summary: string; payloadVersion: number; payloadDigest: string; status: ApprovalStatus; decidedBy: string | null; decisionReason: string | null; createdAt: string; decidedAt: string | null };
export type GuidedDependency = { id: string; taskId: string; stepId: string | null; dependsOnTaskId: string | null; dependsOnStepId: string | null; resolvedAt: string | null };
export type GuidedExecutionState = { workflow: GuidedWorkflow; tasks: GuidedTask[]; steps: GuidedStep[]; dependencies: GuidedDependency[]; evidence: GuidedEvidence[]; approvals: GuidedApproval[] };
```

Create `apps/web/src/execution/api.ts` with `normalizeExecutionState(raw)` and:

```ts
export async function loadGuidedExecutionState(workflowId: string) {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/functions/v1/atlas-execution', {
    method: 'POST',
    body: JSON.stringify({
      operation: 'get_state',
      organization_id: organization.id,
      workflow_id: workflowId
    })
  });
  const raw = await parseExecutionResponse(response);
  return normalizeExecutionState(raw);
}
```

The normalizer must whitelist fields; never spread raw rows into UI objects.

- [ ] **Step 5: Run focused tests and typecheck**

```bash
npx vitest run tests/unit/guided-execution-api.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/atlasSession.ts apps/web/src/execution/types.ts apps/web/src/execution/api.ts tests/unit/guided-execution-api.test.ts
git commit -m "feat: add Guided Execution API client"
```

---

### Task 2: Add the authenticated `/execution/:workflowId` route with truthful loading/error/empty states

**Files:**
- Create: `apps/web/src/execution/GuidedExecutionPage.tsx`
- Modify: `apps/web/src/App.tsx`
- Test: `tests/integration/guided-execution-route.test.tsx`

**Interfaces:**
- Consumes: `loadGuidedExecutionState(workflowId)` from Task 1.
- Produces: authenticated route `/execution/:workflowId`, refresh/reload behavior, route-level state container.

- [ ] **Step 1: Write failing route tests**

Create `tests/integration/guided-execution-route.test.tsx` and mock `loadGuidedExecutionState`:

```tsx
it('renders an authenticated Guided Execution workflow', async () => {
  vi.mocked(loadGuidedExecutionState).mockResolvedValue(makeGuidedState());
  render(<MemoryRouter initialEntries={['/execution/wf-1']}><App /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'Verify infrastructure readiness' })).toBeInTheDocument();
});

it('shows a truthful not-found error', async () => {
  vi.mocked(loadGuidedExecutionState).mockRejectedValue(new Error('workflow_not_found'));
  render(<MemoryRouter initialEntries={['/execution/missing']}><App /></MemoryRouter>);
  expect(await screen.findByText('Workflow not found')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/integration/guided-execution-route.test.tsx
```

Expected: FAIL because the route/page do not exist.

- [ ] **Step 3: Implement route-level loading with cancellation protection**

Create `GuidedExecutionPage.tsx` using `useParams`, `useEffect`, and state `{ loading, data, error }`. On workflow ID change, load canonical state; ignore stale resolution after unmount. Render:

```tsx
if (loading) return <section aria-busy="true"><h1>Loading execution workflow</h1></section>;
if (error === 'workflow_not_found') return <section><h1>Workflow not found</h1><p>The workflow is unavailable in the active organization.</p></section>;
if (error) return <section role="alert"><h1>Execution unavailable</h1><p>{error}</p><button onClick={reload}>Retry</button></section>;
if (!data) return <section><h1>No execution state</h1></section>;
```

Do not invent a sample workflow when the API returns no state.

- [ ] **Step 4: Wire the protected route**

In `apps/web/src/App.tsx`, import `GuidedExecutionPage` and add:

```tsx
<Route
  path="/execution/:workflowId"
  element={<RequireAtlasIdentity><GuidedExecutionPage /></RequireAtlasIdentity>}
/>
```

Keep existing routes unchanged.

- [ ] **Step 5: Run route tests**

```bash
npx vitest run tests/integration/guided-execution-route.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/execution/GuidedExecutionPage.tsx tests/integration/guided-execution-route.test.tsx
git commit -m "feat: add Guided Execution route"
```

---

### Task 3: Build pure workflow progress, grouping, current-step, and action selectors

**Files:**
- Create: `apps/web/src/execution/view-model.ts`
- Test: `tests/unit/guided-execution-view-model.test.ts`

**Interfaces:**
- Consumes: `GuidedExecutionState`, `GuidedTask`, `GuidedStep`.
- Produces: `groupTasks(state)`, `workflowProgress(state)`, `activeTask(state)`, `activeStep(state)`, `stepBlockers(state, stepId)`, `deriveStepAction(state, stepId)`.

- [ ] **Step 1: Write failing selector tests**

```ts
it('computes progress only from completed persisted steps', () => {
  const state = makeGuidedState({ stepStatuses: ['completed', 'ready', 'blocked'] });
  expect(workflowProgress(state)).toEqual({ completed: 1, total: 3, percent: 33 });
});

it('does not call a provider boundary executable', () => {
  const state = makeGuidedState({ currentActionType: 'launch_ec2', stepStatus: 'blocked' });
  expect(deriveStepAction(state, 'step-1')).toEqual({
    kind: 'blocked',
    label: 'Resolve blocker',
    executable: false
  });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/unit/guided-execution-view-model.test.ts
```

- [ ] **Step 3: Implement selectors as pure functions**

Rules:

```ts
export function workflowProgress(state: GuidedExecutionState) {
  const relevant = state.steps.filter((step) => step.status !== 'cancelled');
  const completed = relevant.filter((step) => step.status === 'completed').length;
  return {
    completed,
    total: relevant.length,
    percent: relevant.length === 0 ? 0 : Math.floor((completed / relevant.length) * 100)
  };
}
```

`deriveStepAction` must return only one of:

```ts
type StepAction =
  | { kind: 'refresh'; label: 'Refresh state'; executable: true }
  | { kind: 'request_approval'; label: 'Request approval'; executable: true }
  | { kind: 'decide_approval'; label: 'Review approval'; executable: true }
  | { kind: 'view_evidence'; label: 'View evidence'; executable: true }
  | { kind: 'blocked'; label: 'Resolve blocker'; executable: false }
  | { kind: 'done'; label: 'Done'; executable: false }
  | { kind: 'unavailable'; label: 'Action unavailable'; executable: false };
```

Do not derive a generic external `execute` action in this core-web plan.

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/unit/guided-execution-view-model.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/execution/view-model.ts tests/unit/guided-execution-view-model.test.ts
git commit -m "feat: add Guided Execution view model"
```

---

### Task 4: Render workflow header, breadcrumbs, task groups, and selectable steps

**Files:**
- Create: `apps/web/src/execution/WorkflowHeader.tsx`
- Create: `apps/web/src/execution/ExecutionBreadcrumbs.tsx`
- Create: `apps/web/src/execution/TaskGroup.tsx`
- Create: `apps/web/src/execution/ExecutionStepRow.tsx`
- Modify: `apps/web/src/execution/GuidedExecutionPage.tsx`
- Test: `tests/integration/guided-execution-route.test.tsx`

**Interfaces:**
- Consumes: selectors from Task 3 and route state from Task 2.
- Produces: navigable task/step list, expanded/collapsed state, selected step ID.

- [ ] **Step 1: Extend the integration test**

```tsx
expect(await screen.findByText('1 of 3 steps completed')).toBeInTheDocument();
expect(screen.getByRole('button', { name: /Task 1 — Verify infrastructure readiness/i })).toHaveAttribute('aria-expanded', 'true');
fireEvent.click(screen.getByRole('button', { name: /Verify Cloudflare/i }));
expect(screen.getByRole('button', { name: /Verify Cloudflare/i })).toHaveAttribute('aria-current', 'step');
```

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/integration/guided-execution-route.test.tsx
```

- [ ] **Step 3: Implement components**

`WorkflowHeader` must use persisted task/workflow values and selector-derived progress. `TaskGroup` owns only UI expansion state. `ExecutionStepRow` receives `selected`, `onSelect`, and step data; it must not mutate workflow state.

Use semantic controls:

```tsx
<button
  type="button"
  aria-expanded={expanded}
  aria-controls={`task-${task.id}-steps`}
  onClick={() => onToggle(task.id)}
>
  <span>{task.title}</span>
  <span>{taskSteps.length} steps</span>
</button>
```

- [ ] **Step 4: Add breadcrumbs**

Render `ATLAS > {ownerModule} > {task.title} > {step.actionType}` with React Router `Link` for ATLAS home and a return link supplied by workflow context only when a safe internal route is explicitly present; otherwise link back to `/` rather than guessing a module URL.

- [ ] **Step 5: Run tests**

```bash
npx vitest run tests/integration/guided-execution-route.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/execution/WorkflowHeader.tsx apps/web/src/execution/ExecutionBreadcrumbs.tsx apps/web/src/execution/TaskGroup.tsx apps/web/src/execution/ExecutionStepRow.tsx apps/web/src/execution/GuidedExecutionPage.tsx tests/integration/guided-execution-route.test.tsx
git commit -m "feat: render Guided Execution workflow navigation"
```

---

### Task 5: Add step detail, evidence, blockers, and real approval interactions

**Files:**
- Create: `apps/web/src/execution/StepDetailPanel.tsx`
- Create: `apps/web/src/execution/EvidencePanel.tsx`
- Create: `apps/web/src/execution/ApprovalCard.tsx`
- Create: `apps/web/src/execution/StepActionBar.tsx`
- Modify: `apps/web/src/execution/api.ts`
- Modify: `apps/web/src/execution/GuidedExecutionPage.tsx`
- Test: `tests/integration/guided-execution-approval.test.tsx`

**Interfaces:**
- Consumes: Edge operations `request_approval` and `decide_approval`; `deriveStepAction` from Task 3.
- Produces: real approval request/decision actions plus evidence/blocker display.

- [ ] **Step 1: Write failing approval tests**

```tsx
it('submits an approval request through the execution API and reloads canonical state', async () => {
  vi.mocked(requestExecutionApproval).mockResolvedValue({ ok: true });
  render(<GuidedExecutionPageForTest state={makeAwaitingApprovalCandidate()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Request approval' }));
  expect(requestExecutionApproval).toHaveBeenCalledWith(expect.objectContaining({ taskId: 'task-1' }));
});

it('never exposes the payload digest as editable data', () => {
  render(<ApprovalCard approval={makeApproval()} onDecision={vi.fn()} />);
  expect(screen.queryByDisplayValue(makeApproval().payloadDigest)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/integration/guided-execution-approval.test.tsx
```

- [ ] **Step 3: Add API functions**

`requestExecutionApproval` posts:

```ts
{
  operation: 'request_approval',
  organization_id: organization.id,
  task_id: input.taskId,
  approval_type: input.approvalType,
  required_permission: input.requiredPermission,
  risk_level: input.riskLevel,
  summary: input.summary,
  payload_version: input.payloadVersion
}
```

`decideExecutionApproval` posts:

```ts
{
  operation: 'decide_approval',
  organization_id: organization.id,
  approval_id: input.approvalId,
  decision: input.decision,
  decision_reason: input.reason
}
```

Do not compute or accept a client-supplied approval digest; the server remains authoritative for digest/version binding.

- [ ] **Step 4: Implement detail panels**

`StepDetailPanel` renders action type as a human-readable label, completion criteria, permissions, dependencies, blocker, approvals, and evidence. `EvidencePanel` displays evidence `kind`, verified status, timestamp, and a safe reference string; it must not fetch arbitrary external URLs.

`ApprovalCard` renders approve/reject controls only for `pending` approvals. Server 403/409 errors must remain visible and must not optimistically mark an approval approved.

- [ ] **Step 5: Reload canonical state after every successful mutation**

In `GuidedExecutionPage`, after request/decision success call the same `reload()` used for route refresh. Do not patch approval state optimistically.

- [ ] **Step 6: Run focused tests**

```bash
npx vitest run tests/integration/guided-execution-approval.test.tsx tests/integration/guided-execution-route.test.tsx
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/execution tests/integration/guided-execution-approval.test.tsx tests/integration/guided-execution-route.test.tsx
git commit -m "feat: add Guided Execution evidence and approvals"
```

---

### Task 6: Add ATLAS-native responsive styling and accessibility contracts

**Files:**
- Create: `apps/web/src/execution/execution.css`
- Modify: `apps/web/src/main.tsx`
- Modify: Guided Execution components only where semantic hooks are required
- Test: `tests/integration/guided-execution-accessibility.test.tsx`

**Interfaces:**
- Consumes: components from Tasks 2–5.
- Produces: desktop/tablet/mobile layout, keyboard-operable disclosure controls, focus visibility, screen-reader state announcements, reduced-motion behavior.

- [ ] **Step 1: Write failing accessibility tests**

```tsx
it('announces workflow state changes without color-only semantics', async () => {
  render(<GuidedExecutionPageForTest state={makeGuidedState()} />);
  expect(screen.getByRole('status')).toHaveTextContent(/current status/i);
  expect(screen.getAllByText(/Completed|Blocked|Now|Next|Awaiting approval/i).length).toBeGreaterThan(0);
});

it('uses native disclosure buttons for every task group', () => {
  render(<GuidedExecutionPageForTest state={makeGuidedState()} />);
  for (const button of screen.getAllByRole('button', { name: /Task/i })) {
    expect(button).toHaveAttribute('aria-expanded');
  }
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/integration/guided-execution-accessibility.test.tsx
```

- [ ] **Step 3: Add responsive CSS**

Use one desktop two-column execution layout that collapses at tablet/mobile widths:

```css
.execution-layout { display: grid; grid-template-columns: minmax(18rem, 0.9fr) minmax(0, 1.4fr); gap: 1.25rem; }
@media (max-width: 900px) { .execution-layout { grid-template-columns: 1fr; } }
.execution-step[aria-current="step"] { outline: 2px solid currentColor; outline-offset: 2px; }
.execution-task-toggle:focus-visible, .execution-action:focus-visible { outline: 3px solid currentColor; outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) { .execution-layout * { scroll-behavior: auto; transition-duration: 0.01ms !important; } }
```

Do not copy AWS orange branding or AWS component styling.

- [ ] **Step 4: Import stylesheet once**

In `apps/web/src/main.tsx`:

```ts
import './execution/execution.css';
```

- [ ] **Step 5: Run accessibility and route tests**

```bash
npx vitest run tests/integration/guided-execution-accessibility.test.tsx tests/integration/guided-execution-route.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/execution/execution.css apps/web/src/main.tsx apps/web/src/execution tests/integration/guided-execution-accessibility.test.tsx
git commit -m "feat: make Guided Execution responsive and accessible"
```

---

### Task 7: Prove refresh/resume, permission failure, stale approval failure, and regression safety

**Files:**
- Modify: `tests/integration/guided-execution-route.test.tsx`
- Modify: `tests/integration/guided-execution-approval.test.tsx`
- Create: `tests/integration/guided-execution-regression.test.tsx`
- Modify production code only if a failing test proves a defect.

**Interfaces:**
- Consumes: complete Core Web implementation.
- Produces: verified behavior for refresh/resume and negative paths.

- [ ] **Step 1: Add refresh/resume test**

```tsx
it('reloads the same persisted workflow instead of reconstructing browser state', async () => {
  vi.mocked(loadGuidedExecutionState)
    .mockResolvedValueOnce(makeGuidedState({ currentStepId: 'step-2' }))
    .mockResolvedValueOnce(makeGuidedState({ currentStepId: 'step-2' }));
  const { unmount } = render(<MemoryRouter initialEntries={['/execution/wf-1']}><App /></MemoryRouter>);
  expect(await screen.findByText(/step-2/i)).toBeInTheDocument();
  unmount();
  render(<MemoryRouter initialEntries={['/execution/wf-1']}><App /></MemoryRouter>);
  expect(await screen.findByText(/step-2/i)).toBeInTheDocument();
  expect(loadGuidedExecutionState).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Add negative authorization/approval tests**

Mock server errors and assert the UI remains unchanged:

```tsx
vi.mocked(decideExecutionApproval).mockRejectedValue(new Error('permission_required'));
fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
expect(await screen.findByRole('alert')).toHaveTextContent('permission_required');
expect(screen.getByText('Pending')).toBeInTheDocument();
```

Repeat for `stale_approval`/payload-version mismatch if that is the exact server error exposed by the reconciled foundation contract.

- [ ] **Step 3: Add adjacent route regression test**

```tsx
it.each([
  ['/', 'One governed enterprise ecosystem'],
  ['/finance', 'Finance'],
  ['/finance/accounting/accounts-payable', /Accounts Payable/i],
  ['/health', 'Health'],
  ['/studio', /Create beyond the prompt/i]
])('preserves %s', async (path, heading) => {
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
});
```

- [ ] **Step 4: Run the Guided Execution test set**

```bash
npx vitest run tests/unit/guided-execution-api.test.ts tests/unit/guided-execution-view-model.test.ts tests/integration/guided-execution-route.test.tsx tests/integration/guided-execution-approval.test.tsx tests/integration/guided-execution-accessibility.test.tsx tests/integration/guided-execution-regression.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run full repository verification**

```bash
npm run typecheck
npm test
npm run build
```

Expected: all PASS. Do not claim production readiness from these local checks.

- [ ] **Step 6: Commit verification-only changes**

```bash
git add tests/integration/guided-execution-route.test.tsx tests/integration/guided-execution-approval.test.tsx tests/integration/guided-execution-regression.test.tsx
git commit -m "test: verify Guided Execution recovery and boundaries"
```

## Completion Gate

This plan is complete only when:

- `/execution/:workflowId` uses authenticated canonical state;
- raw action payloads are not exposed;
- task/step navigation works;
- progress derives from persisted completed steps;
- approvals are server-authoritative and stale/forbidden decisions fail closed;
- evidence and blockers are visible without fabricating success;
- refresh reloads backend state;
- desktop/tablet/mobile and keyboard/ARIA checks pass;
- adjacent ATLAS routes remain intact;
- full typecheck/test/build passes;
- no AWS or paid-provider mutation occurred;
- no merge or deploy occurred.
