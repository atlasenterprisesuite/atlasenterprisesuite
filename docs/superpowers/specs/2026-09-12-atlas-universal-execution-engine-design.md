# ATLAS Universal Execution Engine — Design Specification

Date: 2026-09-12
Status: Approved product direction; repository design captured for implementation planning
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Target branch: `feat/universal-execution-engine`
Owner layer: shared platform infrastructure
Primary consumers: all present and future ATLAS modules

## 1. Purpose

ATLAS Universal Execution Engine turns ATLAS from a collection of information surfaces into a connected execution system that can take user intent, locate the owning module, determine current state and dependencies, execute permitted work, validate the result, preserve evidence, and expose the next action without forcing the user to reconstruct context.

The engine is transversal to Dashboard, Enterprise, Finance, Accounting, AP, AR, GL, Tax, HR, Payroll, Benefits, Recruiting, Timecards, CRM, Sales, Inventory, Vendors, Purchasing, POS, Projects, Analytics, Security, Settings, ATLAS Pay, Health, Ride, Hospitality, Education, ATLAS Drive, Knowledge Atlas, ATLAS Voice, ATLAS Connect, Assistant, Studio, Creator, Automations, Lawyer, and future modules.

The canonical flow is:

`INTENT -> OWNER MODULE -> CONTEXT -> CURRENT STATE -> GOAL -> DEPENDENCIES -> PERMISSIONS -> MICROACTIONS -> EXECUTION -> VALIDATION -> EVIDENCE -> NEXT ACTION`

ATLAS must prioritize execution over explanation whenever tools, APIs, persistence, permissions, and authorization make execution possible.

## 2. Repository Context and Architectural Decision

The canonical repository uses npm workspaces under `apps/*` and `packages/*`, with `apps/web` as the primary application and Supabase as the primary backend direction.

Current inspection shows:

- `packages/core` exists but is intentionally small and currently holds basic tenancy and permission helpers;
- there is no existing repository-wide Task Engine or Workflow Engine implementation;
- current modules live under `apps/web/src/modules/*` and domain packages under `packages/*`;
- Supabase migrations already exist under `supabase/migrations` and demonstrate tenant-aware, RLS-oriented persistence patterns;
- ATLAS Director is a Creator/Studio feature and is not the owner of universal execution infrastructure.

### Decision

Create a dedicated shared package:

`packages/execution`

This package owns the provider-neutral execution domain model, state machine, transition validation, decomposition contracts, workflow orchestration primitives, approval contracts, audit events, and module adapter interfaces.

Persistence is implemented through Supabase migrations and server-side access patterns. User-facing execution surfaces remain inside `apps/web` and consume the package rather than reimplementing state logic.

This separation keeps `packages/core` focused on foundational cross-cutting primitives while preventing execution logic from being duplicated across Finance, HR, Payroll, Health, Ride, Hospitality, Creator, or future modules.

## 3. Seven Universal Execution Mechanisms

### 3.1 Task decomposition

Large, ambiguous, or blocked work must be decomposable into concrete microactions. The engine must identify a real first executable action and avoid generating oversized task lists when one next action is sufficient.

### 3.2 Work and progress architecture

Complex work is represented as ordered blocks with:

- goal;
- input;
- action;
- completion criterion;
- dependencies;
- evidence requirement;
- next action.

Progress must persist between sessions.

### 3.3 ATLAS Assistant operational companion

ATLAS Assistant may surface the current action, next action, blockers, approvals, and recent evidence. Assistant must read the same execution state as the underlying module instead of maintaining a separate conversational truth.

### 3.4 Context switching

When work moves between modules, the originating state is persisted before the destination module is activated. The destination receives explicit context, provenance, dependencies, and the next action so the user does not have to reconstruct the workflow manually.

### 3.5 Contextual motivation

Administrative and repetitive workflows may expose progress, milestones, completion feedback, and useful visual reinforcement. Gamification must never replace required financial, clinical, legal, regulatory, security, accounting, or authorization controls.

### 3.6 Time and complexity auditing

Important work must be able to distinguish:

- implementation effort;
- blocked time;
- approval waiting time;
- external dependency waiting time;
- validation and verification effort.

An interface being rendered is not evidence that the workflow is complete.

### 3.7 Executive-function externalization

Unstructured notes, requests, alerts, or pending items may be converted into executable records classified as:

- `now`;
- `next`;
- `delegated`;
- `blocked`;
- `automatable`;
- `awaiting_approval`;
- `discarded`;
- `completed`.

When an authorized integration exists, classification should lead to the real task, event, workflow, record, or module action rather than only a textual recommendation.

## 4. Canonical Domain Model

### 4.1 ExecutionTask

Each executable unit contains at minimum:

- `id` / `task_id`;
- `tenantId`;
- `organizationId`;
- `module`;
- `ownerUserId` or system owner;
- `title`;
- `intent`;
- `goal`;
- `status`;
- `priority`;
- `currentStep`;
- `nextAction`;
- `dependencies`;
- `blockedReason`;
- `permissionsRequired`;
- `evidence`;
- `createdAt`;
- `updatedAt`;
- `completedAt`;
- `auditHistory`;
- `sourceType`;
- `sourceId`;
- `parentTaskId`;
- `workflowId`;
- `version`.

### 4.2 Universal status model

Canonical user-facing statuses:

- `now` — actionable current work;
- `next` — queued successor action;
- `blocked` — cannot continue until a dependency or condition changes;
- `awaiting_approval` — requires an authorized approval before execution;
- `completed` — validation and evidence requirements satisfied.

Additional internal statuses may include:

- `draft`;
- `delegated`;
- `automatable`;
- `discarded`;
- `failed`;
- `cancelled`.

Status changes must be governed by the state machine. Modules may not write arbitrary strings as workflow state.

### 4.3 ExecutionStep

A task may contain ordered steps with:

- `id`;
- `taskId`;
- `sequence`;
- `module`;
- `actionType`;
- `actionPayload`;
- `status`;
- `completionCriteria`;
- `permissionsRequired`;
- `dependencyIds`;
- `evidenceRequirement`;
- `startedAt`;
- `completedAt`.

### 4.4 Workflow

A workflow groups tasks and cross-module transitions:

- `id`;
- `tenantId`;
- `organizationId`;
- `workflowType`;
- `ownerModule`;
- `status`;
- `currentTaskId`;
- `currentModule`;
- `context`;
- `createdByUserId`;
- `createdAt`;
- `updatedAt`;
- `completedAt`;
- `version`.

The workflow owns cross-module lineage; individual modules own their domain records.

### 4.5 Evidence

Evidence is first-class and may reference:

- persisted domain record IDs;
- validation results;
- provider acknowledgements;
- test or build results;
- approval decisions;
- generated artifacts;
- audit event IDs;
- external provider references where authorized and available.

The engine must never fabricate evidence.

## 5. Shared Infrastructure Components

### 5.1 Task Engine

Responsibilities:

- create and update tasks;
- enforce state transitions;
- determine the current actionable step;
- resolve dependencies;
- mark blocked state with explicit reason;
- determine completion eligibility;
- retain evidence references;
- expose module-neutral task queries.

### 5.2 Workflow Engine

Responsibilities:

- connect related tasks across modules;
- move context between module adapters;
- preserve the source-of-truth domain record instead of duplicating it;
- calculate current module/current task;
- resume from persisted state;
- route to approval or blocking states;
- emit auditable transition events.

### 5.3 ATLAS Assistant integration

ATLAS Assistant consumes execution state through a read/write service boundary. It may:

- summarize current state;
- answer "where did we stop?";
- continue the next permitted action;
- surface blockers;
- surface only approval-required items;
- classify unstructured pending work into execution tasks.

Assistant must not bypass RBAC, tenant boundaries, approval policy, or provider restrictions.

### 5.4 Approval Center

Approval Center is a shared decision surface, not a per-module queue. Approval requests contain:

- `id`;
- `taskId`;
- `workflowId`;
- `module`;
- `requestedBy`;
- `approvalType`;
- `requiredPermission`;
- `riskLevel`;
- `summary`;
- `payloadHash` or version binding;
- `status`;
- `decidedBy`;
- `decisionReason`;
- `createdAt`;
- `decidedAt`.

An approval must be bound to the version/payload that was reviewed so later mutations cannot reuse stale authorization.

### 5.5 Audit Trail

Every sensitive execution transition produces an immutable audit event with:

- actor;
- tenant/organization;
- task/workflow reference;
- module;
- action;
- previous state;
- resulting state;
- evidence references;
- timestamp;
- request or correlation ID where available.

Auditability is shared infrastructure and not optional for sensitive operations.

## 6. Module Adapter Contract

Each participating module integrates through a narrow adapter rather than importing module internals into the Workflow Engine.

A module adapter must be able to expose:

- supported action types;
- permission requirements;
- input validation;
- dependency checks;
- execution handler or real dependency boundary;
- completion validation;
- evidence extraction;
- next-action hints;
- domain record references.

Example conceptual adapter surface:

- `canHandle(actionType)`;
- `validate(context, payload)`;
- `authorize(actor, action)`;
- `execute(action)`;
- `verify(result)`;
- `buildEvidence(result)`;
- `suggestNext(result)`.

The exact API will be finalized in the implementation plan and TDD tests.

## 7. Cross-Module Lineage Rules

One business reality has one authoritative domain record. The execution layer references that record and may not create shadow truth.

Examples:

### Hiring

`HR -> Payroll -> Benefits -> Security -> Drive -> Accounting -> Analytics`

HR owns the employee/employment source record. Other modules attach their own domain records and workflow evidence to the same execution lineage.

### Procure-to-pay

`Purchasing -> AP -> Accounting -> Finance -> Vendor -> Analytics`

The workflow retains references to purchase order, invoice, accounting entry, and payment records without duplicating those records into an execution-only table.

### Lead-to-cash

`CRM -> Sales -> Inventory -> POS/Payments -> AR -> Accounting -> Analytics`

Each transition records context and evidence while preserving the native source of truth for each domain object.

## 8. Supabase Persistence Design

The first migration should introduce dedicated execution tables rather than overloading domain tables:

- `execution_workflows`;
- `execution_tasks`;
- `execution_steps`;
- `execution_dependencies`;
- `execution_evidence`;
- `execution_approvals`;
- `execution_audit_events`.

All tables must include organization/tenant scope where applicable and use RLS consistent with existing ATLAS identity patterns.

Requirements:

- no cross-organization reads or writes;
- service-role access restricted to server-side execution boundaries;
- approval mutations require appropriate permissions;
- audit events are append-only through supported application paths;
- foreign keys preserve task/workflow lineage;
- payload fields use bounded JSON only when a stable relational column is not appropriate;
- indexes cover organization, status, owner, module, workflow, and updated time queries;
- migrations are reversible where practical and do not modify unrelated domain tables.

## 9. UI Contract

The engine does not require every module to use the same visual layout, but every module must be able to expose the same execution semantics.

Shared visible states:

- Now;
- Next;
- Blocked;
- Awaiting approval;
- Completed.

A shared execution component may render:

- current action;
- progress;
- blocker;
- approval requirement;
- recent evidence;
- next action;
- resume control.

The component must support desktop, tablet, and mobile and be consumable by ATLAS Assistant/Voice.

No UI may report "connected", "live", "executed", "approved", or "completed" unless backed by real state.

## 10. Permissions and Safety

Execution always follows the stricter of:

1. authenticated user permissions;
2. module authorization rules;
3. workflow policy;
4. approval requirements;
5. external provider capability/credential state.

The engine must not weaken controls merely to continue a workflow.

High-risk or irreversible actions must stop at `awaiting_approval` when policy requires explicit authorization.

No secret, provider token, API key, credential, password, private certificate, or recovery code is persisted in execution payloads or audit events.

## 11. Error and Blocking Semantics

A failure and a blocker are different states.

- `blocked`: expected dependency or permission condition prevents progress;
- `failed`: an attempted executable action failed after authorization/execution began;
- `awaiting_approval`: execution is ready but policy requires a human decision.

Each blocked or failed task must retain a machine-readable code plus a human-readable reason.

Retries must be idempotent where the module action supports idempotency. External actions require correlation/idempotency keys when available.

## 12. Validation and Definition of Done

A task is eligible for `completed` only when:

- all required steps are complete;
- completion criteria pass;
- required approvals are satisfied;
- required evidence exists;
- verification succeeds;
- no blocking dependency remains.

A workflow is eligible for `completed` only when every required terminal task is complete or explicitly cancelled/discarded according to policy.

No code path may set `completed` solely because an API call returned without validating the domain result.

## 13. Testing Strategy

Implementation must use TDD for the engine contracts.

Minimum coverage:

### Unit

- allowed and forbidden state transitions;
- dependency resolution;
- current/next action selection;
- completion gating;
- approval version binding;
- module adapter validation;
- context handoff;
- evidence requirements;
- cross-tenant rejection.

### Integration

- Supabase persistence and RLS behavior;
- create -> execute -> verify -> complete workflow;
- blocked -> dependency resolved -> resume;
- awaiting approval -> approved -> execute;
- approval rejected;
- failed action and retry;
- cross-module handoff with preserved lineage;
- Assistant reads the same persisted state exposed by UI.

### Application verification

Before any production claim:

- `npm run typecheck`;
- `npm test`;
- `npm run build`;
- affected routes return no 404/500;
- tenant boundaries hold;
- permissions hold;
- no fabricated data or execution state appears;
- responsive states work;
- no secrets are introduced.

## 14. Delivery Sequence

Implementation should be split into independently verifiable slices:

1. package scaffold and canonical domain types;
2. state machine and transition rules;
3. dependency and next-action resolver;
4. module adapter contract;
5. Supabase schema and RLS;
6. repository/service layer;
7. Approval Center domain/service contract;
8. Audit Trail emission;
9. shared UI execution status component;
10. ATLAS Assistant integration;
11. first real module adapter pilot;
12. second cross-module workflow proving handoff;
13. full validation and production-readiness evidence.

The first pilot should use a low-risk workflow that already has real persistence and permissions. The first implementation must not begin with irreversible payment, clinical, legal, payroll submission, or security-admin actions.

## 15. Non-Goals for the First Slice

The first slice will not:

- replace every existing module workflow at once;
- create a separate ATLAS application;
- create duplicate domain databases;
- execute paid provider actions without explicit authorization;
- infer approvals from conversational language alone;
- simulate integrations that are not configured;
- move production traffic merely because the engine code exists.

## 16. Success Criteria

The architecture is successful when:

- one shared engine can represent work from multiple ATLAS modules;
- task/workflow state survives sessions;
- module handoffs preserve lineage and context;
- the user can resume with "continue" without rebuilding context;
- blocked and approval states are explicit and truthful;
- completion always has evidence;
- tenant/RBAC boundaries are enforced;
- modules reuse the execution engine rather than implementing competing state systems;
- ATLAS Assistant and UI observe the same persisted execution truth;
- at least one real cross-module workflow proves end-to-end execution and verification.

## 17. Governing Rule

ATLAS must behave as one connected enterprise operating system.

The target interaction is:

`I have to do it -> I know exactly what is next -> ATLAS executed what it was authorized to execute -> the result was verified -> the next action is preserved.`

This rule applies to present and future ATLAS modules.
