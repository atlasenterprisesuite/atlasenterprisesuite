# ATLAS Work Soberano — Design Specification

Date: 2026-09-12
Status: Approved design baseline; written-spec review pending
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Target branch: `feat/atlas-work-sovereign`
Owner: ATLAS Core / Universal Execution Engine
Primary consumers: Owner Mode and all Enterprise tenant modules

## 1. Purpose

ATLAS Work Soberano is the universal operational workspace for turning user intent into persistent, authorized, auditable, verifiable execution across ATLAS modules and external providers.

It is not a replacement for ATLAS Manager, ATLAS Director, ATLAS Assistant, Guided Execution, or the Sovereign AI Orchestrator. It composes them.

Canonical flow:

`INTENT -> OWNER MODULE -> CANONICAL WORKFLOW -> POLICY/RBAC -> APPROVAL -> EXECUTION ROUTER -> RUNTIME -> PROVIDER/SITE -> INDEPENDENT VERIFICATION -> EVIDENCE -> NEXT ACTION`

ATLAS Work Soberano exists to make ATLAS capable of carrying substantial work through to completion while preserving tenant isolation, permission boundaries, cost controls, resumability, and truthful completion semantics.

## 2. Binding Architecture Decision

ATLAS Work Soberano must be implemented as a universal execution layer over the existing Universal Execution Engine and Guided Execution contracts.

It must not create:

- a second workflow state machine;
- a second workflow persistence system;
- a shadow approval system;
- a second audit trail;
- a second tenant or organization identity model;
- a parallel infrastructure control plane;
- a duplicate ATLAS Assistant state store.

ATLAS Manager remains the owner of infrastructure-provider operations. Other domain modules remain owners of their own workflows. ATLAS Work is the universal operational front door and cross-module work surface.

## 3. Existing ATLAS Components to Reuse

Implementation must reuse or extend existing components where they already exist and are stronger than this specification:

- Universal Execution Engine;
- Guided Execution and `/execution/:workflowId`;
- ATLAS Sovereign AI Orchestrator;
- ATLAS Manager infrastructure control plane;
- ATLAS Assistant;
- Approval Center;
- canonical tenant / organization / session boundary;
- RBAC / permissions;
- audit trail and execution evidence;
- existing provider integrations;
- existing Supabase control-plane assets and persistence;
- existing navigation, shell, responsive patterns, and design system.

No component in this document authorizes duplication when an equivalent canonical component already exists.

## 4. Product Modes

ATLAS Work Soberano launches with both tenancy modes from v1.

### 4.1 Owner Mode

Owner Mode is for ATLAS platform owners and explicitly authorized administrators. It may operate global ATLAS infrastructure, the canonical repository, production services, global integrations, and cross-module administrative workflows when the caller has the required authority.

Owner Mode is not a bypass. Every sensitive action still passes through policy, permission, approval, budget, provider capability, and audit checks.

### 4.2 Enterprise Mode

Enterprise Mode is available to customer organizations and tenants from v1.

Every workflow, task, step, connection reference, runtime allocation, evidence record, approval, and audit event must be scoped by canonical tenant and organization identity.

Cross-tenant and cross-organization access must fail closed. A user from one organization must not be able to enumerate, inspect, resume, approve, or execute another organization's work unless an explicit canonical cross-organization permission exists.

## 5. Execution Modes

ATLAS Work supports three execution modes inside one execution router.

### 5.1 API Mode

Prefer direct authorized provider APIs and connectors when they expose the required capability.

Benefits:

- deterministic payloads;
- stronger structured verification;
- lower UI fragility;
- easier auditing and retry semantics.

API Mode must not invent or simulate unsupported provider actions.

### 5.2 Browser Mode

Use a sovereign browser executor when the task requires interacting with a web UI or when no authorized API exposes the required action.

Browser Mode may navigate, click, type, upload, download, read state, and submit forms only inside the task's execution envelope and active authorization.

### 5.3 Hybrid Mode

Hybrid Mode is the default.

The router may combine provider APIs, browser execution, local tools, or other authorized adapters in one canonical workflow. It must preserve workflow state while switching methods.

Default selection principle:

`AUTHORIZED API -> AUTHORIZED SESSION/BROWSER -> OTHER APPROVED RUNTIME`

The router should use the strongest reliable mechanism for each step rather than forcing an entire workflow through one transport.

## 6. Autonomy Levels

ATLAS Work supports three user-selectable autonomy levels.

### 6.1 Manual

Each executable mutation requires user approval before execution.

Read-only discovery and planning may proceed automatically when permitted.

### 6.2 Guided

Guided is the recommended default for sensitive operational work.

Normal reversible actions may execute automatically inside policy. High-impact, external, irreversible, regulated, privileged, destructive, paid, or materially security-sensitive actions route through Approval Center when required.

### 6.3 Autonomous

ATLAS may continue through the workflow without step-by-step approval when the actions remain inside previously granted permissions, policy, execution envelope, and budget.

Autonomous does not mean unrestricted.

The workflow must stop or escalate when it encounters a required new authorization, MFA, CAPTCHA, consent, payment, irreversible action requiring approval, policy boundary, missing credential, legal/security restriction, or provider limitation.

## 7. Runtime Architecture

ATLAS Work supports three browser/runtime environments.

### 7.1 Local Agent

A user-authorized local runtime may operate using local network context, files, or existing local sessions when explicitly permitted.

### 7.2 Self-Hosted Runner / VPS

A self-hosted ATLAS runtime may execute long-running or server-side tasks. It must be registered, authenticated, scoped, health-checked, and revocable.

### 7.3 Cloud Ephemeral Browser

A temporary isolated browser/runtime may be created for eligible tasks. It must use task-scoped credentials or sessions, minimize retained state, and be destroyed or sanitized after the task according to policy.

### 7.4 Runtime Selection

The runtime broker chooses based on:

- required provider access;
- session availability;
- data sensitivity;
- tenant policy;
- geographic or network requirements;
- task duration;
- runtime health;
- provider constraints;
- budget.

Recommended default priority when API is not sufficient:

`Local Agent -> Self-Hosted Runner -> Cloud Ephemeral Browser`

The runtime broker may choose a different order when policy or capability requires it.

## 8. Credentials and Session Strategy

ATLAS Work supports three credential/session mechanisms.

### 8.1 OAuth / Provider Connections

This is the preferred mechanism when the provider supports an appropriate authorized connection.

### 8.2 Session Reuse

ATLAS may reuse an already authenticated user session in an approved local or browser runtime when policy permits. ATLAS must not copy session material into workflow records or prompts.

### 8.3 Secure Vault

A secure tenant-scoped vault may store provider credentials, tokens, certificates, or equivalent secret material when necessary and explicitly authorized.

Secrets must be encrypted at rest and access must be temporary, least-privilege, auditable, and revocable.

### 8.4 Secret Handling Rules

Secrets must never be persisted in:

- prompts;
- workflow descriptions;
- task records;
- browser screenshots intended as ordinary evidence;
- audit event bodies;
- application logs;
- Git repositories;
- client-visible error messages.

Execution records store opaque connection references rather than secret values.

Preferred selection priority:

`OAuth/Provider Connection -> Session Reuse -> Secure Vault`

## 9. Core Components

### 9.1 Work Command Center

Primary route: `/work`

Responsibilities:

- receive user intent;
- show active work, approvals, blockers, history, and resumable tasks;
- expose execution configuration before launch;
- link to canonical Guided Execution workflows;
- preserve organization context.

### 9.2 Intent Compiler

Transforms user intent into a proposed canonical workflow containing:

- objective;
- owner module;
- task groups;
- executable steps;
- dependencies;
- success criteria;
- evidence requirements;
- required permissions;
- approval requirements;
- candidate execution modes;
- runtime requirements;
- provider capabilities;
- budget requirements.

The compiler may use AI assistance but AI output is not authoritative workflow state until validated against canonical contracts and persisted through the execution engine.

### 9.3 Universal Execution Engine

Remains the single source of truth for workflow state, task state, step state, approvals, dependencies, evidence, blockers, audit history, resumability, and completion semantics.

### 9.4 Sovereign Execution Router

Selects API, Browser, or Hybrid execution for each step.

It must inspect actual provider capability and active authorization before selecting a path.

### 9.5 Runtime Broker

Allocates Local Agent, Self-Hosted Runner/VPS, or Cloud Ephemeral Browser according to policy and capability.

### 9.6 Connection Broker

Resolves authorized OAuth/provider connections, browser sessions, or vault references without exposing secret material to the workflow UI.

### 9.7 Credential Boundary

Delivers secrets only to the exact adapter/runtime that needs them and only for the minimum required lifetime.

### 9.8 Policy Engine

Evaluates:

- tenant / organization boundary;
- role / permission;
- autonomy level;
- action sensitivity;
- provider policy;
- execution envelope;
- budget;
- approval requirements;
- regulated-domain rules.

### 9.9 Approval Center

Approvals bind to the exact action payload or payload digest. A changed payload invalidates stale approval.

### 9.10 Provider Adapters

Provider-specific adapters must expose normalized capabilities and outcomes instead of leaking provider-specific semantics into the execution engine.

Initial relevant adapters include existing or future authorized paths for:

- GitHub;
- Supabase;
- Cloudflare / DNS;
- OpenAI web or provider surfaces;
- Google;
- Microsoft;
- other ATLAS-connected providers as required.

No adapter should be introduced until a workflow actually needs it.

### 9.11 Browser Executor

Executes approved browser actions inside a constrained execution envelope.

### 9.12 Verification Engine

Independently checks that the requested outcome actually exists in the expected state.

A successful request submission is not by itself completion evidence.

### 9.13 Evidence Recorder

Stores non-secret evidence required by the workflow's completion criteria.

### 9.14 Audit Trail

Records material decisions and actions including actor, tenant, organization, workflow, step, policy result, approval, execution mechanism, provider result, verification result, and timestamps.

## 10. Routes and Navigation

### 10.1 Primary routes

- `/work` — Work Command Center;
- `/work/new` — create work from natural language or template;
- `/execution/:workflowId` — canonical Guided Execution workspace;
- `/work/history` — prior workflows and results;
- `/work/connections` — provider/API/session connection management;
- `/work/runtimes` — runtime registration, health, and policy;
- `/work/policies` — autonomy, approval, budget, and execution policies;
- `/work/templates` — reusable workflow templates;
- `/work/team` — organization users, roles, delegations, and relevant Work permissions.

### 10.2 Canonical execution route

ATLAS Work must not create `/work/:workflowId` as a second execution state surface.

Opening a workflow from `/work` must route to `/execution/:workflowId` and preserve owner-module and organization context.

### 10.3 Sidebar integration

Work is a first-level ATLAS module entry.

Suggested primary navigation:

`Home · Work · Finance · Accounting · Payroll · HR · Health · Ride · Hospitality · Studio · Manager · Settings`

Work subnavigation:

`Overview · Active · Approvals · History · Templates · Connections · Runtimes · Policies`

## 11. Work Command Center UX

### 11.1 Command Composer

Primary interaction:

`What do you want ATLAS to accomplish?`

The composer accepts natural-language goals and structured templates.

Examples:

- Verify `atlasenterprisesuite.com` with OpenAI.
- Reconcile August bank transactions and prepare the closing package.
- Diagnose production authentication and repair it.
- Build and publish the approved hotel proposal.

### 11.2 Pre-execution configuration

Before launch, the UI must expose the resolved or selected:

- organization / tenant;
- owner module;
- execution mode: API / Browser / Hybrid;
- autonomy: Manual / Guided / Autonomous;
- runtime policy;
- permissions required;
- approvals expected;
- paid-provider requirement;
- known external cost or budget requirement;
- success criteria.

The user must be able to inspect the proposed plan before sensitive execution begins.

### 11.3 Work Queue

Work should summarize canonical visible states rather than introduce competing states.

Primary visible states:

- `now`;
- `next`;
- `blocked`;
- `awaiting_approval`;
- `completed`.

Additional operational states may mirror the execution engine where available.

### 11.4 ATLAS Assistant

ATLAS Assistant acts as the conversational interface to the canonical workflow.

It may explain state, summarize evidence, request missing information, and surface the next action. It must not maintain a competing workflow truth store or mark work complete independently of the execution engine.

## 12. Execution Data Contract

ATLAS Work extends or references the canonical workflow contract. At minimum, each workflow must be able to resolve:

```ts
interface AtlasWorkExecutionContext {
  workflowId: string;
  tenantId: string;
  organizationId: string;
  requestedBy: string;
  ownerModule: string;
  executionMode: 'api' | 'browser' | 'hybrid';
  autonomyLevel: 'manual' | 'guided' | 'autonomous';
  runtimePolicy: string;
  permissionsRequired: string[];
  approvalPolicy: string[];
  connectionRefs: string[];
  evidenceRefs: string[];
  budgetLimit: number | null;
  currentExternalCost: number;
  requiresPaidProvider: boolean;
}
```

Exact field names must reconcile with canonical Universal Execution Engine models rather than creating duplicate persisted representations.

## 13. Authorization Model

A visible button is never authorization.

Each mutation follows the strictest applicable chain:

`Authenticated session -> Tenant/Organization -> Execution permission -> Owning-module permission -> Workflow policy -> Autonomy policy -> Approval policy -> Budget -> Provider capability -> Execution envelope -> Execute`

Authorization must be revalidated immediately before mutation.

Generic Work or infrastructure permissions must not imply unrelated domain permissions such as payroll submission, accounting posting, health-data mutation, tax filing, payment execution, or legal action.

## 14. Browser Execution Envelope

Every browser execution session receives a task-scoped execution envelope.

Example shape:

```ts
interface BrowserExecutionEnvelope {
  workflowId: string;
  stepId: string;
  tenantId: string;
  organizationId: string;
  allowedDomains: string[];
  allowedActions: string[];
  deniedActions: string[];
  autonomyLevel: 'manual' | 'guided' | 'autonomous';
  expiresAt: string;
}
```

Example for OpenAI domain verification:

Allowed:

- OpenAI domain verification surface;
- authoritative DNS provider;
- read current DNS state;
- create the exact required TXT record;
- verify public DNS;
- invoke OpenAI `Check`.

Denied unless separately approved:

- delete DNS records;
- change nameservers;
- modify MX;
- modify unrelated A / CNAME records;
- buy a domain or subscription;
- alter unrelated OpenAI account settings.

Even Autonomous Mode cannot exceed the execution envelope.

## 15. Budget and Cost Controls

No provider spend without authorization.

Workflows must be able to express:

- `budget_limit`;
- `current_external_cost`;
- `requires_paid_provider`.

When no budget authorization exists, the effective external paid-provider budget defaults to `$0`.

A paid action must block or route to approval before incurring cost.

## 16. Verification and Completion Semantics

Completion requires evidence that the intended outcome exists, not merely that an action was attempted.

General pattern:

`REQUEST ACCEPTED -> EXPECTED RESOURCE/RESULT EXISTS -> EXPECTED STATE REACHED -> INDEPENDENT VALIDATION -> EVIDENCE RECORDED -> COMPLETED`

The verification engine should use an independent read path where practical.

Examples:

- DNS write -> public DNS lookup;
- deployment trigger -> runtime/public health verification;
- file upload -> provider read-back or checksum;
- data mutation -> scoped read-after-write;
- browser form submission -> provider state confirmation.

## 17. Failure, Retry, and Resumability

ATLAS Work is resumable by design.

On timeout, runtime loss, browser closure, provider interruption, or uncertain mutation result, ATLAS must not blindly repeat the action.

Recovery pattern:

`RELOAD CANONICAL STATE -> RECONCILE PROVIDER STATE -> DETERMINE WHETHER PRIOR MUTATION SUCCEEDED -> CONTINUE OR RETRY SAFELY`

Example:

`Create TXT -> connection lost -> resume -> query DNS -> if record exists, verify and continue; otherwise retry according to policy.`

Workflow truth must survive refresh, logout/login, browser restart, runtime restart, and device change.

## 18. Sensitive Interaction Boundaries

ATLAS must stop or hand control to an authorized human when required by:

- MFA;
- CAPTCHA;
- reauthentication requiring direct human interaction;
- unapproved payment;
- materially changed consent or legal terms;
- destructive action requiring explicit approval;
- new provider authorization;
- missing credential;
- policy or safety restriction.

After the blocking interaction is resolved, ATLAS resumes from canonical state rather than restarting the workflow.

## 19. First End-to-End Production Workflow

The first production-oriented Work Soberano workflow is:

`Verify atlasenterprisesuite.com with OpenAI`

Owner module: ATLAS Manager / infrastructure and domain operations.

Preferred execution mode: Hybrid.

Recommended autonomy: Guided.

Paid-provider budget: `$0` unless explicitly changed.

### 19.1 Expected workflow

1. Resolve current tenant / organization and owner authority.
2. Confirm target domain is `atlasenterprisesuite.com`.
3. Retrieve or observe the exact OpenAI domain-verification requirement from the authorized OpenAI surface.
4. Resolve the authoritative DNS provider using real provider evidence.
5. Inspect current DNS state.
6. Confirm the exact intended mutation is additive and scoped to the required TXT record.
7. Route to Approval Center if policy requires DNS mutation approval.
8. Create the exact TXT record without modifying unrelated records.
9. Read back DNS provider state.
10. Query public DNS until the expected TXT value is visible or a bounded propagation timeout is reached.
11. Return to the authorized OpenAI surface.
12. Invoke `Check`.
13. Verify OpenAI reports the domain as verified.
14. Record non-secret evidence.
15. Mark the workflow completed only after verification passes.

### 19.2 Success criteria

The workflow is complete only when all are true:

- the intended TXT exists at the correct DNS name;
- the value matches the active OpenAI verification requirement exactly;
- unrelated DNS records were not modified by the workflow;
- public DNS returns the expected TXT;
- OpenAI reports the domain verified;
- the evidence record is persisted;
- the audit trail identifies the authorized action and result.

A DNS API success response alone is not completion.

### 19.3 Failure cases

The workflow must surface truthful blockers for:

- wrong DNS provider;
- missing DNS write permission;
- stale or changed OpenAI verification token;
- TXT added to the wrong hostname;
- propagation delay;
- conflicting provider UI behavior;
- MFA/CAPTCHA;
- provider outage;
- missing browser session;
- policy denial.

## 20. Testing Requirements

Implementation must use existing ATLAS testing conventions and include focused tests for every new execution boundary.

Required coverage includes:

### 20.1 Contracts

- intent compilation produces canonical workflow-compatible output;
- execution mode and autonomy validation;
- runtime policy validation;
- browser execution envelope validation;
- budget validation;
- tenant and organization scoping.

### 20.2 Authorization

- cross-tenant access fails closed;
- stale approval cannot authorize changed payload;
- browser action outside the envelope is denied;
- insufficient module permission blocks execution;
- Autonomous Mode cannot bypass approval or budget policy.

### 20.3 Routing

- API selection when provider capability is available;
- browser fallback when authorized API capability is absent;
- Hybrid switching preserves canonical workflow state;
- runtime failover does not duplicate completed mutations.

### 20.4 Secret handling

- secrets are absent from prompts, persisted workflow payloads, evidence, and logs;
- opaque connection references resolve only server-side under authorization.

### 20.5 Resumability

- interrupted mutation reconciles provider state before retry;
- workflow resumes after runtime restart;
- completed steps remain completed only when completion evidence is still valid according to policy.

### 20.6 OpenAI-domain pilot

Use adapter fakes or controlled test fixtures for automated tests. Do not mutate production DNS in automated CI.

Production validation of the pilot must be an explicitly authorized Guided workflow with a narrowly scoped DNS execution envelope.

## 21. Rollout Strategy

### Phase 1 — Work Command Center + canonical workflow launch

Expose `/work`, `/work/new`, Active, Approvals, History, and linkage into `/execution/:workflowId` using the existing execution engine.

### Phase 2 — Execution router and policy contracts

Introduce normalized API / Browser / Hybrid routing and Manual / Guided / Autonomous policy handling without yet requiring all providers.

### Phase 3 — Runtime and connection brokers

Add only the runtime and connection capabilities required by real workflows, beginning with the OpenAI-domain verification pilot.

### Phase 4 — Browser execution envelope + verification engine

Deliver constrained browser execution, independent verification, evidence persistence, and safe resumability.

### Phase 5 — Owner + Enterprise hardening

Validate RLS/tenant boundaries, delegations, enterprise policies, runtime isolation, and audit quality.

### Phase 6 — Expand module consumers

Add Work templates and adapters for Finance, Accounting, Payroll, HR, Hospitality, Studio, and other modules only as concrete workflows require them.

## 22. Non-Goals for the First Implementation Slice

The initial implementation must not:

- create every possible provider adapter;
- create a general password manager UI without a workflow requirement;
- deploy a paid browser cloud when a free/authorized runtime is sufficient;
- allow models to bypass Approval Center;
- add a second state machine;
- implement unrestricted desktop control;
- claim production browser autonomy before a real runtime is authorized and verified;
- auto-purchase provider capacity;
- mutate production DNS from CI;
- mark the OpenAI-domain pilot complete without OpenAI's verified state.

## 23. Acceptance Criteria

ATLAS Work Soberano design is correctly implemented when:

1. `/work` is a first-class ATLAS operational entry point.
2. Workflows execute through the existing Universal Execution Engine.
3. `/execution/:workflowId` remains the canonical detailed execution surface.
4. Owner Mode and Enterprise Mode are both supported with real tenant isolation.
5. API, Browser, and Hybrid modes share one router and canonical workflow state.
6. Manual, Guided, and Autonomous are policy levels, not separate engines.
7. Local Agent, Self-Hosted Runner, and Cloud Ephemeral Browser are normalized runtimes behind one broker.
8. OAuth/provider connections, session reuse, and secure vault references are supported according to policy without leaking secrets.
9. Browser execution is constrained by an explicit execution envelope.
10. Every mutation is authorized immediately before execution.
11. Paid provider actions cannot occur without budget authorization.
12. Work resumes safely after interruption by reconciling real provider state before retry.
13. Completion requires independent verification and persisted evidence.
14. The OpenAI-domain pilot can create only the approved TXT mutation, verify public DNS, invoke OpenAI Check, confirm `verified`, and retain non-secret evidence.
15. No parallel workflow, approval, audit, tenant, or persistence system is introduced.

## 24. Implementation Handoff Rule

After this written design is reviewed and approved, implementation planning must be produced with Superpowers `writing-plans` before code changes begin.

The implementation plan must reconcile the current state of `feat/universal-execution-engine`, `feat/atlas-guided-execution`, ATLAS Manager, and the canonical `main` branch before selecting exact files and task ordering.
