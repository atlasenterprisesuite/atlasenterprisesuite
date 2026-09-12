# ATLAS Automations & Shortcuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build ATLAS Automations & Shortcuts v0.1 as a tenant-scoped, RBAC-protected, auditable automation core using `Trigger → Conditions → Actions → Permissions → Result`.

**Architecture:** Add a focused `src/modules/automations/` subsystem with pure shortcut validation, an allowlisted action registry, a deterministic execution engine, a tenant-scoped in-memory store, immutable built-in templates, and a service layer that owns RBAC and audit recording. Extend the existing Core permission matrix rather than introducing a parallel authorization model.

**Tech Stack:** Node.js >=22, ECMAScript modules, `node:test`, `node:assert/strict`, built-in `crypto.randomUUID`, `structuredClone`.

**Spec:** `docs/superpowers/specs/2026-09-03-atlas-automations-shortcuts-design.md`

## Global Constraints

- Node.js 22 or newer.
- ECMAScript modules only.
- Tests use Node's built-in `node:test` and `node:assert/strict`.
- No `eval`, `Function` constructor, shell execution, or arbitrary dynamic import from shortcut payloads.
- All shortcut and execution data is tenant-scoped.
- Only allowlisted action adapters execute.
- RBAC is enforced in the service layer.
- No fake network/provider connectivity or fabricated success.
- Missing adapters produce `ACTION_UNAVAILABLE`.
- Secrets, tokens, credentials, and raw authorization material must not enter audit records.
- Existing Site Review behavior and tests must remain intact.

---

## File Map

**Create**
- `src/modules/automations/errors.js` — stable domain error type/codes.
- `src/modules/automations/shortcut-definition.js` — normalization, schema validation, declarative-payload safety.
- `src/modules/automations/action-registry.js` — allowlisted adapter registration/execution.
- `src/modules/automations/automation-engine.js` — trigger/condition evaluation and sequential actions.
- `src/modules/automations/automation-store.js` — tenant-scoped in-memory shortcuts and execution records.
- `src/modules/automations/templates.js` — frozen built-in templates.
- `src/modules/automations/automation-service.js` — RBAC, CRUD, enable/disable, execution, audit access.
- `tests/shortcut-definition.test.mjs`
- `tests/action-registry.test.mjs`
- `tests/automation-engine.test.mjs`
- `tests/automation-store.test.mjs`
- `tests/automation-service.test.mjs`
- `tests/automation-templates.test.mjs`

**Modify**
- `src/core/permissions.js` — append automation capabilities to existing roles.
- `tests/permissions.test.mjs` — verify the expanded matrix without weakening Site Review assertions.

---

### Task 1: Domain Errors and Shortcut Definition

**Files:**
- Create: `src/modules/automations/errors.js`
- Create: `src/modules/automations/shortcut-definition.js`
- Test: `tests/shortcut-definition.test.mjs`

**Interfaces:**
- Produces: `AutomationError`, `ERROR_CODES`, `createShortcutDefinition(input, deps?)`, `validateShortcutDefinition(input)`.
- `createShortcutDefinition` returns a deep-cloned normalized shortcut and accepts optional `{ now, id }` injection for deterministic tests.

- [ ] **Step 1: Write failing shortcut tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createShortcutDefinition } from '../src/modules/automations/shortcut-definition.js';

const fixedNow = () => '2026-09-03T12:00:00.000Z';
const fixedId = () => 'shortcut-1';

test('creates a disabled normalized shortcut with defaults', () => {
  const shortcut = createShortcutDefinition({
    tenantId: 'tenant-a',
    name: 'Start Work',
    trigger: { type: 'manual', config: {} },
    actions: [{ type: 'atlas.workspace.open', input: {} }],
    createdBy: 'user-1'
  }, { now: fixedNow, id: fixedId });

  assert.equal(shortcut.id, 'shortcut-1');
  assert.equal(shortcut.enabled, false);
  assert.deepEqual(shortcut.conditions, []);
  assert.equal(shortcut.actions[0].required, true);
});

test('rejects arbitrary executable shortcut payloads', () => {
  assert.throws(() => createShortcutDefinition({
    tenantId: 'tenant-a',
    name: 'Unsafe',
    trigger: { type: 'manual', config: {} },
    actions: [{ type: 'atlas.test', input: { command: 'rm -rf /' } }],
    createdBy: 'user-1'
  }), (error) => error.code === 'INVALID_SHORTCUT');
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/shortcut-definition.test.mjs`
Expected: FAIL because `shortcut-definition.js` does not exist.

- [ ] **Step 3: Implement minimal domain error and validator**

```js
export class AutomationError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'AutomationError';
    this.code = code;
    this.details = details;
  }
}

export const ERROR_CODES = Object.freeze({
  INVALID_SHORTCUT: 'INVALID_SHORTCUT',
  SHORTCUT_NOT_FOUND: 'SHORTCUT_NOT_FOUND',
  SHORTCUT_DISABLED: 'SHORTCUT_DISABLED',
  TRIGGER_MISMATCH: 'TRIGGER_MISMATCH',
  CONDITIONS_UNMET: 'CONDITIONS_UNMET',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  ACTION_UNAVAILABLE: 'ACTION_UNAVAILABLE',
  ACTION_FAILED: 'ACTION_FAILED',
  DUPLICATE_ACTION_TYPE: 'DUPLICATE_ACTION_TYPE'
});
```

`shortcut-definition.js` must whitelist trigger types (`manual`, `schedule`, `module.event`, `network.event`), condition operators (`equals`, `notEquals`, `in`, `exists`), require non-empty action types, default `required` to `true`, and recursively reject forbidden keys named `command`, `shell`, `script`, `eval`, `function`, or `dynamicImport` anywhere inside trigger config, conditions, or action input.

- [ ] **Step 4: Run GREEN**

Run: `node --test tests/shortcut-definition.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/automations/errors.js src/modules/automations/shortcut-definition.js tests/shortcut-definition.test.mjs
git commit -m "feat: add automation shortcut definition"
```

---

### Task 2: Action Registry

**Files:**
- Create: `src/modules/automations/action-registry.js`
- Test: `tests/action-registry.test.mjs`

**Interfaces:**
- Consumes: `AutomationError`, `ERROR_CODES`.
- Produces: `createActionRegistry()` returning `{ register, has, execute }`.
- Adapter contract: `async ({ tenantId, actor, shortcut, input, services }) => output`.
- `execute(type, context)` returns `{ type, status, output?, errorCode? }` and converts adapter exceptions to `ACTION_FAILED`.

- [ ] **Step 1: Write failing registry tests**

```js
test('executes only a registered action adapter', async () => {
  const registry = createActionRegistry();
  registry.register('atlas.echo', async ({ input }) => ({ echoed: input.value }));
  const result = await registry.execute('atlas.echo', {
    tenantId: 'tenant-a', actor: { userId: 'u1' }, shortcut: { id: 's1' }, input: { value: 7 }, services: {}
  });
  assert.deepEqual(result, { type: 'atlas.echo', status: 'success', output: { echoed: 7 } });
});

test('marks a missing adapter unavailable', async () => {
  const registry = createActionRegistry();
  const result = await registry.execute('atlas.network.scan', { tenantId: 't', actor: {}, shortcut: {}, input: {}, services: {} });
  assert.equal(result.status, 'unavailable');
  assert.equal(result.errorCode, 'ACTION_UNAVAILABLE');
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/action-registry.test.mjs`
Expected: FAIL because registry module is missing.

- [ ] **Step 3: Implement registry**

Use a private `Map`. `register(type, adapter)` validates non-empty type/function and throws `DUPLICATE_ACTION_TYPE` on duplicate. `execute` never imports code dynamically and never treats an unregistered action as successful.

- [ ] **Step 4: Run GREEN**

Run: `node --test tests/action-registry.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/automations/action-registry.js tests/action-registry.test.mjs
git commit -m "feat: add automation action registry"
```

---

### Task 3: Automation Engine

**Files:**
- Create: `src/modules/automations/automation-engine.js`
- Test: `tests/automation-engine.test.mjs`

**Interfaces:**
- Consumes: action registry.
- Produces: `createAutomationEngine({ registry, now?, id? })` returning `{ execute }`.
- `execute({ shortcut, event, actor, services? })` returns an execution record.

- [ ] **Step 1: Write failing engine tests**

Test these independent behaviors:

```js
test('skips when conditions are unmet', async () => {
  const result = await engine.execute({
    shortcut: enabledShortcut({ conditions: [{ type: 'equals', path: 'event.status', value: 'ready' }] }),
    event: { type: 'manual', status: 'blocked' },
    actor
  });
  assert.equal(result.status, 'skipped');
  assert.deepEqual(result.actionResults, []);
});

test('stops after a failed required action', async () => {
  assert.equal(result.status, 'failed');
  assert.equal(result.actionResults.length, 1);
});

test('continues after a failed optional action', async () => {
  assert.equal(result.actionResults.length, 2);
  assert.equal(result.actionResults[1].status, 'success');
});
```

Also cover disabled shortcut, trigger mismatch, all four condition operators, unknown paths, schedule/module/network event matching, and unavailable adapters.

- [ ] **Step 2: Run RED**

Run: `node --test tests/automation-engine.test.mjs`
Expected: FAIL because engine module is missing.

- [ ] **Step 3: Implement deterministic engine**

Implementation rules:
- disabled shortcut => execution `status: 'skipped'`, no actions;
- mismatched trigger => `status: 'skipped'`, no actions;
- unmet conditions => `status: 'skipped'`, no actions;
- action status `failed` or `unavailable` stops execution when `required !== false`;
- optional failures continue;
- engine output contains `executionId`, `shortcutId`, `tenantId`, `actorUserId`, `triggerType`, `status`, `startedAt`, `finishedAt`, `actionResults`;
- do not serialize actor/session secrets into the record.

- [ ] **Step 4: Run GREEN**

Run: `node --test tests/automation-engine.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/automations/automation-engine.js tests/automation-engine.test.mjs
git commit -m "feat: add automation execution engine"
```

---

### Task 4: Tenant-Scoped Store and Audit Storage

**Files:**
- Create: `src/modules/automations/automation-store.js`
- Test: `tests/automation-store.test.mjs`

**Interfaces:**
- Produces: `createMemoryAutomationStore()`.
- Methods: `createShortcut`, `getShortcut`, `listShortcuts`, `updateShortcut`, `deleteShortcut`, `saveExecution`, `listExecutions`.
- Every shortcut method receives `tenantId`; execution listing is tenant-scoped.

- [ ] **Step 1: Write failing isolation tests**

```js
test('does not expose a shortcut across tenants', () => {
  const store = createMemoryAutomationStore();
  store.createShortcut('tenant-a', { id: 'same-id', tenantId: 'tenant-a', name: 'A' });
  assert.equal(store.getShortcut('tenant-b', 'same-id'), null);
});

test('returns defensive copies', () => {
  const stored = store.createShortcut('tenant-a', shortcut);
  stored.name = 'mutated';
  assert.equal(store.getShortcut('tenant-a', shortcut.id).name, shortcut.name);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/automation-store.test.mjs`
Expected: FAIL because store module is missing.

- [ ] **Step 3: Implement store**

Use nested maps keyed by tenant, or composite keys that include tenant ID. Use `structuredClone` on ingress and egress. `updateShortcut` and `deleteShortcut` return `null` when the tenant cannot see the ID. Audit records are grouped/listed strictly by tenant.

- [ ] **Step 4: Run GREEN**

Run: `node --test tests/automation-store.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/automations/automation-store.js tests/automation-store.test.mjs
git commit -m "feat: add tenant scoped automation store"
```

---

### Task 5: Extend Canonical RBAC

**Files:**
- Modify: `src/core/permissions.js`
- Modify: `tests/permissions.test.mjs`

**Interfaces:**
- Existing `capabilitiesForRole(role)` and `hasCapability(role, capability)` remain unchanged.
- Add capabilities: `automation.read`, `automation.create`, `automation.update`, `automation.delete`, `automation.execute`, `automation.manage`, `automation.audit`.

- [ ] **Step 1: Expand tests first**

```js
test('developer receives approved automation capabilities but cannot manage or delete', () => {
  assert.equal(hasCapability('developer', 'automation.read'), true);
  assert.equal(hasCapability('developer', 'automation.create'), true);
  assert.equal(hasCapability('developer', 'automation.update'), true);
  assert.equal(hasCapability('developer', 'automation.execute'), true);
  assert.equal(hasCapability('developer', 'automation.audit'), true);
  assert.equal(hasCapability('developer', 'automation.manage'), false);
  assert.equal(hasCapability('developer', 'automation.delete'), false);
});

test('client can read automations but cannot mutate or execute them', () => {
  assert.equal(hasCapability('client', 'automation.read'), true);
  assert.equal(hasCapability('client', 'automation.execute'), false);
});
```

Update the owner expected set to contain both existing Site Review/audit capabilities and the seven automation capabilities.

- [ ] **Step 2: Run RED**

Run: `node --test tests/permissions.test.mjs`
Expected: FAIL on missing automation capabilities.

- [ ] **Step 3: Implement role matrix additions**

Do not remove any existing Site Review capability. Owners/admins receive all; developer receives read/create/update/execute/audit; designer/reviewer/client receive `automation.read` only.

- [ ] **Step 4: Run GREEN**

Run: `node --test tests/permissions.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/permissions.js tests/permissions.test.mjs
git commit -m "feat: add automation RBAC capabilities"
```

---

### Task 6: Built-in Template Library

**Files:**
- Create: `src/modules/automations/templates.js`
- Test: `tests/automation-templates.test.mjs`

**Interfaces:**
- Produces: `listAutomationTemplates()` and `getAutomationTemplate(templateId)`.
- Templates: `morning-business`, `start-work`, `payroll-friday`, `close-accounting-month`, `driving-mode`, `atlas-security-check`, `network-diagnostic`, `smart-office`.

- [ ] **Step 1: Write failing tests**

```js
test('exposes the eight approved templates', () => {
  assert.deepEqual(listAutomationTemplates().map((item) => item.id), [
    'morning-business', 'start-work', 'payroll-friday', 'close-accounting-month',
    'driving-mode', 'atlas-security-check', 'network-diagnostic', 'smart-office'
  ]);
});

test('template callers cannot mutate the library', () => {
  const first = listAutomationTemplates();
  first[0].name = 'Changed';
  assert.equal(listAutomationTemplates()[0].name, 'Morning Business');
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/automation-templates.test.mjs`
Expected: FAIL because templates module is missing.

- [ ] **Step 3: Implement immutable definitions**

Each template has a declarative trigger and one or more namespaced future action types such as `atlas.business.summary`, `atlas.workspace.open`, `atlas.payroll.preflight`, `atlas.accounting.close-period`, `atlas.ride.driving-mode`, `atlas.security.check`, `atlas.network.diagnostic`, and `atlas.connect.smart-office`. These are definitions only; absent adapters remain unavailable at execution time.

- [ ] **Step 4: Run GREEN**

Run: `node --test tests/automation-templates.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/automations/templates.js tests/automation-templates.test.mjs
git commit -m "feat: add automation template library"
```

---

### Task 7: Automation Service, RBAC, CRUD, and Audit

**Files:**
- Create: `src/modules/automations/automation-service.js`
- Test: `tests/automation-service.test.mjs`

**Interfaces:**
- Consumes: `hasCapability`, `createShortcutDefinition`, store, engine, template library.
- Produces `createAutomationService({ store, engine, now?, id? })` with:
  - `createShortcut(actor, input)`
  - `getShortcut(actor, shortcutId)`
  - `listShortcuts(actor)`
  - `updateShortcut(actor, shortcutId, patch)`
  - `deleteShortcut(actor, shortcutId)`
  - `enableShortcut(actor, shortcutId)`
  - `disableShortcut(actor, shortcutId)`
  - `executeShortcut(actor, shortcutId, event, services?)`
  - `listExecutions(actor)`
  - `listTemplates(actor)`

- [ ] **Step 1: Write failing service tests**

Cover each capability separately, plus tenant isolation and denied execution audit.

```js
test('records a denied execution attempt without invoking the engine', async () => {
  const result = await service.executeShortcut(
    { tenantId: 'tenant-a', userId: 'client-1', role: 'client' },
    'shortcut-1',
    { type: 'manual' }
  );
  assert.equal(result.status, 'denied');
  const audit = service.listExecutions({ tenantId: 'tenant-a', userId: 'owner-1', role: 'owner' });
  assert.equal(audit.at(-1).status, 'denied');
});

test('an actor from another tenant cannot fetch a shortcut by guessed id', () => {
  assert.throws(
    () => service.getShortcut({ tenantId: 'tenant-b', userId: 'owner-b', role: 'owner' }, shortcutId),
    (error) => error.code === 'SHORTCUT_NOT_FOUND'
  );
});
```

Also test create/read/update/delete, manage-only enable/disable, execute permission, template read permission, audit permission, unavailable action result, success/failure/skip execution persistence, and actor context validation.

- [ ] **Step 2: Run RED**

Run: `node --test tests/automation-service.test.mjs`
Expected: FAIL because service module is missing.

- [ ] **Step 3: Implement service**

Authorization mapping:
- create => `automation.create`
- get/list/templates => `automation.read`
- update => `automation.update`
- delete => `automation.delete`
- enable/disable => `automation.manage`
- execute => `automation.execute`
- list executions => `automation.audit`

The service supplies `tenantId` and `createdBy` from the actor instead of trusting client-supplied values. A denied execute attempt must save a minimal safe execution record with `status: 'denied'` before returning it. Non-execution permission failures throw `PERMISSION_DENIED`.

- [ ] **Step 4: Run GREEN**

Run: `node --test tests/automation-service.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/automations/automation-service.js tests/automation-service.test.mjs
git commit -m "feat: add automation service and audit flow"
```

---

### Task 8: Full Regression and Safety Verification

**Files:**
- Review all files modified/created above.

- [ ] **Step 1: Run the complete suite**

Run: `npm test`
Expected: all Site Review and Automations tests pass, zero failures.

- [ ] **Step 2: Scan production code for prohibited execution primitives**

Run:

```bash
node -e "const fs=require('fs');const p='src/modules/automations';for(const f of fs.readdirSync(p)){const s=fs.readFileSync(p+'/'+f,'utf8');for(const x of ['eval(','new Function','child_process','exec(','spawn(','dynamic import'])if(s.includes(x))throw new Error(f+': prohibited '+x)}console.log('automation safety scan passed')"
```

Expected: `automation safety scan passed`.

- [ ] **Step 3: Confirm branch diff stays in scope**

Run: `git diff --check feat/site-review-center-foundation...HEAD`
Expected: exit 0, no whitespace errors.

Run: `git diff --stat feat/site-review-center-foundation...HEAD`
Expected: only the approved spec/plan, automation module/tests, and canonical permission files are changed.

- [ ] **Step 4: Final commit only if verification required fixes**

```bash
git add src tests docs
git commit -m "test: verify automation core integration"
```

Do not create an empty commit.

---

## Completion Gate

Do not claim v0.1 complete unless fresh evidence shows:

- `npm test` exits 0 with zero failures;
- safety scan exits 0;
- diff check exits 0;
- no unregistered provider/network action is represented as connected or successful;
- no production deployment has been claimed or performed by this plan.
