# ATLAS Guided Execution Manager Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove Guided Execution with a real, read-only ATLAS Manager workflow that verifies the required GitHub -> Supabase -> Cloudflare -> Production path, records provider-specific evidence, persists/resumes state, and performs no paid or destructive provider mutation.

**Architecture:** Extend the authenticated `atlas-execution` Edge Function with one bounded operation, `sync_manager_readiness`, that calls the existing authenticated `atlas-infra-status` function using the same user session. Consume its current response contract (`provider_status` entries with `{ state, required }`) rather than duplicating provider probes. Project those real facts into one persisted execution workflow, one task, four required steps, provider-specific evidence, and immutable audit events. The web launcher starts/resumes the persisted workflow then navigates to the generic `/execution/:workflowId` surface.

**Tech Stack:** Supabase Edge Functions (Deno + `@supabase/supabase-js@2`), PostgreSQL/RLS, Web Crypto SHA-256, TypeScript, React Router, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-guided-execution-design.md`

## Global Constraints

- Execute only after `2026-09-12-atlas-guided-execution-core-web.md` is complete and independently reviewed.
- Reuse `atlas-infra-status`; do not duplicate GitHub, Supabase, Cloudflare, production, or optional Vercel probe logic.
- `sync_manager_readiness` is read-only with respect to external providers; its only mutations are ATLAS execution workflow/step/evidence/audit persistence.
- The incoming user must pass both execution authorization and the existing ATLAS Manager infrastructure-admin authorization enforced by `atlas-infra-status`.
- `ATLAS_PLATFORM_TENANT_ID` is a server-side non-secret identifier used only when creating a new platform readiness workflow. If no active readiness workflow exists and this identifier is absent, return `platform_tenant_not_configured`; never substitute organization ID or invent a tenant.
- Existing active readiness workflows keep their persisted `tenant_id`; do not rewrite it from environment changes.
- Vercel remains optional and is informational only; it never enters the required-step denominator.
- No AWS calls, EC2 resources, provider charges, DNS changes, deployments, secret changes, repair execution, or production mutation.
- No merge or deploy in this plan.
- Every sync preserves audit provenance and never stores provider tokens, request authorization headers, or raw secret-bearing provider responses.
- Task status transitions must respect the existing `@atlas/execution` state machine. A blocked readiness task may not jump directly to `completed`.
- Completion must use provider-specific verified evidence so one provider's evidence cannot satisfy another provider's step.

## File Map

- `supabase/migrations/20260912_manager_readiness_execution.sql` — one-active-readiness-workflow invariant and query index.
- `supabase/functions/atlas-execution/manager-readiness.ts` — response-contract validation, pure projection, evidence digest helpers, sync orchestration dependencies.
- `supabase/functions/atlas-execution/index.ts` — register/dispatch `sync_manager_readiness` and pass existing auth/admin/audit helpers.
- `apps/web/src/execution/api.ts` — `syncManagerReadiness()` client.
- `apps/web/src/execution/ManagerReadinessLauncher.tsx` — authenticated start/resume launcher.
- `apps/web/src/App.tsx` — `/execution/manager/readiness` launcher route.
- `tests/unit/manager-readiness-projection.test.ts` — current infra-status contract -> step/task mapping.
- `tests/integration/manager-readiness-edge-contract.test.ts` — auth, state-machine, evidence, no-paid-mutation source contract.
- `tests/integration/manager-readiness-route.test.tsx` — launcher -> persisted workflow navigation.
- `tests/integration/manager-readiness-no-mutation.test.ts` — external read-only guarantee.

---

### Task 1: Lock the one-active-readiness-workflow persistence invariant

**Files:**
- Create: `supabase/migrations/20260912_manager_readiness_execution.sql`
- Test: `tests/integration/manager-readiness-edge-contract.test.ts`

**Interfaces:**
- Consumes: `execution_workflows` from Universal Execution Foundation.
- Produces: one active `manager.infrastructure_readiness` workflow per organization; completed/cancelled/discarded workflows remain historical.

- [ ] **Step 1: Write the failing schema contract test**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

it('permits only one active readiness workflow per organization', () => {
  const sql = readFileSync('supabase/migrations/20260912_manager_readiness_execution.sql', 'utf8');
  expect(sql).toContain('manager.infrastructure_readiness');
  expect(sql).toContain('create unique index');
  expect(sql).toContain("status not in ('completed','cancelled','discarded')");
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

- [ ] **Step 4: Run schema test and commit**

```bash
npx vitest run tests/integration/manager-readiness-edge-contract.test.ts
git add supabase/migrations/20260912_manager_readiness_execution.sql tests/integration/manager-readiness-edge-contract.test.ts
git commit -m "feat: constrain manager readiness workflows"
```

---

### Task 2: Validate the existing `atlas-infra-status` response and build a pure readiness projection

**Files:**
- Create: `supabase/functions/atlas-execution/manager-readiness.ts`
- Test: `tests/unit/manager-readiness-projection.test.ts`

**Interfaces:**
- Consumes: current `atlas-infra-status` response field `provider_status` where providers contain `{ state: string, required: boolean }`.
- Produces: `normalizeManagerInfraStatus(raw)` and `projectManagerReadiness(status)`.

- [ ] **Step 1: Write failing response-contract tests**

```ts
import { describe, expect, it } from 'vitest';
import { normalizeManagerInfraStatus, projectManagerReadiness } from '../../supabase/functions/atlas-execution/manager-readiness';

const raw = {
  ok: true,
  provider_status: {
    github: { state: 'ready', required: true },
    supabase: { state: 'ready', required: true },
    cloudflare: { state: 'authorization_error', required: true },
    production: { state: 'ready', required: true },
    vercel: { state: 'optional_provider_unconfigured', required: false }
  },
  blockers: [{ stage: 'cloudflare', code: 'authorization_error', detail: 'Cloudflare is not verified.' }]
};

it('uses provider_status.state from the existing infra-status contract', () => {
  const projected = projectManagerReadiness(normalizeManagerInfraStatus(raw));
  expect(projected.taskStatus).toBe('blocked');
  expect(projected.steps.find((step) => step.key === 'cloudflare')?.status).toBe('blocked');
  expect(projected.optionalProviders.vercel.state).toBe('optional_provider_unconfigured');
});

it('fails closed when a required provider entry is missing', () => {
  expect(() => normalizeManagerInfraStatus({ ok: true, provider_status: {} }))
    .toThrow('infra_status_contract_invalid');
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/unit/manager-readiness-projection.test.ts
```

- [ ] **Step 3: Implement strict normalization**

Required provider names are exactly `github`, `supabase`, `cloudflare`, `production`. Each must exist with non-empty string `state` and `required === true`. `vercel` may exist and must be treated as optional regardless of its readiness state. If the response violates these invariants, throw `infra_status_contract_invalid` rather than inventing provider state.

- [ ] **Step 4: Implement fixed required steps**

```ts
export const REQUIRED_MANAGER_STEPS = [
  { key: 'github', sequence: 1, actionType: 'verify_github', title: 'Verify canonical GitHub state', evidenceKind: 'infra_verification.github' },
  { key: 'supabase', sequence: 2, actionType: 'verify_supabase', title: 'Verify Supabase control plane', evidenceKind: 'infra_verification.supabase' },
  { key: 'cloudflare', sequence: 3, actionType: 'verify_cloudflare', title: 'Verify Cloudflare public edge', evidenceKind: 'infra_verification.cloudflare' },
  { key: 'production', sequence: 4, actionType: 'verify_production', title: 'Verify public production route', evidenceKind: 'infra_verification.production' }
] as const;
```

Map each required provider:

```ts
const status = provider.state === 'ready' ? 'completed' : 'blocked';
```

Do not treat `verified`/`connected` aliases as ready because the shared current infrastructure evaluator defines readiness specifically as `state === 'ready'`.

Task projection is `completed` only when all four required steps are completed; otherwise `blocked`. `nextAction` is the title of the first blocked required step or `null` when complete. `blockedReason` comes from the matching blocker code when available, otherwise the provider's exact state.

- [ ] **Step 5: Run tests and commit**

```bash
npx vitest run tests/unit/manager-readiness-projection.test.ts
git add supabase/functions/atlas-execution/manager-readiness.ts tests/unit/manager-readiness-projection.test.ts
git commit -m "feat: project manager readiness from infra status"
```

---

### Task 3: Add authenticated `sync_manager_readiness` without bypassing execution transitions

**Files:**
- Modify: `supabase/functions/atlas-execution/index.ts`
- Modify: `supabase/functions/atlas-execution/manager-readiness.ts`
- Test: `tests/integration/manager-readiness-edge-contract.test.ts`

**Interfaces:**
- Consumes: resolved execution context, same user Authorization header, `ATLAS_PLATFORM_TENANT_ID`, `atlas-infra-status`, `canTransitionTask`, `evaluateTaskCompletion`, existing `appendAudit` callback.
- Produces: `{ ok: true, workflow_id, state }` after idempotent persistence.

- [ ] **Step 1: Extend failing Edge source-contract assertions**

```ts
expect(edgeSource).toContain("'sync_manager_readiness'");
expect(managerSource).toContain('/functions/v1/atlas-infra-status');
expect(managerSource).toContain('ATLAS_PLATFORM_TENANT_ID');
expect(managerSource).toContain('evaluateTaskCompletion');
expect(managerSource).not.toContain('ec2.amazonaws.com');
expect(managerSource).not.toContain('RunInstances');
expect(managerSource).not.toContain('TerminateInstances');
```

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/integration/manager-readiness-edge-contract.test.ts
```

- [ ] **Step 3: Register and dispatch the operation**

Add `sync_manager_readiness` to `SUPPORTED_OPERATIONS`. Keep `resolveContext(req, orgId)` in `index.ts`, then call the manager module with an explicit dependency object containing `req`, `context`, `requestId`, `admin`, Supabase URL/publishable key, and an audit callback wrapping the existing `appendAudit`. Do not export service-role credentials or duplicate the general auth resolver.

- [ ] **Step 4: Call `atlas-infra-status` with the same user authorization**

```ts
const response = await fetch(`${supabaseUrl}/functions/v1/atlas-infra-status`, {
  method: 'GET',
  headers: {
    apikey: publishableKey,
    authorization: req.headers.get('authorization') || ''
  }
});
if (!response.ok) throw new ManagerReadinessError(`infra_status_${response.status}`, response.status);
const status = normalizeManagerInfraStatus(await response.json());
```

This preserves the existing `atlas-infra-status` owner/admin/platform-admin check.

- [ ] **Step 5: Find the active workflow before requiring creation context**

Query the latest active `manager.infrastructure_readiness` workflow for `context.orgId`. If found, use its persisted `tenant_id`. Only when none exists read:

```ts
const tenantId = Deno.env.get('ATLAS_PLATFORM_TENANT_ID')?.trim() || '';
if (!tenantId) throw new ManagerReadinessError('platform_tenant_not_configured', 503);
```

Create a workflow initially as `now` with:

```ts
workflow_type: 'manager.infrastructure_readiness',
owner_module: 'manager',
current_module: 'manager',
context: { source: 'atlas-infra-status', mutation_policy: 'read_only', return_path: '/' }
```

On a partial-unique-index race, reload the active workflow instead of creating a duplicate.

- [ ] **Step 6: Find-or-create one readiness task in legal `now` state**

Use:

```ts
title: 'Verify infrastructure readiness',
intent: 'Verify the active ATLAS production path using existing read-only probes',
goal: 'Produce evidence-backed readiness for GitHub, Supabase, Cloudflare, and public production',
permissions_required: ['execution.read']
```

If an existing active task is `blocked`, first perform and audit the legal `blocked -> now` transition before recalculating. Never jump `blocked -> completed`.

- [ ] **Step 7: Upsert four fixed steps idempotently**

Upsert by `(task_id, sequence)`. For each required provider set `status` to `completed` only when its state is exactly `ready`; otherwise `blocked`. Set its single evidence requirement to the provider-specific `evidenceKind` from Task 2. Set `current_step_id` to the first blocked step; when all are ready, set it to the final completed step.

Do not describe this multi-call Supabase sequence as a database transaction. The sync is idempotent: if a persistence call fails, return an error and the next sync reconciles the same fixed rows rather than fabricating completion.

- [ ] **Step 8: Gate final task completion through existing evaluation**

After evidence from Task 4 is present, call `evaluateTaskCompletion` with all four steps, their provider-specific evidence, approvals (none required for this read-only pilot), and unresolved dependencies. If not eligible, task/workflow become or remain `blocked`. If eligible, ensure task is `now`, verify `canTransitionTask('now','completed')`, then write `completed`. Mirror workflow state only after task state succeeds.

- [ ] **Step 9: Run Edge contract tests and commit**

```bash
npx vitest run tests/unit/manager-readiness-projection.test.ts tests/integration/manager-readiness-edge-contract.test.ts
git add supabase/functions/atlas-execution/index.ts supabase/functions/atlas-execution/manager-readiness.ts tests/integration/manager-readiness-edge-contract.test.ts
git commit -m "feat: sync read-only manager readiness workflow"
```

---

### Task 4: Record provider-specific digest evidence and immutable audit provenance

**Files:**
- Modify: `supabase/functions/atlas-execution/manager-readiness.ts`
- Test: `tests/integration/manager-readiness-edge-contract.test.ts`

**Interfaces:**
- Consumes: normalized live provider facts and persisted fixed steps.
- Produces: one provider-specific evidence kind/reference per observed provider state and sync audit provenance.

- [ ] **Step 1: Add failing evidence assertions**

```ts
expect(source).toContain('crypto.subtle.digest');
expect(source).toContain('infra_verification.github');
expect(source).toContain('infra_verification.cloudflare');
expect(source).toContain('execution.manager.readiness_synced');
expect(source).not.toContain('CLOUDFLARE_API_TOKEN');
expect(source).not.toContain('GITHUB_TOKEN');
```

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/integration/manager-readiness-edge-contract.test.ts
```

- [ ] **Step 3: Build redacted SHA-256 evidence references**

For one sync timestamp `checkedAt`, digest only:

```ts
const digestInput = JSON.stringify({ provider: step.key, state: provider.state, required: true, checkedAt });
const digestBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(digestInput));
const digest = [...new Uint8Array(digestBuffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
const reference = `atlas-infra-status:${step.key}:${digest}`;
```

Persist evidence with `kind=step.evidenceKind` and `verified = provider.state === 'ready'`. A blocked observation is still evidence of the observed state, but it is not verified completion evidence.

- [ ] **Step 4: Avoid exact duplicate evidence**

Before insert, query exact `(org_id, task_id, step_id, kind, reference)`. Repeated later syncs may intentionally create new timestamped evidence; exact duplicate requests do not.

- [ ] **Step 5: Re-evaluate completion only after all evidence writes finish**

Call the completion gate described in Task 3 after evidence persistence. This sequencing prevents a ready step set from being marked completed before its required evidence exists.

- [ ] **Step 6: Append immutable audit provenance**

Use the callback supplied from `index.ts` to append `execution.manager.readiness_synced` with workflow/task IDs, previous/resulting task state, evidence IDs observed/written, and the request correlation ID. If a legal `blocked -> now -> completed` recovery occurred, retain enough audit entries to reconstruct both transitions; do not compress them into a false direct `blocked -> completed` event.

- [ ] **Step 7: Run tests and commit**

```bash
npx vitest run tests/integration/manager-readiness-edge-contract.test.ts
git add supabase/functions/atlas-execution/manager-readiness.ts tests/integration/manager-readiness-edge-contract.test.ts
git commit -m "feat: record manager readiness evidence"
```

---

### Task 5: Add the web start/resume launcher and navigate to generic Guided Execution

**Files:**
- Modify: `apps/web/src/execution/api.ts`
- Create: `apps/web/src/execution/ManagerReadinessLauncher.tsx`
- Modify: `apps/web/src/App.tsx`
- Test: `tests/integration/manager-readiness-route.test.tsx`

**Interfaces:**
- Consumes: `sync_manager_readiness`.
- Produces: `/execution/manager/readiness` -> `/execution/:workflowId` navigation.

- [ ] **Step 1: Write a failing launcher test with an explicit location probe**

In the test file define:

```tsx
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}
```

Then:

```tsx
vi.mocked(syncManagerReadiness).mockResolvedValue({ workflowId: 'wf-manager-1' });
render(<MemoryRouter initialEntries={['/execution/manager/readiness']}><App /><LocationProbe /></MemoryRouter>);
expect(await screen.findByText('Verifying infrastructure readiness')).toBeInTheDocument();
await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/execution/wf-manager-1'));
```

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run tests/integration/manager-readiness-route.test.tsx
```

- [ ] **Step 3: Implement `syncManagerReadiness()`**

```ts
export async function syncManagerReadiness() {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/functions/v1/atlas-execution', {
    method: 'POST',
    body: JSON.stringify({ operation: 'sync_manager_readiness', organization_id: organization.id })
  });
  const data = await parseExecutionResponse(response);
  if (!data.workflow_id) throw new Error('manager_readiness_workflow_missing');
  return { workflowId: String(data.workflow_id) };
}
```

- [ ] **Step 4: Implement launcher**

On mount call `syncManagerReadiness()`. While waiting render `aria-busy="true"` and `Verifying infrastructure readiness`. On success navigate with `{ replace: true }`. On failure show the exact error (`platform_tenant_not_configured`, `infrastructure_admin_required`, `infra_status_*`, `infra_status_contract_invalid`) plus Retry. Do not translate a provider error into a fake successful workflow.

- [ ] **Step 5: Add protected launcher route before the dynamic workflow route**

```tsx
<Route path="/execution/manager/readiness" element={<RequireAtlasIdentity><ManagerReadinessLauncher /></RequireAtlasIdentity>} />
```

React Router ranking should prefer the static route, but keep the declaration adjacent to `/execution/:workflowId` for maintainability.

- [ ] **Step 6: Run tests and commit**

```bash
npx vitest run tests/integration/manager-readiness-route.test.tsx tests/integration/guided-execution-route.test.tsx
git add apps/web/src/execution/api.ts apps/web/src/execution/ManagerReadinessLauncher.tsx apps/web/src/App.tsx tests/integration/manager-readiness-route.test.tsx
git commit -m "feat: launch manager readiness Guided Execution"
```

---

### Task 6: Prove optional-provider semantics, failure truthfulness, and zero provider mutation

**Files:**
- Modify: `tests/unit/manager-readiness-projection.test.ts`
- Modify: `tests/integration/manager-readiness-edge-contract.test.ts`
- Create: `tests/integration/manager-readiness-no-mutation.test.ts`

**Interfaces:**
- Consumes: complete Manager pilot.
- Produces: safety and correctness evidence.

- [ ] **Step 1: Prove optional Vercel never blocks completion**

Provide all four required `provider_status.*.state='ready'` and Vercel `state='optional_provider_unconfigured', required=false`; expect projected task status `completed`.

- [ ] **Step 2: Prove a required provider failure remains blocked**

Set `cloudflare.state='authorization_error'` or `production.state='public_site_unreachable'`; expect corresponding step and task `blocked`, with no eligible completion.

- [ ] **Step 3: Prove the feature adds no provider mutation calls**

Read `manager-readiness.ts`, `atlas-execution/index.ts`, and the migration. Assert this feature contains no AWS host/EC2 actions, Cloudflare mutation endpoint/method, GitHub write endpoint, Vercel deploy call, deployment trigger, DNS write, secret mutation, or repair execution. The only external readiness request in `manager-readiness.ts` must target `/functions/v1/atlas-infra-status` using `GET`.

- [ ] **Step 4: Run the pilot test set**

```bash
npx vitest run tests/unit/manager-readiness-projection.test.ts tests/integration/manager-readiness-edge-contract.test.ts tests/integration/manager-readiness-route.test.tsx tests/integration/manager-readiness-no-mutation.test.ts
```

- [ ] **Step 5: Run full repository verification**

```bash
npm run typecheck
npm test
npm run build
```

Expected: all PASS. Do not call production or paid-provider endpoints during this verification.

- [ ] **Step 6: Commit**

```bash
git add tests/unit/manager-readiness-projection.test.ts tests/integration/manager-readiness-edge-contract.test.ts tests/integration/manager-readiness-no-mutation.test.ts
git commit -m "test: prove manager readiness is read-only"
```

## Completion Gate

The Manager pilot is ready for review only when a permitted infrastructure admin can start/resume the same active readiness workflow; current `atlas-infra-status.provider_status` facts drive the four required steps; each step has its own evidence kind; blockers remain blocked; recovery follows legal state transitions; optional Vercel never reduces required-path completion; refresh/start-resume preserves canonical workflow identity while active; audit/evidence provenance exists; full verification passes; and no AWS/provider mutation, paid call, merge, or deploy occurred.
