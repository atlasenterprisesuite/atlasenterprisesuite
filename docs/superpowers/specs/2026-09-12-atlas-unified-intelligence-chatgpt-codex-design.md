# ATLAS Unified Intelligence — ChatGPT + Codex Design Specification

Date: 2026-09-12
Status: Approved architecture, pending implementation plan
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Target branch: `feat/unified-atlas-intelligence`
Owner layer: ATLAS Intelligence / Assistant
Primary runtime surface: existing `supabase/functions/atlas-copilot`

## 1. Purpose

ATLAS must present one intelligence identity to the user: **ATLAS Assistant**.

Behind that single identity, ATLAS may use different OpenAI capabilities according to the work required:

- conversational reasoning and coordination for dialogue, analysis, planning, context interpretation, and cross-module decisions;
- Codex execution for repository-aware software engineering, code modification, tests, debugging, review, terminal-oriented work, and implementation workflows.

The user must not be required to choose between "ChatGPT" and "Codex" for normal use. ATLAS owns the routing decision.

The canonical user experience is:

`USER -> ATLAS ASSISTANT -> ATLAS INTELLIGENCE ROUTER -> BEST CAPABILITY -> GOVERNED EXECUTION -> ONE RESULT`

The architectural objective is one identity, one conversation context, one authorization model, one execution state, one approval path, one audit trail, and one continuity model.

## 2. Existing ATLAS Context

The repository already contains the correct foundation for this design inside `supabase/functions/atlas-copilot`:

- `intelligence-gateway.mjs` normalizes requests, enforces `intelligence.use`, persists conversations, routes capabilities, invokes a provider, records telemetry, and returns provenance and usage;
- `agentic-core.mjs` provides tool registration, permission checks, tenant checks, risk levels, approval requirements, and auditable execution;
- `atlas-intelligence-auth.mjs` and the current identity patterns provide organization/user/session context;
- `atlas-intelligence-store.mjs` provides the persistence boundary for conversation and request state;
- the current router is provider-neutral and already separates requested capabilities from provider selection.

This feature must extend those boundaries. It must not create a second assistant application, a second conversation store, a second permission system, or a parallel orchestration service.

## 3. Architectural Decision

ATLAS Assistant is the only user-facing intelligence identity.

Internally, ATLAS Intelligence becomes a capability router with at least two execution planes:

### 3.1 Conversational Intelligence Plane

Responsibilities:

- natural-language conversation;
- reasoning;
- summarization;
- task decomposition;
- module/context selection;
- requirement interpretation;
- plan generation;
- response synthesis;
- deciding whether engineering execution is needed.

The implementation should use the existing OpenAI provider adapter pattern already present in `atlas-copilot` rather than binding ATLAS to a consumer ChatGPT UI session.

### 3.2 Codex Engineering Plane

Responsibilities:

- repository inspection;
- code search and analysis;
- branch/worktree-aware implementation;
- code editing;
- test execution;
- debugging;
- code review;
- implementation-plan execution;
- generation of verifiable engineering evidence.

Codex is a capability behind ATLAS Intelligence, not a separate visible assistant.

The implementation must integrate through an adapter boundary compatible with the supported Codex programmatic runtime chosen at implementation time. The adapter must keep provider/runtime details out of the user-facing ATLAS contract.

## 4. Unified Capability Model

Extend the intelligence capability vocabulary so ATLAS can route by work type rather than product name.

Initial capability set:

- `generation`;
- `reasoning`;
- `research`;
- `code_analysis`;
- `code_execution`;
- `code_review`;
- `testing`;
- `repository_operations`.

Capabilities are logical ATLAS contracts. A provider or runtime declares which capabilities it supports and whether it is configured and verified.

The router must never select a runtime that is not both configured and verified for the requested capability.

## 5. Unified Request Contract

A single `IntelligenceRequest` enters ATLAS Intelligence.

Required logical fields:

- `module`;
- `intent` / reasoning profile;
- `message`;
- `conversation_id` when continuing an existing conversation;
- `capabilities_requested`;
- authenticated organization/user/session/request context;
- optional execution context containing repository, branch, task/workflow references, or domain references.

ATLAS decides whether the request can be fulfilled entirely by conversational intelligence or requires a Codex engineering run.

The user must not need to know which runtime was selected.

## 6. Routing Policy

### 6.1 Conversational-only examples

Route to the conversational plane when the request is primarily:

- explanation;
- analysis;
- summarization;
- planning without repository changes;
- business/process reasoning;
- module guidance;
- interpretation of existing ATLAS state.

### 6.2 Codex-required examples

Route to the Codex engineering plane when the requested result requires:

- reading or modifying repository code;
- creating or updating tests;
- running a build/typecheck/test command;
- performing repository-aware debugging;
- reviewing a code diff or branch;
- executing an approved implementation plan;
- generating commit-level implementation evidence.

### 6.3 Mixed requests

For mixed work, ATLAS Assistant remains coordinator:

`CONVERSATIONAL INTELLIGENCE -> ENGINEERING TASK CONTRACT -> CODEX -> ENGINEERING RESULT -> CONVERSATIONAL SYNTHESIS`

The conversational plane may frame the task and summarize the result, but it must not claim code was changed, tested, reviewed, committed, or deployed unless Codex or another authorized engineering execution boundary produced verifiable evidence.

## 7. Codex Task Contract

The Codex adapter receives a bounded engineering task, not the entire raw conversation history by default.

A `CodexTask` contains:

- `id`;
- `organization_id`;
- `user_id`;
- `conversation_id`;
- `request_id`;
- `repository`;
- `base_ref`;
- `working_branch` when applicable;
- `goal`;
- `requirements`;
- `constraints`;
- `allowed_operations`;
- `approval_state`;
- `execution_mode`;
- `test_requirements`;
- `source_task_id` / `workflow_id` when the Universal Execution Engine is available;
- `created_at`.

The task must contain only the context necessary for the engineering action. Secrets and unrelated conversation content must not be copied into Codex task payloads.

## 8. Codex Result Contract

Codex returns a structured result that ATLAS can persist, audit, and summarize.

A `CodexResult` contains at minimum:

- `task_id`;
- `status`;
- `repository`;
- `branch`;
- `base_sha`;
- `head_sha` when commits exist;
- changed-file references;
- commands executed;
- tests executed;
- exact test outcomes;
- build/typecheck outcomes when requested;
- review findings when review was requested;
- blockers;
- evidence references;
- approval-required next actions;
- runtime/provider metadata;
- usage/cost metadata when available;
- `started_at`;
- `completed_at`.

Allowed result states include:

- `planned`;
- `running`;
- `blocked`;
- `awaiting_approval`;
- `failed`;
- `completed`.

`completed` requires the requested validation gates to have actually passed.

## 9. One Conversation and One Continuity Model

ChatGPT-style conversation and Codex engineering runs must share one ATLAS conversation lineage.

The conversation remains the user-visible continuity record. Codex execution is attached to that conversation through execution/task references and structured provenance.

The user may ask:

- "continúa";
- "¿dónde quedamos?";
- "¿qué cambió?";
- "¿qué pruebas pasaron?";
- "¿qué necesita aprobación?";

ATLAS must answer from persisted execution state and evidence rather than reconstructing or guessing from chat text.

When the Universal Execution Engine is available, it becomes the canonical task/workflow persistence layer for engineering runs. Until that integration is present, the Codex adapter must expose compatible identifiers and state so later migration does not require a contract rewrite.

## 10. Identity, Tenancy, and Authorization

Every intelligence and Codex request inherits the authenticated ATLAS principal:

- organization;
- user;
- session;
- request/correlation ID;
- roles;
- permissions.

The existing `intelligence.use` permission remains the entry permission for ATLAS Intelligence.

Engineering operations require additional capability-specific permissions. Initial execution-layer permissions should distinguish at least:

- `intelligence.code.read`;
- `intelligence.code.execute`;
- `intelligence.code.review`;
- `intelligence.repository.write`;
- `intelligence.repository.publish`.

A broad intelligence permission must not silently imply repository-write or publish permission.

Tenant mismatch must fail closed before any engineering action.

## 11. Approval Policy

ATLAS must preserve the existing approval/risk architecture.

Examples:

- repository inspection: normally read-only and may proceed when authorized;
- local/worktree code edits: permitted only with code-execution authorization;
- commit on an authorized feature branch: governed by repository policy;
- push to a shared remote branch: external side effect and approval-gated when policy requires;
- merge to protected/shared branches: explicit approval required;
- deploy/publish: explicit approval required;
- paid provider generation or other billable actions: explicit approval required when the user has prohibited automatic spend.

An approval is scoped to the exact action/payload/version it authorized. It cannot be reused after material task mutation.

## 12. Cost and Provider Controls

ATLAS must not silently convert a conversational request into billable Codex or provider activity when policy requires user approval.

The router must be able to distinguish:

- capability available;
- runtime configured;
- runtime verified;
- execution authorized;
- cost permitted;
- approval required.

When Codex is unavailable because no supported runtime/workspace is configured, ATLAS must report a real blocker and preserve the task state. It must not claim that an engineering subagent is running.

## 13. Unified User Experience

The user sees:

**ATLAS Assistant**

The interface may optionally expose transparent execution metadata such as:

- `Reasoning`;
- `Coding`;
- `Testing`;
- `Reviewing`;
- `Awaiting approval`;
- `Blocked`;
- `Completed`.

These are execution states/capabilities, not separate assistant identities.

Do not present routine controls that force the user to select ChatGPT versus Codex.

Advanced diagnostic/admin surfaces may show the actual provider/runtime, model, trace ID, usage, and evidence for observability.

## 14. Provenance and Audit

Every Codex invocation must create auditable provenance including:

- initiating user/request;
- conversation/task/workflow reference;
- repository and branch;
- capability selected;
- authorization decision;
- approval reference if any;
- execution start/end;
- result state;
- commit/test/build/review evidence;
- error/blocker code;
- provider/runtime identifier.

ATLAS must not expose private chain-of-thought. Audit stores operational events and evidence, not hidden reasoning traces.

## 15. Error Semantics

Normalize engineering-specific failures into stable ATLAS error codes.

Minimum set:

- `code_runtime_not_configured`;
- `code_runtime_unverified`;
- `code_capability_unavailable`;
- `repository_access_required`;
- `repository_permission_denied`;
- `tenant_mismatch`;
- `approval_required`;
- `cost_approval_required`;
- `worktree_required`;
- `engineering_execution_failed`;
- `engineering_validation_failed`;
- `provider_rate_limited`;
- `provider_unavailable`.

A blocker must preserve enough information for ATLAS to resume from the exact dependency boundary later.

## 16. Integration with the Universal Execution Engine

The unified intelligence feature and Universal Execution Engine are complementary but independently mergeable.

When both exist:

- ATLAS Intelligence owns capability routing and interaction orchestration;
- Universal Execution Engine owns durable task/workflow state, current/next/blocker/approval/completion semantics, and evidence references;
- Codex becomes an execution adapter registered for engineering actions;
- Approval Center governs approval-required engineering steps;
- Audit Trail records all sensitive transitions.

Neither subsystem may create a competing task state machine.

## 17. Security Requirements

- Never commit or expose OpenAI, Codex, GitHub, Supabase, Cloudflare, Vercel, or other provider secrets.
- Keep provider/runtime credentials server-side.
- Never send secrets through conversational history or Codex task payloads.
- Apply least privilege to repository access.
- Do not permit Codex to bypass ATLAS RBAC because it has repository credentials.
- Do not allow conversational intelligence to bypass Codex execution controls by directly performing equivalent external writes.
- Maintain organization isolation in conversation, execution, telemetry, and audit records.
- Redact sensitive provider errors before returning them to users.

## 18. Testing Strategy

### Unit tests

Cover:

- capability classification;
- routing decisions;
- mixed conversation-to-Codex handoff;
- permission gating;
- tenant mismatch rejection;
- approval gating;
- cost gating;
- normalized Codex result states;
- failure normalization;
- truthful completion rules.

### Integration tests

Cover:

- one conversation spanning reasoning -> Codex task -> result -> response;
- repository read-only task;
- code execution task with fake/local adapter;
- tests failing -> execution state `failed` or `blocked`, never `completed`;
- approval-required remote side effect;
- Codex runtime unavailable;
- provider telemetry/provenance persisted;
- no cross-organization access;
- compatibility with Universal Execution Engine task identifiers when available.

### Application verification

Before any production-readiness claim:

```bash
npm run typecheck
npm test
npm run build
```

Production runtime verification is a separate step and must not be inferred from local/unit tests.

## 19. Definition of Done

The first implementation is complete when:

1. ATLAS exposes one Assistant identity without a normal ChatGPT/Codex selector.
2. Existing conversational requests continue through `atlas-copilot` without regression.
3. Engineering requests are classified into Codex capabilities through the same Intelligence Gateway.
4. A Codex adapter exists behind a stable ATLAS interface.
5. The adapter can operate against a controlled test/local runtime without fabricating execution.
6. Repository/worktree/test/review evidence is returned in structured form.
7. Permissions, tenant boundaries, approval policy, and cost policy are enforced before engineering side effects.
8. Mixed requests preserve one conversation lineage.
9. Failed/unavailable Codex execution produces truthful blockers/errors.
10. Unit/integration tests, typecheck, and build pass.
11. No production deploy, merge, or paid provider action occurs merely to validate the architecture.

## 20. Non-Goals for the First Slice

The first slice does not require:

- replacing all existing intelligence providers;
- exposing every Codex capability immediately;
- automatic production deployment;
- automatic merge to `main`;
- autonomous paid provider usage;
- a second user-facing Codex chat;
- migrating unrelated ATLAS modules;
- storing hidden chain-of-thought;
- implementing Universal Execution Engine again inside Intelligence.

## 21. Canonical Principle

**ATLAS has one intelligence identity. ChatGPT-style reasoning coordinates; Codex executes engineering work; ATLAS owns routing, permissions, continuity, approvals, evidence, and audit.**

The user should experience one capable assistant, not a collection of disconnected agents.