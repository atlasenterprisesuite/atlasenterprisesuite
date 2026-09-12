# ATLAS Work Soberano Core Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first-class `/work` operational surface that accepts a user goal, previews a safe canonical execution plan, creates a Universal Execution Engine workflow, and routes into the existing `/execution/:workflowId` Guided Execution surface.

**Architecture:** Reconcile `feat/universal-execution-engine` and `feat/atlas-guided-execution` into `feat/atlas-work-sovereign`, then extend `@atlas/execution` with Work-specific metadata while keeping workflow truth in the existing execution tables. Add server operations to create and list Work workflows, and add ATLAS-native React routes that use the authenticated organization boundary and the existing Guided Execution route for detailed execution.

**Tech Stack:** TypeScript 5.7, React 18.3, React Router, Vitest 3.2, Testing Library 16, Supabase Edge Functions/Postgres.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-work-sovereign-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`.
- Target branch: `feat/atlas-work-sovereign`.
- Reconcile `feat/universal-execution-engine` and `feat/atlas-guided-execution` before implementation; preserve approved commits from both branches.
- Do not create a second workflow state machine, workflow persistence layer, approval system, audit trail, tenant model, or Assistant truth store.
- `/execution/:workflowId` remains the canonical detailed execution route.
- Work UI state is presentation state only; workflow truth persists through `atlas-execution` and the existing execution tables.
- Every server mutation revalidates authenticated membership and execution permission.
- No secrets, tokens, passwords, cookies, recovery codes, or raw provider credentials cross into browser-visible Work state.
- Default external paid-provider budget is `$0` until explicitly authorized.
- No production DNS mutation, deploy, merge, paid-provider action, or unrestricted browser automation in this plan.
- TDD for every task: failing test -> minimal implementation -> focused test -> commit -> independent spec review -> independent quality review.
- Final verification: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`.

## Pre-flight Gate

```bash
git fetch origin main feat/universal-execution-engine feat/atlas-guided-execution
git merge --no-ff origin/feat/universal-execution-engine
git merge --no-ff origin/feat/atlas-guided-execution
test -f packages/execution/src/types.ts
test -f apps/web/src/execution/GuidedExecutionPage.tsx
test -f supabase/functions/atlas-execution/index.ts
npm ci
npm run typecheck
npm test
npm run build
```

Expected: merges preserve both foundations and baseline verification passes. Resolve conflicts by keeping the strongest approved implementation; never force-reset or force-push to discard approved branch history.

---

## File Map

- `packages/execution/src/work-types.ts` — Work modes, autonomy, launch-plan metadata and safe workflow context parser.
- `packages/execution/src/work-intent.ts` — deterministic first-slice intent normalization and preview builder.
- `packages/execution/src/index.ts` — re-export Work contracts.
- `supabase/functions/atlas-execution/work.ts` — authenticated Work workflow create/list server helpers.
- `supabase/functions/atlas-execution/index.ts` — wire `create_workflow_plan` and `list_workflows` operations.
- `apps/web/src/work/types.ts` — UI-safe Work list and draft types.
- `apps/web/src/work/api.ts` — authenticated Work API client and response normalization.
- `apps/web/src/work/view-model.ts` — pure filtering and state-summary selectors.
- `apps/web/src/work/WorkRoutes.tsx` — Work route graph.
- `apps/web/src/work/WorkCommandCenter.tsx` — composer entry, active queue, approvals summary and recent history.
- `apps/web/src/work/WorkComposerPage.tsx` — goal capture, plan preview and launch confirmation.
- `apps/web/src/work/WorkQueue.tsx` — canonical state cards linking to Guided Execution.
- `apps/web/src/work/WorkSubnav.tsx` — Work local navigation.
- `apps/web/src/work/WorkListPage.tsx` — reusable Active/History/Approvals filtered list.
- `apps/web/src/work/work.css` — responsive ATLAS-native styles.
- `apps/web/src/App.tsx` — authenticated `/work/*` routes.
- `apps/web/src/components/AtlasShell.tsx` — first-level Work navigation entry.
- `apps/web/src/main.tsx` — Work stylesheet import.
- `tests/fixtures/workSovereign.ts` — deterministic Work fixtures.
- `tests/unit/work-types.test.ts` — metadata validation and secret rejection.
- `tests/unit/work-intent.test.ts` — deterministic preview behavior.
- `tests/unit/work-api.test.ts` — normalization and transport contract.
- `tests/unit/work-view-model.test.ts` — Active/History/Approvals filtering.
- `tests/integration/work-route.test.tsx` — routing and organization-bound load.
- `tests/integration/work-launch.test.tsx` — preview then launch then Guided Execution navigation.
- `tests/integration/work-regression.test.tsx` — adjacent route safety.

---

### Task 1: Add canonical Work metadata contracts without creating new workflow state

**Files:**
- Create: `packages/execution/src/work-types.ts`
- Modify: `packages/execution/src/index.ts`
- Test: `tests/unit/work-types.test.ts`

**Interfaces:**
- Consumes: `ExecutionScope`, `ExecutionStatus` from `packages/execution/src/types.ts`.
- Produces: `WorkExecutionMode`, `WorkAutonomyLevel`, `WorkRuntimePreference`, `AtlasWorkContext`, `parseAtlasWorkContext(value)`.

- [ ] **Step 1: Write the failing contract test**

```ts
import { describe, expect, it } from 'vitest';
import { parseAtlasWorkContext } from '../../packages/execution/src/work-types';

it('normalizes safe Work metadata and drops unexpected secret-like keys', () => {
  expect(parseAtlasWorkContext({
    work: {
      executionMode: 'hybrid', autonomyLevel: 'guided', runtimePreference: 'auto',
      budgetLimit: 0, connectionRefs: ['conn-cloudflare'], token: 'must-not-survive'
    }
  })).toEqual({
    executionMode: 'hybrid', autonomyLevel: 'guided', runtimePreference: 'auto',
    budgetLimit: 0, connectionRefs: ['conn-cloudflare']
  });
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/work-types.test.ts
```

Expected: FAIL because Work contracts do not exist.

- [ ] **Step 3: Implement the contracts**

Create `packages/execution/src/work-types.ts` with:

```ts
export const WORK_EXECUTION_MODES = ['api', 'browser', 'hybrid'] as const;
export type WorkExecutionMode = (typeof WORK_EXECUTION_MODES)[number];

export const WORK_AUTONOMY_LEVELS = ['manual', 'guided', 'autonomous'] as const;
export type WorkAutonomyLevel = (typeof WORK_AUTONOMY_LEVELS)[number];

export const WORK_RUNTIME_PREFERENCES = ['auto', 'local', 'self_hosted', 'cloud_ephemeral'] as const;
export type WorkRuntimePreference = (typeof WORK_RUNTIME_PREFERENCES)[number];

export type AtlasWorkContext = {
  executionMode: WorkExecutionMode;
  autonomyLevel: WorkAutonomyLevel;
  runtimePreference: WorkRuntimePreference;
  budgetLimit: number | null;
  connectionRefs: string[];
};

export function parseAtlasWorkContext(value: unknown): AtlasWorkContext {
  const root = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const raw = root.work && typeof root.work === 'object' ? root.work as Record<string, unknown> : {};
  const executionMode = WORK_EXECUTION_MODES.includes(raw.executionMode as WorkExecutionMode) ? raw.executionMode as WorkExecutionMode : 'hybrid';
  const autonomyLevel = WORK_AUTONOMY_LEVELS.includes(raw.autonomyLevel as WorkAutonomyLevel) ? raw.autonomyLevel as WorkAutonomyLevel : 'guided';
  const runtimePreference = WORK_RUNTIME_PREFERENCES.includes(raw.runtimePreference as WorkRuntimePreference) ? raw.runtimePreference as WorkRuntimePreference : 'auto';
  const budget = raw.budgetLimit === null ? null : Number(raw.budgetLimit);
  return {
    executionMode,
    autonomyLevel,
    runtimePreference,
    budgetLimit: Number.isFinite(budget) && budget >= 0 ? budget : 0,
    connectionRefs: Array.isArray(raw.connectionRefs) ? [...new Set(raw.connectionRefs.map(String).filter(Boolean))].slice(0, 20) : []
  };
}
```

Export `./work-types` from `packages/execution/src/index.ts`.

- [ ] **Step 4: Verify GREEN**

```bash
npx vitest run tests/unit/work-types.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/execution/src/work-types.ts packages/execution/src/index.ts tests/unit/work-types.test.ts
git commit -m "feat: add ATLAS Work execution metadata contracts"
```

---

### Task 2: Add deterministic intent preview generation

**Files:**
- Create: `packages/execution/src/work-intent.ts`
- Modify: `packages/execution/src/index.ts`
- Test: `tests/unit/work-intent.test.ts`

**Interfaces:**
- Consumes: Work metadata from Task 1.
- Produces: `WorkIntentInput`, `WorkPlanPreview`, `compileWorkIntent(input)`.

- [ ] **Step 1: Write the failing preview tests**

```ts
import { expect, it } from 'vitest';
import { compileWorkIntent } from '../../packages/execution/src/work-intent';

it('builds a reviewable draft without claiming execution', () => {
  const preview = compileWorkIntent({
    intent: 'Verify atlasenterprisesuite.com with OpenAI',
    ownerModule: 'manager', executionMode: 'hybrid', autonomyLevel: 'guided',
    runtimePreference: 'auto', budgetLimit: 0
  });
  expect(preview.status).toBe('draft');
  expect(preview.ownerModule).toBe('manager');
  expect(preview.successCriteria.length).toBeGreaterThan(0);
});

it('rejects an empty intent', () => {
  expect(() => compileWorkIntent({ intent: '   ', ownerModule: 'manager' })).toThrow('work_intent_required');
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/work-intent.test.ts
```

Expected: FAIL because the compiler does not exist.

- [ ] **Step 3: Implement the first-slice compiler**

`compileWorkIntent` must trim the intent to 2,000 characters, require an explicit `ownerModule` for v1, default to Hybrid + Guided + Auto + `$0`, and return one initial task whose success criteria are reviewable but non-executing. For the exact OpenAI-domain phrase, return the known safe criteria: DNS TXT exists, public DNS returns the expected value, OpenAI reports verified, evidence persisted. For every other intent, return generic criteria `['requested outcome exists', 'result independently verified', 'evidence persisted']` rather than inventing domain-specific actions.

- [ ] **Step 4: Verify GREEN**

```bash
npx vitest run tests/unit/work-intent.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/execution/src/work-intent.ts packages/execution/src/index.ts tests/unit/work-intent.test.ts
git commit -m "feat: add safe ATLAS Work intent preview compiler"
```

---

### Task 3: Add authenticated Work workflow create/list operations

**Files:**
- Create: `supabase/functions/atlas-execution/work.ts`
- Modify: `supabase/functions/atlas-execution/index.ts`
- Test: `tests/unit/atlas-execution-work-edge.test.ts`

**Interfaces:**
- Consumes: existing `resolveContext`, `requireExecutionPermission`, execution tables and audit helper.
- Produces server operations `create_workflow_plan` and `list_workflows`.

- [ ] **Step 1: Write failing server-contract tests**

Create tests that assert:

```ts
expect(SUPPORTED_OPERATIONS).toContain('create_workflow_plan');
expect(SUPPORTED_OPERATIONS).toContain('list_workflows');
```

and source-level guards that `create_workflow_plan` requires `execution.write`, inserts into `execution_workflows`, `execution_tasks`, and `execution_steps`, and writes `execution.workflow.created` audit evidence without persisting raw secret fields.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/atlas-execution-work-edge.test.ts
```

Expected: FAIL because the operations do not exist.

- [ ] **Step 3: Implement `create_workflow_plan`**

Create `work.ts` with an exported helper receiving `{ admin, context, requestId, body, appendAudit }`. Validate:

```ts
const ownerModule = requiredText(body.owner_module, 'owner_module_required', 80);
const intent = requiredText(body.intent, 'work_intent_required', 2000);
const work = parseAtlasWorkContext({ work: body.work });
```

Insert an `execution_workflows` row with `workflow_type: 'work.sovereign'`, `owner_module`, `status: 'draft'`, `current_module: ownerModule`, `created_by_user_id: context.userId`, and `context: { work, intent }`. Insert one initial task and one `plan_review` step with no provider secret payload. If a child insert fails, delete the just-created workflow by id and org before surfacing `persistence_error`, relying on existing FK cleanup where configured.

Return `{ ok: true, workflow_id, task_id }` with HTTP 201.

- [ ] **Step 4: Implement `list_workflows`**

Require `execution.read`; query `execution_workflows` for `org_id = context.orgId` and `workflow_type = 'work.sovereign'`, newest first, limit 100. Return only workflow fields plus safe `context.work` metadata; never return task action payloads.

- [ ] **Step 5: Wire operations into `index.ts`**

Add both names to `SUPPORTED_OPERATIONS` and dispatch after `resolveContext`. Keep request-size, CORS and authentication behavior unchanged.

- [ ] **Step 6: Verify GREEN**

```bash
npx vitest run tests/unit/atlas-execution-work-edge.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/atlas-execution/work.ts supabase/functions/atlas-execution/index.ts tests/unit/atlas-execution-work-edge.test.ts
git commit -m "feat: add authenticated ATLAS Work workflow operations"
```

---

### Task 4: Add the Work web API boundary and view model

**Files:**
- Create: `apps/web/src/work/types.ts`
- Create: `apps/web/src/work/api.ts`
- Create: `apps/web/src/work/view-model.ts`
- Create: `tests/fixtures/workSovereign.ts`
- Test: `tests/unit/work-api.test.ts`
- Test: `tests/unit/work-view-model.test.ts`

**Interfaces:**
- Consumes: `authorizedAtlasFetch`, `getActiveAtlasOrganization` and server operations from Task 3.
- Produces: `listWorkflows()`, `createWorkWorkflow(input)`, `workflowsByView(workflows, view)`.

- [ ] **Step 1: Write failing API tests**

Assert `normalizeWorkWorkflow` whitelists only id, owner module, status, timestamps and parsed Work context, and that a raw context containing `token` does not survive serialization.

- [ ] **Step 2: Write failing view-model tests**

Use deterministic fixtures for `now`, `awaiting_approval`, `completed`, and `blocked`; assert `active` excludes completed, `history` includes completed/failed/cancelled, and `approvals` includes only awaiting-approval workflows.

- [ ] **Step 3: Verify RED**

```bash
npx vitest run tests/unit/work-api.test.ts tests/unit/work-view-model.test.ts
```

- [ ] **Step 4: Implement API and normalization**

Follow the existing `apps/web/src/execution/api.ts` transport pattern. `createWorkWorkflow` must POST:

```ts
{
  operation: 'create_workflow_plan',
  owner_module: input.ownerModule,
  intent: input.intent,
  work: {
    executionMode: input.executionMode,
    autonomyLevel: input.autonomyLevel,
    runtimePreference: input.runtimePreference,
    budgetLimit: input.budgetLimit,
    connectionRefs: input.connectionRefs
  }
}
```

`listWorkflows()` posts `{ operation: 'list_workflows' }`.

- [ ] **Step 5: Implement pure filters**

`workflowsByView` accepts `'active' | 'history' | 'approvals' | 'all'` and derives views only from canonical status.

- [ ] **Step 6: Verify GREEN**

```bash
npx vitest run tests/unit/work-api.test.ts tests/unit/work-view-model.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/work tests/fixtures/workSovereign.ts tests/unit/work-api.test.ts tests/unit/work-view-model.test.ts
git commit -m "feat: add ATLAS Work web data boundary"
```

---

### Task 5: Build Work Command Center and composer launch flow

**Files:**
- Create: `apps/web/src/work/WorkCommandCenter.tsx`
- Create: `apps/web/src/work/WorkComposerPage.tsx`
- Create: `apps/web/src/work/WorkQueue.tsx`
- Create: `apps/web/src/work/WorkSubnav.tsx`
- Test: `tests/integration/work-launch.test.tsx`

**Interfaces:**
- Consumes: `compileWorkIntent`, `listWorkflows`, `createWorkWorkflow`.
- Produces: review-before-launch UX and navigation to `/execution/:workflowId`.

- [ ] **Step 1: Write the failing launch test**

Render `/work/new`, type `Verify atlasenterprisesuite.com with OpenAI`, select owner module `manager`, verify preview displays `Hybrid`, `Guided`, `Auto`, `$0`, and success criteria before any create call. Click `Create workflow`, mock a response `{ workflowId: 'wf-184' }`, and assert navigation to `/execution/wf-184`.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/integration/work-launch.test.tsx
```

- [ ] **Step 3: Implement the composer**

Use controlled fields for intent, owner module, execution mode, autonomy, runtime preference and budget. Default to Hybrid/Guided/Auto/0. The first button is `Review plan`; only after a valid preview exists render `Create workflow`. Changing any launch field invalidates the existing preview.

- [ ] **Step 4: Implement the Command Center**

Load current organization workflows, render the composer CTA, active queue, approvals count and recent completed items. Each workflow card links to `/execution/${workflow.id}`; do not build a second detailed execution page.

- [ ] **Step 5: Verify GREEN**

```bash
npx vitest run tests/integration/work-launch.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/work tests/integration/work-launch.test.tsx
git commit -m "feat: add ATLAS Work command center and composer"
```

---

### Task 6: Add Work routes, filtered lists, sidebar navigation and responsive styling

**Files:**
- Create: `apps/web/src/work/WorkRoutes.tsx`
- Create: `apps/web/src/work/WorkListPage.tsx`
- Create: `apps/web/src/work/work.css`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/AtlasShell.tsx`
- Modify: `apps/web/src/main.tsx`
- Test: `tests/integration/work-route.test.tsx`
- Test: `tests/integration/work-regression.test.tsx`

**Interfaces:**
- Consumes: Work components from Tasks 4-5 and existing `RequireAtlasIdentity` shell.
- Produces routes `/work`, `/work/new`, `/work/active`, `/work/approvals`, `/work/history`.

- [ ] **Step 1: Write failing route tests**

Assert authenticated navigation exposes a first-level `Work` item; `/work` renders Command Center; `/work/active`, `/work/approvals`, and `/work/history` render canonical filtered list views; unauthenticated behavior remains governed by the existing identity boundary.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/integration/work-route.test.tsx tests/integration/work-regression.test.tsx
```

- [ ] **Step 3: Implement `WorkRoutes`**

Use nested React Router routes under `/work/*`. Unknown Work subroutes navigate to `/work` instead of rendering a blank page.

- [ ] **Step 4: Update shell and app route graph**

Add `{ to: '/work', label: 'Work' }` immediately after Home in `AtlasShell.tsx`. Add the Work route inside the same authenticated shell that contains Guided Execution; do not move `/execution/:workflowId`.

- [ ] **Step 5: Add responsive styles**

`work.css` must support desktop, tablet and mobile with a single-column composer below 760px, visible focus states, readable status chips, disabled/loading/success/error states, and no fixed-width overflow.

- [ ] **Step 6: Verify GREEN and adjacent routes**

```bash
npx vitest run tests/integration/work-route.test.tsx tests/integration/work-regression.test.tsx
npm run typecheck
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/work apps/web/src/App.tsx apps/web/src/components/AtlasShell.tsx apps/web/src/main.tsx tests/integration/work-route.test.tsx tests/integration/work-regression.test.tsx
git commit -m "feat: integrate ATLAS Work into the enterprise shell"
```

---

### Task 7: Core Web verification and review gate

**Files:**
- No new implementation files unless review finds a defect.

- [ ] **Step 1: Run focused Work suite**

```bash
npx vitest run tests/unit/work-types.test.ts tests/unit/work-intent.test.ts tests/unit/work-api.test.ts tests/unit/work-view-model.test.ts tests/integration/work-launch.test.tsx tests/integration/work-route.test.tsx tests/integration/work-regression.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run repository verification**

```bash
npm run typecheck
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 3: Independent spec review**

Reviewer checks that Work launches canonical workflows, detailed execution remains `/execution/:workflowId`, tenant context comes from the authenticated organization, no secret crosses the UI boundary, and no second workflow state machine or persistence store was introduced.

- [ ] **Step 4: Independent quality review**

Reviewer checks error/loading/empty states, accessibility, mobile layout, duplicate logic, type safety and regression risk. Fix findings and rerun focused + full verification before proceeding to the router/policy plan.
