# ATLAS Work Soberano Runtime, Connections and Browser Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide normalized Local Agent, Self-Hosted Runner, and Cloud Ephemeral runtime contracts, opaque OAuth/session/vault connection references, a persistent runtime job queue, and a browser-execution protocol constrained by the approved execution envelope.

**Architecture:** Runtime and connection metadata are execution support data, not workflow truth. Add tenant-scoped runtime registrations, runtime jobs, and opaque connection-reference rows that never contain provider secrets. A broker selects healthy authorized runtimes; browser actions are queued as sanitized jobs, executed by an authorized runtime, and accepted only if the action is inside the persisted envelope and the result is sanitized before evidence/audit use.

**Tech Stack:** TypeScript 5.7, Supabase Postgres/RLS/Edge Functions, Vitest 3.2, existing execution scope and audit contracts.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-work-sovereign-design.md`

## Global Constraints

- Target branch: `feat/atlas-work-sovereign` after Core Web and Router/Policy plans pass.
- No secret values in runtime, connection-reference, workflow, job, evidence or audit rows.
- `execution_connection_refs.external_ref` is an opaque pointer to the real authorized provider/session/vault substrate; it is not a token or credential.
- Runtime auth tokens are shown only once at enrollment, stored only as SHA-256 hashes server-side, and never returned by list/read operations.
- Local and self-hosted runtimes must heartbeat; stale runtimes are ineligible for new mutation jobs.
- Cloud Ephemeral is a normalized runtime kind; this plan must not purchase or provision paid browser capacity.
- Browser executor enforces the envelope before dispatch and the runtime must enforce it again before the action.
- Jobs are resumable and leased; an expired lease is not blindly replayed. The owning workflow must first reconcile provider state before a replacement mutation job may be queued.
- No unrestricted desktop control.
- No production DNS mutation in CI.

## File Map

- `supabase/migrations/20260912_atlas_work_runtime.sql` — tenant-scoped connection refs, runtime registrations, runtime jobs, indexes and RLS.
- `packages/execution/src/work-connections.ts` — opaque connection-ref types and eligibility.
- `packages/execution/src/work-runtime.ts` — runtime/job types, runtime selection and health rules.
- `packages/execution/src/browser-executor.ts` — sanitized browser action/result protocol.
- `packages/execution/src/index.ts` — exports.
- `supabase/functions/atlas-execution/work-runtime.ts` — runtime enrollment/authentication, heartbeat, list, queue, claim and complete helpers.
- `supabase/functions/atlas-execution/work-connections.ts` — tenant-scoped connection-ref create/list/revoke helpers.
- `supabase/functions/atlas-execution/index.ts` — operation dispatch with separate user-session and runtime-token authentication paths.
- `apps/web/src/work/WorkConnectionsPage.tsx` — real normalized connection metadata and empty/configured state.
- `apps/web/src/work/WorkRuntimesPage.tsx` — registered runtime status/heartbeat/capabilities.
- `apps/web/src/work/WorkPoliciesPage.tsx` — current policy defaults and `$0` budget behavior; no fake provider state.
- `apps/web/src/work/WorkRoutes.tsx` — routes.
- `tests/unit/work-runtime-migration.test.ts` — table/RLS/secret-boundary schema contract.
- `tests/unit/work-connections.test.ts` — secret-free metadata contracts.
- `tests/unit/work-runtime.test.ts` — broker selection and stale-runtime behavior.
- `tests/unit/browser-executor.test.ts` — envelope and sanitizer contracts.
- `tests/unit/atlas-execution-runtime-edge.test.ts` — enrollment/auth/job protocol contracts.
- `tests/integration/work-runtime-pages.test.tsx` — actual loaded/empty/error states.

---

### Task 1: Add tenant-scoped runtime, job and opaque connection-reference persistence

**Files:**
- Create: `supabase/migrations/20260912_atlas_work_runtime.sql`
- Test: `tests/unit/work-runtime-migration.test.ts`

**Interfaces:**
- Produces tables `execution_connection_refs`, `execution_runtime_registrations`, `execution_runtime_jobs`.

- [ ] **Step 1: Write the failing migration contract test**

Read the migration as text and assert all three tables exist, every table includes `org_id` and `tenant_id`, `execution_runtime_registrations` contains `auth_token_hash` but no plaintext token column, connection refs contain `external_ref` but none of `secret`, `password`, `token_value`, `cookie`, and runtime jobs include `execution_envelope`, `action`, `sanitized_result`, `lease_id`, `lease_expires_at`.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/work-runtime-migration.test.ts
```

- [ ] **Step 3: Implement the tables**

```sql
create table if not exists execution_connection_refs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  tenant_id uuid not null,
  provider text not null,
  mechanism text not null check (mechanism in ('oauth','session','vault')),
  external_ref text not null,
  status text not null default 'active' check (status in ('active','revoked','expired','error')),
  capabilities jsonb not null default '[]'::jsonb,
  created_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists execution_runtime_registrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  tenant_id uuid not null,
  kind text not null check (kind in ('local','self_hosted','cloud_ephemeral')),
  label text not null,
  status text not null default 'offline' check (status in ('online','offline','degraded','revoked')),
  capabilities jsonb not null default '[]'::jsonb,
  auth_token_hash text not null,
  last_seen_at timestamptz,
  created_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists execution_runtime_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  tenant_id uuid not null,
  workflow_id uuid not null,
  task_id uuid not null,
  step_id uuid not null,
  runtime_id uuid references execution_runtime_registrations(id),
  runtime_kind text not null check (runtime_kind in ('local','self_hosted','cloud_ephemeral')),
  state text not null default 'queued' check (state in ('queued','claimed','running','waiting_human','completed','failed','cancelled')),
  execution_envelope jsonb not null,
  action jsonb not null,
  sanitized_result jsonb,
  lease_id uuid,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_execution_connection_refs_org_status on execution_connection_refs(org_id,status);
create index if not exists idx_execution_runtimes_org_seen on execution_runtime_registrations(org_id,last_seen_at);
create index if not exists idx_execution_runtime_jobs_org_state on execution_runtime_jobs(org_id,state,created_at);
```

- [ ] **Step 4: Add explicit member-read RLS and deny direct browser writes**

```sql
alter table execution_connection_refs enable row level security;
alter table execution_runtime_registrations enable row level security;
alter table execution_runtime_jobs enable row level security;

create policy execution_connection_refs_member_read on execution_connection_refs
for select to authenticated using (
  exists (
    select 1 from organization_members m
    where m.user_id = auth.uid() and m.org_id = execution_connection_refs.org_id and m.status = 'active'
  )
);

create policy execution_runtime_registrations_member_read on execution_runtime_registrations
for select to authenticated using (
  exists (
    select 1 from organization_members m
    where m.user_id = auth.uid() and m.org_id = execution_runtime_registrations.org_id and m.status = 'active'
  )
);

create policy execution_runtime_jobs_member_read on execution_runtime_jobs
for select to authenticated using (
  exists (
    select 1 from organization_members m
    where m.user_id = auth.uid() and m.org_id = execution_runtime_jobs.org_id and m.status = 'active'
  )
);
```

Do not create INSERT/UPDATE/DELETE policies for `authenticated`; mutations use the existing service-role Edge boundary after server authorization.

- [ ] **Step 5: Verify GREEN and commit**

```bash
npx vitest run tests/unit/work-runtime-migration.test.ts
git add supabase/migrations/20260912_atlas_work_runtime.sql tests/unit/work-runtime-migration.test.ts
git commit -m "feat: add ATLAS Work runtime support persistence"
```

---

### Task 2: Add normalized connection-ref contracts and fail-closed eligibility

**Files:**
- Create: `packages/execution/src/work-connections.ts`
- Modify: `packages/execution/src/index.ts`
- Test: `tests/unit/work-connections.test.ts`

**Interfaces:**
- Produces `WorkConnectionRef`, `ConnectionRequirement`, `connectionCanSatisfy(ref, requirement)`.

- [ ] **Step 1: Write failing tests**

```ts
import { expect, it } from 'vitest';
import { connectionCanSatisfy } from '../../packages/execution/src/work-connections';

it('requires active provider and capability match', () => {
  expect(connectionCanSatisfy(
    { id: 'c1', provider: 'cloudflare', mechanism: 'oauth', status: 'active', capabilities: ['dns.read','dns.write.txt'] },
    { provider: 'cloudflare', capability: 'dns.write.txt' }
  )).toBe(true);
});

it('rejects revoked references', () => {
  expect(connectionCanSatisfy(
    { id: 'c1', provider: 'cloudflare', mechanism: 'oauth', status: 'revoked', capabilities: ['dns.write.txt'] },
    { provider: 'cloudflare', capability: 'dns.write.txt' }
  )).toBe(false);
});
```

- [ ] **Step 2: Verify RED, implement, verify GREEN and commit**

`WorkConnectionRef` exposes only id/provider/mechanism/status/capabilities. It deliberately has no secret or externalRef field in ordinary application-facing types. Provider matching is case-insensitive; capability matching is exact.

```bash
npx vitest run tests/unit/work-connections.test.ts
git add packages/execution/src/work-connections.ts packages/execution/src/index.ts tests/unit/work-connections.test.ts
git commit -m "feat: add opaque Work connection reference contracts"
```

---

### Task 3: Add runtime broker and stale-runtime rules

**Files:**
- Create: `packages/execution/src/work-runtime.ts`
- Modify: `packages/execution/src/index.ts`
- Test: `tests/unit/work-runtime.test.ts`

**Interfaces:**
- Produces `WorkRuntime`, `WorkRuntimeKind`, `RuntimeSelectionRequest`, `selectWorkRuntime(request, now)`.

- [ ] **Step 1: Write failing selection tests**

Use `lastSeenAt` values and assert Auto chooses healthy Local first, then Self-Hosted, then Cloud Ephemeral; explicit preferences require the requested kind; a runtime is stale when `now - lastSeenAt > 120 seconds`; revoked/offline/degraded runtimes are ineligible for mutation jobs.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/work-runtime.test.ts
```

- [ ] **Step 3: Implement selection**

The selection function accepts required capabilities and returns `{ state: 'ready'|'blocked', runtimeId, runtimeKind, reason }`. It never provisions capacity and never treats a configured-but-stale runtime as online.

- [ ] **Step 4: Verify GREEN and commit**

```bash
npx vitest run tests/unit/work-runtime.test.ts
git add packages/execution/src/work-runtime.ts packages/execution/src/index.ts tests/unit/work-runtime.test.ts
git commit -m "feat: add Work runtime broker contracts"
```

---

### Task 4: Add browser action protocol and result sanitizer

**Files:**
- Create: `packages/execution/src/browser-executor.ts`
- Modify: `packages/execution/src/index.ts`
- Test: `tests/unit/browser-executor.test.ts`

**Interfaces:**
- Consumes `BrowserExecutionEnvelope` from router/policy plan.
- Produces `BrowserAction`, `BrowserActionResult`, `prepareBrowserJob(envelope, action, now)`, `sanitizeBrowserResult(value)`.

- [ ] **Step 1: Write failing tests**

Assert an action outside the envelope throws `browser_action_not_allowed`; sanitized results recursively remove keys matching `/token|secret|password|cookie|authorization|recovery/i`; strings are capped at 2,000 chars and arrays at 50 items.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/browser-executor.test.ts
```

- [ ] **Step 3: Implement protocol**

Supported first-slice action types are `navigate`, `read_text`, `click`, `type`, `submit`, `create_dns_txt`, `click_openai_check`. `prepareBrowserJob` calls `evaluateBrowserAction` before returning a job payload. It contains no credentials.

- [ ] **Step 4: Verify GREEN and commit**

```bash
npx vitest run tests/unit/browser-executor.test.ts
git add packages/execution/src/browser-executor.ts packages/execution/src/index.ts tests/unit/browser-executor.test.ts
git commit -m "feat: add constrained browser execution protocol"
```

---

### Task 5: Add authenticated connection-ref and runtime server operations

**Files:**
- Create: `supabase/functions/atlas-execution/work-connections.ts`
- Create: `supabase/functions/atlas-execution/work-runtime.ts`
- Modify: `supabase/functions/atlas-execution/index.ts`
- Test: `tests/unit/atlas-execution-runtime-edge.test.ts`

**Interfaces:**
- Produces user-session operations `list_work_connections`, `register_work_connection_ref`, `revoke_work_connection_ref`, `list_work_runtimes`, `enroll_work_runtime`, `enqueue_work_runtime_job`; runtime-token operations `heartbeat_work_runtime`, `claim_work_runtime_job`, `complete_work_runtime_job`.

- [ ] **Step 1: Write failing server tests**

Assert every user-session operation resolves Supabase membership and org scope. `register_work_connection_ref` accepts an opaque `external_ref` and rejects request keys matching `/token|secret|password|cookie|authorization|recovery/i`. `enroll_work_runtime` requires `execution.admin`, generates 32 random bytes, returns the runtime token only in that 201 response, and persists `sha256(token)` only. List operations never return `auth_token_hash`; ordinary connection lists never return `external_ref`.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/atlas-execution-runtime-edge.test.ts
```

- [ ] **Step 3: Implement separate authentication dispatch in `index.ts`**

Keep `Authorization: Bearer ...` mandatory for every non-OPTIONS request. Define:

```ts
const RUNTIME_OPERATIONS = new Set([
  'heartbeat_work_runtime',
  'claim_work_runtime_job',
  'complete_work_runtime_job'
]);
```

If operation is in `RUNTIME_OPERATIONS`, require header `x-atlas-runtime-id`, pass the bearer token to `resolveRuntimeContext`, and do **not** call Supabase `auth.getUser` for that request. All other operations continue through existing `resolveContext` and user JWT membership checks.

- [ ] **Step 4: Implement runtime enrollment/authentication**

Enrollment input is `{ kind, label, capabilities }`. Generate one-time token with `crypto.getRandomValues(new Uint8Array(32))`, encode base64url, hash with `crypto.subtle.digest('SHA-256', bytes(token))`, persist hex digest. `resolveRuntimeContext(runtimeId, bearerToken)` loads the registration by id, hashes supplied bearer token, constant-time compares digest bytes, rejects revoked records, and returns runtime org/tenant/kind/capabilities.

- [ ] **Step 5: Implement heartbeat**

A valid runtime heartbeat updates `last_seen_at = now()` and status `online` unless revoked. It cannot change org, tenant, runtime kind or capabilities.

- [ ] **Step 6: Implement job queue lease protocol**

`enqueue_work_runtime_job` is user-authenticated, requires `execution.write`, and only accepts a server-produced ready route/policy decision for the current org-scoped workflow/task/step. `claim_work_runtime_job` is runtime-authenticated and uses a single database update conditioned on `state='queued'`, matching `runtime_kind`, and eligible org/tenant. It sets runtime id, `state='claimed'`, random `lease_id`, `lease_expires_at = now() + interval '5 minutes'` and returns one job. `complete_work_runtime_job` requires matching runtime id + lease id and non-expired lease, sanitizes result, then sets only `completed`, `waiting_human` or `failed`.

- [ ] **Step 7: Verify GREEN and commit**

```bash
npx vitest run tests/unit/atlas-execution-runtime-edge.test.ts
npm run typecheck
git add supabase/functions/atlas-execution/work-connections.ts supabase/functions/atlas-execution/work-runtime.ts supabase/functions/atlas-execution/index.ts tests/unit/atlas-execution-runtime-edge.test.ts
git commit -m "feat: add Work runtime and connection broker endpoints"
```

---

### Task 6: Build real Connections, Runtimes and Policies pages

**Files:**
- Create: `apps/web/src/work/WorkConnectionsPage.tsx`
- Create: `apps/web/src/work/WorkRuntimesPage.tsx`
- Create: `apps/web/src/work/WorkPoliciesPage.tsx`
- Modify: `apps/web/src/work/api.ts`
- Modify: `apps/web/src/work/WorkRoutes.tsx`
- Modify: `apps/web/src/work/WorkSubnav.tsx`
- Test: `tests/integration/work-runtime-pages.test.tsx`

**Interfaces:**
- Produces `/work/connections`, `/work/runtimes`, `/work/policies`.

- [ ] **Step 1: Write failing page tests**

Connections page renders provider/mechanism/status/capabilities and truthful empty state `No authorized Work connections are registered for this organization.` Runtimes page shows kind/status/last heartbeat/capabilities and never runtime auth token/hash. Policies page shows default execution mode Hybrid, autonomy Guided, runtime Auto, paid-provider budget `$0` unless persisted policy says otherwise.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/integration/work-runtime-pages.test.tsx
```

- [ ] **Step 3: Implement API normalization and pages**

Whitelist response fields. Do not add credential-entry forms. Admin connection-ref registration accepts only provider, mechanism, opaque external reference and capabilities; the actual provider/vault/session authorization occurs in its real authorized subsystem.

- [ ] **Step 4: Verify GREEN and commit**

```bash
npx vitest run tests/integration/work-runtime-pages.test.tsx
npm run typecheck
git add apps/web/src/work tests/integration/work-runtime-pages.test.tsx
git commit -m "feat: add Work runtime connection and policy surfaces"
```

---

### Task 7: Runtime/connections/browser final verification

- [ ] **Step 1: Focused suite**

```bash
npx vitest run tests/unit/work-runtime-migration.test.ts tests/unit/work-connections.test.ts tests/unit/work-runtime.test.ts tests/unit/browser-executor.test.ts tests/unit/atlas-execution-runtime-edge.test.ts tests/integration/work-runtime-pages.test.tsx
```

- [ ] **Step 2: Full repository verification**

```bash
npm run typecheck
npm test
npm run build
```

- [ ] **Step 3: Independent security/spec review**

Reject if any secret value can persist in these rows/logs/UI; runtime auth is routed through Supabase user authentication; a runtime can cross org scope; stale/revoked runtime receives a new job; envelope checks occur only in UI; a job completes with wrong/expired lease; or Cloud Ephemeral provisioning incurs cost.

- [ ] **Step 4: Independent quality review**

Review lease/retry semantics, constant-time token comparison, race resistance, sanitization recursion, RLS, empty/error states and mobile pages. Fix findings and rerun focused + full verification before the OpenAI-domain pilot.
