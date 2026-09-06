# ATLAS Forge Bootstrap Runner + CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap an ATLAS-controlled development path that can hold a Git-compatible source copy, execute the current ATLAS CI commands on an ATLAS-owned runner, persist logs and checksum-verified artifacts, and continue operating when GitHub or GitHub Actions is unavailable.

**Architecture:** Milestone 1 is deliberately single-host and filesystem-backed so it can become operational before the rest of Forge exists. `packages/forge-core` owns provider-independent state/pipeline contracts; `packages/forge-git` owns local Git operations; `packages/forge-runner` executes exact-SHA jobs without a shell; `packages/forge-artifacts` stores content-addressed build evidence; `apps/forge-api` owns queue, persistence, auth, audit, and health. GitHub is only an optional Git remote/mirror. TypeScript runtime entry points use the checked-in `tsx` package so Forge does not require generated `dist` files to start and tests always execute the same source files used by the service.

**Tech Stack:** Node.js 22, TypeScript 5.8, `tsx` 4.x, npm workspaces, Vitest 3, standard Git CLI, Node built-ins (`node:http`, `node:child_process`, `node:crypto`, `node:fs`, `node:path`), Linux/systemd for the first ATLAS-controlled host.

**Spec:** `docs/superpowers/specs/2026-09-06-atlas-forge-sovereign-devops-design.md`

## Global Constraints

- Work on `release/atlas-a-z`; keep `main` production-stable until the complete A-Z closure gate is green.
- Use standard Git semantics; never invent a proprietary source format.
- GitHub is an optional mirror/provider and MUST NOT be required for local source operations or CI execution.
- CI jobs execute in disposable workspaces and receive no implicit production credentials.
- Pipeline commands are versioned with source and executed with `shell: false`.
- Every run binds to one exact 40-character source SHA, and the runner verifies checked-out `HEAD` before execution.
- Keep `failed`, `timed_out`, and `infrastructure_error` as distinct terminal outcomes.
- Secrets remain outside Git. The first host reads control/runner tokens only from a root-managed environment file.
- Artifacts are immutable after publication and identified by SHA-256 manifest digest.
- Provider failures surface as `degraded` or `unavailable`; they never silently become successful states.
- Every sensitive Forge mutation emits ATLAS audit evidence with correlation ID.
- This plan implements Forge Milestone 1 only: source continuity, runner, CI evidence, artifact vault, health, and provider-neutral Git mirror sync. Internal reviews, multi-runner scheduling, secret-vault adapters, release deployment, web UI, and disaster-recovery automation receive separate plans.
- The existing repository `test:e2e` script is not called proven until its Playwright dependency/config is verified. Milestone 1 proves a sovereign end-to-end Forge flow through Vitest and preserves the full browser E2E requirement for the A-Z release gate.

---

## File Map

### Shared governance
- Modify: `packages/core/src/rbac.ts`
- Modify: `tests/unit/core.test.ts`

### Forge Core
- Create: `packages/forge-core/package.json`
- Create: `packages/forge-core/src/types.ts`
- Create: `packages/forge-core/src/stateMachine.ts`
- Create: `packages/forge-core/src/pipeline.ts`
- Create: `packages/forge-core/src/index.ts`
- Create: `tests/unit/forge-core.test.ts`
- Create: `.atlas/forge/pipelines/atlas-ci.json`

### Local Git service
- Create: `packages/forge-git/package.json`
- Create: `packages/forge-git/src/gitRepository.ts`
- Create: `packages/forge-git/src/mirror.ts`
- Create: `packages/forge-git/src/index.ts`
- Create: `tests/integration/forge-git.test.ts`

### Runner
- Create: `packages/forge-runner/package.json`
- Create: `packages/forge-runner/src/environment.ts`
- Create: `packages/forge-runner/src/executor.ts`
- Create: `packages/forge-runner/src/localCli.ts`
- Create: `packages/forge-runner/src/apiClient.ts`
- Create: `packages/forge-runner/src/daemon.ts`
- Create: `packages/forge-runner/src/index.ts`
- Create: `tests/unit/forge-runner.test.ts`
- Create: `tests/integration/forge-runner-api.test.ts`

### Artifact Vault
- Create: `packages/forge-artifacts/package.json`
- Create: `packages/forge-artifacts/src/manifest.ts`
- Create: `packages/forge-artifacts/src/filesystemArtifactStore.ts`
- Create: `packages/forge-artifacts/src/index.ts`
- Create: `tests/unit/forge-artifacts.test.ts`

### Forge API
- Create: `apps/forge-api/package.json`
- Create: `apps/forge-api/src/config.ts`
- Create: `apps/forge-api/src/fileStateStore.ts`
- Create: `apps/forge-api/src/auth.ts`
- Create: `apps/forge-api/src/fileAuditSink.ts`
- Create: `apps/forge-api/src/server.ts`
- Create: `apps/forge-api/src/main.ts`
- Create: `tests/integration/forge-api.test.ts`

### Workspace and operations
- Create: `tsconfig.forge.json`
- Create: `scripts/forge/bootstrap-local-repository.sh`
- Create: `scripts/forge/sync-git-mirror.sh`
- Create: `infra/forge/systemd/atlas-forge-api.service`
- Create: `infra/forge/systemd/atlas-forge-runner.service`
- Create: `infra/forge/forge.env.example`
- Create: `docs/operations/atlas-forge-bootstrap.md`
- Create: `tests/integration/forge-sovereign-ci.test.ts`
- Create: `.gitignore` if absent; otherwise merge Forge entries into the existing file.
- Modify: `package.json`
- Modify: `package-lock.json`

---

### Task 1: Forge domain contracts, state transitions, workspace runtime, and RBAC

**Files:**
- Create: `packages/forge-core/package.json`
- Create: `packages/forge-core/src/types.ts`
- Create: `packages/forge-core/src/stateMachine.ts`
- Create: `packages/forge-core/src/index.ts`
- Create: `tsconfig.forge.json`
- Modify: `packages/core/src/rbac.ts`
- Modify: `tests/unit/core.test.ts`
- Create: `tests/unit/forge-core.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces `ForgeRunStatus`, `ForgeStepDefinition`, `ForgePipelineDefinition`, `ForgeRunRecord`, `ForgeJobRecord`, `ForgeStepResult`, `ForgeArtifactRecord`, `MirrorState`, and `assertRunTransition(current, next)`.
- Produces Forge permissions governed by existing `hasPermission`.

- [ ] **Step 1: Write failing Forge state/RBAC tests**

```ts
import { describe, expect, it } from 'vitest';
import { assertRunTransition } from '../../packages/forge-core/src/index.ts';
import { hasPermission } from '../../packages/core/src/index.ts';

describe('ATLAS Forge core', () => {
  it('allows execution transitions and rejects terminal resurrection', () => {
    expect(() => assertRunTransition('queued', 'assigned')).not.toThrow();
    expect(() => assertRunTransition('assigned', 'running')).not.toThrow();
    expect(() => assertRunTransition('running', 'passed')).not.toThrow();
    expect(() => assertRunTransition('passed', 'running')).toThrow(/transition/i);
  });

  it('keeps product and infrastructure failure separate', () => {
    expect(() => assertRunTransition('running', 'failed')).not.toThrow();
    expect(() => assertRunTransition('running', 'infrastructure_error')).not.toThrow();
  });

  it('grants Forge domain permissions only through forge.admin', () => {
    expect(hasPermission(['forge.admin'], 'forge.pipeline.execute')).toBe(true);
    expect(hasPermission(['accounting.admin'], 'forge.pipeline.execute')).toBe(false);
  });
});
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- tests/unit/forge-core.test.ts tests/unit/core.test.ts
```

Expected: FAIL because Forge contracts and Forge admin implication do not exist.

- [ ] **Step 3: Add exact Forge types**

`packages/forge-core/src/types.ts`:

```ts
export type ForgeRunStatus =
  | 'queued'
  | 'assigned'
  | 'running'
  | 'passed'
  | 'failed'
  | 'cancelled'
  | 'timed_out'
  | 'infrastructure_error';

export type MirrorState =
  | 'healthy'
  | 'syncing'
  | 'behind'
  | 'diverged'
  | 'authentication_required'
  | 'rate_limited'
  | 'unavailable';

export type ForgeStepDefinition = {
  readonly id: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly timeoutMs: number;
};

export type ForgePipelineDefinition = {
  readonly id: string;
  readonly version: number;
  readonly steps: readonly ForgeStepDefinition[];
  readonly artifactPaths: readonly string[];
};

export type ForgeStepResult = {
  readonly stepId: string;
  readonly status: 'passed' | 'failed' | 'timed_out' | 'infrastructure_error';
  readonly exitCode: number | null;
  readonly startedAt: string;
  readonly finishedAt: string;
};

export type ForgeArtifactRecord = {
  readonly id: string;
  readonly sourceSha: string;
  readonly runId: string;
  readonly digest: string;
  readonly manifestPath: string;
  readonly payloadPath: string;
  readonly createdAt: string;
  readonly verified: boolean;
};

export type ForgeRunRecord = {
  readonly id: string;
  readonly repositoryId: string;
  readonly sourceSha: string;
  readonly pipelineId: string;
  readonly pipelineVersion: number;
  readonly trigger: 'manual' | 'push' | 'review' | 'retry';
  readonly requestedBy: string;
  readonly correlationId: string;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly status: ForgeRunStatus;
  readonly artifact: ForgeArtifactRecord | null;
};

export type ForgeJobRecord = {
  readonly id: string;
  readonly runId: string;
  readonly repositoryId: string;
  readonly sourceSha: string;
  readonly pipeline: ForgePipelineDefinition;
  readonly status: ForgeRunStatus;
  readonly assignedRunnerId: string | null;
  readonly stepResults: readonly ForgeStepResult[];
};
```

`packages/forge-core/src/stateMachine.ts`:

```ts
import type { ForgeRunStatus } from './types.ts';

const allowed: Record<ForgeRunStatus, readonly ForgeRunStatus[]> = {
  queued: ['assigned', 'cancelled'],
  assigned: ['running', 'cancelled', 'infrastructure_error'],
  running: ['passed', 'failed', 'cancelled', 'timed_out', 'infrastructure_error'],
  passed: [],
  failed: [],
  cancelled: [],
  timed_out: [],
  infrastructure_error: [],
};

export function assertRunTransition(current: ForgeRunStatus, next: ForgeRunStatus): void {
  if (!allowed[current].includes(next)) {
    throw new Error(`Invalid Forge run transition: ${current} -> ${next}`);
  }
}
```

- [ ] **Step 4: Extend shared RBAC**

Add this union to `packages/core/src/rbac.ts`:

```ts
export type ForgePermission =
  | 'forge.read'
  | 'forge.repository.read'
  | 'forge.repository.write'
  | 'forge.pipeline.read'
  | 'forge.pipeline.execute'
  | 'forge.runner.read'
  | 'forge.runner.manage'
  | 'forge.artifact.read'
  | 'forge.release.read'
  | 'forge.release.approve'
  | 'forge.release.deploy'
  | 'forge.mirror.manage'
  | 'forge.admin';
```

The permission implication must end as:

```ts
if (granted.includes(required)) return true;
if (required.startsWith('accounting.')) return granted.includes('accounting.admin');
if (required.startsWith('forge.')) return granted.includes('forge.admin');
return false;
```

- [ ] **Step 5: Add a no-emit Forge TypeScript config and local runtime tool**

`tsconfig.forge.json`:

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"],
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": [
    "apps/forge-api/src/**/*.ts",
    "packages/forge-core/src/**/*.ts",
    "packages/forge-git/src/**/*.ts",
    "packages/forge-runner/src/**/*.ts",
    "packages/forge-artifacts/src/**/*.ts"
  ]
}
```

Add root dev dependencies `@types/node: ^22.0.0`, `typescript: ^5.8.0`, and `tsx: ^4.20.0`. Add `"engines": { "node": ">=22" }`.

Each Forge workspace `package.json` follows the existing ATLAS source-package pattern:

```json
{
  "name": "@atlas/forge-core",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "exports": "./src/index.ts"
}
```

- [ ] **Step 6: Install, test, typecheck, commit**

```bash
npm install --no-audit --no-fund
npm test -- tests/unit/forge-core.test.ts tests/unit/core.test.ts
npx tsc -p tsconfig.forge.json --noEmit
git add package.json package-lock.json tsconfig.forge.json packages/core/src/rbac.ts packages/forge-core tests/unit/core.test.ts tests/unit/forge-core.test.ts
git commit -m "feat: add ATLAS Forge core contracts"
```

Expected: PASS.

---

### Task 2: Versioned ATLAS CI pipeline contract

**Files:**
- Create: `packages/forge-core/src/pipeline.ts`
- Modify: `packages/forge-core/src/index.ts`
- Create: `.atlas/forge/pipelines/atlas-ci.json`
- Modify: `tests/unit/forge-core.test.ts`

**Interfaces:**
- Consumes `ForgePipelineDefinition`.
- Produces `parsePipeline(value: unknown): ForgePipelineDefinition`.
- Bootstrap pipeline commands are restricted to `npm`; checkout is runner-owned.

- [ ] **Step 1: Write failing parser tests**

```ts
import { parsePipeline } from '../../packages/forge-core/src/index.ts';

expect(parsePipeline({
  id: 'atlas-ci',
  version: 1,
  steps: [{ id: 'typecheck', command: 'npm', args: ['run', 'typecheck'], timeoutMs: 600000 }],
  artifactPaths: ['apps/web/dist'],
}).id).toBe('atlas-ci');

expect(() => parsePipeline({
  id: 'unsafe',
  version: 1,
  steps: [{ id: 'unsafe', command: 'bash', args: ['-c', 'echo unsafe'], timeoutMs: 1000 }],
  artifactPaths: [],
})).toThrow(/command/i);
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- tests/unit/forge-core.test.ts
```

- [ ] **Step 3: Implement strict runtime validation**

`parsePipeline` rejects non-objects, blank IDs, versions below 1, duplicate step IDs, commands other than `npm`, non-string args, timeout values outside `1..1800000`, absolute artifact paths, and artifact paths containing a `..` segment.

- [ ] **Step 4: Check in the canonical pipeline**

`.atlas/forge/pipelines/atlas-ci.json`:

```json
{
  "id": "atlas-ci",
  "version": 1,
  "steps": [
    { "id": "install", "command": "npm", "args": ["ci", "--no-audit", "--no-fund"], "timeoutMs": 600000 },
    { "id": "typecheck", "command": "npm", "args": ["run", "typecheck"], "timeoutMs": 600000 },
    { "id": "unit", "command": "npm", "args": ["run", "test:unit"], "timeoutMs": 900000 },
    { "id": "integration", "command": "npm", "args": ["run", "test:integration"], "timeoutMs": 900000 },
    { "id": "dependency-audit", "command": "npm", "args": ["audit", "--audit-level=high"], "timeoutMs": 600000 },
    { "id": "build", "command": "npm", "args": ["run", "build"], "timeoutMs": 900000 }
  ],
  "artifactPaths": ["apps/web/dist"]
}
```

- [ ] **Step 5: Test and commit**

```bash
npm test -- tests/unit/forge-core.test.ts
npx tsc -p tsconfig.forge.json --noEmit
git add .atlas/forge/pipelines/atlas-ci.json packages/forge-core/src tests/unit/forge-core.test.ts
git commit -m "feat: define ATLAS Forge CI pipeline"
```

---

### Task 3: Local Git repository adapter and optional mirror health

**Files:**
- Create: `packages/forge-git/package.json`
- Create: `packages/forge-git/src/gitRepository.ts`
- Create: `packages/forge-git/src/mirror.ts`
- Create: `packages/forge-git/src/index.ts`
- Create: `tests/integration/forge-git.test.ts`
- Modify: `package-lock.json`

**Interfaces:**
- Produces `initBareRepository(repositoryPath)`, `resolveCommit(repositoryPath, ref)`, `checkoutExactSha(repositoryPath, sha, workspacePath)`, `syncMirror(repositoryPath, remoteName)`.
- `syncMirror` returns `{ state: MirrorState; message: string }`; provider failure is state, not a local-CI exception.

- [ ] **Step 1: Write failing exact-SHA and mirror tests**

Create a temporary source Git repository, commit one file, push it to a temporary bare repository, and assert:

```ts
const sha = await resolveCommit(barePath, 'refs/heads/main');
await checkoutExactSha(barePath, sha, workspacePath);
const head = (await execFileAsync('git', ['-C', workspacePath, 'rev-parse', 'HEAD'])).stdout.trim();
expect(head).toBe(sha);

await execFileAsync('git', ['--git-dir', barePath, 'remote', 'add', 'github', '/missing/provider.git']);
expect((await syncMirror(barePath, 'github')).state).toBe('unavailable');
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- tests/integration/forge-git.test.ts
```

- [ ] **Step 3: Implement Git only through `execFile`**

Use `promisify(execFile)`; never build shell strings. `checkoutExactSha` rejects non-40-char lowercase hex SHAs, recreates the disposable workspace, clones with `--no-checkout`, checks out `--detach <sha>`, and verifies resolved `HEAD` equals the requested SHA.

`syncMirror` runs `git --git-dir <repo> fetch <remote> --prune`. Classify credential/authentication messages as `authentication_required`, throttling/rate-limit messages as `rate_limited`, and other failures as `unavailable`. It MUST NOT force-push divergence.

- [ ] **Step 4: Test/typecheck/commit**

```bash
npm install --no-audit --no-fund
npm test -- tests/integration/forge-git.test.ts
npx tsc -p tsconfig.forge.json --noEmit
git add packages/forge-git tests/integration/forge-git.test.ts package-lock.json
git commit -m "feat: add ATLAS Forge local Git adapter"
```

---

### Task 4: Disposable runner and emergency local CI

**Files:**
- Create: `packages/forge-runner/package.json`
- Create: `packages/forge-runner/src/environment.ts`
- Create: `packages/forge-runner/src/executor.ts`
- Create: `packages/forge-runner/src/localCli.ts`
- Create: `packages/forge-runner/src/index.ts`
- Create: `tests/unit/forge-runner.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces `sanitizedEnvironment(runId)`, `runStep(step, cwd, onLog)`, `executePipeline(pipeline, cwd, runId, onLog)`, and CLI `forge:ci:local`.

- [ ] **Step 1: Write failing runner safety tests**

```ts
process.env.ATLAS_FORGE_CONTROL_TOKEN = 'secret-value';
const env = sanitizedEnvironment('run-1');
expect(env.ATLAS_FORGE_CONTROL_TOKEN).toBeUndefined();
expect(env.CI).toBe('true');
expect(env.ATLAS_FORGE_RUN_ID).toBe('run-1');
```

Also directly call `runStep` with a missing executable and expect `infrastructure_error`; call Node with `process.exit(7)` and expect `failed`; call a Node process longer than a 50 ms timeout and expect `timed_out`.

- [ ] **Step 2: Verify RED**

```bash
npm test -- tests/unit/forge-runner.test.ts
```

- [ ] **Step 3: Implement no-shell execution and sanitized environment**

Only inherit `PATH`, `HOME`, `TMPDIR`, `TEMP`, `SystemRoot`, and `ComSpec` when present. Add:

```ts
CI: 'true'
ATLAS_FORGE_RUN_ID: runId
npm_config_audit: 'false'
npm_config_fund: 'false'
```

Use:

```ts
spawn(step.command, [...step.args], {
  cwd,
  env: sanitizedEnvironment(runId),
  shell: false,
  stdio: ['ignore', 'pipe', 'pipe'],
});
```

Stream both output channels through `onLog`, enforce `timeoutMs`, and stop the pipeline after the first non-passing step.

- [ ] **Step 4: Implement emergency local CI evidence**

`localCli.ts` resolves `git rev-parse HEAD`, validates `.atlas/forge/pipelines/atlas-ci.json`, executes the pipeline in the current checkout, and writes `${ATLAS_FORGE_HOME:-.atlas-forge}/local-runs/<runId>.json`. Exit `0` only when all steps pass.

Add root scripts:

```json
{
  "forge:typecheck": "tsc -p tsconfig.forge.json --noEmit",
  "forge:ci:local": "tsx packages/forge-runner/src/localCli.ts"
}
```

- [ ] **Step 5: Test and commit**

```bash
npm install --no-audit --no-fund
npm test -- tests/unit/forge-runner.test.ts
npm run forge:typecheck
git add packages/forge-runner tests/unit/forge-runner.test.ts package.json package-lock.json
git commit -m "feat: add ATLAS-owned Forge runner"
```

---

### Task 5: Content-addressed filesystem Artifact Vault

**Files:**
- Create: `packages/forge-artifacts/package.json`
- Create: `packages/forge-artifacts/src/manifest.ts`
- Create: `packages/forge-artifacts/src/filesystemArtifactStore.ts`
- Create: `packages/forge-artifacts/src/index.ts`
- Create: `tests/unit/forge-artifacts.test.ts`
- Modify: `package-lock.json`

**Interfaces:**
- Produces `buildArtifactManifest(directory)`, `FilesystemArtifactStore.publishDirectory(input)`, and `FilesystemArtifactStore.verifyArtifact(record)`.

- [ ] **Step 1: Write failing integrity test**

```ts
const published = await store.publishDirectory({
  sourceDirectory: dist,
  sourceSha: 'a'.repeat(40),
  runId: 'run-1',
});
expect(published.digest).toMatch(/^[0-9a-f]{64}$/);
expect(await store.verifyArtifact(published)).toBe(true);

await writeFile(join(published.payloadPath, 'index.html'), 'tampered');
expect(await store.verifyArtifact(published)).toBe(false);
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- tests/unit/forge-artifacts.test.ts
```

- [ ] **Step 3: Implement canonical manifest and immutable publication**

Recursively walk regular files, reject symlinks, normalize relative paths to `/`, sort paths, SHA-256 every file, serialize only `{path,size,sha256}` entries plus source SHA/run ID, and SHA-256 that canonical JSON. Publish to:

```text
<forge-home>/artifacts/<digest>/manifest.json
<forge-home>/artifacts/<digest>/payload/<files>
```

If the digest directory already exists, verify and reuse it. If verification fails, throw an integrity error instead of overwriting evidence.

- [ ] **Step 4: Test/typecheck/commit**

```bash
npm install --no-audit --no-fund
npm test -- tests/unit/forge-artifacts.test.ts
npm run forge:typecheck
git add packages/forge-artifacts tests/unit/forge-artifacts.test.ts package-lock.json
git commit -m "feat: add ATLAS Forge artifact vault"
```

---

### Task 6: Filesystem Forge API, queue lifecycle, audit, and health

**Files:**
- Create: `apps/forge-api/package.json`
- Create: `apps/forge-api/src/config.ts`
- Create: `apps/forge-api/src/fileStateStore.ts`
- Create: `apps/forge-api/src/auth.ts`
- Create: `apps/forge-api/src/fileAuditSink.ts`
- Create: `apps/forge-api/src/server.ts`
- Create: `apps/forge-api/src/main.ts`
- Create: `tests/integration/forge-api.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- HTTP: `GET /healthz`, `POST /v1/runs`, `POST /v1/jobs/claim`, `POST /v1/jobs/:jobId/start`, `POST /v1/jobs/:jobId/log`, `POST /v1/jobs/:jobId/complete`, `GET /v1/runs/:runId`.
- Control operations use `ATLAS_FORGE_CONTROL_TOKEN`; runner operations use `ATLAS_FORGE_RUNNER_TOKEN`.

- [ ] **Step 1: Write failing auth/run lifecycle test**

Start `createForgeServer` on port `0` with a temporary Forge home. Verify health is 200, unauthenticated run creation is 401, authenticated creation is 201, runner claim moves the job to `assigned`, runner start moves it to `running`, and completion from `running` to `passed` succeeds. Also assert completion directly from `assigned` returns `409`.

- [ ] **Step 2: Verify RED**

```bash
npm test -- tests/integration/forge-api.test.ts
```

- [ ] **Step 3: Implement explicit configuration and constant-time auth**

```ts
export type ForgeApiConfig = {
  home: string;
  repositoriesRoot: string;
  pipelinesRoot: string;
  controlToken: string;
  runnerToken: string;
  bindHost: string;
  port: number;
};
```

In non-test mode reject tokens shorter than 32 characters. Compare equal-length UTF-8 buffers with `timingSafeEqual`; never log token values.

- [ ] **Step 4: Implement atomic filesystem state and durable audit**

Persist:

```text
<home>/state/runs/<runId>.json
<home>/state/jobs/<jobId>.json
<home>/logs/<jobId>.log
<home>/audit/events.jsonl
```

JSON record changes use sibling temporary file mode `0600`, `fsync`, then atomic rename. `FileAuditSink` writes events matching the shared ATLAS audit shape with actions `forge.run.create`, `forge.job.claim`, `forge.job.start`, and `forge.run.complete`.

- [ ] **Step 5: Implement exact endpoint transitions**

`POST /v1/runs` validates repository ID `/^[a-z0-9][a-z0-9-]{0,63}$/` and SHA `/^[0-9a-f]{40}$/`, loads `<pipelinesRoot>/<pipelineId>.json`, validates with `parsePipeline`, creates run/job in `queued`.

`POST /v1/jobs/claim` accepts runner ID, selects oldest queued job, applies `queued -> assigned` to job and run, and records `assignedRunnerId`.

`POST /v1/jobs/:id/start` requires the same runner ID that claimed the job and applies `assigned -> running`, setting run `startedAt`.

`POST /v1/jobs/:id/log` caps each input line at 16 KiB and strips NUL characters.

`POST /v1/jobs/:id/complete` accepts only `passed|failed|cancelled|timed_out|infrastructure_error` and only from `running`; it stores exact step results and nullable artifact record, then sets `finishedAt`.

`GET /healthz` returns `200 {"status":"ready"}` only when state/repository/log/artifact roots are readable and writable; otherwise return `503` with status `degraded` and named checks.

- [ ] **Step 6: Add runtime scripts and test**

Add:

```json
{
  "forge:api:start": "tsx apps/forge-api/src/main.ts",
  "forge:runner:start": "tsx packages/forge-runner/src/daemon.ts"
}
```

Run:

```bash
npm install --no-audit --no-fund
npm test -- tests/integration/forge-api.test.ts
npm run forge:typecheck
git add apps/forge-api tests/integration/forge-api.test.ts package.json package-lock.json
git commit -m "feat: add ATLAS Forge orchestration API"
```

---

### Task 7: Runner API client and daemon

**Files:**
- Create: `packages/forge-runner/src/apiClient.ts`
- Create: `packages/forge-runner/src/daemon.ts`
- Modify: `packages/forge-runner/src/index.ts`
- Create: `tests/integration/forge-runner-api.test.ts`

**Interfaces:**
- Produces `ForgeApiClient.claim`, `ForgeApiClient.start`, `ForgeApiClient.appendLog`, `ForgeApiClient.complete`, `executeClaimedJob`, and `runDaemon`.

- [ ] **Step 1: Write failing runner/API integration test**

Create a temporary local Git repo with a small npm project, push to `<repos>/atlas.git`, start Forge API, queue its exact SHA, run daemon once, and assert run reaches a terminal state, log contains its pipeline step ID, and checked-out SHA was exact.

- [ ] **Step 2: Verify RED**

```bash
npm test -- tests/integration/forge-runner-api.test.ts
```

- [ ] **Step 3: Implement runner client without credential leakage**

```ts
claim(runnerId: string): Promise<ForgeJobRecord | null>;
start(jobId: string, runnerId: string): Promise<void>;
appendLog(jobId: string, runnerId: string, line: string): Promise<void>;
complete(jobId: string, runnerId: string, result: {
  status: ForgeRunStatus;
  stepResults: readonly ForgeStepResult[];
  artifact: ForgeArtifactRecord | null;
}): Promise<void>;
```

For non-2xx responses throw an error containing status and response text capped at 4 KiB, never Authorization data.

- [ ] **Step 4: Implement exact-SHA claimed job execution**

For each claimed job: derive bare repository path from validated `repositoryId`; create `<home>/workspaces/<jobId>`; call `checkoutExactSha`; call API `start`; execute pipeline; on pass publish the configured artifact directory through `FilesystemArtifactStore`; complete the job; remove workspace in `finally`.

The daemon polls every 2000 ms by default. `--once` performs one claim/no-claim cycle. SIGTERM stops accepting jobs and waits for the active step to finish or time out.

- [ ] **Step 5: Test/typecheck/commit**

```bash
npm test -- tests/unit/forge-runner.test.ts tests/integration/forge-runner-api.test.ts
npm run forge:typecheck
git add packages/forge-runner tests/integration/forge-runner-api.test.ts
git commit -m "feat: connect ATLAS Forge runner to orchestrator"
```

---

### Task 8: Authoritative local source bootstrap and hardened systemd services

**Files:**
- Create: `scripts/forge/bootstrap-local-repository.sh`
- Create: `scripts/forge/sync-git-mirror.sh`
- Create: `infra/forge/systemd/atlas-forge-api.service`
- Create: `infra/forge/systemd/atlas-forge-runner.service`
- Create: `infra/forge/forge.env.example`
- Create: `docs/operations/atlas-forge-bootstrap.md`
- Create/Modify: `.gitignore`

**Interfaces:**
- Produces a local bare repository usable without GitHub and repeatable Linux service contracts.
- Optional remote name `github` may fail without stopping Forge API/runner.

- [ ] **Step 1: Write strict bootstrap script**

```bash
#!/usr/bin/env bash
set -euo pipefail
SOURCE_REPOSITORY=${1:?usage: bootstrap-local-repository.sh <source-working-copy> <forge-home> <repository-id>}
FORGE_HOME=${2:?forge home required}
REPOSITORY_ID=${3:?repository id required}
[[ "$REPOSITORY_ID" =~ ^[a-z0-9][a-z0-9-]{0,63}$ ]] || { echo "invalid repository id" >&2; exit 64; }
mkdir -p "$FORGE_HOME"/{repos,state/runs,state/jobs,logs,audit,artifacts,workspaces,home,npm-cache}
chmod 700 "$FORGE_HOME"
TARGET="$FORGE_HOME/repos/$REPOSITORY_ID.git"
if [[ ! -d "$TARGET" ]]; then
  git clone --mirror "$SOURCE_REPOSITORY" "$TARGET"
fi
git --git-dir "$TARGET" config receive.denyNonFastForwards true
git --git-dir "$TARGET" fsck --full
printf '%s\n' "$TARGET"
```

`sync-git-mirror.sh` accepts `<bare-repository> <remote-name>` and optional `--push`; it fetches/prunes by default, pushes `--mirror` only when explicitly requested, and never silently uses `--force` to reconcile divergence.

- [ ] **Step 2: Add systemd hardening**

Both services use `User=atlas-forge`, `Group=atlas-forge`, `WorkingDirectory=/opt/atlas/atlasenterprisesuite`, `EnvironmentFile=/etc/atlas-forge/forge.env`, `Restart=on-failure`, `NoNewPrivileges=true`, `PrivateTmp=true`, `ProtectHome=true`, `ProtectSystem=strict`, and `ReadWritePaths=/srv/atlas-forge`.

API `ExecStart=/usr/bin/npm run forge:api:start`; runner `ExecStart=/usr/bin/npm run forge:runner:start`.

Add service environment:

```ini
Environment=HOME=/srv/atlas-forge/home
Environment=NPM_CONFIG_CACHE=/srv/atlas-forge/npm-cache
```

- [ ] **Step 3: Add non-secret environment example and operations procedure**

`infra/forge/forge.env.example`:

```dotenv
ATLAS_FORGE_HOME=/srv/atlas-forge
ATLAS_FORGE_REPOSITORIES_ROOT=/srv/atlas-forge/repos
ATLAS_FORGE_PIPELINES_ROOT=/opt/atlas/atlasenterprisesuite/.atlas/forge/pipelines
ATLAS_FORGE_API_URL=http://127.0.0.1:8788
ATLAS_FORGE_BIND=127.0.0.1
ATLAS_FORGE_PORT=8788
ATLAS_FORGE_RUNNER_ID=runner-primary
```

The operations doc instructs the operator to generate `ATLAS_FORGE_CONTROL_TOKEN` and `ATLAS_FORGE_RUNNER_TOKEN` with at least 32 random bytes into `/etc/atlas-forge/forge.env`, `chmod 600` the file, and never paste either value into Git or logs.

- [ ] **Step 4: Ignore runtime state without deleting existing rules**

Ensure `.gitignore` contains:

```gitignore
node_modules/
dist/
.atlas-forge/
*.log
```

- [ ] **Step 5: Validate and commit**

```bash
bash -n scripts/forge/bootstrap-local-repository.sh
bash -n scripts/forge/sync-git-mirror.sh
git add scripts/forge infra/forge docs/operations/atlas-forge-bootstrap.md .gitignore
git commit -m "ops: bootstrap sovereign ATLAS Forge services"
```

---

### Task 9: Sovereign continuity E2E and bootstrap acceptance gate

**Files:**
- Create: `tests/integration/forge-sovereign-ci.test.ts`
- Modify: `package.json`
- Modify: `docs/operations/atlas-forge-bootstrap.md`

**Interfaces:**
- Proves local source + local API + local runner + local Artifact Vault completes a run while `github` mirror is deliberately unavailable.

- [ ] **Step 1: Write the full sovereign integration test**

In one temporary directory:

1. create a source Git repo containing a minimal npm package whose build writes `dist/index.html`;
2. push it to `repos/atlas.git`;
3. add `github` remote pointing to a guaranteed-missing local path and verify `syncMirror(...).state === 'unavailable'`;
4. start Forge API on an ephemeral port;
5. queue exact source SHA with a test `npm` pipeline;
6. execute one runner cycle;
7. fetch run and assert `status === 'passed'`;
8. assert all step results are `passed`;
9. verify the artifact through `FilesystemArtifactStore.verifyArtifact`;
10. assert mirror remains `unavailable` and did not alter run status;
11. assert audit events exist for create, claim, start, and complete.

Central assertions:

```ts
expect(mirror.state).toBe('unavailable');
expect(run.status).toBe('passed');
if (!run.artifact) throw new Error('expected Forge artifact');
expect(run.artifact.verified).toBe(true);
expect(await artifactStore.verifyArtifact(run.artifact)).toBe(true);
```

- [ ] **Step 2: Verify sovereign E2E without network**

```bash
npm test -- tests/integration/forge-sovereign-ci.test.ts
```

Expected: PASS with the GitHub mirror intentionally unavailable.

- [ ] **Step 3: Add focused verification script**

```json
{
  "test:forge": "vitest run --config apps/web/vite.config.ts tests/unit/forge-core.test.ts tests/unit/forge-runner.test.ts tests/unit/forge-artifacts.test.ts tests/integration/forge-git.test.ts tests/integration/forge-api.test.ts tests/integration/forge-runner-api.test.ts tests/integration/forge-sovereign-ci.test.ts"
}
```

- [ ] **Step 4: Run complete bootstrap matrix from final SHA**

```bash
npm ci --no-audit --no-fund
npm run forge:typecheck
npm run test:forge
npm run typecheck
npm run test:unit
npm run test:integration
npm audit --audit-level=high
npm run build
```

Every command must exit `0`. Pre-existing unrelated failures are recorded precisely and keep Milestone 1 from being called green until corrected.

- [ ] **Step 5: Smoke emergency local CI against the complete ATLAS checkout**

```bash
ATLAS_FORGE_HOME="$(mktemp -d)" npm run forge:ci:local
```

Expected: exact current Git SHA is recorded and canonical ATLAS CI executes without GitHub Actions. Do not claim this smoke passed unless it actually ran on a complete checkout.

- [ ] **Step 6: Repository integrity and commit**

```bash
git fsck --full
git status --short
git add tests/integration/forge-sovereign-ci.test.ts package.json package-lock.json docs/operations/atlas-forge-bootstrap.md
git commit -m "test: prove ATLAS Forge sovereign CI continuity"
```

---

## Bootstrap Acceptance Gate

Milestone 1 is accepted only when evidence confirms:

- [ ] ATLAS-controlled bare Git resolves the same exact release SHA as its source copy.
- [ ] `git fsck --full` passes on the local authoritative copy.
- [ ] `npm run forge:ci:local` executes without GitHub Actions.
- [ ] Forge API `/healthz` is `ready` on an ATLAS-controlled host.
- [ ] Runner claims, starts, executes, and completes one exact-SHA job in a disposable workspace.
- [ ] Ambient Forge control/runner tokens do not appear in job environment or logs.
- [ ] Unit, integration, dependency-audit, and web build outcomes have terminal evidence.
- [ ] Artifact Vault publishes and re-verifies SHA-256 content-addressed evidence.
- [ ] Deliberately unavailable `github` mirror reports `unavailable` while sovereign CI still passes.
- [ ] Audit records correlate run creation, claim, start, and completion.
- [ ] systemd API/runner services restart cleanly after process restart.
- [ ] A second independent repository copy or verified backup exists before Forge is called resilient; until then readiness must explicitly say backup verification is pending.
- [ ] No merge to `main`, production deployment, or claim of complete ATLAS Forge occurs from this bootstrap milestone alone.

## Follow-on Plans

After Milestone 1 is green, create separate plans in this order:

1. **Forge Reviews + Consensus Gate** — internal review object, diffs, approvals, merge eligibility, existing 3-of-3 consensus.
2. **Forge Multi-Runner Scheduler + Secret References** — capability labels, leases, retries, short-lived credentials, encrypted secret adapter.
3. **Forge Release Engine** — release candidates, approval, deployment adapters, `/healthz` verification, rollback metadata.
4. **Forge Web UI** — real `/forge/*` operational screens backed only by Forge API state.
5. **Forge Replication + Disaster Recovery** — second independent source/metadata copy, scheduled integrity verification, tested restore.

This bootstrap is first because it removes the current GitHub Actions runner dependency before building the broader Forge product surface.
