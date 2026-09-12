# ATLAS Automations & Shortcuts — Design Specification

**Date:** 2026-09-03  
**Status:** Approved design, implementation specification  
**Target repository:** `atlasenterprisesuite/atlasenterprisesuite`  
**Base branch:** `feat/site-review-center-foundation`  
**Target branch:** `feat/atlas-automations-shortcuts`

## 1. Purpose

ATLAS Automations & Shortcuts is a cross-module orchestration subsystem under **ATLAS OS**. It converts explicit user-defined workflows into safe, auditable executions using the canonical sequence:

`Trigger → Conditions → Actions → Permissions → Result`

The subsystem must allow ATLAS modules to expose approved actions without coupling automation logic directly to each module. It must never simulate a live integration, network state, financial event, device connection, or external provider response.

## 2. Scope for v0.1

Version 0.1 delivers the reusable automation core and service layer. It includes:

- shortcut definition and validation;
- trigger and condition evaluation;
- an allowlisted action registry;
- RBAC-aware creation, editing, enabling, disabling, listing, and execution;
- an in-memory store matching the repository's current lightweight service pattern;
- execution and audit result records;
- built-in template definitions;
- explicit unavailable-action behavior for integrations that do not yet exist;
- automated tests using Node's built-in `node:test`.

Version 0.1 does **not** include a production database, background scheduler, native iOS Shortcuts export, Apple App Intents, WiFiman/UniFi API connectivity, production network scanning, or a final ATLAS OS user interface. Those capabilities must consume this core later through adapters rather than bypassing it.

## 3. Existing architecture to reuse

The current foundation branch uses:

- Node.js 22 or newer;
- ECMAScript modules;
- `node:test`;
- `src/core/permissions.js` for role capability checks;
- `src/modules/<module>/` for isolated module code;
- tests under `tests/`.

Automations must follow those conventions. No parallel application, repository, permission system, or private source of truth may be introduced.

## 4. Module ownership and integrations

**Owner:** ATLAS OS → Automations & Shortcuts.

**Primary dependencies:**
- ATLAS Core permissions/RBAC;
- audit-compatible execution records;
- module action adapters.

**Secondary integrations planned through adapters:**
- Accounting
- Finance
- Payroll
- HR
- Drive
- Voice
- Security
- Ride
- Health
- Connect
- Network Intelligence / Network Control

An integration is considered available only when a real adapter is registered. Missing adapters must produce a deterministic `ACTION_UNAVAILABLE` result.

## 5. Architecture

Create `src/modules/automations/` with focused units:

### `shortcut-definition.js`
Owns the shortcut schema, normalization, IDs, validation, and immutable template shape.

A shortcut contains:

```js
{
  id,
  tenantId,
  name,
  description,
  trigger,
  conditions,
  actions,
  enabled,
  createdBy,
  createdAt,
  updatedAt
}
```

Rules:
- `tenantId`, `name`, `trigger`, `actions`, and `createdBy` are required.
- `conditions` defaults to `[]`.
- `enabled` defaults to `false`.
- `actions` must contain at least one action.
- every trigger, condition, and action uses an explicit `type`;
- arbitrary executable code, shell commands, dynamic imports, and eval-like payloads are forbidden.

### `action-registry.js`
Owns the allowlist of executable action types.

Public behavior:
- register an action adapter by unique type;
- query whether an action type is available;
- execute a registered adapter through a stable context contract;
- reject duplicate registrations;
- return `ACTION_UNAVAILABLE` for missing adapters.

Adapters receive only an execution context containing tenant, actor, shortcut, action input, and permitted service dependencies. They do not receive unrestricted process or filesystem access through the registry.

### `automation-engine.js`
Pure orchestration layer.

Responsibilities:
1. verify shortcut is enabled;
2. verify the incoming trigger matches the shortcut trigger;
3. evaluate all conditions;
4. execute actions sequentially through the registry;
5. stop on a failed required action;
6. collect results without fabricating success;
7. return a structured execution record.

The engine does not persist shortcuts and does not decide role capabilities itself. The service must complete tenant and RBAC authorization before invoking the engine.

### `automation-store.js`
Repository-compatible persistence abstraction.

v0.1 ships an in-memory implementation scoped by `tenantId`. Required operations:
- create;
- get by ID;
- list by tenant;
- update;
- delete.

Cross-tenant reads and writes must fail even when shortcut IDs collide or are guessed.

### `automation-service.js`
Application service that combines permissions, validation, storage, engine execution, and audit records.

Required operations:
- `createShortcut`
- `getShortcut`
- `listShortcuts`
- `updateShortcut`
- `deleteShortcut`
- `enableShortcut`
- `disableShortcut`
- `executeShortcut`
- `listExecutions`
- `listTemplates`

All state-changing and execution operations require an actor context with `tenantId`, `userId`, and `role`. `listExecutions` is tenant-scoped and requires `automation.audit`; `listTemplates` requires `automation.read`.

### `templates.js`
Contains reusable definitions only. Templates are not treated as installed shortcuts until a user explicitly creates one for a tenant.

## 6. Trigger model

v0.1 supports deterministic trigger matching for:

- `manual`
- `schedule`
- `module.event`
- `network.event`

A trigger object uses:

```js
{
  type: "manual" | "schedule" | "module.event" | "network.event",
  config: {}
}
```

`manual` requires no external event payload.

`schedule` stores schedule metadata but v0.1 does not run a background scheduler. A future scheduler adapter can call the engine with a schedule trigger event.

`module.event` requires a namespaced event name such as `payroll.closed` or `accounting.period.closed`.

`network.event` is reserved for real ATLAS Network Intelligence adapters. v0.1 may validate the definition but must not generate fake network events.

## 7. Condition model

Conditions are declarative and side-effect free.

Initial operators:
- `equals`
- `notEquals`
- `in`
- `exists`

A condition references only fields present in the supplied trigger event or approved execution context. Unknown paths evaluate as unmet rather than throwing uncaught errors.

All conditions must pass for execution to continue.

## 8. Action model

Each action uses:

```js
{
  type,
  input,
  required: true
}
```

`required` defaults to `true`.

Actions execute sequentially in definition order. A failed required action stops remaining actions. A failed optional action is recorded and execution continues.

Each action result must use a structured shape containing:
- action type;
- status: `success`, `failed`, `skipped`, or `unavailable`;
- output when available;
- machine-readable error code when not successful.

No adapter may return `success` merely because a provider is expected to exist.

## 9. Permissions and RBAC

Extend `src/core/permissions.js` with:

- `automation.read`
- `automation.create`
- `automation.update`
- `automation.delete`
- `automation.execute`
- `automation.manage`
- `automation.audit`

Role policy for v0.1:

- `owner`: all automation capabilities;
- `admin`: all automation capabilities;
- `developer`: read, create, update, execute, audit;
- `designer`: read;
- `reviewer`: read;
- `client`: read.

`automation.manage` controls enable/disable operations. Built-in template definitions are immutable in v0.1, so template administration is outside this version. `automation.delete` remains separate from update.

The service must check both tenant boundary and capability before returning or mutating shortcut data.

## 10. Audit model

Every execution attempt produces an execution record even when it is denied, skipped, fails, or encounters an unavailable action. Permission-denied attempts are recorded by the service before the engine is invoked.

Record shape:

```js
{
  executionId,
  shortcutId,
  tenantId,
  actorUserId,
  triggerType,
  status,
  startedAt,
  finishedAt,
  actionResults
}
```

Statuses:
- `success`
- `failed`
- `skipped`
- `denied`

v0.1 may keep audit records in memory alongside the automation service, but the interface must make later durable audit storage possible without changing engine semantics.

Secrets, credentials, tokens, and raw authorization material must never be written into execution records.

## 11. Built-in template library

Provide these templates as safe definitions:

1. **Morning Business**
   - manual/schedule-ready trigger;
   - intended future actions for business summary modules.

2. **Start Work**
   - manual trigger;
   - intended future actions for workspace initialization.

3. **Payroll Friday**
   - schedule-ready trigger;
   - intended future Payroll checks/actions.

4. **Close Accounting Month**
   - manual trigger;
   - intended future Accounting close actions.

5. **Driving Mode**
   - manual/network-ready trigger;
   - intended future Ride/Voice actions.

6. **ATLAS Security Check**
   - manual trigger;
   - intended future Security diagnostic actions.

7. **Network Diagnostic**
   - manual/network-ready trigger;
   - action type reserved for Network Intelligence.

8. **Smart Office**
   - network/event-ready trigger;
   - intended future Connect/Security/approved smart-device actions.

Templates may reference action types that are not registered. A tenant may instantiate a template through `createShortcut`; execution must then surface `ACTION_UNAVAILABLE` for any missing adapter. ATLAS must not claim that the provider or device is connected.

## 12. Network Intelligence boundary

WiFiman-style concepts are references for useful functionality, not code or UI to copy.

The automation subsystem may eventually consume verified network events such as:
- trusted device joined;
- unknown device detected;
- latency threshold crossed;
- connectivity restored;
- approved network health check completed.

v0.1 provides only the trigger/action contract. It performs no packet capture, unauthorized scanning, router login, WiFiman/UniFi impersonation, or remote device control.

Any future network adapter must:
- use an authorized integration;
- report actual connectivity state;
- respect tenant/device authorization;
- avoid exposing network secrets;
- emit auditable events.

## 13. Error contract

Use stable machine-readable error codes:

- `INVALID_SHORTCUT`
- `SHORTCUT_NOT_FOUND`
- `SHORTCUT_DISABLED`
- `TRIGGER_MISMATCH`
- `CONDITIONS_UNMET`
- `PERMISSION_DENIED`
- `TENANT_MISMATCH`
- `ACTION_UNAVAILABLE`
- `ACTION_FAILED`
- `DUPLICATE_ACTION_TYPE`

Expected business errors are returned or thrown in a consistent typed/domain-error shape and covered by tests. Unexpected adapter exceptions are converted to `ACTION_FAILED` without leaking secrets.

## 14. Testing requirements

Add focused tests for:

- shortcut validation and defaults;
- invalid executable/dynamic payload rejection;
- action registry registration, duplicate detection, unavailable behavior, and execution;
- trigger matching;
- condition operators and unknown paths;
- disabled shortcut behavior;
- sequential required/optional action behavior;
- permission matrix;
- tenant isolation;
- CRUD operations;
- enable/disable authorization;
- execution audit records for success, failure, skip, denied, and unavailable action cases;
- template list and template immutability;
- network trigger contract without fake connectivity.

All existing tests on the base branch must remain passing after implementation.

## 15. Security constraints

- No `eval`, `Function` constructor, shell execution, or arbitrary dynamic import from shortcut payloads.
- No secrets in shortcut definitions, logs, action results, or audit records.
- All shortcut data is tenant-scoped.
- Only allowlisted adapters can execute.
- RBAC is enforced in the service, not delegated to UI code.
- External integrations remain disabled until a real authorized adapter is registered.
- Destructive adapters added in future must define stronger authorization and audit requirements before registration.

## 16. Success criteria for v0.1

v0.1 is ready for integration planning when:

1. the module structure exists under `src/modules/automations/`;
2. RBAC capabilities are added to the canonical permission layer;
3. shortcuts can be validated and stored per tenant;
4. enabled shortcuts can execute registered actions through the engine;
5. unavailable integrations are surfaced explicitly;
6. every execution path produces a safe structured audit record;
7. built-in templates are available without pretending they are installed or connected;
8. the full Node test suite passes with no regressions.

This specification does not authorize deployment to production. Production deployment requires implementation, fresh test/build evidence, integration verification, and the repository/deployment access needed at that time.
