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
- `ATLAS_PLATFORM_TENANT_ID` is a server-side non-secret identifier used only when creating a new readiness workflow. If no active workflow exists and this identifier is absent, return `platform_tenant_not_configured`; never invent a tenant ID.
- Existing active readiness workflows keep their persisted `tenant_id`.
- Vercel is optional and informational only; it never enters the required-step denominator.
- No AWS calls, EC2 resources, provider charges, DNS changes, deployments, secret changes, repair execution, or production mutation.
- No merge or deploy in this plan.
- Task transitions must respect `@atlas/execution`; in particular `blocked -> completed` is forbidden.
- Completion must use one distinct verified evidence kind per required provider.

## File Map

- `supabase/migrations/20260912_manager_readiness_execution.sql`
- `supabase/functions/atlas-execution/manager-readiness.ts`
- `supabase/functions/atlas-execution/index.ts`
- `apps/web/src/execution/api.ts`
- `apps/web/src/execution/ManagerReadinessLauncher.tsx`
- `apps/web/src/App.tsx`
- `tests/unit/manager-readiness-projection.test.ts`
- `tests/integration/manager-readiness-edge-contract.test.ts`
- `tests/integration/manager-readiness-route.test.tsx`
- `tests/integration/manager-readiness-no-mutation.test.ts`

---

### Task 1: Enforce one active readiness workflow per organization

**Files:** Create `supabase/migrations/20260912_manager_readiness_execution.sql`; test `tests/integration/manager-readiness-edge-contract.test.ts`.

- [ ] **Step 1: Write failing schema test**

```ts
const sql = readFileSync('supabase/migrations/20260912_manager_readiness_execution.sql', 'utf8');
expect(sql).toContain('manager.infrastructure_readiness');
expect(sql).toContain('create unique index');
expect(sql).toContain("status not in ('completed','cancelled','discarded')");
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/integration/manager-readiness-edge-contract.test.ts
```

- [ ] **Step 3: Add migration**

```sql
create unique index if not exists execution_manager_readiness_one_active_idx
on public.execution_workflows (org_id, workflow_type)
where workflow_type = 'manager.infrastructure_readiness'
  and status not in ('completed','cancelled','discarded');

create index if not exists execution_manager_readiness_updated_idx
on public.execution_workflows (org_id, updated_at desc)
where workflow_type = 'manager.infrastructure_readiness';
```

- [ ] **Step 4: Verify GREEN and commit**

```bash
npx vitest run tests/integration/manager-readiness-edge-contract.test.ts
git add supabase/migrations/20260912_manager_readiness_execution.sql tests/integration/manager-readiness-edge-contract.test.ts
git commit -m "feat: constrain manager readiness workflows"
```

---

### Task 2: Normalize the current `atlas-infra-status` contract and project required steps

**Files:** Create `supabase/functions/atlas-execution/manager-readiness.ts`; test `tests/unit/manager-readiness-projection.test.ts`.

- [ ] **Step 1: Write failing contract/projection tests**

```ts
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
const projected = projectManagerReadiness(normalizeManagerInfraStatus(raw));
expect(projected.taskStatus).toBe('blocked');
expect(projected.steps.find((step) => step.key === 'cloudflare')?.status).toBe('blocked');
expect(() => normalizeManagerInfraStatus({ ok: true, provider_status: {} })).toThrow('infra_status_contract_invalid');
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/manager-readiness-projection.test.ts
```

- [ ] **Step 3: Implement strict normalizer**

Require exactly usable entries for `github`, `supabase`, `cloudflare`, and `production`: non-empty string `state` and `required === true`. `vercel` is optional. Missing/malformed required entries throw `infra_status_contract_invalid`.

- [ ] **Step 4: Implement fixed provider-specific step definitions**

```ts
export const REQUIRED_MANAGER_STEPS = [
  { key: 'github', sequence: 1, actionType: 'verify_github', title: 'Verify canonical GitHub state', evidenceKind: 'infra_verification.github' },
  { key: 'supabase', sequence: 2, actionType: 'verify_supabase', title: 'Verify Supabase control plane', evidenceKind: 'infra_verification.supabase' },
  { key: 'cloudflare', sequence: 3, actionType: 'verify_cloudflare', title: 'Verify Cloudflare public edge', evidenceKind: 'infra_verification.cloudflare' },
  { key: 'production', sequence: 4, actionType: 'verify_production', title: 'Verify public production route', evidenceKind: 'infra_verification.production' }
] as const;
```

A required step is `completed` only for `provider.state === 'ready'`; otherwise it is `blocked`. `nextAction` is the first blocked title. `blockedReason` uses matching blocker `code` when present, otherwise the exact provider state.

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run tests/unit/manager-readiness-projection.test.ts
git add supabase/functions/atlas-execution/manager-readiness.ts tests/unit/manager-readiness-projection.test.ts
git commit -m "feat: project manager readiness from infra status"
```

---

### Task 3: Add authenticated `sync_manager_readiness` and idempotent workflow/step reconciliation

**Files:** Modify `supabase/functions/atlas-execution/index.ts`, `supabase/functions/atlas-execution/manager-readiness.ts`; test `tests/integration/manager-readiness-edge-contract.test.ts`.

**Important:** Task 3 does **not** mark the readiness task completed yet. Completion is added only in Task 4 after provider-specific evidence exists.

- [ ] **Step 1: Write failing Edge contract assertions**

```ts
expect(edgeSource).toContain("'sync_manager_readiness'");
expect(managerSource).toContain('/functions/v1/atlas-infra-status');
expect(managerSource).toContain('ATLAS_PLATFORM_TENANT_ID');
expect(managerSource).not.toContain('ec2.amazonaws.com');
expect(managerSource).not.toContain('RunInstances');
expect(managerSource).not.toContain('TerminateInstances');
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/integration/manager-readiness-edge-contract.test.ts
```

- [ ] **Step 3: Register/dispatch operation through existing auth context**

Add `sync_manager_readiness` to `SUPPORTED_OPERATIONS`. Keep `resolveContext(req, orgId)` in `index.ts`; pass an explicit dependency object to the manager module containing `req`, resolved `context`, `requestId`, `adminClient()`, Supabase URL/publishable key, and an audit callback wrapping existing `appendAudit`. Do not duplicate auth or expose service-role credentials.

- [ ] **Step 4: Call existing status function using the same user session**

```ts
const response = await fetch(`${supabaseUrl}/functions/v1/atlas-infra-status`, {
  method: 'GET',
  headers: { apikey: publishableKey, authorization: req.headers.get('authorization') || '' }
});
if (!response.ok) throw new ManagerReadinessError(`infra_status_${response.status}`, response.status);
const status = normalizeManagerInfraStatus(await response.json());
```

- [ ] **Step 5: Find existing active workflow before creation**

If an active `manager.infrastructure_readiness` workflow exists for `context.orgId`, use its persisted `tenant_id`. Otherwise require non-empty `ATLAS_PLATFORM_TENANT_ID`; create workflow in `now` with:

```ts
{
  workflow_type: 'manager.infrastructure_readiness', owner_module: 'manager', current_module: 'manager',
  context: { source: 'atlas-infra-status', mutation_policy: 'read_only', return_path: '/' }
}
```

On partial-unique-index conflict, reload the active workflow.

- [ ] **Step 6: Find/create one readiness task and normalize legal active state**

Task fields:

```ts
{
  title: 'Verify infrastructure readiness',
  intent: 'Verify the active ATLAS production path using existing read-only probes',
  goal: 'Produce evidence-backed readiness for GitHub, Supabase, Cloudflare, and public production',
  permissions_required: ['execution.read']
}
```

If existing task is `blocked`, perform/audit legal `blocked -> now` before reconciling. Completed historical workflows are not active and therefore get a new workflow on a later readiness run.

- [ ] **Step 7: Upsert four fixed steps idempotently**

Upsert `(task_id, sequence)` with action type/status/provider-specific `evidence_requirement`. Set `current_step_id` to first blocked required step, or step 4 when all four are ready. Do not claim a SQL transaction: if a persistence call fails, return an error; next sync reconciles the same fixed rows.

Until Task 4 exists, leave task/workflow as `blocked` whenever any provider is blocked, and as `now` when all four provider states are ready but completion evidence has not yet been evaluated.

- [ ] **Step 8: Verify and commit**

```bash
npx vitest run tests/unit/manager-readiness-projection.test.ts tests/integration/manager-readiness-edge-contract.test.ts
git add supabase/functions/atlas-execution/index.ts supabase/functions/atlas-execution/manager-readiness.ts tests/integration/manager-readiness-edge-contract.test.ts
git commit -m "feat: sync read-only manager readiness workflow"
```

---

### Task 4: Record provider-specific evidence, evaluate completion, and audit legal transitions

**Files:** Modify `supabase/functions/atlas-execution/manager-readiness.ts`; test `tests/integration/manager-readiness-edge-contract.test.ts`.

- [ ] **Step 1: Write failing evidence/completion assertions**

```ts
expect(source).toContain('crypto.subtle.digest');
expect(source).toContain('infra_verification.github');
expect(source).toContain('infra_verification.cloudflare');
expect(source).toContain('evaluateTaskCompletion');
expect(source).toContain('execution.manager.readiness_synced');
expect(source).not.toContain('CLOUDFLARE_API_TOKEN');
expect(source).not.toContain('GITHUB_TOKEN');
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/integration/manager-readiness-edge-contract.test.ts
```

- [ ] **Step 3: Persist redacted provider-specific evidence**

Use one `checkedAt` per sync. For each required step:

```ts
const digestInput = JSON.stringify({ provider: step.key, state: provider.state, required: true, checkedAt });
const digestBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(digestInput));
const digest = [...new Uint8Array(digestBuffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
const reference = `atlas-infra-status:${step.key}:${digest}`;
```

Persist `kind=step.evidenceKind` and `verified=(provider.state === 'ready')`. Before insert, reject exact duplicate `(org_id, task_id, step_id, kind, reference)`. Never persist auth headers/tokens/raw provider responses.

- [ ] **Step 4: Evaluate completion only after evidence writes finish**

Call `evaluateTaskCompletion` with the four current steps, provider-specific evidence, no approvals for this read-only pilot, and unresolved dependencies. If ineligible, task/workflow becomes/remains `blocked` and shows the projected reason. If eligible, ensure task is `now`, assert `canTransitionTask('now','completed')`, then update task to `completed`; only after task success mirror workflow `completed`.

If a previous sync had task `blocked` and the new sync is healthy, the operation must already have audited `blocked -> now` from Task 3 before this `now -> completed` transition. Never record a synthetic direct `blocked -> completed` event.

- [ ] **Step 5: Append immutable sync/transition audit events**

Use the existing callback from `index.ts` with workflow/task IDs, previous/resulting states, evidence IDs, request correlation ID, and action `execution.manager.readiness_synced` plus explicit transition events where state changed.

- [ ] **Step 6: Verify and commit**

```bash
npx vitest run tests/integration/manager-readiness-edge-contract.test.ts
git add supabase/functions/atlas-execution/manager-readiness.ts tests/integration/manager-readiness-edge-contract.test.ts
git commit -m "feat: record and verify manager readiness evidence"
```

---

### Task 5: Add authenticated web launcher and navigate to the generic workflow route

**Files:** Modify `apps/web/src/execution/api.ts`, create `apps/web/src/execution/ManagerReadinessLauncher.tsx`, modify `apps/web/src/App.tsx`; test `tests/integration/manager-readiness-route.test.tsx`.

- [ ] **Step 1: Write failing launcher test with explicit location probe**

```tsx
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}
```

Mock `syncManagerReadiness()` to return `{ workflowId:'wf-manager-1' }`, render `/execution/manager/readiness`, and assert navigation to `/execution/wf-manager-1`.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/integration/manager-readiness-route.test.tsx
```

- [ ] **Step 3: Implement client**

Use the exported `parseExecutionResponse` from Core Web:

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

- [ ] **Step 4: Implement launcher and protected route**

On mount sync; while waiting render `aria-busy="true"` + `Verifying infrastructure readiness`; success uses `navigate('/execution/'+workflowId,{replace:true})`; failure shows exact error plus Retry. Add static `/execution/manager/readiness` route adjacent to and before `/execution/:workflowId`, wrapped in `RequireAtlasIdentity`.

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run tests/integration/manager-readiness-route.test.tsx tests/integration/guided-execution-route.test.tsx
git add apps/web/src/execution/api.ts apps/web/src/execution/ManagerReadinessLauncher.tsx apps/web/src/App.tsx tests/integration/manager-readiness-route.test.tsx
git commit -m "feat: launch manager readiness Guided Execution"
```

---

### Task 6: Prove optional-provider semantics, failure truthfulness, and zero provider mutation

**Files:** Modify projection/edge tests; create `tests/integration/manager-readiness-no-mutation.test.ts`.

- [ ] **Step 1: Prove optional Vercel does not block**

All four required provider states `ready` plus Vercel `optional_provider_unconfigured` must project `completed` eligibility.

- [ ] **Step 2: Prove required failures remain blocked**

Cloudflare `authorization_error` or production `public_site_unreachable` must remain blocked and must not satisfy completion evidence.

- [ ] **Step 3: Prove no external mutation was introduced**

Read the feature source and assert no AWS/EC2 endpoint/action, Cloudflare mutation, GitHub write endpoint, Vercel deployment, DNS write, secret mutation, deployment trigger, or repair execution. The only external readiness request from the feature is `GET /functions/v1/atlas-infra-status`.

- [ ] **Step 4: Run pilot tests**

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

The pilot is ready for review only when a permitted infrastructure admin can start/resume the same active readiness workflow; current `atlas-infra-status.provider_status` facts drive four required steps; each step has distinct evidence; blockers remain blocked; recovery follows legal state transitions; optional Vercel never reduces required-path completion; audit/evidence provenance exists; full typecheck/test/build passes; and no AWS/provider mutation, paid call, merge, or deploy occurred.
