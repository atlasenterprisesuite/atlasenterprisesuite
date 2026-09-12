# ATLAS Guided Execution Core Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reusable `/execution/:workflowId` Guided Execution web surface over the existing Universal Execution Engine without introducing a second workflow state machine or fake execution state.

**Architecture:** Reuse `@atlas/execution`, the authenticated `atlas-execution` Edge Function, the existing ATLAS session/organization boundary, React Router, and the current ATLAS shell. Normalize the Edge Function's snake_case persistence payload exactly once at the web boundary, then render task groups, steps, approvals, evidence, blockers, audit history, progress, and resumability from canonical persisted state.

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
- Approval payload digests are server-generated and server-validated; the browser never supplies or edits them.
- Audit visibility is permission-gated by `execution.audit`; inability to read audit history must not break ordinary workflow reading.
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

Expected: all file checks and baseline commands pass. If the feature branch is behind the approved foundation branch, reconcile by normal merge/rebase without force-resetting, force-pushing, or discarding approved Guided Execution commits.

---

## File Map

- `apps/web/src/execution/types.ts` — normalized UI-safe read model.
- `apps/web/src/execution/api.ts` — authenticated execution client and normalization boundary.
- `apps/web/src/execution/view-model.ts` — pure selectors for grouping, progress, current step, blockers, and action semantics.
- `apps/web/src/execution/GuidedExecutionPage.tsx` — route-level loading/reload/selection state.
- `apps/web/src/execution/WorkflowHeader.tsx` — status, priority and verified progress.
- `apps/web/src/execution/ExecutionBreadcrumbs.tsx` — safe return navigation and current location.
- `apps/web/src/execution/TaskGroup.tsx` — expandable task group.
- `apps/web/src/execution/ExecutionStepRow.tsx` — selectable step status row.
- `apps/web/src/execution/StepDetailPanel.tsx` — criteria, permissions, dependencies, blocker/error.
- `apps/web/src/execution/EvidencePanel.tsx` — verified/unverified evidence references only.
- `apps/web/src/execution/ApprovalCard.tsx` — existing approval state and permitted decisions.
- `apps/web/src/execution/AuditTimeline.tsx` — permission-gated immutable audit history.
- `apps/web/src/execution/StepActionBar.tsx` — only actions supported by the current server contract.
- `apps/web/src/execution/execution.css` — ATLAS-native responsive/accessibility styles.
- `apps/web/src/App.tsx` — authenticated `/execution/:workflowId` route.
- `apps/web/src/main.tsx` — Guided Execution stylesheet import.
- `apps/web/src/lib/atlasSession.ts` — export the existing authenticated fetch primitive without changing refresh semantics.
- `supabase/functions/atlas-execution/index.ts` — add read-only `get_audit` operation guarded by `execution.audit`.
- `tests/fixtures/guidedExecution.ts` — shared deterministic test builders.
- `tests/unit/guided-execution-api.test.ts` — transport/normalization contracts.
- `tests/unit/guided-execution-view-model.test.ts` — pure progress/status/action behavior.
- `tests/integration/guided-execution-route.test.tsx` — route/load/error/selection behavior.
- `tests/integration/guided-execution-approval.test.tsx` — server-authoritative approval behavior.
- `tests/integration/guided-execution-audit.test.tsx` — audit permission and rendering behavior.
- `tests/integration/guided-execution-accessibility.test.tsx` — keyboard/ARIA/state announcements.
- `tests/integration/guided-execution-regression.test.tsx` — adjacent ATLAS route safety.

---

### Task 1: Add deterministic test fixtures, the authenticated web client, and normalized read model

**Files:**
- Create: `tests/fixtures/guidedExecution.ts`
- Create: `apps/web/src/execution/types.ts`
- Create: `apps/web/src/execution/api.ts`
- Modify: `apps/web/src/lib/atlasSession.ts`
- Test: `tests/unit/guided-execution-api.test.ts`

**Interfaces:**
- Consumes: `getActiveAtlasOrganization()` and existing session refresh behavior; Edge operation `get_state` with `{ organization_id, workflow_id }`.
- Produces: `GuidedExecutionState`, `GuidedAuditEvent`, `loadGuidedExecutionState(workflowId)`, `requestExecutionApproval(input)`, `decideExecutionApproval(input)`, fixture builders `makeGuidedState(options)` and `makeApproval(overrides)`.

- [ ] **Step 1: Define shared deterministic fixture builders**

Create `tests/fixtures/guidedExecution.ts` with one stable three-step workflow and typed overrides:

```ts
import type { ApprovalStatus, ExecutionStatus, StepStatus } from '../../packages/execution/src';
import type { GuidedApproval, GuidedExecutionState } from '../../apps/web/src/execution/types';

export type GuidedFixtureOptions = {
  workflowStatus?: ExecutionStatus;
  taskStatus?: ExecutionStatus;
  currentStepId?: string | null;
  blockedReason?: string | null;
  stepStatuses?: StepStatus[];
  currentActionType?: string;
  approvals?: GuidedApproval[];
};

export function makeApproval(overrides: Partial<GuidedApproval> = {}): GuidedApproval {
  return {
    id: 'approval-1', taskId: 'task-1', workflowId: 'wf-1', module: 'manager',
    approvalType: 'infrastructure_review', requiredPermission: 'execution.approve',
    riskLevel: 'high', summary: 'Review infrastructure action', payloadVersion: 1,
    payloadDigest: 'a'.repeat(64), status: 'pending' as ApprovalStatus,
    decidedBy: null, decisionReason: null, createdAt: '2026-09-12T12:00:00Z', decidedAt: null,
    ...overrides
  };
}

export function makeGuidedState(options: GuidedFixtureOptions = {}): GuidedExecutionState {
  const statuses = options.stepStatuses ?? ['completed', 'ready', 'blocked'];
  return {
    workflow: {
      id: 'wf-1', organizationId: 'org-1', tenantId: 'tenant-1',
      workflowType: 'manager.infrastructure_readiness', ownerModule: 'manager',
      status: options.workflowStatus ?? 'now', currentTaskId: 'task-1', currentModule: 'manager',
      context: { return_path: '/' }, version: 1
    },
    tasks: [{
      id: 'task-1', workflowId: 'wf-1', module: 'manager', title: 'Verify infrastructure readiness',
      goal: 'Produce evidence-backed readiness', status: options.taskStatus ?? 'now', priority: 'high',
      currentStepId: options.currentStepId === undefined ? 'step-2' : options.currentStepId,
      nextAction: 'Verify Cloudflare', blockedReason: options.blockedReason ?? null,
      permissionsRequired: ['execution.read']
    }],
    steps: [
      { id: 'step-1', taskId: 'task-1', sequence: 1, module: 'manager', actionType: 'verify_github', status: statuses[0] ?? 'completed', completionCriteria: ['github verified'], permissionsRequired: ['execution.read'], evidenceRequirement: ['infra_verification'], startedAt: null, completedAt: statuses[0] === 'completed' ? '2026-09-12T12:01:00Z' : null },
      { id: 'step-2', taskId: 'task-1', sequence: 2, module: 'manager', actionType: options.currentActionType ?? 'verify_cloudflare', status: statuses[1] ?? 'ready', completionCriteria: ['cloudflare verified'], permissionsRequired: ['execution.read'], evidenceRequirement: ['infra_verification'], startedAt: null, completedAt: null },
      { id: 'step-3', taskId: 'task-1', sequence: 3, module: 'manager', actionType: 'verify_production', status: statuses[2] ?? 'blocked', completionCriteria: ['production verified'], permissionsRequired: ['execution.read'], evidenceRequirement: ['infra_verification'], startedAt: null, completedAt: null }
    ],
    dependencies: [],
    evidence: [],
    approvals: options.approvals ?? []
  };
}
```

- [ ] **Step 2: Write the failing normalization test**

Create `tests/unit/guided-execution-api.test.ts` and assert raw database rows are normalized without exposing `action_payload`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizeExecutionState } from '../../apps/web/src/execution/api';

it('whitelists execution state and omits raw action payloads', () => {
  const state = normalizeExecutionState({
    ok: true,
    workflow: { id: 'wf-1', org_id: 'org-1', tenant_id: 'tenant-1', workflow_type: 'manager.infrastructure_readiness', owner_module: 'manager', status: 'now', current_task_id: 'task-1', current_module: 'manager', context: { return_path: '/' }, version: 1 },
    tasks: [{ id: 'task-1', workflow_id: 'wf-1', module: 'manager', title: 'Verify infrastructure readiness', goal: 'Produce evidence-backed readiness', status: 'now', priority: 'high', current_step_id: 'step-1', next_action: 'Verify GitHub', blocked_reason: null, permissions_required: ['execution.read'] }],
    steps: [{ id: 'step-1', task_id: 'task-1', sequence: 1, module: 'manager', action_type: 'verify_github', action_payload: { secret: 'must-not-cross-ui-boundary' }, status: 'ready', completion_criteria: ['github verified'], permissions_required: ['execution.read'], evidence_requirement: ['infra_verification'], started_at: null, completed_at: null }],
    dependencies: [], evidence: [], approvals: []
  });
  expect(state.workflow.context).toEqual({ return_path: '/' });
  expect(state.steps[0]).not.toHaveProperty('actionPayload');
  expect(JSON.stringify(state)).not.toContain('must-not-cross-ui-boundary');
});
```

- [ ] **Step 3: Run the test and verify RED**

```bash
npx vitest run tests/unit/guided-execution-api.test.ts
```

Expected: FAIL because the Guided Execution web API does not exist.

- [ ] **Step 4: Export the existing authenticated transport without changing its behavior**

In `apps/web/src/lib/atlasSession.ts`, rename/export the existing internal helper:

```ts
export async function authorizedAtlasFetch(path: string, init: RequestInit = {}) {
  // keep the existing access-token lookup, one-time 401 refresh, headers and retry behavior unchanged
}
```

Update internal callers in the same file from `authorizedFetch(...)` to `authorizedAtlasFetch(...)`. Do not change storage keys, Supabase URL, refresh behavior, or publishable-key behavior.

- [ ] **Step 5: Implement the UI-safe normalized types**

Create `apps/web/src/execution/types.ts`:

```ts
import type { ApprovalStatus, ExecutionPriority, ExecutionStatus, StepStatus } from '../../../../packages/execution/src';

export type GuidedWorkflow = {
  id: string; organizationId: string; tenantId: string; workflowType: string; ownerModule: string;
  status: ExecutionStatus; currentTaskId: string | null; currentModule: string;
  context: Record<string, unknown>; version: number;
};
export type GuidedTask = {
  id: string; workflowId: string; module: string; title: string; goal: string; status: ExecutionStatus;
  priority: ExecutionPriority; currentStepId: string | null; nextAction: string | null;
  blockedReason: string | null; permissionsRequired: string[];
};
export type GuidedStep = {
  id: string; taskId: string; sequence: number; module: string; actionType: string; status: StepStatus;
  completionCriteria: string[]; permissionsRequired: string[]; evidenceRequirement: string[];
  startedAt: string | null; completedAt: string | null;
};
export type GuidedEvidence = { id: string; taskId: string; stepId: string | null; kind: string; reference: string; verified: boolean; createdAt: string };
export type GuidedApproval = { id: string; taskId: string; workflowId: string; module: string; approvalType: string; requiredPermission: string; riskLevel: 'low' | 'medium' | 'high' | 'critical'; summary: string; payloadVersion: number; payloadDigest: string; status: ApprovalStatus; decidedBy: string | null; decisionReason: string | null; createdAt: string; decidedAt: string | null };
export type GuidedDependency = { id: string; taskId: string; stepId: string | null; dependsOnTaskId: string | null; dependsOnStepId: string | null; resolvedAt: string | null };
export type GuidedAuditEvent = { id: string; actorUserId: string; taskId: string | null; workflowId: string | null; module: string; action: string; previousState: string | null; resultingState: string | null; evidenceIds: string[]; correlationId: string | null; createdAt: string };
export type GuidedExecutionState = { workflow: GuidedWorkflow; tasks: GuidedTask[]; steps: GuidedStep[]; dependencies: GuidedDependency[]; evidence: GuidedEvidence[]; approvals: GuidedApproval[] };
```

- [ ] **Step 6: Implement response parsing, normalization, and `loadGuidedExecutionState`**

Create `apps/web/src/execution/api.ts` with a parser that preserves server errors:

```ts
async function parseExecutionResponse(response: Response): Promise<Record<string, any>> {
  const text = await response.text();
  let data: Record<string, any> = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: 'invalid_response' }; }
  if (!response.ok) throw new Error(String(data.error || `execution_request_failed_${response.status}`));
  return data;
}
```

`normalizeExecutionState(raw)` must map only the fields declared in `types.ts`; map `workflow.context` only when it is an object and otherwise use `{}`. Never use object spread on raw workflow/task/step/evidence/approval rows.

```ts
export async function loadGuidedExecutionState(workflowId: string) {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/functions/v1/atlas-execution', {
    method: 'POST',
    body: JSON.stringify({ operation: 'get_state', organization_id: organization.id, workflow_id: workflowId })
  });
  return normalizeExecutionState(await parseExecutionResponse(response));
}
```

- [ ] **Step 7: Run focused tests and typecheck**

```bash
npx vitest run tests/unit/guided-execution-api.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add tests/fixtures/guidedExecution.ts tests/unit/guided-execution-api.test.ts apps/web/src/lib/atlasSession.ts apps/web/src/execution/types.ts apps/web/src/execution/api.ts
git commit -m "feat: add Guided Execution web data boundary"
```

---

### Task 2: Add the protected `/execution/:workflowId` route with truthful loading/error/empty states

**Files:**
- Create: `apps/web/src/execution/GuidedExecutionPage.tsx`
- Modify: `apps/web/src/App.tsx`
- Test: `tests/integration/guided-execution-route.test.tsx`

**Interfaces:**
- Consumes: `loadGuidedExecutionState(workflowId)`.
- Produces: protected route, canonical reload function, route-level state `{ loading, data, error, selectedStepId }`.

- [ ] **Step 1: Write a failing route contract test**

Use `MemoryRouter` and mock `RequireAtlasIdentity` only for the successful rendering cases so the test isolates Guided Execution. Add a separate unauthenticated route test using the real guard and no `atlas_access_token` to confirm redirect to `/identity?app=%2Fexecution%2Fwf-1`.

Successful case:

```tsx
vi.mocked(loadGuidedExecutionState).mockResolvedValue(makeGuidedState());
render(<MemoryRouter initialEntries={['/execution/wf-1']}><App /></MemoryRouter>);
expect(await screen.findByRole('heading', { name: 'Verify infrastructure readiness' })).toBeInTheDocument();
```

Error case:

```tsx
vi.mocked(loadGuidedExecutionState).mockRejectedValue(new Error('workflow_not_found'));
render(<MemoryRouter initialEntries={['/execution/missing']}><App /></MemoryRouter>);
expect(await screen.findByRole('heading', { name: 'Workflow not found' })).toBeInTheDocument();
```

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/integration/guided-execution-route.test.tsx
```

- [ ] **Step 3: Implement cancellable load/reload behavior**

`GuidedExecutionPage` uses `useParams()` and a `reload()` callback. On workflow ID change or manual retry, load canonical state; ignore stale resolution after unmount. Select `workflow.currentTaskId`'s `currentStepId` after a successful load when it exists.

Render exact states:

```tsx
if (loading) return <section aria-busy="true"><h1>Loading execution workflow</h1></section>;
if (error === 'workflow_not_found') return <section><h1>Workflow not found</h1><p>The workflow is unavailable in the active organization.</p></section>;
if (error) return <section role="alert"><h1>Execution unavailable</h1><p>{error}</p><button type="button" onClick={reload}>Retry</button></section>;
if (!data) return <section><h1>No execution state</h1></section>;
```

Do not substitute demo/sample workflow data.

- [ ] **Step 4: Wire the protected route**

In `apps/web/src/App.tsx`:

```tsx
<Route path="/execution/:workflowId" element={<RequireAtlasIdentity><GuidedExecutionPage /></RequireAtlasIdentity>} />
```

- [ ] **Step 5: Run route tests and commit**

```bash
npx vitest run tests/integration/guided-execution-route.test.tsx
git add apps/web/src/App.tsx apps/web/src/execution/GuidedExecutionPage.tsx tests/integration/guided-execution-route.test.tsx
git commit -m "feat: add protected Guided Execution route"
```

---

### Task 3: Build pure workflow progress, grouping, blocker, and action selectors

**Files:**
- Create: `apps/web/src/execution/view-model.ts`
- Test: `tests/unit/guided-execution-view-model.test.ts`

**Interfaces:**
- Consumes: `GuidedExecutionState`, `GuidedTask`, `GuidedStep`.
- Produces: `groupTasks(state)`, `workflowProgress(state)`, `activeTask(state)`, `activeStep(state)`, `stepBlockers(state, stepId)`, `deriveStepAction(state, stepId)`.

- [ ] **Step 1: Write failing selector tests**

```ts
it('computes progress only from persisted completed non-cancelled steps', () => {
  const state = makeGuidedState({ stepStatuses: ['completed', 'ready', 'blocked'] });
  expect(workflowProgress(state)).toEqual({ completed: 1, total: 3, percent: 33 });
});

it('never derives external execution for an unavailable provider action', () => {
  const state = makeGuidedState({ currentActionType: 'launch_ec2', stepStatuses: ['completed', 'blocked', 'blocked'] });
  expect(deriveStepAction(state, 'step-2')).toEqual({ kind: 'blocked', label: 'Resolve blocker', executable: false });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/unit/guided-execution-view-model.test.ts
```

- [ ] **Step 3: Implement selectors as pure functions**

Progress:

```ts
export function workflowProgress(state: GuidedExecutionState) {
  const relevant = state.steps.filter((step) => step.status !== 'cancelled');
  const completed = relevant.filter((step) => step.status === 'completed').length;
  return { completed, total: relevant.length, percent: relevant.length === 0 ? 0 : Math.floor((completed / relevant.length) * 100) };
}
```

Action union:

```ts
export type StepAction =
  | { kind: 'refresh'; label: 'Refresh state'; executable: true }
  | { kind: 'request_approval'; label: 'Request approval'; executable: true }
  | { kind: 'review_approval'; label: 'Review approval'; executable: true }
  | { kind: 'view_evidence'; label: 'View evidence'; executable: true }
  | { kind: 'blocked'; label: 'Resolve blocker'; executable: false }
  | { kind: 'done'; label: 'Done'; executable: false }
  | { kind: 'unavailable'; label: 'Action unavailable'; executable: false };
```

Rules: `blocked -> blocked`; pending approval -> `review_approval`; approval-required current step without pending approval -> `request_approval`; completed with evidence -> `view_evidence`; completed workflow -> `done`; ready/running read-only step -> `refresh`; otherwise `unavailable`. This core plan deliberately defines no generic provider `execute` action.

- [ ] **Step 4: Run tests and commit**

```bash
npx vitest run tests/unit/guided-execution-view-model.test.ts
git add apps/web/src/execution/view-model.ts tests/unit/guided-execution-view-model.test.ts
git commit -m "feat: add Guided Execution view model"
```

---

### Task 4: Render workflow header, safe breadcrumbs, task groups, and selectable steps

**Files:**
- Create: `apps/web/src/execution/WorkflowHeader.tsx`
- Create: `apps/web/src/execution/ExecutionBreadcrumbs.tsx`
- Create: `apps/web/src/execution/TaskGroup.tsx`
- Create: `apps/web/src/execution/ExecutionStepRow.tsx`
- Modify: `apps/web/src/execution/GuidedExecutionPage.tsx`
- Test: `tests/integration/guided-execution-route.test.tsx`

**Interfaces:**
- Consumes: Task 3 selectors and route state.
- Produces: expanded/collapsed task navigation and selected step.

- [ ] **Step 1: Extend route tests**

Assert:

```tsx
expect(await screen.findByText('1 of 3 steps completed')).toBeInTheDocument();
const toggle = screen.getByRole('button', { name: /Task 1 — Verify infrastructure readiness/i });
expect(toggle).toHaveAttribute('aria-expanded', 'true');
fireEvent.click(screen.getByRole('button', { name: /Verify Cloudflare/i }));
expect(screen.getByRole('button', { name: /Verify Cloudflare/i })).toHaveAttribute('aria-current', 'step');
```

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/integration/guided-execution-route.test.tsx
```

- [ ] **Step 3: Implement semantic task disclosure and step selection**

`TaskGroup` owns only `expanded`; workflow status remains read-only. Its toggle uses `aria-expanded` and `aria-controls`. `ExecutionStepRow` uses a real `button` and `aria-current="step"` only when selected.

- [ ] **Step 4: Implement safe breadcrumbs**

Always render Home and owner module as text. A return-path link is permitted only when `workflow.context.return_path` is a string that begins with `/` and does not begin with `//`; otherwise return to `/`. Never concatenate an arbitrary external URL from workflow context.

- [ ] **Step 5: Run tests and commit**

```bash
npx vitest run tests/integration/guided-execution-route.test.tsx
git add apps/web/src/execution/WorkflowHeader.tsx apps/web/src/execution/ExecutionBreadcrumbs.tsx apps/web/src/execution/TaskGroup.tsx apps/web/src/execution/ExecutionStepRow.tsx apps/web/src/execution/GuidedExecutionPage.tsx tests/integration/guided-execution-route.test.tsx
git commit -m "feat: render Guided Execution workflow navigation"
```

---

### Task 5: Add step detail, evidence, blockers, and server-authoritative approval interactions

**Files:**
- Create: `apps/web/src/execution/StepDetailPanel.tsx`
- Create: `apps/web/src/execution/EvidencePanel.tsx`
- Create: `apps/web/src/execution/ApprovalCard.tsx`
- Create: `apps/web/src/execution/StepActionBar.tsx`
- Modify: `apps/web/src/execution/api.ts`
- Modify: `apps/web/src/execution/GuidedExecutionPage.tsx`
- Test: `tests/integration/guided-execution-approval.test.tsx`

**Interfaces:**
- Consumes: existing Edge operations `request_approval` and `decide_approval`; Task 3 `deriveStepAction`.
- Produces: `requestExecutionApproval(input)`, `decideExecutionApproval(input)`, evidence/blocker panels, no optimistic approval state.

- [ ] **Step 1: Write failing approval tests**

Use `makeGuidedState` and `makeApproval`. Assert a request calls the API with current task and that an approval digest is never rendered as an editable value. Assert a 403/409 error leaves `Pending` visible.

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/integration/guided-execution-approval.test.tsx
```

- [ ] **Step 3: Implement the exact existing approval request contract**

`requestExecutionApproval` posts no client payload version/digest:

```ts
{
  operation: 'request_approval',
  organization_id: organization.id,
  task_id: input.taskId,
  approval_type: input.approvalType,
  required_permission: input.requiredPermission,
  risk_level: input.riskLevel,
  summary: input.summary
}
```

The current server computes the approval binding version and SHA-256 digest from the persisted current task/step.

- [ ] **Step 4: Implement the exact decision contract**

```ts
{
  operation: 'decide_approval',
  organization_id: organization.id,
  approval_id: input.approvalId,
  decision: input.decision, // only 'approved' | 'rejected'
  decision_reason: input.reason
}
```

Never mark local approval state optimistically. After success call `reload()`; on any error render `role="alert"` and retain the last canonical state.

- [ ] **Step 5: Implement detail/evidence/action components**

`StepDetailPanel` renders action type, completion criteria, required permissions, unresolved dependencies, blocker, approvals and evidence. `EvidencePanel` renders kind, verified state, timestamp and reference as text; it must not automatically open/fetch arbitrary evidence URLs. `StepActionBar` invokes only reload, request approval, review approval selection, or evidence focus based on `StepAction`.

- [ ] **Step 6: Run tests and commit**

```bash
npx vitest run tests/integration/guided-execution-approval.test.tsx tests/integration/guided-execution-route.test.tsx
git add apps/web/src/execution apps/web/src/execution/api.ts tests/integration/guided-execution-approval.test.tsx tests/integration/guided-execution-route.test.tsx
git commit -m "feat: add Guided Execution evidence and approvals"
```

---

### Task 6: Add permission-gated audit retrieval and Audit Timeline

**Files:**
- Modify: `supabase/functions/atlas-execution/index.ts`
- Modify: `apps/web/src/execution/api.ts`
- Create: `apps/web/src/execution/AuditTimeline.tsx`
- Modify: `apps/web/src/execution/GuidedExecutionPage.tsx`
- Test: `tests/integration/guided-execution-audit.test.tsx`

**Interfaces:**
- Consumes: authenticated execution context and `execution.audit` permission.
- Produces: Edge operation `get_audit`, `loadGuidedExecutionAudit(workflowId)`, read-only audit timeline.

- [ ] **Step 1: Write failing Edge/UI contract tests**

Assert `get_audit` is unsupported before implementation. UI test asserts `permission_required` hides audit detail without failing workflow content; owner/admin audit response renders action/state/timestamp.

- [ ] **Step 2: Add `get_audit` to the server operation allowlist**

Implement:

```ts
async function getAudit(req: Request, body: JsonObject, context: RequestContext) {
  requireExecutionPermission(context, 'execution.audit');
  const workflowId = requiredText(body.workflow_id, 'workflow_id_required', 80);
  const admin = adminClient();
  await loadWorkflow(admin, context.orgId, workflowId);
  const { data, error } = await admin
    .from('execution_audit_events')
    .select('id,actor_user_id,task_id,workflow_id,module,action,previous_state,resulting_state,evidence_ids,correlation_id,created_at')
    .eq('org_id', context.orgId)
    .eq('workflow_id', workflowId)
    .order('created_at', { ascending: true });
  if (error) throw new EdgeError('persistence_error', 500);
  return json(req, { ok: true, audit: data || [] });
}
```

Register `get_audit` in `SUPPORTED_OPERATIONS` and dispatch it after `resolveContext`.

- [ ] **Step 3: Add the web audit client**

`loadGuidedExecutionAudit(workflowId)` posts `get_audit`; normalize only `GuidedAuditEvent` fields. If the server returns `permission_required`, `GuidedExecutionPage` stores audit as `null` and continues rendering the workflow; any other audit error is shown in the Audit Timeline only, not as a whole-page failure.

- [ ] **Step 4: Implement `AuditTimeline`**

Render chronological immutable events with action, module, previous/resulting state, created time and correlation ID when present. Do not render actor email/name unless separately resolved by an authorized identity service; display the actor ID only if audit permission already succeeded.

- [ ] **Step 5: Run tests and commit**

```bash
npx vitest run tests/integration/guided-execution-audit.test.tsx tests/integration/guided-execution-route.test.tsx
git add supabase/functions/atlas-execution/index.ts apps/web/src/execution/api.ts apps/web/src/execution/AuditTimeline.tsx apps/web/src/execution/GuidedExecutionPage.tsx tests/integration/guided-execution-audit.test.tsx
git commit -m "feat: add Guided Execution audit timeline"
```

---

### Task 7: Add ATLAS-native responsive styling and accessibility contracts

**Files:**
- Create: `apps/web/src/execution/execution.css`
- Modify: `apps/web/src/main.tsx`
- Modify Guided Execution components only where semantic hooks are required
- Test: `tests/integration/guided-execution-accessibility.test.tsx`

**Interfaces:**
- Consumes: Tasks 2–6 components.
- Produces: desktop/tablet/mobile layout, visible focus, keyboard disclosure controls, state announcements, reduced-motion behavior.

- [ ] **Step 1: Write failing accessibility tests**

Assert workflow status is exposed in a `role="status"` region, every task disclosure is a native button with `aria-expanded`, selected step has `aria-current="step"`, and completed/blocked/awaiting labels appear as text rather than color-only state.

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/integration/guided-execution-accessibility.test.tsx
```

- [ ] **Step 3: Add responsive ATLAS CSS**

```css
.execution-layout { display: grid; grid-template-columns: minmax(18rem, .9fr) minmax(0, 1.4fr); gap: 1.25rem; }
@media (max-width: 900px) { .execution-layout { grid-template-columns: 1fr; } }
.execution-step[aria-current="step"] { outline: 2px solid currentColor; outline-offset: 2px; }
.execution-task-toggle:focus-visible, .execution-action:focus-visible { outline: 3px solid currentColor; outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) { .execution-layout * { scroll-behavior: auto; transition-duration: .01ms !important; } }
```

Use existing ATLAS CSS variables/classes where available; do not copy AWS orange branding or AWS component styling.

- [ ] **Step 4: Import stylesheet once**

In `apps/web/src/main.tsx`:

```ts
import './execution/execution.css';
```

- [ ] **Step 5: Run tests and commit**

```bash
npx vitest run tests/integration/guided-execution-accessibility.test.tsx tests/integration/guided-execution-route.test.tsx
git add apps/web/src/execution/execution.css apps/web/src/main.tsx apps/web/src/execution tests/integration/guided-execution-accessibility.test.tsx
git commit -m "feat: make Guided Execution responsive and accessible"
```

---

### Task 8: Prove refresh/resume, authorization failure, stale approval failure, and regression safety

**Files:**
- Modify: `tests/integration/guided-execution-route.test.tsx`
- Modify: `tests/integration/guided-execution-approval.test.tsx`
- Create: `tests/integration/guided-execution-regression.test.tsx`
- Modify production code only if a failing test proves a defect.

**Interfaces:**
- Consumes: complete Core Web implementation.
- Produces: recovery/negative-path/regression evidence.

- [ ] **Step 1: Add refresh/resume test**

Mount, observe `currentStepId='step-2'`, unmount, remount the same `/execution/wf-1`, and assert `loadGuidedExecutionState` is called again and `step-2` remains selected from canonical state. Do not restore the selection from localStorage/sessionStorage.

- [ ] **Step 2: Add permission failure test**

Mock `decideExecutionApproval` with `new Error('permission_required')`; click Approve; assert `role="alert"` contains `permission_required` and the displayed approval remains `Pending`.

- [ ] **Step 3: Add stale approval binding test**

Mock `decideExecutionApproval` with the current server error `approval_binding_mismatch`; assert the UI leaves approval pending and instructs the user to reload/re-request approval rather than retrying automatically.

- [ ] **Step 4: Add adjacent route regression test**

Verify `/`, `/finance`, `/finance/accounting/accounts-payable`, `/health`, and `/studio` still reach their existing headings. Do not weaken existing identity guards to make these tests pass.

- [ ] **Step 5: Run Guided Execution tests**

```bash
npx vitest run tests/unit/guided-execution-api.test.ts tests/unit/guided-execution-view-model.test.ts tests/integration/guided-execution-route.test.tsx tests/integration/guided-execution-approval.test.tsx tests/integration/guided-execution-audit.test.tsx tests/integration/guided-execution-accessibility.test.tsx tests/integration/guided-execution-regression.test.tsx
```

- [ ] **Step 6: Run full repository verification**

```bash
npm run typecheck
npm test
npm run build
```

Expected: all PASS. Local checks do not establish production readiness.

- [ ] **Step 7: Commit verification changes**

```bash
git add tests/integration/guided-execution-route.test.tsx tests/integration/guided-execution-approval.test.tsx tests/integration/guided-execution-regression.test.tsx
git commit -m "test: verify Guided Execution recovery and boundaries"
```

## Completion Gate

Core Web is ready for its next plan only when `/execution/:workflowId` reads authenticated canonical state; raw action payloads are absent from the UI model; task/step navigation works; progress derives from persisted completed steps; approvals remain server-authoritative; stale/forbidden decisions fail closed; evidence/blockers/audit are truthful and permission-aware; refresh reloads backend state; responsive/keyboard/ARIA checks pass; adjacent ATLAS routes remain intact; full typecheck/test/build passes; and no AWS, paid-provider mutation, merge, or deploy occurred.
