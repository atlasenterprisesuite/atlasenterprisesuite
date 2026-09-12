# ATLAS Universal Execution Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared, persistent, permission-aware, approval-gated, evidence-backed execution runtime that dependent ATLAS modules can adopt without duplicating orchestration logic.

**Architecture:** Add a focused `@atlas/execution` package for workflow semantics, keep cross-domain authorization primitives in `@atlas/core`, persist canonical execution state in Supabase with organization-scoped RLS, expose a thin `atlas-execution` Edge Function for authenticated mutations, and add Approval Center / workflow progress surfaces to the existing React shell. Provider and tool execution are registered through explicit contracts; no provider is represented as usable unless it is verified.

**Tech Stack:** TypeScript 5.7, React 18, React Router, Vitest 3, Supabase/Postgres migrations and Edge Functions, existing ATLAS session/auth patterns.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-universal-execution-core-design.md`

## Global Constraints

- Work only on `feat/atlas-universal-execution-core` or an isolated worktree derived from it; do not merge or deploy from this plan.
- Do not spend provider credits or execute tax filing, card issuance, money movement, publishing, production infrastructure mutation, or any other regulated/external side effect.
- Preserve existing `organization_members(org_id, user_id, status)` authorization semantics and enforce mutation authorization server-side.
- `completed` requires the workflow completion policy to be satisfied and all required evidence to be present and verified.
- High-impact and regulated execution must pass Approval Center policy before execution.
- Do not persist service-role keys, access tokens, PAN/CVV, unredacted tax payloads, or provider secrets in general tables, logs, audit events, or browser state.
- No UI copy may claim `live`, `connected`, `ready`, `active`, `submitted`, `accepted`, or `completed` unless the backing state and evidence support that exact claim.
- Keep dependent modules (Studio Music, Finance Modeling, Document Intelligence, Tax, ATLAS Pay, Weather) out of this implementation plan except for adoption seams/contracts; each gets its own follow-on plan after the core is verified.

---

### Task 1: Create the execution domain package and deterministic workflow state machine

**Files:**
- Create: `packages/execution/package.json`
- Create: `packages/execution/src/types.ts`
- Create: `packages/execution/src/state-machine.ts`
- Create: `packages/execution/src/dependency-graph.ts`
- Create: `packages/execution/src/index.ts`
- Create: `tests/unit/execution-state-machine.test.ts`
- Create: `tests/unit/execution-dependency-graph.test.ts`

**Interfaces:**
- Produces: `AtlasWorkflowStatus`, `AtlasExecutionClass`, `AtlasWorkflow`, `AtlasWorkflowStep`, `AtlasEvidenceRequirement`, `transitionWorkflow`, `canCompleteWorkflow`, `validateDependencyGraph`.
- Consumers: Tasks 4–9.

- [ ] **Step 1: Write failing workflow transition tests**

```ts
import { describe, expect, it } from 'vitest';
import { canCompleteWorkflow, transitionWorkflow } from '../../packages/execution/src/index';

describe('ATLAS workflow state machine', () => {
  it('refuses completion when required evidence is missing', () => {
    expect(canCompleteWorkflow({ requiredEvidenceIds: ['ev-1'], verifiedEvidenceIds: [] })).toBe(false);
  });

  it('moves an approved workflow from awaiting_approval to now', () => {
    expect(transitionWorkflow('awaiting_approval', 'approval_granted')).toBe('now');
  });

  it('rejects invalid terminal transitions', () => {
    expect(() => transitionWorkflow('completed', 'resume')).toThrow('invalid_transition');
  });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npx vitest run tests/unit/execution-state-machine.test.ts`

Expected: FAIL because `packages/execution` does not exist.

- [ ] **Step 3: Implement the minimal workflow contracts and state machine**

Use these canonical states in `types.ts`:

```ts
export type AtlasWorkflowStatus =
  | 'now' | 'next' | 'blocked' | 'awaiting_approval'
  | 'completed' | 'failed' | 'cancelled';

export type AtlasExecutionClass = 'observe' | 'prepare' | 'execute' | 'validate';

export type AtlasWorkflow = {
  taskId: string;
  workflowType: string;
  module: string;
  tenantId: string;
  organizationId: string;
  ownerId: string;
  status: AtlasWorkflowStatus;
  priority: 'low' | 'normal' | 'high' | 'critical';
  currentStep: string | null;
  nextAction: string | null;
  dependencies: string[];
  blockedReason: string | null;
  permissionsRequired: string[];
  evidenceIds: string[];
  traceId: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};
```

Implement `transitionWorkflow` with an explicit transition table. Do not use permissive fall-through logic.

- [ ] **Step 4: Add dependency graph tests and implementation**

Test that a graph with `step-a -> step-b -> step-a` throws `dependency_cycle` and that an acyclic graph returns execution order.

- [ ] **Step 5: Run unit tests**

Run: `npx vitest run tests/unit/execution-state-machine.test.ts tests/unit/execution-dependency-graph.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/execution tests/unit/execution-state-machine.test.ts tests/unit/execution-dependency-graph.test.ts
git commit -m "feat: add ATLAS execution state machine"
```

---

### Task 2: Generalize Core RBAC without breaking Accounting

**Files:**
- Modify: `packages/core/src/index.ts`
- Create: `tests/unit/core-permissions.test.ts`

**Interfaces:**
- Produces: `AtlasPermission`, domain-safe `hasPermission(granted, required)`, `permissionDomain(permission)`.
- Preserves: existing Accounting permission strings and `demoAtlasContext` compatibility.

- [ ] **Step 1: Write failing domain-boundary tests**

```ts
import { describe, expect, it } from 'vitest';
import { hasPermission } from '../../packages/core/src/index';

describe('universal ATLAS permissions', () => {
  it('allows exact permission', () => {
    expect(hasPermission(['workflow.read'], 'workflow.read')).toBe(true);
  });

  it('allows a same-domain admin permission', () => {
    expect(hasPermission(['accounting.admin'], 'accounting.post')).toBe(true);
  });

  it('does not let accounting admin approve workflows', () => {
    expect(hasPermission(['accounting.admin'], 'workflow.approve')).toBe(false);
  });
});
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run tests/unit/core-permissions.test.ts`

Expected: FAIL because `hasPermission` is accounting-specific.

- [ ] **Step 3: Implement domain-neutral permissions**

Define `AtlasPermission` as the union needed by the core milestone, including existing accounting permissions plus:

```ts
export type AtlasPermission =
  | AccountingPermission
  | 'workflow.read' | 'workflow.manage' | 'workflow.approve' | 'workflow.admin'
  | 'agent.execute'
  | 'provider.read' | 'provider.manage'
  | 'evidence.read' | 'evidence.write'
  | 'audit.read'
  | 'usage.read' | 'usage.manage'
  | 'creator.generate' | 'creator.publish'
  | 'tax.prepare' | 'tax.review' | 'tax.file'
  | 'pay.card.add' | 'pay.card.manage'
  | 'weather.read';
```

`hasPermission` must allow exact permission or `<required-domain>.admin`; it must not treat one domain's admin as global admin.

- [ ] **Step 4: Run tests and existing suite**

Run: `npm run test:unit`

Expected: PASS with no Accounting regression.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/index.ts tests/unit/core-permissions.test.ts
git commit -m "refactor: generalize ATLAS core permissions"
```

---

### Task 3: Persist universal execution state with organization-scoped RLS

**Files:**
- Create: `supabase/migrations/20260912_universal_execution_core.sql`
- Create: `tests/unit/universal-execution-migration.test.ts`

**Interfaces:**
- Produces tables: `atlas_workflows`, `atlas_workflow_steps`, `atlas_workflow_events`, `atlas_approval_requests`, `atlas_evidence`, `atlas_provider_registry`, `atlas_provider_probes`, `atlas_usage_events`, `atlas_document_sources`, `atlas_document_fields`.
- All tables use `org_id uuid references public.organizations(id)` and RLS membership checks through `public.organization_members`.

- [ ] **Step 1: Write a failing migration contract test**

The test reads the SQL file and asserts all ten table names exist, every scoped table enables RLS, browser grants are read-only, and membership policies require `om.user_id = auth.uid()` plus `om.status = 'active'`.

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/20260912_universal_execution_core.sql', 'utf8');

describe('universal execution migration', () => {
  it('defines the canonical workflow tables', () => {
    for (const name of ['atlas_workflows','atlas_workflow_steps','atlas_workflow_events','atlas_approval_requests','atlas_evidence','atlas_provider_registry','atlas_provider_probes','atlas_usage_events','atlas_document_sources','atlas_document_fields']) {
      expect(sql).toContain(`public.${name}`);
    }
  });
  it('enforces active organization membership', () => {
    expect(sql).toContain('om.user_id = auth.uid()');
    expect(sql).toContain("om.status = 'active'");
  });
});
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run tests/unit/universal-execution-migration.test.ts`

Expected: FAIL because migration is absent.

- [ ] **Step 3: Implement schema and constraints**

Required schema rules:
- UUID primary keys with `gen_random_uuid()`.
- `atlas_workflows.status` check exactly matches the canonical workflow states.
- `atlas_workflow_steps.execution_class` check matches `observe|prepare|execute|validate`.
- Approval risk check matches `low|moderate|high|regulated`.
- Provider state check matches `not_configured|configured_unverified|probing|verified|degraded|unavailable`.
- Append-only event/evidence rows have no browser update/delete grant.
- Index workflow/status/owner, step/workflow/status, approval/org/status, evidence/workflow, provider/org/state, usage/org/created_at.

- [ ] **Step 4: Add RLS and browser read policies**

Follow the existing Hospitality policy form:

```sql
exists (
  select 1 from public.organization_members om
  where om.org_id = atlas_workflows.org_id
    and om.user_id = auth.uid()
    and om.status = 'active'
)
```

Browser users receive `select` only. Mutations go through the authenticated Edge Function after server-side policy checks.

- [ ] **Step 5: Run migration contract test and full unit suite**

Run: `npm run test:unit`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260912_universal_execution_core.sql tests/unit/universal-execution-migration.test.ts
git commit -m "feat: persist universal ATLAS execution state"
```

---

### Task 4: Add workflow repository, resumability, and append-only event semantics

**Files:**
- Create: `packages/execution/src/store.ts`
- Create: `packages/execution/src/recovery.ts`
- Modify: `packages/execution/src/index.ts`
- Create: `tests/unit/execution-store.test.ts`
- Create: `tests/unit/execution-recovery.test.ts`

**Interfaces:**
- Produces: `ExecutionStore` interface, `appendWorkflowEvent`, `resumeWorkflow`, `summarizeRecoveryState`.
- Store methods consume scoped IDs and return normalized domain records; they never accept a free-form SQL fragment.

- [ ] **Step 1: Write failing in-memory store tests**

Define the interface before concrete Supabase wiring:

```ts
export interface ExecutionStore {
  getWorkflow(scope: { organizationId: string; taskId: string }): Promise<AtlasWorkflow | null>;
  saveWorkflow(workflow: AtlasWorkflow): Promise<void>;
  listSteps(scope: { organizationId: string; taskId: string }): Promise<AtlasWorkflowStep[]>;
  appendEvent(event: AtlasWorkflowEvent): Promise<void>;
}
```

Test that recovery chooses `awaiting_approval` over `next`, preserves `blocked_reason`, and returns a concrete `nextAction`.

- [ ] **Step 2: Run RED**

Run: `npx vitest run tests/unit/execution-store.test.ts tests/unit/execution-recovery.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement pure repository contracts and recovery logic**

Do not introduce network access in this package. Keep Supabase transport in the Edge Function adapter in Task 8.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/execution-store.test.ts tests/unit/execution-recovery.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/execution/src tests/unit/execution-store.test.ts tests/unit/execution-recovery.test.ts
git commit -m "feat: add execution persistence contracts and recovery"
```

---

### Task 5: Implement Approval Center policy contracts

**Files:**
- Create: `packages/execution/src/approvals.ts`
- Modify: `packages/execution/src/index.ts`
- Create: `tests/unit/execution-approvals.test.ts`

**Interfaces:**
- Produces: `AtlasRiskClass`, `AtlasApprovalRequest`, `approvalRequiredFor`, `assertApprovalSatisfied`.
- Consumes: `AtlasExecutionClass`, `AtlasPermission`.

- [ ] **Step 1: Write failing approval policy tests**

```ts
import { describe, expect, it } from 'vitest';
import { approvalRequiredFor } from '../../packages/execution/src/index';

describe('approval policy', () => {
  it('does not require approval for observe', () => {
    expect(approvalRequiredFor({ executionClass: 'observe', risk: 'low', estimatedCost: 0 })).toBe(false);
  });
  it('requires approval for regulated execution', () => {
    expect(approvalRequiredFor({ executionClass: 'execute', risk: 'regulated', estimatedCost: 0 })).toBe(true);
  });
  it('requires approval when budget policy says spend exceeds threshold', () => {
    expect(approvalRequiredFor({ executionClass: 'execute', risk: 'moderate', estimatedCost: 25, approvalCostThreshold: 10 })).toBe(true);
  });
});
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run tests/unit/execution-approvals.test.ts`

- [ ] **Step 3: Implement approval policy with explicit risk/cost rules**

`high` and `regulated` execution always require explicit approval unless the caller supplies a separately validated preauthorization reference; the core function must not create preauthorization itself.

- [ ] **Step 4: Run tests and commit**

Run: `npx vitest run tests/unit/execution-approvals.test.ts`

```bash
git add packages/execution/src/approvals.ts packages/execution/src/index.ts tests/unit/execution-approvals.test.ts
git commit -m "feat: add universal ATLAS approval policy"
```

---

### Task 6: Add Tool Registry, Provider Registry, Evidence Registry, and cost policy

**Files:**
- Create: `packages/execution/src/tools.ts`
- Create: `packages/execution/src/providers.ts`
- Create: `packages/execution/src/evidence.ts`
- Create: `packages/execution/src/usage.ts`
- Modify: `packages/execution/src/index.ts`
- Create: `tests/unit/execution-tools.test.ts`
- Create: `tests/unit/execution-providers.test.ts`
- Create: `tests/unit/execution-evidence.test.ts`
- Create: `tests/unit/execution-usage.test.ts`

**Interfaces:**
- Produces: `AtlasToolDefinition`, `ToolRegistry`, `AtlasProviderState`, `ProviderRegistry`, `AtlasEvidence`, `verifyEvidenceRequirements`, `AtlasUsageDecision`, `evaluateUsageBudget`.

- [ ] **Step 1: Write failing tool/provider tests**

Require duplicate capability IDs to throw `duplicate_tool`, require provider state `verified` before executable capabilities are returned, and return `provider_unverified` for `configured_unverified`.

- [ ] **Step 2: Write failing evidence/cost tests**

Evidence test: completion requirement `['provider_reference']` is false until a verified evidence record of that type exists.

Usage test: `estimatedCost > remainingBudget` returns `{ allowed: false, reason: 'budget_blocked' }`; no provider call is attempted by this pure policy function.

- [ ] **Step 3: Run RED**

Run: `npx vitest run tests/unit/execution-tools.test.ts tests/unit/execution-providers.test.ts tests/unit/execution-evidence.test.ts tests/unit/execution-usage.test.ts`

- [ ] **Step 4: Implement registries and pure policy functions**

Keep registries deterministic and dependency-injected. No global provider secrets or direct HTTP calls belong in `packages/execution`.

- [ ] **Step 5: Run tests and commit**

```bash
npx vitest run tests/unit/execution-tools.test.ts tests/unit/execution-providers.test.ts tests/unit/execution-evidence.test.ts tests/unit/execution-usage.test.ts
git add packages/execution/src tests/unit/execution-tools.test.ts tests/unit/execution-providers.test.ts tests/unit/execution-evidence.test.ts tests/unit/execution-usage.test.ts
git commit -m "feat: add governed ATLAS execution registries"
```

---

### Task 7: Build the governed Agent Runtime orchestration loop

**Files:**
- Create: `packages/execution/src/runtime.ts`
- Modify: `packages/execution/src/index.ts`
- Create: `tests/unit/execution-runtime.test.ts`

**Interfaces:**
- Produces: `createExecutionRuntime({ store, tools, providers, authorize, approvals, usage, evidence })` and `runtime.runStep(...)`.
- Runtime cycle: `observe → reason/plan input → policy check → tool/provider execution → validate → evidence → event → next state`.

- [ ] **Step 1: Write failing runtime tests using fakes**

Test three cases:
1. `observe` executes with permission and no approval.
2. regulated `execute` returns `approval_required` and never calls the tool before approval.
3. tool result without required evidence leaves workflow non-completed.

- [ ] **Step 2: Run RED**

Run: `npx vitest run tests/unit/execution-runtime.test.ts`

- [ ] **Step 3: Implement the minimal runtime**

The model/runtime may choose a registered tool ID, but `runtime.runStep` must independently enforce permission, provider state, usage budget, approval status, idempotency metadata, and evidence requirements before state transition.

Never auto-retry `ambiguous_external_result`.

- [ ] **Step 4: Run tests and full unit suite**

Run: `npm run test:unit`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/execution/src/runtime.ts packages/execution/src/index.ts tests/unit/execution-runtime.test.ts
git commit -m "feat: add governed ATLAS agent runtime"
```

---

### Task 8: Expose authenticated execution APIs through Supabase Edge Function

**Files:**
- Create: `supabase/functions/atlas-execution/index.ts`
- Create: `supabase/functions/atlas-execution/atlas-execution-auth.mjs`
- Create: `supabase/functions/atlas-execution/atlas-execution-store.mjs`
- Create: `tests/integration/atlas-execution-api.test.ts`

**Interfaces:**
- Routes: `?api=status`, `?api=workflows`, `?api=workflow`, `?api=create`, `?api=advance`, `?api=approve`, `?api=deny`.
- Mutating endpoints accept organization scope from authenticated context, not from an untrusted body alone.
- Produces normalized errors with `trace_id` and canonical error codes.

- [ ] **Step 1: Write failing API contract tests**

Static/injected-handler tests must prove:
- unauthenticated mutations return `unauthenticated`;
- organization membership is resolved server-side;
- `approve` requires `workflow.approve`;
- `status` does not claim any provider is verified unless registry/probe state says so;
- errors never echo authorization headers or secrets.

- [ ] **Step 2: Run RED**

Run: `npx vitest run tests/integration/atlas-execution-api.test.ts`

- [ ] **Step 3: Implement auth/store adapters following existing `atlas-copilot` patterns**

Reuse the repository's Supabase URL/publishable-key/auth-context pattern, but do not expose `SUPABASE_SERVICE_ROLE_KEY` to browser code. The store adapter performs table mutations only after the runtime has authorized the action.

- [ ] **Step 4: Implement status/read/mutation handlers**

Every mutation appends an `atlas_workflow_events` row carrying `trace_id`, actor, authorization result, approval state, result state, and redacted evidence references.

- [ ] **Step 5: Run integration tests**

Run: `npm run test:integration`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/atlas-execution tests/integration/atlas-execution-api.test.ts
git commit -m "feat: expose ATLAS universal execution API"
```

---

### Task 9: Add Approval Center and resumable workflow progress to the existing web shell

**Files:**
- Create: `apps/web/src/modules/execution/ExecutionApi.ts`
- Create: `apps/web/src/modules/execution/ApprovalCenterPage.tsx`
- Create: `apps/web/src/modules/execution/WorkflowProgressPage.tsx`
- Create: `apps/web/src/modules/execution/execution.css`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/AtlasShell.tsx`
- Create: `tests/integration/atlas-approval-center-route.test.tsx`
- Create: `tests/integration/atlas-workflow-progress-route.test.tsx`

**Interfaces:**
- Routes: `/approvals`, `/workflows/:taskId`.
- UI states map exactly to `now`, `next`, `blocked`, `awaiting_approval`, `completed` plus terminal `failed/cancelled`.
- Approval mutation buttons are disabled while submitting and display backend error text without fabricating success.

- [ ] **Step 1: Write failing route/UI tests**

Approval Center test must render a pending request with action summary, risk class, intended external effect, and Approve/Deny controls; it must not render raw secret fields.

Workflow Progress test must render current step, exact blocker when blocked, evidence count, and next action; a workflow cannot display “Completed” when backend state is not `completed`.

- [ ] **Step 2: Run RED**

Run: `npx vitest run tests/integration/atlas-approval-center-route.test.tsx tests/integration/atlas-workflow-progress-route.test.tsx`

- [ ] **Step 3: Implement a typed browser client**

`ExecutionApi.ts` sends the authenticated session request to `/functions/v1/atlas-execution`; no service-role key, provider secret, or unrestricted mutation token is embedded.

- [ ] **Step 4: Implement pages and navigation**

Add `Approval Center` to `AtlasShell` navigation and identity-gate both routes in `App.tsx` with `RequireAtlasIdentity`.

- [ ] **Step 5: Run route tests, typecheck, and build**

Run:

```bash
npm run test:integration
npm run typecheck
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/modules/execution apps/web/src/App.tsx apps/web/src/components/AtlasShell.tsx tests/integration/atlas-approval-center-route.test.tsx tests/integration/atlas-workflow-progress-route.test.tsx
git commit -m "feat: add ATLAS approval and workflow progress surfaces"
```

---

### Task 10: Core milestone verification, security assertions, and adoption handoff

**Files:**
- Create: `tests/integration/atlas-universal-execution-flow.test.ts`
- Create: `tests/integration/atlas-universal-execution-security.test.ts`
- Create: `docs/superpowers/handoffs/2026-09-12-atlas-universal-execution-sdd-handoff.md`

**Interfaces:**
- Verifies the core path: workflow create → blocked/approval → approve → execute fake tool → validate evidence → completed.
- Verifies cross-organization access is rejected by policy/API contracts.
- Handoff records exact follow-on plan order without implementing dependent modules.

- [ ] **Step 1: Write end-to-end integration test with only fakes/local state**

Use a fake provider/tool with zero external calls. Assert event order includes authorization, approval, execution, validation, evidence, completion and one stable `trace_id`.

- [ ] **Step 2: Write security assertions**

Prove an actor in organization A cannot read/advance/approve organization B workflow through the API/store boundary. Assert audit metadata excludes `authorization`, `service_role`, `cvv`, `pan`, and `access_token` keys.

- [ ] **Step 3: Run the complete verification pipeline**

Run:

```bash
npm audit --audit-level=high
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

Expected: all commands PASS. Do not claim production readiness because this plan does not deploy.

- [ ] **Step 4: Write the SDD handoff**

The handoff must instruct the executor to use an isolated worktree, TDD, one fresh subagent per task, independent spec review and quality review after each task, final branch review, and no merge/deploy/provider spend without explicit approval.

It must list follow-on implementation plans in this dependency order after Core is verified:
1. Studio Music + Creator Library persistence.
2. Finance Modeling + Document Intelligence.
3. Tax Execution Agent.
4. ATLAS Pay / Wallet & Cards.
5. Weather Context Service.
6. Secondary module adoption and ATLAS Director shared-contract adoption where compatible.

- [ ] **Step 5: Commit verification and handoff**

```bash
git add tests/integration/atlas-universal-execution-flow.test.ts tests/integration/atlas-universal-execution-security.test.ts docs/superpowers/handoffs/2026-09-12-atlas-universal-execution-sdd-handoff.md
git commit -m "test: verify ATLAS universal execution core"
```

## Plan Self-Review

- Spec coverage: Core contracts/state machine, universal RBAC, persistence/RLS, Approval Center, tool/provider registry, evidence/audit/cost policy, Agent Runtime, recovery/resumability, UI progress, canonical errors, traceability and security are all assigned to tasks.
- Scope boundary: Studio Music, Finance Modeling, Document Intelligence, Tax, ATLAS Pay and Weather remain follow-on implementation plans; this avoids mixing independent regulated/provider subsystems into the Core branch.
- Type consistency: `AtlasWorkflowStatus`, `AtlasExecutionClass`, `AtlasPermission`, provider states, risk classes and error strings match the approved design.
- Provider safety: all tests and the implementation milestone use fakes or configuration state only; no paid provider invocation is required.
- Deployment safety: the plan ends at build/test verification and branch review; it does not merge or deploy.
