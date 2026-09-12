# ATLAS Work Soberano Execution Router and Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one canonical decision layer that chooses API, Browser, or Hybrid execution per step and enforces Manual, Guided, or Autonomous policy, budget, approvals, tenant scope, and execution-envelope constraints before any mutation.

**Architecture:** Extend `@atlas/execution`; do not create a Work-specific state machine. Routing is a pure deterministic decision over provider capability, requested execution mode and runtime availability. Policy is evaluated server-side immediately before execution and returns allow, require-approval, or deny with machine-readable reasons; the browser may display the decision but cannot override it.

**Tech Stack:** TypeScript 5.7, Vitest 3.2, Supabase Edge Functions, existing `@atlas/execution` approval and audit contracts.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-work-sovereign-design.md`

## Global Constraints

- Target branch: `feat/atlas-work-sovereign` after the Core Web plan passes review.
- Preserve canonical `ExecutionStatus`, `StepStatus`, approval binding and completion rules.
- Execution mode is a routing preference, not authorization.
- Autonomous Mode never bypasses permission, approval, budget, execution-envelope, regulated-domain or provider-capability policy.
- A changed action payload invalidates stale approval through the existing payload digest mechanism.
- Default external paid-provider budget is `$0`.
- No provider call occurs from the pure router or policy package.
- No production mutation in automated tests.
- TDD + independent spec and quality review for every task.

## File Map

- `packages/execution/src/work-routing.ts` — normalized provider capability and execution-path selection.
- `packages/execution/src/work-policy.ts` — action sensitivity, autonomy, budget and approval decisions.
- `packages/execution/src/browser-envelope.ts` — domain/action envelope validation.
- `packages/execution/src/index.ts` — exports.
- `supabase/functions/atlas-execution/work-policy.ts` — server policy resolver using authenticated context and current task/step.
- `supabase/functions/atlas-execution/index.ts` — `evaluate_work_step` operation.
- `apps/web/src/work/ExecutionConfiguration.tsx` — user-visible mode/autonomy/runtime/budget summary.
- `apps/web/src/execution/StepDetailPanel.tsx` — display resolved execution decision without becoming authority.
- `tests/unit/work-routing.test.ts` — router matrix.
- `tests/unit/work-policy.test.ts` — autonomy/budget/approval matrix.
- `tests/unit/browser-envelope.test.ts` — allow/deny constraints.
- `tests/unit/atlas-execution-work-policy-edge.test.ts` — server reauthorization contract.
- `tests/integration/work-policy-visibility.test.tsx` — UI displays server decision truthfully.

---

### Task 1: Define normalized execution capabilities and route selection

**Files:**
- Create: `packages/execution/src/work-routing.ts`
- Modify: `packages/execution/src/index.ts`
- Test: `tests/unit/work-routing.test.ts`

**Interfaces:**
- Produces `ProviderExecutionCapability`, `ExecutionRouteRequest`, `ExecutionRouteDecision`, `selectExecutionRoute(request)`.

- [ ] **Step 1: Write failing route-matrix tests**

```ts
import { expect, it } from 'vitest';
import { selectExecutionRoute } from '../../packages/execution/src/work-routing';

const base = {
  requestedMode: 'hybrid' as const,
  apiCapability: { available: true, authorized: true },
  browserCapability: { available: true, authorized: true },
  runtimeAvailable: true
};

it('prefers an authorized API in hybrid mode', () => {
  expect(selectExecutionRoute(base).mechanism).toBe('api');
});

it('falls back to browser when API capability is absent', () => {
  expect(selectExecutionRoute({ ...base, apiCapability: { available: false, authorized: false } }).mechanism).toBe('browser');
});

it('blocks browser-only mode when no authorized browser runtime exists', () => {
  expect(selectExecutionRoute({ ...base, requestedMode: 'browser', runtimeAvailable: false }).state).toBe('blocked');
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/work-routing.test.ts
```

- [ ] **Step 3: Implement deterministic routing**

Define:

```ts
export type ProviderExecutionCapability = { available: boolean; authorized: boolean; reason?: string };
export type ExecutionRouteDecision = {
  state: 'ready' | 'blocked';
  mechanism: 'api' | 'browser' | null;
  reason: string;
};
```

Rules: API mode requires authorized API; Browser mode requires authorized browser + runtime; Hybrid chooses authorized API first, then authorized browser runtime; otherwise blocked. No implicit paid provider fallback.

- [ ] **Step 4: Verify GREEN**

```bash
npx vitest run tests/unit/work-routing.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/execution/src/work-routing.ts packages/execution/src/index.ts tests/unit/work-routing.test.ts
git commit -m "feat: add sovereign execution route selection"
```

---

### Task 2: Add explicit browser execution envelope validation

**Files:**
- Create: `packages/execution/src/browser-envelope.ts`
- Modify: `packages/execution/src/index.ts`
- Test: `tests/unit/browser-envelope.test.ts`

**Interfaces:**
- Produces `BrowserExecutionEnvelope`, `BrowserActionRequest`, `evaluateBrowserAction(envelope, action, now)`.

- [ ] **Step 1: Write failing envelope tests**

```ts
import { expect, it } from 'vitest';
import { evaluateBrowserAction } from '../../packages/execution/src/browser-envelope';

const envelope = {
  workflowId: 'wf-1', stepId: 'step-1', tenantId: 'tenant-1', organizationId: 'org-1',
  allowedDomains: ['openai.com', 'dash.cloudflare.com'],
  allowedActions: ['navigate', 'read', 'create_dns_txt', 'click_openai_check'],
  deniedActions: ['delete_dns_record', 'change_nameservers', 'purchase'],
  autonomyLevel: 'guided' as const,
  expiresAt: '2026-09-12T22:00:00Z'
};

it('allows an explicitly-scoped action', () => {
  expect(evaluateBrowserAction(envelope, { domain: 'openai.com', action: 'navigate' }, '2026-09-12T21:00:00Z').allowed).toBe(true);
});

it('denies a nameserver change even on an allowed domain', () => {
  expect(evaluateBrowserAction(envelope, { domain: 'dash.cloudflare.com', action: 'change_nameservers' }, '2026-09-12T21:00:00Z').allowed).toBe(false);
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/browser-envelope.test.ts
```

- [ ] **Step 3: Implement fail-closed envelope checks**

Normalize hostnames to lowercase, allow exact domain or subdomain match only, deny expired envelopes, evaluate denied actions before allowed actions, and return `{ allowed, reason }` without executing anything.

- [ ] **Step 4: Verify GREEN and commit**

```bash
npx vitest run tests/unit/browser-envelope.test.ts
git add packages/execution/src/browser-envelope.ts packages/execution/src/index.ts tests/unit/browser-envelope.test.ts
git commit -m "feat: constrain browser execution with task envelopes"
```

---

### Task 3: Add autonomy, sensitivity, approval and budget policy

**Files:**
- Create: `packages/execution/src/work-policy.ts`
- Modify: `packages/execution/src/index.ts`
- Test: `tests/unit/work-policy.test.ts`

**Interfaces:**
- Produces `WorkActionPolicyInput`, `WorkActionPolicyDecision`, `evaluateWorkActionPolicy(input)`.

- [ ] **Step 1: Write failing policy tests**

```ts
import { expect, it } from 'vitest';
import { evaluateWorkActionPolicy } from '../../packages/execution/src/work-policy';

it('requires approval for DNS writes in guided mode', () => {
  const result = evaluateWorkActionPolicy({
    autonomyLevel: 'guided', sensitivity: 'high', reversible: true,
    mutation: true, paidCost: 0, budgetLimit: 0,
    permissionsSatisfied: true, envelopeAllowed: true, regulated: false
  });
  expect(result.outcome).toBe('require_approval');
});

it('denies paid execution above budget even in autonomous mode', () => {
  const result = evaluateWorkActionPolicy({
    autonomyLevel: 'autonomous', sensitivity: 'low', reversible: true,
    mutation: true, paidCost: 1, budgetLimit: 0,
    permissionsSatisfied: true, envelopeAllowed: true, regulated: false
  });
  expect(result.outcome).toBe('deny');
  expect(result.reason).toBe('budget_exceeded');
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/work-policy.test.ts
```

- [ ] **Step 3: Implement decision order**

Decision order must be exact: missing permission -> deny; envelope denied -> deny; paid cost above budget -> deny; regulated mutation -> require approval; destructive/irreversible mutation -> require approval; Manual mutation -> require approval; Guided high/critical mutation -> require approval; Autonomous inside granted policy -> allow; read-only action with permissions -> allow. Return a machine-readable reason for every non-allow outcome.

- [ ] **Step 4: Verify GREEN and commit**

```bash
npx vitest run tests/unit/work-policy.test.ts
git add packages/execution/src/work-policy.ts packages/execution/src/index.ts tests/unit/work-policy.test.ts
git commit -m "feat: add Work autonomy budget and approval policy"
```

---

### Task 4: Add server-authoritative `evaluate_work_step`

**Files:**
- Create: `supabase/functions/atlas-execution/work-policy.ts`
- Modify: `supabase/functions/atlas-execution/index.ts`
- Test: `tests/unit/atlas-execution-work-policy-edge.test.ts`

**Interfaces:**
- Consumes current workflow/task/step rows, authenticated `RequestContext`, Work context, routing and policy functions.
- Produces operation `evaluate_work_step` returning safe route/policy decision only.

- [ ] **Step 1: Write failing server tests**

Assert the operation requires `execution.read`; loads workflow/task/current step scoped to `context.orgId`; derives Work metadata from `workflow.context`; never accepts `permissionsSatisfied`, approval outcome, provider authorization or budget truth directly from the browser request.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/atlas-execution-work-policy-edge.test.ts
```

- [ ] **Step 3: Implement server evaluation**

Request shape is limited to:

```ts
{ operation: 'evaluate_work_step', organization_id: string, task_id: string }
```

Server loads task + step + workflow. For this plan, provider capabilities come from server-owned safe metadata attached to the step under `action_payload.capabilities` only after whitelisting booleans; connection secrets are never returned. Permission satisfaction derives from authenticated context. Budget derives from parsed Work context. Return:

```ts
{
  ok: true,
  route: { state, mechanism, reason },
  policy: { outcome, reason },
  approvalRequired: policy.outcome === 'require_approval'
}
```

- [ ] **Step 4: Verify GREEN**

```bash
npx vitest run tests/unit/atlas-execution-work-policy-edge.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/atlas-execution/work-policy.ts supabase/functions/atlas-execution/index.ts tests/unit/atlas-execution-work-policy-edge.test.ts
git commit -m "feat: evaluate Work execution policy server side"
```

---

### Task 5: Surface execution configuration and server decision without granting authority to UI

**Files:**
- Create: `apps/web/src/work/ExecutionConfiguration.tsx`
- Modify: `apps/web/src/work/WorkComposerPage.tsx`
- Modify: `apps/web/src/execution/api.ts`
- Modify: `apps/web/src/execution/StepDetailPanel.tsx`
- Test: `tests/integration/work-policy-visibility.test.tsx`

**Interfaces:**
- Consumes `evaluate_work_step` response.
- Produces transparent user-visible mode/autonomy/runtime/budget and resolved route/policy state.

- [ ] **Step 1: Write failing integration test**

Mock a server decision `{ route: { state: 'ready', mechanism: 'api', reason: 'authorized_api_available' }, policy: { outcome: 'require_approval', reason: 'guided_high_risk_mutation' }, approvalRequired: true }`. Assert Guided Execution displays `API`, `Approval required`, and never renders an `Execute without approval` control.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/integration/work-policy-visibility.test.tsx
```

- [ ] **Step 3: Implement API helper and display components**

Add `evaluateWorkStep(taskId)` to `apps/web/src/execution/api.ts` using existing authenticated `executionPost`. Display server decisions as informational state. Existing ApprovalCard/StepActionBar remains the only mutation path.

- [ ] **Step 4: Verify GREEN and commit**

```bash
npx vitest run tests/integration/work-policy-visibility.test.tsx
npm run typecheck
git add apps/web/src/work/ExecutionConfiguration.tsx apps/web/src/work/WorkComposerPage.tsx apps/web/src/execution/api.ts apps/web/src/execution/StepDetailPanel.tsx tests/integration/work-policy-visibility.test.tsx
git commit -m "feat: expose truthful Work routing and policy decisions"
```

---

### Task 6: Router and policy final verification

- [ ] **Step 1: Focused suite**

```bash
npx vitest run tests/unit/work-routing.test.ts tests/unit/browser-envelope.test.ts tests/unit/work-policy.test.ts tests/unit/atlas-execution-work-policy-edge.test.ts tests/integration/work-policy-visibility.test.tsx
```

- [ ] **Step 2: Full repository verification**

```bash
npm run typecheck
npm test
npm run build
```

- [ ] **Step 3: Independent spec review**

Reject the slice if UI can self-authorize, Autonomous bypasses any hard boundary, API/browser fallback invents capability, budget can become positive without explicit persisted authorization, or any second workflow/approval state appears.

- [ ] **Step 4: Independent quality review**

Review exhaustive route/policy matrix, fail-closed defaults, naming consistency and duplication. Fix findings and rerun focused + full verification before the runtime/browser/connections plan.
