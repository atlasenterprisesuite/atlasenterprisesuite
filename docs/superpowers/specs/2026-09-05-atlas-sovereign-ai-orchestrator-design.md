# ATLAS Sovereign AI Orchestrator — Architecture Design

Date: 2026-09-05
Status: Approved design baseline
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Branch: `atlas/sovereign-ai-orchestrator-design`

## 1. Purpose

ATLAS Sovereign AI provides a governed orchestration layer that lets multiple AI agents cooperate on ATLAS work without requiring one chat product to talk directly to another. The orchestrator is the shared control plane for tasks, agent assignments, state transitions, evidence, permissions, audit history, CI results, human approval, and deployment eligibility.

The design deliberately separates conversational products from execution infrastructure. OpenAI-backed agents, GitHub Copilot agents, and future providers communicate through ATLAS-owned contracts and tools. ATLAS remains the source of truth for task state and governance.

## 2. Goals

The first production-capable architecture must:

- support multi-agent work using a common task protocol;
- support OpenAI and GitHub/Copilot through provider adapters;
- expose ATLAS-controlled tools through a dedicated MCP layer;
- preserve tenant and organization boundaries;
- require explicit permissions for every sensitive action;
- record immutable-enough audit events for all material transitions and tool use;
- reuse the repository's existing CI consensus gate instead of creating a competing approval mechanism;
- require a separate human approval before production deployment;
- make provider replacement possible without changing task or governance contracts;
- support blocked, failed, and cancelled execution paths;
- never represent simulated provider connectivity, CI success, or deployment as live production state.

## 3. Non-goals for the first implementation slice

The first slice will not:

- implement Gemini, Claude, or local-model execution adapters;
- allow any model to deploy directly to production;
- replace the existing ATLAS web application;
- replace the existing `ATLAS 3-of-3 Consensus` CI workflow;
- introduce a new database vendor unless no authorized ATLAS persistence backend is available;
- claim production persistence until a real authorized persistence adapter is configured and verified;
- auto-merge or auto-deploy merely because an LLM recommends it.

Future providers may be added through the provider interface after the OpenAI and GitHub paths are stable and tested.

## 4. Existing repository constraints to preserve

The repository is an npm workspace monorepo using `apps/*` and `packages/*`. Existing application code lives under `apps/web`, while shared domain packages currently include `packages/core`, `packages/accounting`, and `packages/health`.

The existing core package already defines tenant and organization scope primitives. The orchestrator must reuse or extend that scope model rather than create a parallel tenant identity system.

The repository also already contains an `ATLAS Consensus CI` workflow with three required opinions:

1. Product and UX — integration tests;
2. Architecture and Build — typecheck plus production build;
3. Security and Reliability — dependency audit plus unit tests.

The orchestrator must consume the result of that gate. It must not duplicate or bypass it.

## 5. Chosen approach

Use a TypeScript-first, ATLAS-native monorepo architecture.

The orchestrator runtime lives in `apps/atlas-orchestrator`. Reusable contracts and policy code live in packages. Provider-specific integrations are isolated behind adapters. MCP is exposed through an ATLAS-owned package instead of being embedded into one provider.

This approach is preferred because it:

- matches the existing repository language and workspace structure;
- minimizes operational complexity;
- allows the same TypeScript contracts to be used in runtime, tests, and UI;
- avoids coupling ATLAS governance to one LLM vendor;
- keeps future provider integrations additive.

## 6. Target repository structure

```text
apps/
  atlas-orchestrator/
    src/
      api/
      workers/
      webhooks/
      runtime/

packages/
  ai-core/
    agents/
    orchestration/
    providers/

  task-protocol/
    tasks/
    events/
    schemas/

  agent-registry/
    definitions/
    capabilities/

  atlas-mcp/
    tools/
    auth/

  governance/
    permissions/
    approvals/
    audit/

  integrations/
    github/
    openai/
    future/

tests/
  orchestrator/
  agents/
  permissions/
  integrations/

.github/
  agents/
    atlas-implementer.agent.md
    atlas-reviewer.agent.md
    atlas-qa.agent.md
```

This structure is a target layout, not permission to create every directory in one commit. Implementation should add only the files needed by each tested slice.

## 7. High-level architecture

```text
User / ATLAS UI / API
          |
          v
ATLAS Sovereign AI Orchestrator
          |
          +-- Task Protocol
          +-- Agent Registry
          +-- Governance
          |     +-- permissions
          |     +-- approvals
          |     +-- audit
          |
          +-- Event Bus
          +-- MCP Gateway
          |
          +-- OpenAI Adapter
          |      +-- Architect
          |      +-- Planner
          |      +-- Research
          |      +-- Engineer
          |      +-- Reviewer
          |
          +-- GitHub Adapter
                 +-- Copilot Engineer
                 +-- Copilot QA
                 +-- repository / PR / CI bridge
```

The orchestrator is authoritative for workflow state. Providers may produce recommendations, code changes, findings, or tool requests, but they do not own the workflow state machine.

## 8. Core components

### 8.1 `apps/atlas-orchestrator`

Responsibilities:

- expose the orchestration API;
- receive provider callbacks and GitHub webhooks;
- run task workers;
- validate requested state transitions;
- invoke governance checks before tool execution;
- persist task and event changes through a persistence port;
- correlate provider traces, GitHub commits, PRs, tests, and CI runs;
- expose health/readiness endpoints when the runtime becomes deployable.

The application layer must not contain provider-specific business rules that belong in adapters.

### 8.2 `packages/task-protocol`

Owns the canonical task model, state machine, event definitions, and validation schemas.

The state machine is:

```text
draft
  -> queued
  -> planning
  -> implementation
  -> review
  -> qa
  -> ci
  -> awaiting_human_approval
  -> approved
  -> deploying
  -> verified
  -> completed

Any active state may transition to:
  -> blocked
  -> failed
  -> cancelled
```

Terminal states are `completed`, `failed`, and `cancelled`. `blocked` is recoverable after an explicit unblock event.

Illegal transitions must fail closed and produce an audit event.

### 8.3 Canonical task record

The initial task contract is:

```json
{
  "task_id": "ATL-2026-000184",
  "objective": "Fix ATLAS production authentication",
  "requested_by": "user",
  "assigned_agents": [
    "openai-architect",
    "copilot-engineer"
  ],
  "state": "implementation",
  "artifacts": [],
  "findings": [],
  "commits": [],
  "tests": [],
  "approvals": [],
  "events": [],
  "trace_id": null,
  "deployment": null
}
```

The implementation contract must additionally carry ATLAS scope and version fields so the record can be safely evolved:

```ts
interface AtlasTask {
  schemaVersion: 1;
  taskId: string;
  objective: string;
  requestedBy: string;
  scope: {
    tenantId: string;
    organizationId: string;
  };
  assignedAgents: string[];
  state: AtlasTaskState;
  artifacts: AtlasArtifactRef[];
  findings: AtlasFinding[];
  commits: AtlasCommitRef[];
  tests: AtlasTestResult[];
  approvals: AtlasApproval[];
  events: AtlasEventRef[];
  traceId: string | null;
  deployment: AtlasDeploymentRef | null;
  createdAt: string;
  updatedAt: string;
}
```

No provider may mutate this record directly. Mutations go through orchestrator commands that validate scope, permissions, and state transitions.

### 8.4 `packages/agent-registry`

The registry defines agents by capability instead of by vendor alone.

Each agent definition includes:

- stable agent id;
- provider id;
- human-readable role;
- allowed capabilities;
- required permissions;
- allowed environments;
- allowed tool ids;
- task states in which the agent may operate;
- whether the agent may write code, review code, request tests, or request release approval;
- maximum delegation depth.

Initial logical roles:

- `atlas-architect`;
- `atlas-planner`;
- `atlas-research`;
- `atlas-openai-engineer`;
- `atlas-copilot-engineer`;
- `atlas-security`;
- `atlas-database`;
- `atlas-ui`;
- `atlas-qa`;
- `atlas-reviewer`;
- `atlas-devops`;
- `atlas-release-governor`.

Provider identity and logical role remain separate. For example, `atlas-reviewer` may later run through a different provider without changing workflow contracts.

### 8.5 `packages/ai-core`

Owns provider-neutral orchestration primitives:

- delegation;
- agent invocation requests;
- normalized agent responses;
- tool request envelopes;
- provider trace correlation;
- retry classification;
- cancellation propagation;
- timeout policies.

It must not know GitHub-specific API shapes or OpenAI-specific response objects.

### 8.6 `packages/integrations/openai`

Responsibilities:

- translate ATLAS invocation requests into OpenAI agent execution;
- expose only explicitly authorized ATLAS tools;
- normalize output into ATLAS findings, artifacts, and tool requests;
- return trace identifiers when available;
- propagate provider errors without converting them into false success;
- never grant production deployment capability to a model.

Secrets are supplied only through the runtime secret mechanism. They must not be committed to the repository or stored in task/event payloads.

### 8.7 `packages/integrations/github`

Responsibilities:

- inspect repository content;
- create or update branches only when the calling agent has code-write permission;
- correlate commits and pull requests with `task_id`;
- inspect CI status;
- consume GitHub webhook events;
- provide normalized CI results to the orchestrator;
- refuse merge or deployment actions unless governance conditions are satisfied.

The adapter must reuse existing repository workflows rather than silently creating a parallel release path.

### 8.8 `.github/agents`

Initial Copilot custom-agent profiles:

- `atlas-implementer.agent.md` — may implement within an assigned branch and request tests/review;
- `atlas-reviewer.agent.md` — read/review only, may produce findings and request changes;
- `atlas-qa.agent.md` — test-focused, may inspect code and report verification evidence.

No initial Copilot agent receives production deployment permission.

### 8.9 `packages/atlas-mcp`

The MCP package is the common ATLAS tool boundary.

Initial tool families:

- `atlas.task.create`;
- `atlas.task.read`;
- `atlas.task.update`;
- `atlas.task.claim`;
- `atlas.agent.delegate`;
- `atlas.agent.respond`;
- `atlas.repo.inspect`;
- `atlas.code.propose`;
- `atlas.test.run`;
- `atlas.review.request`;
- `atlas.pr.create`;
- `atlas.ci.verify`;
- `atlas.deploy.request`;
- `atlas.audit.read`.

A tool being exposed through MCP does not mean every connected model can call it. Tool visibility and tool execution are both filtered by agent permissions and environment.

`atlas.deploy.request` only creates a governed deployment request. It does not deploy by itself.

## 9. Governance and permissions

### 9.1 Scope

Every task and material event carries `tenantId` and `organizationId`.

Scope checks must happen before task retrieval, mutation, tool execution, artifact access, and approval operations.

The existing ATLAS scope model should be extended rather than replaced.

### 9.2 Permission model

Governance introduces explicit AI and release permissions, conceptually including:

- `ai.task.read`;
- `ai.task.create`;
- `ai.task.update`;
- `ai.delegate`;
- `ai.repo.read`;
- `ai.code.write`;
- `ai.test.execute`;
- `ai.review.submit`;
- `ai.pr.create`;
- `ai.ci.read`;
- `ai.deploy.request`;
- `ai.approval.read`;
- `ai.audit.read`;
- `release.approve`;
- `release.deploy`.

Actual permission names may be adjusted to match repository conventions during implementation, but the separation of duties is mandatory.

### 9.3 Separation of duties

The minimum policy is:

- an implementation agent cannot approve its own work for production;
- a reviewer cannot mark CI successful without evidence from CI;
- an LLM cannot convert `awaiting_human_approval` to `approved` unless the action is performed by an authorized human actor;
- production deployment requires `approved` state plus successful existing CI gates;
- the release governor evaluates evidence but cannot fabricate it.

## 10. Approval model

The existing `ATLAS 3-of-3 Consensus` remains the machine-verification gate.

Required sequence:

```text
implementation
  -> review
  -> qa
  -> ci
  -> existing ATLAS 3-of-3 Consensus success
  -> awaiting_human_approval
  -> explicit authorized human approval
  -> approved
  -> deployment workflow
  -> verified
```

If any CI opinion fails, the task cannot enter `awaiting_human_approval`.

Human approval is represented by a signed application event containing actor identity, scope, timestamp, task id, target release/commit, and approval result.

## 11. Event model and audit

The orchestrator uses append-oriented domain events. Material examples:

- `task.created`;
- `task.assigned`;
- `task.state_changed`;
- `agent.invocation_started`;
- `agent.invocation_completed`;
- `agent.invocation_failed`;
- `tool.requested`;
- `tool.authorized`;
- `tool.denied`;
- `finding.recorded`;
- `commit.linked`;
- `test.recorded`;
- `ci.recorded`;
- `approval.requested`;
- `approval.granted`;
- `approval.denied`;
- `deployment.requested`;
- `deployment.started`;
- `deployment.verified`;
- `deployment.failed`.

Audit events must record actor, agent, provider, scope, action, target, outcome, timestamp, and correlation ids. Sensitive payloads and secrets must be excluded or redacted.

The audit API is read-only to agents by default.

## 12. Persistence design

No production persistence technology is declared live by this specification because the connected repository does not currently expose an implemented persistence backend for the orchestrator.

The design therefore requires a `PersistencePort` abstraction with repositories for:

- tasks;
- events;
- approvals;
- provider traces;
- deployment references.

Tests may use an in-memory adapter. A production deployment is blocked until an authorized durable ATLAS storage adapter is configured, migration-tested, scoped by tenant/organization, and verified.

The implementation must prefer an existing authorized ATLAS data platform if one becomes available. It must not create a duplicate source of truth merely for convenience.

## 13. Data flow

Example task flow:

1. A user or authorized ATLAS component creates a task.
2. The orchestrator validates scope and `ai.task.create` permission.
3. `task.created` is persisted.
4. Planner/architect agents are selected from the registry by capability.
5. The orchestrator checks each agent's allowed state and tools.
6. Provider adapter executes the invocation.
7. Findings or tool requests return to the orchestrator.
8. Tool requests are re-authorized independently before execution.
9. Code-writing work occurs on an authorized branch through the GitHub adapter.
10. Commits and PRs are linked to the task.
11. Reviewer and QA produce findings/test evidence.
12. Existing ATLAS CI runs.
13. Successful CI is recorded.
14. The task moves to `awaiting_human_approval`.
15. An authorized human approves the exact release candidate.
16. The existing production release mechanism is invoked.
17. Post-deployment verification determines `verified` or `failed`.
18. Only a verified deployment may move to `completed`.

## 14. Error handling

Errors are classified as:

- validation errors — malformed request or illegal state transition;
- authorization errors — missing permission or scope mismatch;
- provider errors — LLM/provider unavailable, rejected, timed out, or rate-limited;
- integration errors — GitHub/webhook/CI failure;
- persistence errors — durable state could not be read or written;
- execution errors — requested test/build/tool failed;
- governance errors — required gate missing or contradictory;
- deployment errors — deployment or post-deploy verification failed.

Rules:

- failures must never be converted to successful findings;
- retries are allowed only for retry-safe operations;
- code writes and release operations require idempotency keys or equivalent guards;
- duplicate webhooks must not duplicate state transitions;
- timeout or provider loss leaves the task recoverable and auditable;
- unauthorized requests are denied before side effects;
- failed deployment never moves directly to `completed`.

## 15. Security requirements

The first implementation must enforce:

- least-privilege tools per agent;
- environment restrictions per agent;
- tenant and organization isolation;
- no secret values in prompts, logs, task records, or audit payloads;
- authenticated webhook verification;
- input/schema validation on all orchestrator commands;
- sanitized provider outputs before using them as tool parameters;
- explicit allowlists for repository operations;
- no arbitrary shell execution through MCP by default;
- no direct production write capability for general agents;
- correlation and audit of every privileged side effect.

Prompt output from any model is untrusted input to the orchestration layer.

## 16. Testing strategy

### Unit tests

Cover:

- state transition matrix;
- capability matching;
- permission checks;
- scope enforcement;
- approval policy;
- tool authorization;
- provider response normalization;
- retry classification;
- redaction logic.

### Integration tests

Cover:

- task creation through completion without real production deployment;
- OpenAI adapter contract with mocked provider boundary;
- GitHub adapter contract with mocked or test-safe repository boundary;
- webhook idempotency;
- CI result ingestion;
- blocked and failed recovery paths;
- human approval requirement;
- prevention of self-approval;
- prevention of deployment when CI is incomplete or failed.

### Existing CI

All orchestrator changes must continue to satisfy the repository's existing:

- integration tests;
- typecheck;
- production build;
- dependency audit;
- unit tests;
- unanimous 3-of-3 consensus job.

### Production verification

A release is not considered verified merely because deployment returned success. Verification must include the applicable health endpoint and a minimal authenticated task/readiness flow in the deployed environment.

## 17. Observability

The orchestrator should emit structured logs and correlation ids for:

- task id;
- trace id;
- provider invocation id;
- GitHub commit/PR identifiers;
- CI run identifier;
- deployment identifier.

Metrics should distinguish requested, authorized, denied, failed, and completed operations. Provider cost/usage telemetry may be added later but must not block the first functional slice.

## 18. Deployment boundaries

The orchestrator will eventually be a deployable ATLAS application, but deployment is intentionally outside the design-spec commit.

Implementation must first prove:

- build and typecheck;
- unit/integration coverage;
- no broken existing ATLAS routes;
- governance enforcement;
- real provider configuration where required;
- durable persistence configuration;
- existing CI consensus success;
- explicit human approval.

Only after those conditions exist may a production deployment be attempted.

## 19. Initial implementation slices

The implementation plan should decompose work in this order:

1. task protocol and transition tests;
2. governance permissions and scope tests;
3. agent registry and capability matching;
4. orchestrator runtime command handlers using in-memory test persistence;
5. audit/event model;
6. GitHub adapter read/CI integration;
7. OpenAI adapter contract and secure tool boundary;
8. MCP tool surface with permission filtering;
9. Copilot custom-agent profiles;
10. durable authorized persistence adapter;
11. end-to-end CI and human approval flow;
12. deployment/readiness wiring after all gates pass.

Each slice must be independently testable and should avoid creating unused directories or abstractions in advance.

## 20. Acceptance criteria

The architecture is successfully implemented when all of the following are demonstrated with evidence:

- a scoped ATLAS task can be created and persisted;
- an authorized agent can claim or receive a task;
- an unauthorized agent cannot call restricted tools;
- two providers can participate in one task without sharing chat sessions directly;
- provider outputs are normalized into ATLAS records;
- findings, commits, tests, and approvals are correlated to one task id;
- illegal state transitions fail closed;
- tenant/organization scope mismatches fail closed;
- review and QA are distinct from implementation authorization;
- existing ATLAS consensus CI is required and consumed as evidence;
- human approval is required for production release;
- no LLM can self-approve a production deployment;
- a failed CI or deployment path is accurately represented as failed/blocked;
- successful production state is only reported after post-deployment verification.

## 21. Design decisions locked by approval

The approved baseline locks these decisions unless a later explicit design change supersedes them:

- TypeScript-first ATLAS-native monorepo architecture;
- `apps/atlas-orchestrator` as the orchestration runtime;
- provider-neutral task and governance contracts;
- ATLAS-owned MCP boundary;
- OpenAI and GitHub/Copilot as initial providers;
- future Gemini/Claude/local providers through adapters;
- existing ATLAS 3-of-3 CI retained;
- explicit human release gate retained;
- no direct LLM production deployment authority;
- tenant/organization scope on task and audit data;
- durable persistence required before production readiness is claimed.
