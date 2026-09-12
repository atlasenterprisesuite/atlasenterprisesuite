# ATLAS Guided Execution Manager Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove Guided Execution with a real, read-only ATLAS Manager workflow that verifies the required GitHub -> Supabase -> Cloudflare -> Production path, records evidence, persists/resumes state, and performs no paid or destructive provider mutation.

**Architecture:** Extend the authenticated `atlas-execution` Edge Function with one bounded operation, `sync_manager_readiness`, that calls the existing authenticated `atlas-infra-status` function using the same user session. Normalize those real readiness results into one persisted execution workflow, tasks, steps, evidence, and audit events. The web launcher starts/resumes the persisted workflow then navigates to the generic `/execution/:workflowId` surface from the Core Web plan.

**Tech Stack:** Supabase Edge Functions (Deno + `@supabase/supabase-js@2`), PostgreSQL/RLS, Web Crypto SHA-256, TypeScript, React Router, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-guided-execution-design.md`

## Global Constraints

- Execute only after `2026-09-12-atlas-guided-execution-core-web.md` is complete and reviewed.
- Reuse `atlas-infra-status`; do not duplicate GitHub, Supabase, Cloudflare, production, or optional Vercel probe logic.
- `sync_manager_readiness` is read-only with respect to external providers; its only mutations are ATLAS execution workflow/evidence/audit persistence.
- The incoming user must pass both execution authorization and the existing ATLAS Manager infrastructure-admin authorization enforced by `atlas-infra-status`.
- `ATLAS_PLATFORM_TENANT_ID` is a server-side non-secret identifier required to create the platform-owned readiness workflow. If absent, return `platform_tenant_not_configured`; never invent a tenant ID.
- Vercel remains optional and must not reduce required-path completion.
- No AWS calls, EC2 resources, provider charges, DNS changes, deployments, secret changes, repair execution, or production mutation.
- No merge or deploy in this plan.
- Every sync writes auditable provenance and never stores provider tokens or raw secret-bearing responses.

## File Map

- `supabase/migrations/20260912_manager_readiness_execution.sql` — one-active-readiness-workflow invariant and query index.
- `supabase/functions/atlas-execution/manager-readiness.ts` — read-only status fetch, normalization, persistence, evidence digesting.
- `supabase/functions/atlas-execution/index.ts` — register/dispatch `sync_manager_readiness`.
- `apps/web/src/execution/api.ts` — `syncManagerReadiness()` client.
- `apps/web/src/execution/ManagerReadinessLauncher.tsx` — authenticated start/resume launcher.
- `apps/web/src/App.tsx` — `/execution/manager/readiness` launcher route.
- `tests/unit/manager-readiness-projection.test.ts` — provider-state -> step/task mapping.
- `tests/integration/manager-readiness-edge-contract.test.ts` — auth, no paid mutation, persistence contract.
- `tests/integration/manager-readiness-route.test.tsx` — launcher -> workflow navigation.

---

### Task 1: Lock the one-active-readiness-workflow persistence invariant

**Files:**
- Create: `supabase/migrations/20260912_manager_readiness_execution.sql`
- Test: `tests/integration/manager-readiness-edge-contract.test.ts`

**Interfaces:**
- Consumes: `execution_workflows` from the Universal Execution Foundation.
- Produces: a partial unique index for one active `manager.infrastructure_readiness` workflow per organization.

- [ ] **Step 1: Write a failing schema contract test**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ATLAS Manager readiness execution schema', () => {
  it('allows only one active readiness workflow per organization', () => {
    const sql = readFileSync('supabase/migrations/20260912_manager_readiness_execution.sql', 'utf8');
    expect(sql).toContain('manager.infrastructure_readiness');
    expect(sql).toContain('create unique index');
    expect(sql).toContain("status not in ('completed','cancelled','discarded')");
  });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/integration/manager-readiness-edge-contract.test.ts
```

- [ ] **Step 3: Add the migration**

```sql
create unique index if not exists execution_manager_readiness_one_active_idx
on public.execution_workflows (org_id, workflow_type)
where workflow_type = 'manager.infrastructure_readiness'
  and status not in ('completed','cancelled','discarded');

create index if not exists execution_manager_readiness_updated_idx
on public.execution_workflows (org_id, updated_at desc)
where workflow_type = 'manager.infrastructure_readiness';
```

- [ ] **Step 4: Run schema test**

```bash
npx vitest run tests/integration/manager-readiness-edge-contract.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260912_manager_readiness_execution.sql tests/integration/manager-readiness-edge-contract.test.ts
git commit -m "feat: constrain manager readiness workflows"
```

---

### Task 2: Build a pure readiness projection from real infrastructure status

**Files:**
- Create: `supabase/functions/atlas-execution/manager-readiness.ts`
- Test: `tests/unit/manager-readiness-projection.test.ts`

**Interfaces:**
- Consumes: normalized result from `atlas-infra-status` containing required provider states and blockers.
- Produces: `projectManagerReadiness(status)` returning task status, fixed step definitions, evidence descriptors, and next action.

- [ ] **Step 1: Write failing projection tests**

```ts
import { describe, expect, it } from 'vitest';
import { projectManagerReadiness } from '../../supabase/functions/atlas-execution/manager-readiness';

describe('manager readiness projection', () => {
  it('completes only required providers that are actually ready', () => {
    const result = projectManagerReadiness({
      status: 'partial',
      providers: {
        github: { status: 'ready', required: true },
        supabase: { status: 'ready', required: true },
        cloudflare: { status: 'not_verified', required: true },
        production: { status: 'ready', required: true },
        vercel: { status: 'not_configured', required: false }
      },
      blockers: [{ provider: 'cloudflare', reason: 'not_verified' }]
    });
    expect(result.taskStatus).toBe('blocked');
    expect(result.steps.find((step) => step.key === 'cloudflare')?.status).toBe('blocked');
    expect(result.steps.find((step) => step.key === 'vercel')?.required).toBe(false);
  });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/unit/manager-readiness-projection.test.ts
```

- [ ] **Step 3: Implement fixed provider projection**

Use exactly these required steps and sequence:

```ts
const REQUIRED_STEPS = [
  { key: 'github', sequence: 1, title: 'Verify canonical GitHub state' },
  { key: 'supabase', sequence: 2, title: 'Verify Supabase control plane' },
  { key: 'cloudflare', sequence: 3, title: 'Verify Cloudflare public edge' },
  { key: 'production', sequence: 4, title: 'Verify public production route' }
] as const;
```

Map provider state to step state:

```ts
function stepStatus(provider: { status: string; required: boolean }) {
  if (!provider.required) return 'completed' as const;
  if (['ready', 'verified', 'connected'].includes(provider.status)) return 'completed' as const;
  return 'blocked' as const;
}
```

Do not treat optional Vercel as a required step. Include its state only as informational evidence.

- [ ] **Step 4: Run projection tests**

```bash
npx vitest run tests/unit/manager-readiness-projection.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/atlas-execution/manager-readiness.ts tests/unit/manager-readiness-projection.test.ts
git commit -m "feat: project manager readiness into execution state"
```

---

### Task 3: Add the authenticated `sync_manager_readiness` server operation

**Files:**
- Modify: `supabase/functions/atlas-execution/index.ts`
- Modify: `supabase/functions/atlas-execution/manager-readiness.ts`
- Test: `tests/integration/manager-readiness-edge-contract.test.ts`

**Interfaces:**
- Consumes: current request authorization, `ATLAS_PLATFORM_TENANT_ID`, `atlas-infra-status`, projection from Task 2.
- Produces: `{ ok: true, workflow_id, state }` after persisting canonical workflow/task/steps/evidence/audit.

- [ ] **Step 1: Extend the Edge contract test**

Assert source contains:

```ts
expect(edgeSource).toContain("'sync_manager_readiness'");
expect(edgeSource).toContain("/functions/v1/atlas-infra-status");
expect(edgeSource).toContain('ATLAS_PLATFORM_TENANT_ID');
expect(edgeSource).not.toContain('ec2.amazonaws.com');
expect(edgeSource).not.toContain('RunInstances');
expect(edgeSource).not.toContain('TerminateInstances');
```

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/integration/manager-readiness-edge-contract.test.ts
```

- [ ] **Step 3: Register the operation**

Add `sync_manager_readiness` to `SUPPORTED_OPERATIONS` and dispatch it after `resolveContext`.

- [ ] **Step 4: Fetch readiness using the same user authorization**

In `manager-readiness.ts`:

```ts
const response = await fetch(`${supabaseUrl}/functions/v1/atlas-infra-status`, {
  method: 'GET',
  headers: {
    apikey: publishableKey,
    authorization: request.headers.get('authorization') || ''
  }
});
if (!response.ok) throw new ManagerReadinessError(`infra_status_${response.status}`, response.status);
const status = await response.json();
```

This preserves the existing `atlas-infra-status` owner/admin/platform-admin check instead of recreating it.

- [ ] **Step 5: Fail closed when platform tenant context is absent**

```ts
const tenantId = Deno.env.get('ATLAS_PLATFORM_TENANT_ID')?.trim() || '';
if (!tenantId) throw new ManagerReadinessError('platform_tenant_not_configured', 503);
```

Do not substitute organization ID or a hard-coded tenant.

- [ ] **Step 6: Find-or-create the active workflow and one readiness task**

Persist:

```ts
workflow_type: 'manager.infrastructure_readiness'
owner_module: 'manager'
current_module: 'manager'
context: { source: 'atlas-infra-status', mutation_policy: 'read_only' }
```

Task:

```ts
title: 'Verify infrastructure readiness'
intent: 'Verify the active ATLAS production path using existing read-only probes'
goal: 'Produce evidence-backed readiness for GitHub, Supabase, Cloudflare, and public production'
permissions_required: ['execution.read']
```

On the partial unique-index race, reload the active workflow rather than creating a second one.

- [ ] **Step 7: Replace readiness steps transactionally at the server boundary**

For the single readiness task, upsert four fixed sequence steps by `(task_id, sequence)` with action types:

```text
verify_github
verify_supabase
verify_cloudflare
verify_production
```

Set only `completed` or `blocked` from the live projection. Set `current_step_id` to the first blocked required step, or the final completed step when all pass. Set task/workflow `completed` only when all four required steps are completed.

- [ ] **Step 8: Run Edge contract tests**

```bash
npx vitest run tests/unit/manager-readiness-projection.test.ts tests/integration/manager-readiness-edge-contract.test.ts
```

- [ ] **Step 9: Commit**

```bash
git add supabase/functions/atlas-execution/index.ts supabase/functions/atlas-execution/manager-readiness.ts tests/unit/manager-readiness-projection.test.ts tests/integration/manager-readiness-edge-contract.test.ts
git commit -m "feat: sync read-only manager readiness workflow"
```

---

### Task 4: Record digest-based evidence and immutable audit provenance

**Files:**
- Modify: `supabase/functions/atlas-execution/manager-readiness.ts`
- Test: `tests/integration/manager-readiness-edge-contract.test.ts`

**Interfaces:**
- Consumes: live status projection and persisted task/steps.
- Produces: idempotent evidence references and one sync audit event per request correlation ID.

- [ ] **Step 1: Add failing evidence contract assertions**

```ts
expect(source).toContain('crypto.subtle.digest');
expect(source).toContain("kind: 'infra_verification'");
expect(source).toContain("action: 'execution.manager.readiness_synced'");
expect(source).not.toContain('CLOUDFLARE_API_TOKEN');
expect(source).not.toContain('GITHUB_TOKEN');
```

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/integration/manager-readiness-edge-contract.test.ts
```

- [ ] **Step 3: Compute a stable SHA-256 digest from redacted status facts**

Digest only:

```ts
const digestInput = JSON.stringify({
  provider: step.key,
  status: provider.status,
  required: provider.required,
  checkedAt
});
const digestBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(digestInput));
const digest = [...new Uint8Array(digestBuffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
```

Evidence reference:

```ts
`atlas-infra-status:${step.key}:${digest}`
```

Never persist provider tokens, request headers, or raw provider responses in execution evidence.

- [ ] **Step 4: Avoid duplicate evidence for the same step/digest**

Before insert, query by `org_id`, `task_id`, `step_id`, `kind='infra_verification'`, and exact reference. Insert only when absent.

- [ ] **Step 5: Append audit**

Use existing `appendAudit` with action `execution.manager.readiness_synced`, previous/resulting task state, evidence IDs written/observed, and the request correlation ID.

- [ ] **Step 6: Run tests and commit**

```bash
npx vitest run tests/integration/manager-readiness-edge-contract.test.ts
git add supabase/functions/atlas-execution/manager-readiness.ts tests/integration/manager-readiness-edge-contract.test.ts
git commit -m "feat: record manager readiness evidence"
```

---

### Task 5: Add the web start/resume launcher and navigate to the generic Guided Execution route

**Files:**
- Modify: `apps/web/src/execution/api.ts`
- Create: `apps/web/src/execution/ManagerReadinessLauncher.tsx`
- Modify: `apps/web/src/App.tsx`
- Test: `tests/integration/manager-readiness-route.test.tsx`

**Interfaces:**
- Consumes: `sync_manager_readiness` server operation.
- Produces: `/execution/manager/readiness` -> `/execution/:workflowId` navigation.

- [ ] **Step 1: Write failing launcher test**

```tsx
it('syncs the real readiness workflow then navigates to its persisted workflow id', async () => {
  vi.mocked(syncManagerReadiness).mockResolvedValue({ workflowId: 'wf-manager-1' });
  render(<MemoryRouter initialEntries={['/execution/manager/readiness']}><App /></MemoryRouter>);
  expect(await screen.findByText('Verifying infrastructure readiness')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/execution/wf-manager-1'));
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/integration/manager-readiness-route.test.tsx
```

- [ ] **Step 3: Add `syncManagerReadiness()`**

```ts
export async function syncManagerReadiness() {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/functions/v1/atlas-execution', {
    method: 'POST',
    body: JSON.stringify({
      operation: 'sync_manager_readiness',
      organization_id: organization.id
    })
  });
  const data = await parseExecutionResponse(response);
  if (!data.workflow_id) throw new Error('manager_readiness_workflow_missing');
  return { workflowId: String(data.workflow_id) };
}
```

- [ ] **Step 4: Implement launcher**

On mount call `syncManagerReadiness()`. While waiting, render `aria-busy=true` and `Verifying infrastructure readiness`. On success navigate with `replace: true`. On failure render the exact truthful dependency (`platform_tenant_not_configured`, `infrastructure_admin_required`, provider/status failure) and a Retry button.

- [ ] **Step 5: Add protected route before the dynamic workflow route**

```tsx
<Route
  path="/execution/manager/readiness"
  element={<RequireAtlasIdentity><ManagerReadinessLauncher /></RequireAtlasIdentity>}
/>
```

- [ ] **Step 6: Run route tests and commit**

```bash
npx vitest run tests/integration/manager-readiness-route.test.tsx tests/integration/guided-execution-route.test.tsx
git add apps/web/src/execution/api.ts apps/web/src/execution/ManagerReadinessLauncher.tsx apps/web/src/App.tsx tests/integration/manager-readiness-route.test.tsx
git commit -m "feat: launch manager readiness Guided Execution"
```

---

### Task 6: Verify the pilot cannot mutate providers or create false readiness

**Files:**
- Modify: `tests/unit/manager-readiness-projection.test.ts`
- Modify: `tests/integration/manager-readiness-edge-contract.test.ts`
- Create: `tests/integration/manager-readiness-no-mutation.test.ts`

**Interfaces:**
- Consumes: complete manager pilot.
- Produces: safety evidence that only read-only status probing plus internal execution persistence occur.

- [ ] **Step 1: Assert optional providers never enter the completion denominator**

```ts
it('does not block completion on optional Vercel state', () => {
  const result = projectManagerReadiness(makeStatus({ requiredReady: true, vercel: 'not_configured' }));
  expect(result.taskStatus).toBe('completed');
});
```

- [ ] **Step 2: Assert external methods are read-only**

Read `atlas-infra-status` and manager readiness source files and assert there is no AWS API host, EC2 SDK call, Cloudflare mutation method, GitHub mutation endpoint, deployment trigger, or Vercel deployment call introduced by this feature. The readiness call itself must be GET.

- [ ] **Step 3: Assert incomplete evidence cannot become completed**

Feed a `cloudflare.status='authorization_error'` or `production.status='public_site_unreachable'` projection and assert workflow/task state is `blocked`, not `completed`.

- [ ] **Step 4: Run pilot test set**

```bash
npx vitest run tests/unit/manager-readiness-projection.test.ts tests/integration/manager-readiness-edge-contract.test.ts tests/integration/manager-readiness-route.test.tsx tests/integration/manager-readiness-no-mutation.test.ts
```

- [ ] **Step 5: Run full verification**

```bash
npm run typecheck
npm test
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add tests/unit/manager-readiness-projection.test.ts tests/integration/manager-readiness-edge-contract.test.ts tests/integration/manager-readiness-no-mutation.test.ts
git commit -m "test: prove manager readiness is read-only"
```

## Completion Gate

The manager pilot is complete only when a permitted user can start/resume the same persisted readiness workflow, every required provider step reflects real `atlas-infra-status` evidence, blocked providers remain blocked, optional Vercel does not reduce readiness, refresh returns the same workflow, audit/evidence provenance exists, and no provider mutation/paid call/production deployment occurs.
