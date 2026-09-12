# ATLAS Guided Execution — Design Specification

Date: 2026-09-12
Status: Approved product design; implementation plan pending user review
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Target branch: `feat/atlas-guided-execution`
Owner: ATLAS Core / Universal Execution Engine
Primary consumers: ATLAS Manager first, then all present and future ATLAS modules
Dependency: `feat/universal-execution-engine` foundation must be completed/reconciled before Guided Execution implementation begins

## 1. Purpose

ATLAS Guided Execution converts complex workflows into a persistent, auditable, step-by-step operational surface. The interaction pattern is inspired by guided infrastructure runbooks such as the provided AWS reference, but the implementation is native to ATLAS and must not copy AWS branding, visual identity, provider-specific assumptions, or fake execution state.

Guided Execution is not a standalone module and does not create a parallel workflow engine. It is a shared user-facing surface over the ATLAS Universal Execution Engine.

Canonical flow:

`INTENT -> WORKFLOW -> TASK GROUP -> STEP -> POLICY/RBAC -> APPROVAL -> EXECUTION -> VALIDATION -> EVIDENCE -> NEXT ACTION`

The surface must prioritize truthful execution over explanation. A step may be shown as completed only when the underlying execution engine confirms that its completion policy and evidence requirements have been satisfied.

## 2. Architectural Ownership

Owner: ATLAS Core / Universal Execution Engine.

ATLAS Manager is the first consumer because infrastructure workflows naturally demonstrate staged execution, verification, evidence, approval, blocking, retry, and resumability without requiring the first implementation to mutate money, payroll, tax filings, health data, or production resources.

Architecture:

```text
ATLAS module / ATLAS Assistant
            |
            v
   Guided Execution UI
            |
            v
 Universal Execution Engine
            |
   +--------+---------+
   |        |         |
 RBAC   Approval   Evidence/Audit
   |        |         |
   +--------+---------+
            |
            v
 Module / Provider Adapter
```

Guided Execution must consume canonical execution state. It must not create a second state machine, shadow workflow tables, or module-specific progress stores.

## 3. Route and Navigation Contract

Primary route:

`/execution/:workflowId`

Modules may deep-link into an active workflow while preserving module ownership and return navigation.

Required navigation depth:

`Module -> Workflow -> Task -> Step -> Evidence / Approval / Result`

Breadcrumb example:

`ATLAS Manager > Production > Deployment #184 > Verify Cloudflare`

The user must always be able to return to the owning module or parent workflow. Deep links must not lose organization, tenant, workflow, task, or step context.

## 4. Guided Execution Information Architecture

The screen contains four primary regions.

### 4.1 Workflow header

Displays only real execution data:

- workflow title;
- owner module;
- organization/tenant context where appropriate;
- priority;
- current status;
- verified progress;
- current task/current step;
- blocker or approval indicator when applicable.

No fabricated readiness score or completion percentage is allowed.

### 4.2 Task groups

Workflows are rendered as expandable task groups such as:

- Task 1 — Prepare environment;
- Task 2 — Execute;
- Task 3 — Post-execution verification;
- Task 4 — Cleanup / Recovery, only when applicable.

Each group displays the real number of steps, status, current step and blocker state.

### 4.3 Execution steps

Each step exposes:

- title/action;
- current state;
- dependencies;
- required permission;
- approval requirement;
- completion criterion;
- evidence requirement;
- blocker/error reason;
- executable CTA when a real action is available.

### 4.4 Operational action area

The active CTA is derived from the engine and may be:

- Continue;
- Run validation;
- Request approval;
- Resolve blocker;
- Retry;
- Resume;
- View evidence;
- View result;
- Done.

No `href="#"`, console-only buttons, dummy continue buttons, or fake actions are permitted.

## 5. Canonical Visible States

Guided Execution must support the Universal Execution Engine user-facing states:

- `now` — action is executable now;
- `next` — queued successor action;
- `blocked` — a concrete dependency, permission, provider, budget, or configuration condition prevents progress;
- `awaiting_approval` — execution is ready but policy requires an authorized decision;
- `completed` — completion criteria, approvals, evidence and verification are satisfied.

Additional operational states may be rendered where the engine supports them:

- `running`;
- `failed`;
- `cancelled`;
- `loading`;
- `empty`;
- `degraded`.

Component interaction states must include active, hover, selected, expanded, collapsed, disabled, loading, error and success where applicable.

## 6. Data and Persistence

Guided Execution has no independent persistence layer. It consumes the Universal Execution Engine persistence introduced by the execution foundation, including the canonical equivalents of:

- `execution_workflows`;
- `execution_tasks`;
- `execution_steps`;
- `execution_dependencies`;
- `execution_evidence`;
- `execution_approvals`;
- `execution_audit_events`.

Browser component state may control presentation only. Workflow truth must persist in the backend so refresh, logout/login, browser restart and device change do not erase progress.

## 7. Step Contract

Every rendered step must be able to answer:

1. What action is required?
2. What dependencies must already be satisfied?
3. Who is authorized to perform it?
4. Does it require approval?
5. What real action will execute?
6. How will the result be verified?
7. What evidence must be retained?
8. What is the next action?

The UI must never expose provider secrets or sensitive execution payloads merely because they exist server-side.

## 8. Permissions and Authorization

A visible button is never authorization.

Execution follows the strictest applicable boundary:

`Authenticated session -> Tenant/Organization -> Execution permission -> Owning-module authorization -> Workflow policy -> Approval policy -> Provider capability -> Execute`

Every mutation must be revalidated server-side immediately before execution.

Generic execution or infrastructure administration permissions must not imply unrelated domain permissions such as payroll submission, accounting posting, payment execution, health mutations, tax filing or legal actions.

Cross-tenant and cross-organization access must fail closed.

## 9. Approval Center Integration

High-impact, irreversible, external or regulated actions must route through the shared Approval Center when policy requires it.

Examples include:

- production deployment;
- destructive infrastructure changes;
- DNS/security mutations;
- deleting resources;
- payroll submission;
- posting financial entries when policy requires review;
- moving money;
- filing tax returns;
- regulated health or legal actions.

Approval is bound to the exact payload version/digest reviewed. If the payload changes, stale approval must not authorize the new action.

## 10. Evidence and Completion Semantics

An API response that merely accepts a request is not sufficient proof of completion.

Typical flow:

`REQUEST ACCEPTED -> RESOURCE/DOMAIN RESULT EXISTS -> EXPECTED STATE REACHED -> INDEPENDENT VALIDATION -> EVIDENCE RECORDED -> COMPLETED`

Evidence may include:

- authoritative domain record reference;
- provider resource/reference ID;
- validated API response digest;
- approval decision;
- test/build result;
- commit SHA;
- deployment ID;
- health check;
- route verification;
- persisted artifact reference;
- timestamped independent validation.

If an external action may have occurred but cannot be confirmed, the system must represent an ambiguous result/reconciliation state rather than retrying blindly or claiming completion.

## 11. ATLAS Assistant and Voice Integration

Guided Execution and ATLAS Assistant must observe the same persisted workflow state.

Assistant must not maintain a conversational progress truth separate from the engine.

When a user says commands such as `continue`, `resume`, `what is next?`, or `where did we stop?`, Assistant resolves:

- authenticated user;
- active organization;
- active/relevant workflow;
- current task;
- current step;
- dependencies;
- permissions;
- approval status;
- next executable action.

Assistant may summarize, navigate and request authorized execution through the engine. It may not bypass permissions or approval rules. ATLAS Voice may later provide the same capability through voice while consuming the same execution API and state.

## 12. Shared Web Components

Recommended first component family under the existing web application:

```text
apps/web/src/execution/
├── GuidedExecutionPage
├── WorkflowHeader
├── WorkflowProgress
├── TaskGroup
├── ExecutionStepRow
├── StepDetailPanel
├── StepActionBar
├── BlockerCard
├── ApprovalCard
├── EvidencePanel
├── AuditTimeline
├── ExecutionBreadcrumbs
└── ResumeExecution
```

Exact file names may be adjusted during implementation to match existing repository conventions, but responsibility boundaries must remain focused and reusable.

No component may embed its own competing workflow state machine.

## 13. Responsive and Accessibility Requirements

Desktop:

- task/workflow navigation and detail may render side-by-side where space allows;
- evidence or step detail may occupy a secondary pane.

Tablet:

- panels stack while preserving direct navigation between task and detail.

Mobile:

- task groups and steps render vertically;
- the current/next action remains easy to reach;
- expanded/collapsed states must not hide the user's location in the workflow.

Accessibility requirements:

- keyboard operability;
- logical focus order;
- semantic headings and controls;
- appropriate ARIA for expandable task groups and dynamic states;
- screen-reader-readable step/state changes;
- sufficient contrast;
- non-color-only state indicators;
- reduced-motion compatibility where motion is introduced.

## 14. AWS Reference Policy — Option A

The provided AWS EC2 task-list reference is used only as an interaction-pattern specification.

First-slice policy:

- do not create or launch EC2 instances;
- do not terminate EC2 instances;
- do not create key pairs;
- do not mutate AWS security groups;
- do not incur AWS charges;
- do not claim an AWS provider is connected unless real provider verification exists.

Guided Execution may represent an EC2 preparation workflow and show a truthful dependency boundary such as:

`AWS execution adapter not enabled`

A future AWS provider adapter is a separate feature requiring its own provider contract, permissions, approval policy, cost governance and explicit authorization.

## 15. First Real Pilot

The first real integration should be a low-risk ATLAS Manager workflow:

`Verify infrastructure readiness`

The pilot should demonstrate:

- workflow retrieval;
- task grouping;
- step progression;
- dependency resolution;
- read-only validation;
- evidence recording;
- blocker representation;
- refresh/resume;
- Assistant visibility of the same workflow state.

The pilot must avoid paid provider calls and production mutations.

## 16. Testing Strategy

### 16.1 Domain tests

Verify:

- state mapping;
- current/next step selection;
- dependency handling;
- blocked/failed distinction;
- approval gating;
- completion evidence requirements;
- resumability contracts.

### 16.2 API/integration tests

Verify:

- authenticated workflow retrieval;
- organization/tenant isolation;
- server-side permission enforcement;
- approval-bound mutations;
- evidence persistence;
- audit emission.

### 16.3 UI tests

Verify:

- expand/collapse;
- breadcrumbs;
- active step selection;
- resume;
- retry;
- blocker rendering;
- approval rendering;
- evidence display;
- empty/loading/error/success states.

### 16.4 Accessibility/responsive tests

Verify desktop, tablet, mobile, keyboard navigation, focus behavior, semantic structure, ARIA and screen-reader announcements for meaningful state changes.

### 16.5 End-to-end tests

Representative flow:

`CREATE/LOAD WORKFLOW -> TASK NOW -> COMPLETE STEP -> VALIDATE -> EVIDENCE -> NEXT TASK -> APPROVAL WHEN REQUIRED -> EXECUTE/VERIFY -> COMPLETED -> REFRESH -> SAME VERIFIED STATE`

Negative flows must prove:

- cross-tenant access denied;
- missing permission blocked/denied;
- stale approval denied;
- missing evidence prevents completion;
- provider unavailable produces truthful blocked/degraded state;
- failed action remains failed until an allowed retry/recovery path succeeds;
- refresh resumes from persisted state.

## 17. Delivery Sequence

Guided Execution must not interrupt or redefine the already approved Universal Execution Foundation implementation.

Required sequence:

1. Complete and independently review the 9-task Universal Execution Foundation.
2. Reconcile `feat/atlas-guided-execution` with the completed foundation branch without discarding approved commits.
3. Implement shared Guided Execution web components.
4. Implement workflow detail/query integration against the stable execution API/contracts.
5. Implement ATLAS Manager read-only infrastructure-readiness pilot.
6. Integrate ATLAS Assistant read/resume/next-action behavior against the same state.
7. Add responsive/accessibility coverage.
8. Add end-to-end workflow verification.
9. Run full repository typecheck, tests and build.
10. Stop before merge/deploy unless separately approved.

## 18. Non-Goals

This feature does not:

- replace the Universal Execution Engine;
- create a separate execution database;
- copy AWS branding;
- enable AWS mutation or paid provider usage;
- bypass Approval Center;
- infer authorization from conversation alone;
- fake `connected`, `running`, `completed`, `approved` or `live` states;
- merge or deploy itself automatically;
- force every ATLAS module to use identical visual layouts beyond the shared execution semantics.

## 19. Acceptance Criteria

ATLAS Guided Execution is ready for review when:

- `/execution/:workflowId` renders canonical execution state;
- task groups and steps are navigable and truthful;
- progress is derived from real workflow state, not hard-coded percentages;
- current, next, blocked, awaiting-approval, running/failed where applicable, and completed states render correctly;
- every visible action either works or truthfully identifies its dependency boundary;
- server-side RBAC/tenant/module policy remains authoritative;
- approval version/digest binding is preserved;
- evidence gates completion;
- refresh/device/session recovery uses persisted backend state;
- Assistant reads the same workflow state and can identify the next permitted action;
- first pilot verifies infrastructure readiness without paid or destructive provider calls;
- desktop/tablet/mobile and accessibility checks pass;
- `npm run typecheck`, `npm test`, and `npm run build` pass before any completion claim;
- no secrets, fabricated provider state or shadow business records are introduced.

## 20. Governance

Guided Execution is a shared presentation and interaction layer of the Universal Execution Engine. Modules may extend domain-specific step detail, validation and actions through their adapters, but may not introduce competing workflow truth, bypass server authorization, weaken approval rules or mark work complete without required evidence.

Future provider integrations, including AWS EC2, require separate provider-adapter authorization and must preserve the same permissions, cost governance, approval, evidence and audit boundaries defined by ATLAS Core.
