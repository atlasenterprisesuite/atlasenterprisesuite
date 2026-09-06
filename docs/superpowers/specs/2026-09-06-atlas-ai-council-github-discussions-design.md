# ATLAS AI Council via GitHub Discussions — Design

Date: 2026-09-06
Status: Approved design, pending implementation-plan review
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Release branch: `release/atlas-a-z`

## 1. Objective

Create a governed multi-model collaboration layer for ATLAS in which GitHub Discussions is the shared human-readable collaboration surface, while ATLAS owns orchestration, identity, policy, audit, consensus, and execution handoff.

The system connects OpenAI/ChatGPT-class reasoning, Gemini, and GitHub Copilot/Codex-class implementation workflows without treating any provider as the source of truth or allowing provider-to-provider loops to run without policy controls.

GitHub Discussions is the collaboration surface, not the ATLAS domain model. The provider-independent ATLAS orchestration layer remains authoritative.

## 2. Architectural Position

ATLAS AI Council must extend the current monorepo and reuse existing ATLAS governance and automation capabilities rather than creating a parallel product.

It integrates with:

- `packages/core` for RBAC, tenancy, audit, and common results;
- `packages/automations` for trigger/condition/action execution patterns;
- ATLAS Forge for future provider-independent source-control, review, CI, and release continuity;
- GitHub as the initial discussion, issue, PR, and CI collaboration adapter;
- external AI providers through isolated adapters.

ATLAS Forge already defines the principle that provider-specific behavior belongs behind replaceable adapters. AI Council follows the same principle.

Conceptually:

```text
Human / ATLAS Agent
        |
        v
GitHub Discussion
        |
        v
GitHub Discussion Adapter
        |
        v
ATLAS AI Council Core
        |
        +--> Command Parser
        +--> Task / Turn State
        +--> Agent Registry
        +--> Provider Router
        +--> Consensus Engine
        +--> Policy / RBAC
        +--> Audit / Evidence
        +--> Loop Guard
        +--> Execution Handoff
        |
        +--> OpenAI Adapter
        +--> Gemini Adapter
        +--> Copilot / GitHub Adapter
        +--> Future Provider Adapters
        |
        +--> Issue / PR / Forge handoff
```

## 3. Scope

First implementation cycle:

- ingest supported GitHub Discussion events;
- parse explicit ATLAS commands;
- create a stable correlation/task ID;
- route requests to one or more configured AI providers;
- normalize provider responses into a common response envelope;
- publish attributed responses back to the originating Discussion;
- calculate a structured consensus result;
- create or link implementation Issues when requested;
- hand execution to Copilot/Codex-compatible flows through Issues/PRs;
- record actor, provider, model, timestamps, hashes, decisions, and errors;
- enforce turn limits, idempotency, RBAC, and loop prevention;
- expose truthful provider state: configured, unavailable, degraded, or verified;
- support dry-run/test mode without writing to GitHub.

Out of scope for the first cycle:

- unrestricted autonomous provider-to-provider conversation;
- direct production deployment from a Discussion command;
- storing provider API secrets in GitHub content or logs;
- treating model output as approval evidence without independent gates;
- replacing ATLAS Forge or GitHub Issues/PR review workflows;
- inventing metrics or provider status when no runtime evidence exists.

## 4. Discussion Command Contract

Supported initial commands:

```text
/ask openai
/ask gemini
/ask all
/delegate copilot
/consensus
/status
/implement
/review
```

Commands are parsed only when the requesting actor is authorized for the repository/tenant and the comment is not itself an AI Council generated response.

### `/ask openai`

Routes the user prompt to the configured OpenAI adapter and posts the normalized response.

### `/ask gemini`

Routes the user prompt to the configured Gemini adapter and posts the normalized response.

### `/ask all`

Runs eligible reasoning providers independently from the same immutable prompt snapshot. Providers do not see each other's answer during this phase.

### `/consensus`

Evaluates completed provider responses for the current task using a deterministic policy before any optional synthesis model is used. The consensus engine must distinguish agreement, disagreement, missing evidence, provider failure, and policy veto.

### `/delegate copilot`

Creates or links an implementation Issue containing the approved task contract and evidence references, then hands execution to the configured GitHub/Copilot workflow when supported.

### `/implement`

Valid only when the task has passed the required approval/consensus gates. Produces an implementation handoff, not a direct production mutation.

### `/review`

Requests a structured review of the linked implementation artifact or PR using the configured review agents and policy.

### `/status`

Returns task state, provider execution state, linked Issue/PR, current consensus state, and blocking dependencies. It must never claim `live`, `connected`, `verified`, or `completed` without evidence.

## 5. Task and Turn Model

Each Discussion-triggered work item receives an immutable ATLAS task ID.

Minimum task fields:

```text
task_id
repository_id
tenant_id
discussion_id
origin_comment_id
requesting_actor
command
prompt_hash
prompt_snapshot
state
created_at
updated_at
max_turns
turn_count
linked_issue
linked_pr
consensus_state
```

Each provider execution records:

```text
execution_id
task_id
provider
model
request_hash
response_hash
started_at
completed_at
status
latency_ms
error_class
usage_metadata
```

The system must support idempotent replay. The same GitHub delivery/event ID and same command origin must not create duplicate provider executions or duplicate Issues.

## 6. Response Envelope

Provider-specific output is normalized before publication.

```text
provider
model
role
summary
analysis_or_recommendation
evidence_refs
confidence_state
limitations
requested_actions
execution_id
```

A Discussion response should be human-readable and include the ATLAS task ID, provider identity, status, and evidence links where available.

Model-generated confidence values must not be presented as calibrated probabilities unless an actual calibration mechanism exists.

## 7. Consensus Engine

Consensus is not a majority-vote shortcut.

Initial policy:

1. collect all required provider outcomes;
2. classify each as support, oppose, conditional, abstain, failed, or unavailable;
3. extract explicit blocking concerns and evidence references;
4. apply security/reliability/policy vetoes before synthesis;
5. detect unresolved contradictions;
6. produce one of:
   - `approved`
   - `approved_with_conditions`
   - `needs_human_review`
   - `blocked`
   - `insufficient_evidence`
7. persist the decision inputs and rule version;
8. optionally use a synthesis model only to explain the deterministic decision, never to silently override it.

For production-impacting work, consensus does not replace CI, security, release, or human approval gates defined elsewhere in ATLAS.

## 8. Loop Prevention and Safety Controls

The orchestrator must prevent AI-to-AI runaway loops.

Required controls:

- every generated comment contains a machine marker and task ID;
- generated comments cannot trigger a new task unless an authorized human explicitly issues a new command;
- maximum provider calls per task;
- maximum turn count;
- maximum wall-clock duration;
- provider timeout and retry budget;
- idempotency key per GitHub delivery/event;
- no recursive `/ask all` from generated content;
- no provider can authorize its own implementation handoff;
- execution and production actions remain behind ATLAS policy gates;
- provider failures produce explicit degraded/error states rather than fabricated output.

## 9. Authentication, Secrets, RBAC, and Tenancy

Secrets are injected at runtime from an authorized secret store and must never be committed to source, Discussion content, Issues, PR bodies, workflow logs, or audit payloads.

Authorization must reuse ATLAS tenancy/RBAC patterns.

Initial roles may include:

- `ai_council_reader`
- `ai_council_operator`
- `ai_council_approver`
- `ai_council_admin`

Capabilities are separated so that reading, asking providers, requesting consensus, delegating implementation, and approving production-impacting work are distinct permissions.

GitHub actor identity must be mapped to an ATLAS actor/tenant context before privileged actions are accepted.

## 10. GitHub Integration

The first GitHub adapter handles:

- Discussion/comment webhook ingestion;
- authenticated Discussion reply publication;
- Issue creation/linking;
- PR linkage and review-state lookup;
- CI/status evidence retrieval where available;
- correlation between Discussion, Issue, PR, commit SHA, and ATLAS task ID.

GitHub is not allowed to become the only persistence layer for orchestration state. ATLAS maintains its own task/audit state so the feature can later migrate to ATLAS Forge or another collaboration surface.

Repository administration may still require a human to enable GitHub Discussions when the connected GitHub permission surface does not expose that repository-setting mutation.

## 11. Provider Adapters

All provider adapters implement a common interface similar to:

```text
health()
capabilities()
invoke(task, prompt, policy_context)
cancel(execution_id)
normalize(raw_response)
```

Provider SDK objects and proprietary response types must not leak into the consensus engine or domain state.

### OpenAI adapter

Used for reasoning, architecture, review, synthesis, and Codex-compatible implementation workflows when configured and authorized.

### Gemini adapter

Used as an independent reasoning/review provider. Gemini responses should be obtained independently during `/ask all` so consensus is not contaminated by prior model output.

### Copilot/GitHub adapter

Used primarily for GitHub-native execution handoff, Issue-to-code workflows, and PR collaboration rather than as the sole arbiter of architectural consensus.

## 12. Proposed Repository Structure

The implementation should fit the current monorepo without duplicating ATLAS core functionality.

```text
apps/
  ai-council-api/
    src/
      webhooks/
      commands/
      tasks/
      providers/
      consensus/
      handoff/
      health/

packages/
  ai-council-core/
    src/
      task.ts
      command.ts
      provider.ts
      consensus.ts
      state.ts
      loop-guard.ts
      evidence.ts

  ai-provider-openai/
  ai-provider-gemini/
  ai-provider-github/

  github-discussions-adapter/

apps/web/src/modules/
  ai-council/
    CouncilHome.tsx
    TaskDetailPage.tsx
    ProvidersPage.tsx
    AuditPage.tsx
```

If implementation discovery reveals an existing backend service that is the correct host, `apps/ai-council-api` should be folded into it rather than creating a duplicate runtime.

## 13. State Machine

Initial task states:

```text
received
-> authorized
-> queued
-> collecting
-> ready_for_consensus
-> consensus_complete
-> awaiting_human_approval
-> ready_for_handoff
-> implementing
-> reviewing
-> completed

received -> rejected
collecting -> degraded
collecting -> failed
any active state -> cancelled
any gated state -> blocked
```

State transitions must be validated server-side and emitted to audit.

## 14. Error Handling

Errors are classified rather than collapsed into generic failure:

- unauthorized actor;
- malformed command;
- duplicate delivery;
- provider not configured;
- provider unavailable;
- provider rate limit;
- provider timeout;
- GitHub write failure;
- consensus insufficient evidence;
- policy veto;
- stale Issue/PR reference;
- persistence failure;
- audit failure.

Retryable failures use bounded exponential backoff. Non-retryable authorization/policy failures fail closed. A failed audit write blocks privileged state transitions.

## 15. Observability and Audit

Every consequential transition records:

- task ID;
- actor;
- tenant;
- source event/delivery ID;
- command;
- provider/model;
- request/response hashes;
- state transition;
- policy/rule version;
- linked Discussion/Issue/PR/commit;
- timestamps;
- error classification;
- approval identity where required.

Logs redact secrets and provider credentials.

## 16. Testing Strategy

Unit tests:

- command parsing;
- RBAC checks;
- idempotency;
- loop-guard logic;
- state machine transitions;
- response normalization;
- deterministic consensus cases;
- secret/log redaction.

Integration tests:

- GitHub webhook -> task creation;
- `/ask openai`, `/ask gemini`, `/ask all` with fake adapters;
- provider failure/degraded behavior;
- Discussion reply publication;
- `/consensus` decision persistence;
- `/delegate copilot` Issue handoff;
- Discussion -> Issue -> PR correlation;
- audit evidence creation.

End-to-end staging test:

```text
human Discussion command
-> webhook
-> provider calls
-> attributed replies
-> consensus
-> Issue handoff
-> PR link
-> status result
```

No production provider key is required for deterministic test suites; provider adapters must support fakes/mocks.

## 17. Production Gates

The feature is not called production-ready until all of the following have evidence:

1. GitHub Discussions enabled on the target repository;
2. webhook signature validation verified;
3. provider credentials configured through an authorized secret store;
4. RBAC and tenant mapping enforced;
5. idempotency and loop guards tested;
6. provider failure/degraded states tested;
7. audit persistence verified;
8. Issue/PR handoff verified;
9. CI/typecheck/unit/integration tests green;
10. staging Discussion flow completed end-to-end;
11. no secrets emitted to logs or GitHub content;
12. production-impacting commands remain behind existing ATLAS release gates.

## 18. Success Criteria

The design is successfully implemented when an authorized human can open one GitHub Discussion, issue `/ask all`, receive independently sourced OpenAI and Gemini responses, request `/consensus`, obtain a traceable ATLAS decision, delegate approved implementation into an Issue/PR workflow, and inspect the full audit trail without manually copying messages between provider interfaces.

The same domain workflow must remain portable so GitHub Discussions can later be replaced or supplemented by ATLAS Forge, ATLAS Connect, Slack, or another collaboration surface without rewriting provider or consensus logic.
