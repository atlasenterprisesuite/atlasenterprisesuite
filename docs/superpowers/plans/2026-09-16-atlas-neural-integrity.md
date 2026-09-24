# ATLAS Neural Integrity System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining cross-system integrity gaps by making the standalone orchestrator explicitly durable in production, removing unreachable root routing, proving the exact deployed commit at the custom domain, and adding one fail-closed Neural Integrity verification layer to `verify:all`.

**Architecture:** Preserve the current ATLAS registry, router, Supabase-first backend, Cloudflare Worker and governance contracts. Add a server-only Supabase `PersistencePort` implementation, a small persistence-mode resolver for the orchestrator HTTP runtime, build-time deployment attestation derived from the checked-out commit, and a repository-level verifier that treats routing, auth, persistence, deployment evidence and production truth as one connected system.

**Tech Stack:** TypeScript 5.7, Node 22, React 18, Vite 6, Vitest 3, Supabase/PostgREST, PostgreSQL migrations/RLS, GitHub Actions, Cloudflare Wrangler 4.

**Spec:** `docs/superpowers/specs/2026-09-16-atlas-neural-integrity-design.md`

## Global Constraints

- Preserve the existing `PersistencePort` interface and tenant/organization scope model.
- `SUPABASE_SERVICE_ROLE_KEY` remains server-only and must never be committed, logged, returned, or bundled into `apps/web`.
- `ATLAS_PERSISTENCE_MODE=memory` is permitted only as an explicit local/test choice.
- Production-style orchestrator startup must not silently fall back to `InMemoryPersistence`.
- Canonical Voice remains `/studio/voice`; do not reintroduce `/voice` as an authoritative route.
- Cloudflare production evidence must fail closed on missing/malformed/mismatched commit attestation.
- ATLAS Identity, RLS, approval gates, Cloudflare security headers and existing production probes must not be weakened.
- Truth vocabulary remains `IMPLEMENTED`, `TESTED`, `DEPLOYED`, `VERIFIED IN PRODUCTION`, `BLOCKED`, `EXTERNAL DEPENDENCY` and `LOCAL-DEMO DATA`.
- TDD is mandatory; each task begins with failing tests and ends with a focused commit.

---

### Task 1: Remove unreachable root-router tissue

**Files:**
- Modify: `apps/web/src/main.tsx`
- Create: `tests/integration/root-router-integrity.test.ts`

**Interfaces:**
- Consumes: existing `HospitalityRoutes`, `RideRoutes`, `App`.
- Produces: one authoritative `RootRouter` decision tree: `/hospitality*`, `/ride*`, otherwise `<App />`.

- [ ] **Step 1: Write the failing integration test**

Create `tests/integration/root-router-integrity.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('apps/web/src/main.tsx', 'utf8');

describe('ATLAS root router integrity', () => {
  it('keeps only the canonical route-family dispatch', () => {
    expect(source).toContain("location.pathname.startsWith('/hospitality')");
    expect(source).toContain("location.pathname.startsWith('/ride')");
    expect(source.match(/return <App \/>;/g)).toHaveLength(1);
  });

  it('does not retain unreachable legacy voice routing', () => {
    expect(source).not.toContain("location.pathname === '/voice'");
    expect(source).not.toContain("import { AtlasVoicePage }");
    expect(source).not.toContain("import { AtlasShell }");
  });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run:

```bash
npx vitest run tests/integration/root-router-integrity.test.ts
```

Expected: FAIL because `main.tsx` still contains `/voice`, `AtlasVoicePage`, `AtlasShell`, and more than one `<App />` return.

- [ ] **Step 3: Make the minimal router cleanup**

Replace the current root-router imports/body with:

```ts
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { App } from './App';
import { HospitalityRoutes } from './modules/hospitality/HospitalityRoutes';
import { RideRoutes } from './modules/ride/RideRoutes';

function RootRouter() {
  const location = useLocation();
  if (location.pathname.startsWith('/hospitality')) return <HospitalityRoutes />;
  if (location.pathname.startsWith('/ride')) return <RideRoutes />;
  return <App />;
}
```

Keep the existing CSS imports and React root render unchanged.

- [ ] **Step 4: Re-run focused tests**

```bash
npx vitest run tests/integration/root-router-integrity.test.ts tests/integration/module-registry-navigation.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/main.tsx tests/integration/root-router-integrity.test.ts
git commit -m "fix: remove unreachable root routing"
```

---

### Task 2: Add durable Supabase persistence for the Sovereign Orchestrator

**Files:**
- Create: `packages/ai-core/src/supabasePersistence.ts`
- Modify: `packages/ai-core/src/index.ts`
- Create: `tests/unit/supabase-persistence.test.ts`
- Create: `supabase/migrations/20260916232000_atlas_orchestrator_persistence.sql`
- Create: `tests/integration/orchestrator-persistence-migration.test.ts`

**Interfaces:**
- Consumes: `PersistencePort`, `TenantScope`, `AtlasTask`, `AtlasEvent`, global `fetch`.
- Produces: `SupabasePersistence implements PersistencePort` with `readonly durable = true` and constructor:

```ts
new SupabasePersistence({
  url: string,
  serviceRoleKey: string,
  fetchImpl?: typeof fetch
})
```

- [ ] **Step 1: Write failing unit tests for scoped PostgREST behavior**

Create `tests/unit/supabase-persistence.test.ts` with a fetch recorder and fixtures. Assert:

```ts
expect(persistence.durable).toBe(true);
await persistence.createTask(task);
expect(request.url).toBe('https://example.supabase.co/rest/v1/atlas_orchestrator_tasks');
expect(request.headers.authorization).toBe('Bearer service-role');
expect(JSON.parse(request.body)).toMatchObject({
  tenant_id: 'tenant-a',
  organization_id: 'org-a',
  task_id: task.taskId,
  schema_version: 1,
  state: task.state,
  task_json: task,
});
```

For `getTask`, assert the URL contains all three predicates:

```text
tenant_id=eq.tenant-a
organization_id=eq.org-a
task_id=eq.ATL-1
```

For `saveTask`, assert PATCH is scoped by all three predicates. For `listEvents`, assert the same scope predicates plus `order=occurred_at.asc,id.asc`. Assert non-2xx responses reject with a safe error that includes status but not the service-role key.

- [ ] **Step 2: Run the unit test and confirm RED**

```bash
npx vitest run tests/unit/supabase-persistence.test.ts
```

Expected: FAIL because `SupabasePersistence` does not exist.

- [ ] **Step 3: Implement the server-only adapter**

Create `packages/ai-core/src/supabasePersistence.ts` with these helpers and semantics:

```ts
import type { TenantScope } from '../../core/src/index';
import type { AtlasEvent, AtlasTask } from '../../task-protocol/src';
import type { PersistencePort } from './persistence';

type FetchLike = typeof fetch;

type SupabasePersistenceOptions = {
  url: string;
  serviceRoleKey: string;
  fetchImpl?: FetchLike;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function encode(value: string): string {
  return encodeURIComponent(value);
}

export class SupabasePersistence implements PersistencePort {
  readonly durable = true;
  private readonly baseUrl: string;
  private readonly key: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: SupabasePersistenceOptions) {
    if (!options.url || !options.serviceRoleKey) {
      throw new Error('Supabase persistence requires URL and service-role credentials');
    }
    this.baseUrl = options.url.replace(/\/$/, '');
    this.key = options.serviceRoleKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const response = await this.fetchImpl(`${this.baseUrl}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: this.key,
        authorization: `Bearer ${this.key}`,
        'content-type': 'application/json',
        ...init.headers,
      },
    });
    if (!response.ok) throw new Error(`Supabase persistence request failed with HTTP ${response.status}`);
    return response;
  }

  async createTask(task: AtlasTask): Promise<void> {
    await this.request('atlas_orchestrator_tasks', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        tenant_id: task.scope.tenantId,
        organization_id: task.scope.organizationId,
        task_id: task.taskId,
        schema_version: task.schemaVersion,
        state: task.state,
        task_json: clone(task),
        created_at: task.createdAt,
        updated_at: task.updatedAt,
      }),
    });
  }

  async getTask(scope: TenantScope, taskId: string): Promise<AtlasTask | null> {
    const query = `atlas_orchestrator_tasks?select=task_json&tenant_id=eq.${encode(scope.tenantId)}&organization_id=eq.${encode(scope.organizationId)}&task_id=eq.${encode(taskId)}&limit=1`;
    const response = await this.request(query, { method: 'GET' });
    const rows = await response.json() as Array<{ task_json: AtlasTask }>;
    return rows[0]?.task_json ? clone(rows[0].task_json) : null;
  }

  async saveTask(task: AtlasTask): Promise<void> {
    const query = `atlas_orchestrator_tasks?tenant_id=eq.${encode(task.scope.tenantId)}&organization_id=eq.${encode(task.scope.organizationId)}&task_id=eq.${encode(task.taskId)}`;
    await this.request(query, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        schema_version: task.schemaVersion,
        state: task.state,
        task_json: clone(task),
        updated_at: task.updatedAt,
      }),
    });
  }

  async appendEvent(event: AtlasEvent): Promise<void> {
    await this.request('atlas_orchestrator_events', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        id: event.eventId,
        tenant_id: event.scope.tenantId,
        organization_id: event.scope.organizationId,
        task_id: event.taskId,
        event_type: event.type,
        event_json: clone(event),
        occurred_at: event.createdAt,
      }),
    });
  }

  async listEvents(scope: TenantScope, taskId: string): Promise<AtlasEvent[]> {
    const query = `atlas_orchestrator_events?select=event_json&tenant_id=eq.${encode(scope.tenantId)}&organization_id=eq.${encode(scope.organizationId)}&task_id=eq.${encode(taskId)}&order=occurred_at.asc,id.asc`;
    const response = await this.request(query, { method: 'GET' });
    const rows = await response.json() as Array<{ event_json: AtlasEvent }>;
    return rows.map((row) => clone(row.event_json));
  }
}
```

Export it from `packages/ai-core/src/index.ts`:

```ts
export * from './supabasePersistence';
```

- [ ] **Step 4: Run unit tests to GREEN**

```bash
npx vitest run tests/unit/supabase-persistence.test.ts tests/unit/orchestrator*.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write the migration contract test**

Create `tests/integration/orchestrator-persistence-migration.test.ts` and assert the SQL contains:

```ts
expect(sql).toContain('create table if not exists public.atlas_orchestrator_tasks');
expect(sql).toContain('primary key (tenant_id, organization_id, task_id)');
expect(sql).toContain('create table if not exists public.atlas_orchestrator_events');
expect(sql).toContain('alter table public.atlas_orchestrator_tasks enable row level security');
expect(sql).toContain('alter table public.atlas_orchestrator_events enable row level security');
expect(sql).toContain('revoke all on public.atlas_orchestrator_tasks from anon, authenticated');
expect(sql).toContain('revoke all on public.atlas_orchestrator_events from anon, authenticated');
```

- [ ] **Step 6: Run migration test and confirm RED**

```bash
npx vitest run tests/integration/orchestrator-persistence-migration.test.ts
```

Expected: FAIL because the migration does not exist.

- [ ] **Step 7: Add the migration**

Create `supabase/migrations/20260916232000_atlas_orchestrator_persistence.sql`:

```sql
create table if not exists public.atlas_orchestrator_tasks (
  tenant_id text not null,
  organization_id text not null,
  task_id text not null,
  schema_version integer not null check (schema_version > 0),
  state text not null,
  task_json jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (tenant_id, organization_id, task_id)
);

create table if not exists public.atlas_orchestrator_events (
  id uuid primary key,
  tenant_id text not null,
  organization_id text not null,
  task_id text not null,
  event_type text not null,
  event_json jsonb not null,
  occurred_at timestamptz not null,
  foreign key (tenant_id, organization_id, task_id)
    references public.atlas_orchestrator_tasks (tenant_id, organization_id, task_id)
    on delete cascade
);

create index if not exists atlas_orchestrator_events_scope_task_time_idx
  on public.atlas_orchestrator_events (tenant_id, organization_id, task_id, occurred_at, id);

alter table public.atlas_orchestrator_tasks enable row level security;
alter table public.atlas_orchestrator_events enable row level security;

revoke all on public.atlas_orchestrator_tasks from anon, authenticated;
revoke all on public.atlas_orchestrator_events from anon, authenticated;
```

Do not add browser-facing policies. Server-side service role remains the only current persistence principal.

- [ ] **Step 8: Run persistence tests**

```bash
npx vitest run tests/unit/supabase-persistence.test.ts tests/integration/orchestrator-persistence-migration.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/ai-core/src/supabasePersistence.ts packages/ai-core/src/index.ts tests/unit/supabase-persistence.test.ts supabase/migrations/20260916232000_atlas_orchestrator_persistence.sql tests/integration/orchestrator-persistence-migration.test.ts
git commit -m "feat: add durable orchestrator persistence"
```

---

### Task 3: Make orchestrator persistence mode explicit and fail closed

**Files:**
- Create: `apps/atlas-orchestrator/src/runtime/persistence.ts`
- Modify: `apps/atlas-orchestrator/src/runtime/container.ts`
- Modify: `apps/atlas-orchestrator/src/http.ts`
- Modify: `tests/integration/orchestrator-runtime.test.ts`

**Interfaces:**
- Consumes: `InMemoryPersistence`, `SupabasePersistence`, `PersistencePort`.
- Produces:

```ts
export type AtlasPersistenceEnvironment = {
  ATLAS_PERSISTENCE_MODE?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

export function resolvePersistence(env: AtlasPersistenceEnvironment): PersistencePort;
```

- [ ] **Step 1: Add failing persistence-mode tests**

Extend `tests/integration/orchestrator-runtime.test.ts`:

```ts
it('uses memory only when explicitly requested', () => {
  const persistence = resolvePersistence({ ATLAS_PERSISTENCE_MODE: 'memory' });
  expect(persistence.durable).toBe(false);
});

it('creates durable Supabase persistence only with complete server configuration', () => {
  const persistence = resolvePersistence({
    ATLAS_PERSISTENCE_MODE: 'supabase',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  });
  expect(persistence.durable).toBe(true);
});

it.each([
  {},
  { ATLAS_PERSISTENCE_MODE: 'supabase' },
  { ATLAS_PERSISTENCE_MODE: 'supabase', SUPABASE_URL: 'https://example.supabase.co' },
])('fails closed for ambiguous or incomplete production persistence: %o', (env) => {
  expect(() => resolvePersistence(env)).toThrow(/ATLAS persistence/i);
});
```

- [ ] **Step 2: Run and confirm RED**

```bash
npx vitest run tests/integration/orchestrator-runtime.test.ts
```

Expected: FAIL because `resolvePersistence` does not exist.

- [ ] **Step 3: Implement the mode resolver**

Create `apps/atlas-orchestrator/src/runtime/persistence.ts`:

```ts
import {
  InMemoryPersistence,
  SupabasePersistence,
  type PersistencePort,
} from '../../../../packages/ai-core/src';

export type AtlasPersistenceEnvironment = {
  ATLAS_PERSISTENCE_MODE?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

export function resolvePersistence(env: AtlasPersistenceEnvironment): PersistencePort {
  if (env.ATLAS_PERSISTENCE_MODE === 'memory') return new InMemoryPersistence();
  if (env.ATLAS_PERSISTENCE_MODE !== 'supabase') {
    throw new Error('ATLAS persistence mode must be explicitly configured');
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('ATLAS persistence Supabase configuration is incomplete');
  }
  return new SupabasePersistence({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
```

Keep `createAtlasRuntime({ persistence })` injectable and its current test default intact; do not make unit tests require live Supabase.

Change `http.ts` from:

```ts
const runtime = createAtlasRuntime();
```

to:

```ts
const runtime = createAtlasRuntime({ persistence: resolvePersistence(process.env) });
```

Import `resolvePersistence` from `./runtime/persistence`.

- [ ] **Step 4: Run runtime tests and typecheck**

```bash
npx vitest run tests/integration/orchestrator-runtime.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/atlas-orchestrator/src/runtime/persistence.ts apps/atlas-orchestrator/src/http.ts tests/integration/orchestrator-runtime.test.ts
git commit -m "feat: fail closed orchestrator persistence mode"
```

---

### Task 4: Attest the exact deployed commit on Cloudflare custom domain

**Files:**
- Create: `scripts/write-deployment-manifest.mjs`
- Modify: `package.json`
- Modify: `apps/web/public/deployment.json`
- Modify: `.github/workflows/cloudflare-deploy.yml`
- Modify: `tests/integration/cloudflare-static-assets-contract.test.ts`
- Create: `tests/unit/deployment-manifest.test.ts`

**Interfaces:**
- Consumes: `GITHUB_SHA`, `CF_PAGES_COMMIT_SHA`, local `git rev-parse HEAD`, GitHub Actions production URL.
- Produces: `apps/web/dist/deployment.json` containing `commit_sha`, and workflow output `production_commit_sha_verified=true` only after live equality with `GITHUB_SHA`.

- [ ] **Step 1: Write failing manifest unit tests**

Create `tests/unit/deployment-manifest.test.ts` for exported helpers from `scripts/write-deployment-manifest.mjs`:

```ts
expect(resolveCommitSha({ GITHUB_SHA: 'abc123' }, () => 'gitsha')).toBe('abc123');
expect(resolveCommitSha({ CF_PAGES_COMMIT_SHA: 'cf123' }, () => 'gitsha')).toBe('cf123');
expect(resolveCommitSha({}, () => 'gitsha\n')).toBe('gitsha');
expect(createManifest('abc123', '12345')).toMatchObject({
  service: 'atlas-enterprise-suite-web',
  commit_sha: 'abc123',
  source: 'github-main',
  target: 'cloudflare-workers-static-assets',
  run_id: '12345',
});
```

- [ ] **Step 2: Run and confirm RED**

```bash
npx vitest run tests/unit/deployment-manifest.test.ts
```

Expected: FAIL because the script does not exist.

- [ ] **Step 3: Implement build-time manifest generation**

Create `scripts/write-deployment-manifest.mjs` exporting `resolveCommitSha` and `createManifest`, and when invoked as the main script write JSON to the path supplied as `process.argv[2]` (default `apps/web/dist/deployment.json`). Resolve SHA in this order: `GITHUB_SHA`, `CF_PAGES_COMMIT_SHA`, `git rev-parse HEAD`. Use `GITHUB_RUN_ID || 'local'` as `run_id`. Never include secrets.

Update root `package.json`:

```json
"build": "npm --workspace apps/web run build && node scripts/write-deployment-manifest.mjs apps/web/dist/deployment.json"
```

Update the tracked `apps/web/public/deployment.json` fallback to:

```json
{
  "service": "atlas-enterprise-suite-web",
  "commit_sha": "development",
  "source": "local-fallback",
  "target": "cloudflare-workers-static-assets",
  "run_id": "local"
}
```

The post-build script overwrites the copied fallback in `dist` with the real checked-out commit.

- [ ] **Step 4: Run manifest tests and build**

```bash
npx vitest run tests/unit/deployment-manifest.test.ts
npm run build
node -e "const j=require('./apps/web/dist/deployment.json'); if(!j.commit_sha || j.commit_sha==='development') process.exit(1)"
```

Expected: PASS.

- [ ] **Step 5: Add failing workflow contract assertions**

Extend `tests/integration/cloudflare-static-assets-contract.test.ts` to require:

```ts
expect(workflow).toContain('production_commit_sha_verified=true');
expect(workflow).toContain('DEPLOYED_COMMIT_SHA');
expect(workflow).toContain('GITHUB_SHA');
expect(workflow).toContain('/deployment.json');
expect(workflow).toContain('Production commit SHA verified');
```

Also assert Manager evidence includes the verified boolean only from the production verification step output, not a hard-coded literal.

- [ ] **Step 6: Run the workflow contract and confirm RED**

```bash
npx vitest run tests/integration/cloudflare-static-assets-contract.test.ts
```

Expected: FAIL because exact-SHA comparison is not yet present.

- [ ] **Step 7: Implement exact-SHA verification in Cloudflare workflow**

After the existing production-route verification, fetch:

```bash
ATTESTATION_BODY="$(curl --retry 5 --retry-delay 3 --silent --show-error \
  --location --max-time 30 \
  -H 'Cache-Control: no-cache, no-store' \
  "${PRODUCTION_URL}/deployment.json")"
DEPLOYED_COMMIT_SHA="$(printf '%s' "$ATTESTATION_BODY" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);process.stdout.write(String(j.commit_sha||''));})")"
test -n "$DEPLOYED_COMMIT_SHA" || { echo "::error::Production deployment attestation is missing commit_sha"; exit 1; }
test "$DEPLOYED_COMMIT_SHA" = "$GITHUB_SHA" || { echo "::error::Production commit mismatch"; exit 1; }
echo "production_commit_sha_verified=true" >> "$GITHUB_OUTPUT"
echo "Production commit SHA verified: $GITHUB_SHA" >> "$GITHUB_STEP_SUMMARY"
```

The existing same-origin/challenge protection must remain in force. If the public request is challenged and the authorized verifier is used, extend that verifier response contract so it returns the observed deployment `commit_sha`; compare that value to `GITHUB_SHA` before emitting the verified output.

Manager evidence must read the output from this step and record `production_commit_sha_verified` from it. Do not set it to true unconditionally.

- [ ] **Step 8: Run Cloudflare contract tests**

```bash
npx vitest run tests/unit/deployment-manifest.test.ts tests/integration/cloudflare-static-assets-contract.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add scripts/write-deployment-manifest.mjs package.json apps/web/public/deployment.json .github/workflows/cloudflare-deploy.yml tests/unit/deployment-manifest.test.ts tests/integration/cloudflare-static-assets-contract.test.ts
git commit -m "feat: attest exact production commit"
```

---

### Task 5: Add the ATLAS Neural Integrity verifier

**Files:**
- Create: `scripts/verify-neural-integrity.mjs`
- Create: `tests/unit/neural-integrity.test.ts`
- Create: `tests/integration/neural-integrity-contract.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: source files and migration/workflow contracts from Tasks 1-4.
- Produces: command `npm run verify:neural` and deterministic status lines for `roots`, `trunk`, `brain`, `nerves`, `bark`, `senses`.

- [ ] **Step 1: Write failing unit tests for status projection**

`tests/unit/neural-integrity.test.ts` imports pure helpers from the script and asserts:

```ts
expect(summarizeIntegrity({
  roots: true,
  trunk: true,
  brain: true,
  nerves: true,
  bark: true,
  senses: true,
})).toEqual({ healthy: true, failed: [] });

expect(summarizeIntegrity({
  roots: true,
  trunk: true,
  brain: false,
  nerves: true,
  bark: true,
  senses: false,
})).toEqual({ healthy: false, failed: ['brain', 'senses'] });
```

- [ ] **Step 2: Run and confirm RED**

```bash
npx vitest run tests/unit/neural-integrity.test.ts
```

Expected: FAIL because the verifier does not exist.

- [ ] **Step 3: Implement pure helpers plus executable verifier**

`verify-neural-integrity.mjs` must export `summarizeIntegrity` and implement these checks when run directly:

```text
roots   -> Supabase migration exists, RLS enabled, durable adapter exported
trunk   -> main.tsx has only canonical route-family dispatch and registry has route/readiness/requiresAuth metadata
brain   -> resolvePersistence exists; readiness rejects durable=false; HTTP runtime injects resolved persistence
nerves  -> every surfaced ATLAS_MODULES route is represented by App, extension resolver, or dedicated top-level router; auth-required modules have recognized RequireAtlasIdentity coverage
bark    -> worker/index.ts security headers and wrangler asset binding remain present
senses  -> Cloudflare workflow verifies production deployment.json commit_sha against GITHUB_SHA and Manager evidence consumes that verified output
```

Print exactly one line per system, for example:

```text
ATLAS neural integrity roots=PASS
ATLAS neural integrity trunk=PASS
ATLAS neural integrity brain=PASS
ATLAS neural integrity nerves=PASS
ATLAS neural integrity bark=PASS
ATLAS neural integrity senses=PASS
```

Exit `1` if any system fails; otherwise exit `0`.

- [ ] **Step 4: Add integration test for the repository contract**

Create `tests/integration/neural-integrity-contract.test.ts` and assert:

```ts
const result = spawnSync(process.execPath, ['scripts/verify-neural-integrity.mjs'], { encoding: 'utf8' });
expect(result.status).toBe(0);
for (const system of ['roots', 'trunk', 'brain', 'nerves', 'bark', 'senses']) {
  expect(result.stdout).toContain(`ATLAS neural integrity ${system}=PASS`);
}
```

- [ ] **Step 5: Wire into repository verification**

Update `package.json` scripts:

```json
"verify:neural": "node scripts/verify-neural-integrity.mjs",
"verify:all": "npm audit --audit-level=high && npm run typecheck && npm run test:unit && npm run test:integration && npm run verify:edge && npm run verify:python && npm run verify:neural && npm run build"
```

- [ ] **Step 6: Run focused verifier tests**

```bash
npx vitest run tests/unit/neural-integrity.test.ts tests/integration/neural-integrity-contract.test.ts
npm run verify:neural
```

Expected: PASS with six PASS lines.

- [ ] **Step 7: Commit**

```bash
git add scripts/verify-neural-integrity.mjs tests/unit/neural-integrity.test.ts tests/integration/neural-integrity-contract.test.ts package.json
git commit -m "feat: add ATLAS neural integrity gate"
```

---

### Task 6: Full verification, PR, deployment truth and production handoff

**Files:**
- Modify only if verification exposes a defect in Tasks 1-5.
- No unrelated refactors.

**Interfaces:**
- Consumes: complete branch implementation.
- Produces: green PR, merged commit, Cloudflare production attestation, and truthful orchestrator deployment state.

- [ ] **Step 1: Run the full repository gate**

```bash
npm run verify:all
```

Expected: dependency audit at configured threshold, typecheck, unit, integration, edge, Python, neural integrity and production build all PASS.

- [ ] **Step 2: Run targeted regression gates**

```bash
npx vitest run tests/integration/orchestrator-runtime.test.ts tests/integration/orchestrator-persistence-migration.test.ts tests/integration/root-router-integrity.test.ts tests/integration/module-registry-navigation.test.tsx tests/integration/cloudflare-static-assets-contract.test.ts tests/integration/neural-integrity-contract.test.ts
```

Expected: PASS.

- [ ] **Step 3: Open PR from `feat/atlas-neural-integrity` to `main`**

PR body must state separately:

```text
IMPLEMENTED: durable adapter, explicit mode resolver, router cleanup, exact SHA attestation, neural integrity gate.
TESTED: full verify:all and CI results.
DEPLOYED: only after provider deployment evidence.
VERIFIED IN PRODUCTION: only after live custom-domain SHA equality and durable orchestrator /readyz against Supabase.
EXTERNAL DEPENDENCY: any missing production orchestrator host/env or unapplied Supabase migration.
```

- [ ] **Step 4: Require existing CI gates before merge**

Verify Consensus 3/3, CodeQL, build/integration/security checks and any repository-specific CI are green on the exact PR HEAD SHA.

- [ ] **Step 5: Merge only the verified PR HEAD**

Use SHA protection/expected-head semantics where available. Do not merge a changed unverified head.

- [ ] **Step 6: Verify Cloudflare production deployment**

On the merge SHA, require the Cloudflare workflow to pass:

```text
preflight -> verify:all -> Wrangler/native deploy -> workers.dev or provider deployment evidence -> production routes -> deployment.json commit_sha == merge SHA -> Manager evidence
```

Only then mark web edge `VERIFIED IN PRODUCTION`.

- [ ] **Step 7: Verify durable orchestrator separately**

If the production orchestrator host and Supabase migration/configuration are available, apply the migration through the authorized Supabase deployment path, configure:

```text
ATLAS_PERSISTENCE_MODE=supabase
SUPABASE_URL=<provider-managed environment value>
SUPABASE_SERVICE_ROLE_KEY=<provider-managed secret>
```

Then require:

```text
GET /healthz -> 200 and durable=true
GET /readyz  -> 200 and ready=true
```

Do not expose secret values in logs. If there is no authorized production orchestrator host/configuration path, report the orchestrator as `TESTED / EXTERNAL DEPENDENCY`, not `VERIFIED IN PRODUCTION`.

- [ ] **Step 8: Final evidence report**

Report each biological/tree layer separately:

```text
roots/marrow      = Supabase durable persistence
trunk/spinal cord = registry + routing + identity
brain             = sovereign orchestrator
nerves/branches   = module routes + APIs
skin/bark         = Cloudflare edge
senses/rings      = CI + probes + Manager evidence
```

For every layer, attach one of the ATLAS truth states and the concrete evidence that justifies it.
