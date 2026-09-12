# ATLAS Unified Intelligence — ChatGPT + Codex Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ATLAS Assistant the single user-facing intelligence identity while routing conversational work through the existing OpenAI Responses path and repository-aware engineering work through a governed Codex App Server bridge.

**Architecture:** Extend the existing `supabase/functions/atlas-copilot` Intelligence Gateway instead of creating a second assistant. Add a server-side `apps/codex-bridge` process that owns the long-lived Codex App Server JSONL-over-stdio connection, exposes a minimal authenticated HTTP boundary to ATLAS, and fails closed on all Codex escalation requests. `atlas-copilot` classifies capabilities, enforces ATLAS permissions/cost/approval policy, dispatches engineering tasks through the bridge adapter, and persists the resulting provenance in the same ATLAS conversation lineage.

**Tech Stack:** TypeScript/ES modules, Node.js built-ins for the Codex bridge (`child_process`, `readline`, `http`, `crypto`), Supabase Edge Functions/Deno, Vitest 3, existing OpenAI Responses adapter, Codex App Server JSONL-over-stdio protocol.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-unified-intelligence-chatgpt-codex-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`; implementation branch: `feat/unified-atlas-intelligence`.
- ATLAS Assistant remains the only normal user-facing intelligence identity; do not add a ChatGPT/Codex selector.
- Extend `supabase/functions/atlas-copilot`; do not create a second conversation store, permission system, assistant UI, or orchestration service.
- Codex App Server is the canonical production engineering runtime boundary; SDK use is auxiliary only.
- Codex App Server transport is JSON-RPC-lite/JSONL over stdio. The bridge must perform `initialize` -> `initialized` before `thread/start` / `turn/start`.
- ATLAS permissions and approvals are authoritative. Codex runtime credentials or repository access must never bypass ATLAS RBAC.
- Automated first-slice Codex turns run non-escalating: `approvalPolicy: "never"`; read operations use `sandbox: "read-only"`, authorized local/worktree writes use `sandbox: "workspace-write"`. Never use `danger-full-access` in this implementation.
- Any server-initiated Codex escalation request (`item/commandExecution/requestApproval`, `item/fileChange/requestApproval`, `item/permissions/requestApproval`) must be declined by the bridge. ATLAS approval must occur before a new appropriately-scoped turn is dispatched; the bridge never auto-approves Codex escalation.
- Repository push, merge, deploy/publish, and billable actions remain explicit approval-gated external side effects.
- A broad `intelligence.use` permission does not imply code execution, repository write, repository publish, or domain-specific permissions.
- Never put OpenAI/Codex/GitHub/Supabase/provider secrets in conversation history, task payloads, evidence, logs, or audit records.
- Never claim code was changed, tested, reviewed, committed, pushed, merged, or deployed without structured engineering evidence.
- Preserve one ATLAS conversation lineage across conversational reasoning and Codex engineering runs.
- No production deploy, merge, provider spend, or remote push is required to complete this plan.
- Full verification before completion: `npm run typecheck`, `npm test`, `npm run build`.

---

## File Map

Create or modify only these focused units unless an existing repository pattern discovered during implementation requires an equivalent location:

- `supabase/functions/atlas-copilot/intelligence-gateway.mjs` — capability vocabulary, router, provider selection, existing conversational gateway.
- `supabase/functions/atlas-copilot/intelligence-classifier.mjs` — deterministic request-to-capability classification.
- `supabase/functions/atlas-copilot/codex-contract.mjs` — normalized Codex task/result contracts and execution permission helpers.
- `supabase/functions/atlas-copilot/codex-bridge-adapter.mjs` — authenticated HTTP client from Supabase to the bridge.
- `supabase/functions/atlas-copilot/index.ts` — readiness/status/chat integration, runtime state and unified dispatch.
- `supabase/functions/atlas-copilot/ui.mjs` — single ATLAS Assistant status wording only; no runtime selector.
- `apps/codex-bridge/package.json` — private workspace metadata and bridge scripts.
- `apps/codex-bridge/src/app-server-client.mjs` — Codex App Server JSONL transport and thread/turn lifecycle.
- `apps/codex-bridge/src/task-runner.mjs` — CodexTask -> thread/turn -> CodexResult normalization.
- `apps/codex-bridge/src/server.mjs` — authenticated HTTP `/healthz` and `/v1/tasks` boundary.
- `tests/unit/atlas-intelligence-classifier.test.ts` — capability classification.
- `tests/unit/atlas-codex-contract.test.ts` — permissions, task/result normalization and cost/side-effect policy.
- `tests/unit/atlas-codex-app-server-client.test.ts` — JSONL handshake/events/approval denial using fake transport.
- `tests/unit/atlas-codex-task-runner.test.ts` — evidence/result normalization.
- `tests/unit/atlas-codex-bridge-adapter.test.ts` — bridge HTTP adapter behavior and secret redaction.
- `tests/integration/atlas-unified-intelligence-routing.test.ts` — conversation vs Codex routing without a second identity.
- `tests/integration/atlas-codex-bridge-contract.test.ts` — bridge authentication and request contract.
- `tests/integration/atlas-unified-intelligence-continuity.test.ts` — one conversation lineage through reasoning -> engineering result.

---

### Task 1: Extend the ATLAS intelligence capability vocabulary and classifier

**Files:**
- Create: `supabase/functions/atlas-copilot/intelligence-classifier.mjs`
- Modify: `supabase/functions/atlas-copilot/intelligence-gateway.mjs`
- Test: `tests/unit/atlas-intelligence-classifier.test.ts`

**Interfaces:**
- Consumes: existing `normalizeIntelligenceRequest()` and `createIntelligenceRouter()`.
- Produces: `ATLAS_INTELLIGENCE_CAPABILITIES`, `ENGINEERING_CAPABILITIES`, `classifyIntelligenceRequest(input)`.

- [ ] **Step 1: Write the failing classifier tests**

Create `tests/unit/atlas-intelligence-classifier.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  classifyIntelligenceRequest,
  ENGINEERING_CAPABILITIES
} from '../../supabase/functions/atlas-copilot/intelligence-classifier.mjs';

describe('ATLAS unified intelligence classifier', () => {
  it('keeps explanatory requests on conversational intelligence', () => {
    expect(classifyIntelligenceRequest({ message: 'Explain how payroll accruals work.' })).toEqual({
      capabilities: ['generation', 'reasoning'],
      plane: 'conversation'
    });
  });

  it('routes repository implementation to the engineering plane', () => {
    const result = classifyIntelligenceRequest({
      message: 'Modify the repository code, add tests, and run the build.'
    });
    expect(result.plane).toBe('engineering');
    expect(result.capabilities).toEqual(expect.arrayContaining(['code_analysis', 'code_execution', 'testing', 'repository_operations']));
  });

  it('respects explicit engineering capabilities instead of relying only on text heuristics', () => {
    expect(classifyIntelligenceRequest({
      message: 'Continue.',
      capabilities_requested: ['code_review']
    })).toEqual({ capabilities: ['code_review'], plane: 'engineering' });
  });

  it('publishes the complete engineering vocabulary', () => {
    expect(ENGINEERING_CAPABILITIES).toEqual([
      'code_analysis',
      'code_execution',
      'code_review',
      'testing',
      'repository_operations'
    ]);
  });
});
```

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/unit/atlas-intelligence-classifier.test.ts
```

Expected: FAIL because `intelligence-classifier.mjs` does not exist.

- [ ] **Step 3: Implement deterministic classification**

Create `supabase/functions/atlas-copilot/intelligence-classifier.mjs`:

```js
export const ENGINEERING_CAPABILITIES = Object.freeze([
  'code_analysis',
  'code_execution',
  'code_review',
  'testing',
  'repository_operations'
]);

export const ATLAS_INTELLIGENCE_CAPABILITIES = Object.freeze([
  'generation',
  'reasoning',
  'research',
  ...ENGINEERING_CAPABILITIES
]);

const CODE_ANALYSIS = /\b(repo(?:sitory)?|code|source|diff|branch|commit|pull request|pr)\b/i;
const CODE_EXECUTION = /\b(modify|edit|implement|fix|refactor|create|write|patch)\b.*\b(code|file|repo(?:sitory)?)\b|\b(code|file|repo(?:sitory)?)\b.*\b(modify|edit|implement|fix|refactor|create|write|patch)\b/i;
const TESTING = /\b(test|tests|typecheck|build|lint|vitest|npm test)\b/i;
const REVIEW = /\b(review|inspect diff|code review|review the pr|review the branch)\b/i;
const REPO_OPS = /\b(branch|worktree|commit|repository|repo|git)\b/i;

export function classifyIntelligenceRequest(input = {}) {
  const explicit = Array.isArray(input.capabilities_requested)
    ? [...new Set(input.capabilities_requested.map(String))]
    : [];
  if (explicit.some((capability) => ENGINEERING_CAPABILITIES.includes(capability))) {
    return Object.freeze({ capabilities: explicit, plane: 'engineering' });
  }

  const message = String(input.message || '');
  const capabilities = [];
  if (CODE_ANALYSIS.test(message)) capabilities.push('code_analysis');
  if (CODE_EXECUTION.test(message)) capabilities.push('code_execution');
  if (REVIEW.test(message)) capabilities.push('code_review');
  if (TESTING.test(message)) capabilities.push('testing');
  if (REPO_OPS.test(message)) capabilities.push('repository_operations');

  if (capabilities.length) {
    return Object.freeze({ capabilities: [...new Set(capabilities)], plane: 'engineering' });
  }

  return Object.freeze({ capabilities: ['generation', 'reasoning'], plane: 'conversation' });
}
```

Modify `intelligence-gateway.mjs` so its exported capability constant derives from `ATLAS_INTELLIGENCE_CAPABILITIES` rather than the current two-value array, and `normalizeIntelligenceRequest()` validates against that shared vocabulary.

- [ ] **Step 4: Run GREEN**

```bash
npx vitest run tests/unit/atlas-intelligence-classifier.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/atlas-copilot/intelligence-classifier.mjs supabase/functions/atlas-copilot/intelligence-gateway.mjs tests/unit/atlas-intelligence-classifier.test.ts
git commit -m "feat: classify unified intelligence capabilities"
```

---

### Task 2: Define Codex task/result contracts and ATLAS engineering permissions

**Files:**
- Create: `supabase/functions/atlas-copilot/codex-contract.mjs`
- Test: `tests/unit/atlas-codex-contract.test.ts`

**Interfaces:**
- Consumes: normalized ATLAS principal shape from `agentic-core.mjs` / auth context.
- Produces: `ENGINEERING_PERMISSIONS`, `requiredEngineeringPermission(capabilities)`, `normalizeCodexTask(input)`, `normalizeCodexResult(input)`, `assertEngineeringAuthorized(context, task)`.

- [ ] **Step 1: Write failing contract tests**

Create `tests/unit/atlas-codex-contract.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  assertEngineeringAuthorized,
  normalizeCodexResult,
  normalizeCodexTask,
  requiredEngineeringPermission
} from '../../supabase/functions/atlas-copilot/codex-contract.mjs';

describe('ATLAS Codex task contract', () => {
  it('maps read-only analysis to intelligence.code.read', () => {
    expect(requiredEngineeringPermission(['code_analysis'])).toBe('intelligence.code.read');
  });

  it('maps code edits/tests to code execution permission', () => {
    expect(requiredEngineeringPermission(['code_execution', 'testing'])).toBe('intelligence.code.execute');
  });

  it('requires explicit repository write permission for commit-capable operations', () => {
    expect(requiredEngineeringPermission(['repository_operations'], { repositoryMutation: true })).toBe('intelligence.repository.write');
  });

  it('rejects organization mismatch before execution', () => {
    const task = normalizeCodexTask({
      id: 'task-1', organization_id: 'org-2', user_id: 'user-1', conversation_id: 'conv-1', request_id: 'req-1',
      repository: 'atlasenterprisesuite/atlasenterprisesuite', base_ref: 'main', working_branch: null,
      goal: 'Inspect code', requirements: [], constraints: [], allowed_operations: ['read'], approval_state: 'not_required',
      execution_mode: 'read_only', test_requirements: [], capabilities: ['code_analysis']
    });
    expect(() => assertEngineeringAuthorized({ organization_id: 'org-1', user_id: 'user-1', permissions: ['intelligence.code.read'] }, task))
      .toThrow('tenant_mismatch');
  });

  it('does not allow intelligence.use to imply code execution', () => {
    const task = normalizeCodexTask({
      id: 'task-1', organization_id: 'org-1', user_id: 'user-1', conversation_id: 'conv-1', request_id: 'req-1',
      repository: 'atlasenterprisesuite/atlasenterprisesuite', base_ref: 'main', working_branch: 'feat/x',
      goal: 'Edit code', requirements: [], constraints: [], allowed_operations: ['read', 'write'], approval_state: 'approved',
      execution_mode: 'workspace_write', test_requirements: [], capabilities: ['code_execution']
    });
    expect(() => assertEngineeringAuthorized({ organization_id: 'org-1', user_id: 'user-1', permissions: ['intelligence.use'] }, task))
      .toThrow('repository_permission_denied');
  });

  it('never upgrades a failed validation result to completed', () => {
    expect(normalizeCodexResult({
      task_id: 'task-1', status: 'completed', repository: 'o/r', branch: 'feat/x',
      commands: ['npm test'], tests: [{ command: 'npm test', passed: false }]
    }).status).toBe('failed');
  });
});
```

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/unit/atlas-codex-contract.test.ts
```

Expected: FAIL because `codex-contract.mjs` does not exist.

- [ ] **Step 3: Implement the normalized contract**

Create `codex-contract.mjs` with these permission constants:

```js
export const ENGINEERING_PERMISSIONS = Object.freeze([
  'intelligence.code.read',
  'intelligence.code.execute',
  'intelligence.code.review',
  'intelligence.repository.write',
  'intelligence.repository.publish'
]);
```

Implement `requiredEngineeringPermission()` with strict precedence:

```js
export function requiredEngineeringPermission(capabilities = [], options = {}) {
  if (options.publish === true) return 'intelligence.repository.publish';
  if (options.repositoryMutation === true) return 'intelligence.repository.write';
  if (capabilities.includes('code_execution') || capabilities.includes('testing')) return 'intelligence.code.execute';
  if (capabilities.includes('code_review')) return 'intelligence.code.review';
  return 'intelligence.code.read';
}
```

`normalizeCodexTask()` must require non-empty `id`, `organization_id`, `user_id`, `conversation_id`, `request_id`, `repository`, `base_ref`, and `goal`; copy only documented task fields; reject `danger_full_access`; and reduce `execution_mode` to `read_only | workspace_write`.

`assertEngineeringAuthorized()` must check exact organization match, exact user match, then the permission returned by `requiredEngineeringPermission()`; wildcard `*` may satisfy a permission only if the existing ATLAS principal already legitimately contains it.

`normalizeCodexResult()` must normalize to `planned | running | blocked | awaiting_approval | failed | completed` and force `failed` when any requested test/build/typecheck result is explicitly false.

- [ ] **Step 4: Run GREEN**

```bash
npx vitest run tests/unit/atlas-codex-contract.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/atlas-copilot/codex-contract.mjs tests/unit/atlas-codex-contract.test.ts
git commit -m "feat: add governed Codex task contracts"
```

---

### Task 3: Build a fail-closed Codex App Server JSONL client

**Files:**
- Create: `apps/codex-bridge/package.json`
- Create: `apps/codex-bridge/src/app-server-client.mjs`
- Test: `tests/unit/atlas-codex-app-server-client.test.ts`

**Interfaces:**
- Consumes: Codex App Server executable path and injected transport/spawn function.
- Produces: `CodexAppServerClient` with `start()`, `startThread(params)`, `startTurn(params)`, `close()`.

- [ ] **Step 1: Write failing protocol tests with an in-memory fake process**

The test must verify all of these exact behaviors:

```ts
expect(sent[0].method).toBe('initialize');
expect(sent[1].method).toBe('initialized');
expect(threadStart.params.approvalPolicy).toBe('never');
expect(['read-only', 'workspace-write']).toContain(threadStart.params.sandbox);
expect(approvalReply.result).toEqual({ decision: 'decline' });
expect(result.status).toBe('completed');
```

The fake transport emits, in order: initialize response, `thread/start` response, `turn/start` response, an optional `item/commandExecution/requestApproval` server request, item notifications, and `turn/completed`.

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/unit/atlas-codex-app-server-client.test.ts
```

Expected: FAIL because the bridge client does not exist.

- [ ] **Step 3: Add workspace metadata**

Create `apps/codex-bridge/package.json`:

```json
{
  "name": "@atlas/codex-bridge",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "start": "node src/server.mjs"
  }
}
```

- [ ] **Step 4: Implement the JSONL client**

`CodexAppServerClient` must:

1. Spawn `[CODEX_CLI_PATH || "codex", "app-server"]` through an injected `spawnFn` (default Node `spawn`).
2. Parse stdout one line at a time as JSON; never log raw environment or stderr containing credentials.
3. Send request objects in the App Server JSON-RPC-lite shape `{ id, method, params }` and notifications `{ method, params }` without adding a required `jsonrpc` field.
4. On `start()`, send:

```js
{ id: 1, method: 'initialize', params: { clientInfo: { name: 'atlas-codex-bridge', version: '0.1.0' }, capabilities: { experimentalApi: false } } }
```

then, only after success:

```js
{ method: 'initialized', params: {} }
```

5. `startThread({ cwd, mode, model })` sends `thread/start` with:

```js
{
  cwd,
  approvalPolicy: 'never',
  sandbox: mode === 'workspace_write' ? 'workspace-write' : 'read-only',
  model: model || null,
  ephemeral: false,
  serviceName: 'atlas-intelligence',
  developerInstructions: 'Operate only inside the supplied repository/worktree. Do not push, merge, deploy, publish, access secrets, or request privilege escalation. Produce verifiable command/test/file-change evidence.'
}
```

6. `startTurn()` sends `turn/start` with the thread id and a text input item. Collect item/turn events until the matching `turn/completed` notification.
7. On any server request whose method is `item/commandExecution/requestApproval` or `item/fileChange/requestApproval`, reply with `{ id, result: { decision: 'decline' } }`.
8. On `item/permissions/requestApproval`, reply with `{ id, result: { permissions: [] } }` if that is the generated schema for the pinned runtime; otherwise use the generated schema output from `codex app-server generate-ts` and implement the exact deny shape before marking Task 3 complete. Never accept/grant permissions.
9. Unknown server requests receive a method-not-supported error response rather than remaining pending.
10. Reject the turn with `engineering_execution_failed` if the process exits before `turn/completed`.

At implementation time, run `codex app-server generate-ts` against the installed/tested Codex binary and save only the generated protocol subset needed for the consumed methods in the task report; do not commit the entire generated schema unless required by the implementation.

- [ ] **Step 5: Run GREEN**

```bash
npx vitest run tests/unit/atlas-codex-app-server-client.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/codex-bridge tests/unit/atlas-codex-app-server-client.test.ts
git commit -m "feat: add Codex App Server client"
```

---

### Task 4: Normalize App Server events into verifiable ATLAS engineering evidence

**Files:**
- Create: `apps/codex-bridge/src/task-runner.mjs`
- Test: `tests/unit/atlas-codex-task-runner.test.ts`

**Interfaces:**
- Consumes: `CodexAppServerClient`, normalized CodexTask shape from Task 2 (wire-compatible JSON).
- Produces: `createCodexTaskRunner({ client, workspaceResolver, clock })` and structured CodexResult.

- [ ] **Step 1: Write failing evidence tests**

Test a fake turn containing:

- one `commandExecution` item for `npm test` with exit code 0;
- one `fileChange` item changing `src/a.ts`;
- one final agent message;
- `turn/completed` status completed.

Assert:

```ts
expect(result.status).toBe('completed');
expect(result.changed_files).toEqual(['src/a.ts']);
expect(result.commands).toEqual(expect.arrayContaining(['npm test']));
expect(result.tests).toEqual(expect.arrayContaining([{ command: 'npm test', passed: true }]));
expect(result.evidence.length).toBeGreaterThan(0);
```

Also test exit code 1 yields `failed` when the command matches a required test command.

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/unit/atlas-codex-task-runner.test.ts
```

- [ ] **Step 3: Implement the task runner**

`workspaceResolver(task)` returns an absolute existing repository/worktree path and must reject paths outside configured roots.

For read-only tasks call `startThread(... mode: 'read_only')`; for authorized code edits call `mode: 'workspace_write'`.

Build the turn prompt from `goal`, `requirements`, `constraints`, `allowed_operations`, and `test_requirements`; do not include arbitrary conversation history or secrets.

Normalize only observable events into evidence:

```js
{
  kind: 'command' | 'file_change' | 'test' | 'assistant_result',
  reference: string,
  verified: boolean
}
```

A command with non-zero exit code is verified evidence of failure, not success. `completed` is allowed only when App Server completed the turn and all required test commands observed in the event stream passed.

- [ ] **Step 4: Run GREEN**

```bash
npx vitest run tests/unit/atlas-codex-task-runner.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/codex-bridge/src/task-runner.mjs tests/unit/atlas-codex-task-runner.test.ts
git commit -m "feat: normalize Codex engineering evidence"
```

---

### Task 5: Expose the Codex bridge through an authenticated server-side HTTP boundary

**Files:**
- Create: `apps/codex-bridge/src/server.mjs`
- Test: `tests/integration/atlas-codex-bridge-contract.test.ts`

**Interfaces:**
- Consumes: `createCodexTaskRunner()`.
- Produces: `GET /healthz` and `POST /v1/tasks`.

- [ ] **Step 1: Write failing bridge contract tests**

Required assertions:

```ts
expect((await unauthenticatedResponse).status).toBe(401);
expect((await healthResponse.json()).service).toBe('atlas-codex-bridge');
expect((await taskResponse.json()).task_id).toBe('task-1');
expect(JSON.stringify(await taskResponse.json())).not.toContain('bridge-secret');
```

Use an injected task runner so the test never invokes a paid provider or real Codex process.

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/integration/atlas-codex-bridge-contract.test.ts
```

- [ ] **Step 3: Implement the server**

Use Node `http.createServer` only; do not add an HTTP framework dependency.

Environment contract:

- `ATLAS_CODEX_BRIDGE_TOKEN` — required bearer secret; server refuses startup if empty.
- `ATLAS_CODEX_ALLOWED_ROOTS` — platform-delimited absolute workspace roots; task path resolution must stay below one of them.
- `CODEX_CLI_PATH` — optional binary path, default `codex`.
- `PORT` — optional, default `8788`.

Authenticate `Authorization: Bearer <token>` using `crypto.timingSafeEqual` on equal-length buffers.

`GET /healthz` returns only non-secret readiness:

```json
{
  "ok": true,
  "service": "atlas-codex-bridge",
  "runtime": "codex-app-server",
  "configured": true
}
```

`POST /v1/tasks` parses one normalized CodexTask, calls the runner, and returns one CodexResult. Request/response logs may include task id, repository, result status, and duration; never authorization headers, environment, prompts, or raw provider errors.

- [ ] **Step 4: Run GREEN**

```bash
npx vitest run tests/integration/atlas-codex-bridge-contract.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/codex-bridge/src/server.mjs tests/integration/atlas-codex-bridge-contract.test.ts
git commit -m "feat: expose authenticated Codex bridge"
```

---

### Task 6: Add the Supabase-to-Codex bridge adapter with truthful readiness

**Files:**
- Create: `supabase/functions/atlas-copilot/codex-bridge-adapter.mjs`
- Test: `tests/unit/atlas-codex-bridge-adapter.test.ts`

**Interfaces:**
- Consumes: bridge URL/token from server-side environment and CodexTask.
- Produces: `createCodexBridgeAdapter({ baseUrl, token, fetchFn })` with `descriptor()`, `probe()`, `execute()`.

- [ ] **Step 1: Write failing adapter tests**

Cover:

- missing URL/token -> `configured:false`, `verified:false`;
- `/healthz` success -> verified engineering provider;
- 401/403 -> `code_runtime_unverified` without leaking token;
- network error -> `provider_unavailable`;
- successful task -> normalized CodexResult;
- response text/logging never contains bearer token.

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/unit/atlas-codex-bridge-adapter.test.ts
```

- [ ] **Step 3: Implement adapter**

Descriptor must be exactly provider-neutral at the ATLAS layer:

```js
{
  id: 'codex-app-server',
  configured: Boolean(baseUrl && token),
  capabilities: ['code_analysis', 'code_execution', 'code_review', 'testing', 'repository_operations'],
  profiles: ['fast', 'balanced', 'deep'],
  runtime: 'codex-app-server'
}
```

`probe()` calls `GET ${baseUrl}/healthz` with the bearer token; `execute()` calls `POST ${baseUrl}/v1/tasks` with the normalized task. Normalize HTTP 401/403 to `code_runtime_unverified`, 429 to `provider_rate_limited`, >=500/network errors to `provider_unavailable`.

- [ ] **Step 4: Run GREEN**

```bash
npx vitest run tests/unit/atlas-codex-bridge-adapter.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/atlas-copilot/codex-bridge-adapter.mjs tests/unit/atlas-codex-bridge-adapter.test.ts
git commit -m "feat: add Codex bridge adapter"
```

---

### Task 7: Route one ATLAS Intelligence request to conversation or Codex without changing identity

**Files:**
- Modify: `supabase/functions/atlas-copilot/intelligence-gateway.mjs`
- Modify: `supabase/functions/atlas-copilot/index.ts`
- Test: `tests/integration/atlas-unified-intelligence-routing.test.ts`

**Interfaces:**
- Consumes: classifier, OpenAI Responses adapter, Codex bridge adapter, Codex contract/permissions.
- Produces: one unified `handleChat()` behavior and one provider resolver selected by capability.

- [ ] **Step 1: Write failing routing integration tests**

Use fake adapters and fake store. Verify:

```ts
expect(conversationResult.provider).toBe('openai');
expect(engineeringResult.provider).toBe('codex-app-server');
expect(engineeringResult.conversation_id).toBe(conversationResult.conversation_id);
expect(engineeringResult.execution_state).toBe('completed');
```

Also assert a user with only `intelligence.use` receives `repository_permission_denied` for `code_execution`, and an unavailable bridge returns `code_runtime_not_configured` or `code_runtime_unverified`, never a fake completed state.

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/integration/atlas-unified-intelligence-routing.test.ts
```

- [ ] **Step 3: Extend the router/gateway**

Refactor `createIntelligenceGateway` to accept `providers` as a provider-id keyed map or a `resolveProvider(route)` function instead of a single provider instance. Preserve existing OpenAI conversational behavior exactly.

The gateway flow becomes:

```text
normalize request
-> classify/request capabilities
-> create/continue same ATLAS conversation
-> router selects verified provider by capabilities
-> conversational route: existing OpenAI adapter
-> engineering route: build normalized CodexTask + assertEngineeringAuthorized
-> execute provider
-> persist assistant result/provenance
-> complete telemetry
```

Engineering task IDs and trace IDs use `crypto.randomUUID()`.

For the first slice, `repositoryMutation` is true only when the normalized task allows `write` or `commit`; push/merge/deploy/publish operations are rejected before the bridge with `approval_required` because this plan does not implement remote side-effect execution.

- [ ] **Step 4: Wire runtime configuration in `index.ts`**

Add server-only environment reads:

```ts
const CODEX_BRIDGE_URL = Deno.env.get('ATLAS_CODEX_BRIDGE_URL') || '';
const CODEX_BRIDGE_TOKEN = Deno.env.get('ATLAS_CODEX_BRIDGE_TOKEN') || '';
```

Do not return either value from readiness/status.

`handleStatus`/readiness may expose:

```json
{
  "assistant": "ATLAS Assistant",
  "capabilities": ["generation","reasoning","research","code_analysis","code_execution","code_review","testing","repository_operations"],
  "runtimes": {
    "conversation": "verified|configured_unverified|not_configured|unavailable",
    "engineering": "verified|configured_unverified|not_configured|unavailable"
  }
}
```

No normal user-facing field should ask the client to choose a runtime.

- [ ] **Step 5: Run GREEN**

```bash
npx vitest run tests/integration/atlas-unified-intelligence-routing.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/atlas-copilot/intelligence-gateway.mjs supabase/functions/atlas-copilot/index.ts tests/integration/atlas-unified-intelligence-routing.test.ts
git commit -m "feat: route ATLAS intelligence to Codex"
```

---

### Task 8: Preserve one conversation lineage and engineering provenance

**Files:**
- Modify: `supabase/functions/atlas-copilot/atlas-intelligence-store.mjs` only if its current provenance shape cannot store engineering metadata without schema changes; otherwise leave it unchanged.
- Modify: `supabase/functions/atlas-copilot/intelligence-gateway.mjs`
- Test: `tests/integration/atlas-unified-intelligence-continuity.test.ts`

**Interfaces:**
- Consumes: existing conversation/message store and CodexResult.
- Produces: persistent provenance linking conversation -> request/trace -> engineering task -> repository/branch/head/test evidence.

- [ ] **Step 1: Write failing continuity tests**

Simulate two sequential requests using the same conversation id:

1. conversational: “Plan the accounting fix.”
2. engineering: “Implement it and run tests.”

Assert both user/assistant turns are stored in the same conversation and the engineering assistant message contains provenance objects with only non-secret fields:

```ts
expect(provenance).toEqual(expect.arrayContaining([
  expect.objectContaining({ kind: 'engineering_task', task_id: 'task-1' }),
  expect.objectContaining({ kind: 'repository', repository: 'atlasenterprisesuite/atlasenterprisesuite' }),
  expect.objectContaining({ kind: 'test', command: 'npm test', passed: true })
]));
```

Assert no provenance field contains task prompt text, authorization token, environment values, or chain-of-thought.

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/integration/atlas-unified-intelligence-continuity.test.ts
```

- [ ] **Step 3: Implement engineering provenance mapping**

Add a pure helper inside `intelligence-gateway.mjs` (or a focused `engineering-provenance.mjs` if it exceeds ~80 lines) that maps CodexResult to bounded provenance:

- task id;
- repository;
- branch;
- base/head SHA when present;
- changed file names;
- command names;
- test/build/typecheck pass/fail;
- blocker/error code;
- runtime id.

Do not persist raw command output unless an existing evidence store explicitly supports bounded/redacted logs.

- [ ] **Step 4: Run GREEN**

```bash
npx vitest run tests/integration/atlas-unified-intelligence-continuity.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/atlas-copilot/intelligence-gateway.mjs supabase/functions/atlas-copilot/atlas-intelligence-store.mjs tests/integration/atlas-unified-intelligence-continuity.test.ts
git commit -m "feat: persist unified intelligence provenance"
```

If `atlas-intelligence-store.mjs` required no change, omit it from `git add`.

---

### Task 9: Present one ATLAS Assistant, verify regression safety, and prepare runtime handoff

**Files:**
- Modify: `supabase/functions/atlas-copilot/ui.mjs`
- Modify: `supabase/functions/atlas-copilot/index.ts`
- Create: `docs/superpowers/handoffs/2026-09-12-atlas-unified-intelligence-runtime-handoff.md`
- Test: `tests/integration/atlas-unified-intelligence-ui-contract.test.ts`

**Interfaces:**
- Consumes: unified readiness/status and routing behavior from Tasks 1-8.
- Produces: one user-facing ATLAS Assistant identity plus deployment/runtime requirements document.

- [ ] **Step 1: Write failing UI contract test**

Read `ui.mjs` and rendered output. Assert it contains `ATLAS Assistant`, may contain execution-state labels `Reasoning`, `Coding`, `Testing`, `Reviewing`, `Awaiting approval`, `Blocked`, `Completed`, and does **not** render a normal control whose purpose is choosing `ChatGPT` versus `Codex`.

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/integration/atlas-unified-intelligence-ui-contract.test.ts
```

- [ ] **Step 3: Update UI/status wording**

Keep the existing surface and navigation. Replace runtime/product-choice wording with one identity and capability-state wording. Runtime/provider/model details may remain only in diagnostic/admin metadata.

- [ ] **Step 4: Create the runtime handoff**

`docs/superpowers/handoffs/2026-09-12-atlas-unified-intelligence-runtime-handoff.md` must state exactly:

- Codex bridge requires a server/container/VM capable of launching the Codex CLI binary;
- required env vars: `ATLAS_CODEX_BRIDGE_TOKEN`, `ATLAS_CODEX_ALLOWED_ROOTS`, optional `CODEX_CLI_PATH`, `PORT`;
- Supabase `atlas-copilot` requires `ATLAS_CODEX_BRIDGE_URL` and matching `ATLAS_CODEX_BRIDGE_TOKEN`;
- the Codex bridge must not be publicly reachable without authentication/network controls;
- repository credentials belong only in the controlled bridge runtime, never Supabase client/browser code;
- initial runtime must be verified with read-only task before enabling workspace writes;
- push, merge, deploy, publish, and paid actions remain disabled/approval-gated;
- no production runtime was provisioned or deployed by this implementation plan.

- [ ] **Step 5: Run focused tests**

```bash
npx vitest run tests/unit/atlas-intelligence-classifier.test.ts tests/unit/atlas-codex-contract.test.ts tests/unit/atlas-codex-app-server-client.test.ts tests/unit/atlas-codex-task-runner.test.ts tests/unit/atlas-codex-bridge-adapter.test.ts tests/integration/atlas-codex-bridge-contract.test.ts tests/integration/atlas-unified-intelligence-routing.test.ts tests/integration/atlas-unified-intelligence-continuity.test.ts tests/integration/atlas-unified-intelligence-ui-contract.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run full repository verification**

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Expected: all commands exit 0. If an existing baseline failure unrelated to this branch is discovered, record exact command/output and compare against `main`; do not relabel it as a feature success.

- [ ] **Step 7: Secret and unsafe-policy scan**

Run:

```bash
grep -R "danger-full-access\|ATLAS_CODEX_BRIDGE_TOKEN=.*\|Authorization: Bearer" apps/codex-bridge supabase/functions/atlas-copilot --exclude='*.test.*' || true
```

Expected: no hardcoded bridge token and no `danger-full-access`; source may contain header construction code but never a literal credential value.

Also inspect the branch diff for API keys, tokens, private certificates, passwords, recovery codes, or copied environment values.

- [ ] **Step 8: Commit final integration/handoff**

```bash
git add apps/codex-bridge supabase/functions/atlas-copilot tests docs/superpowers/handoffs/2026-09-12-atlas-unified-intelligence-runtime-handoff.md
git commit -m "feat: unify ATLAS Assistant with Codex engineering"
```

- [ ] **Step 9: Final review gate**

Perform independent whole-branch review against the design spec and this plan. Specifically verify:

- one ATLAS Assistant identity;
- no ChatGPT/Codex selector;
- App Server integration is behind the bridge, not inside browser code;
- fail-closed Codex approval handling;
- no `danger-full-access`;
- tenant/RBAC checks occur before bridge execution;
- unavailable bridge produces a blocker/error rather than fake execution;
- evidence controls completion state;
- one conversation lineage persists across both planes;
- no remote push, merge, deployment, or provider spend occurred.

Stop before merge/deploy and present the branch for approval.
