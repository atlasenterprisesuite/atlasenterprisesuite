# ATLAS AI Dev Stack Transfer Design

## Status

Approved design, pending written-spec review before implementation planning.

## Goal

Transfer the highest-value AI developer-stack capabilities identified during the September 28–October 4, 2026 review into ATLAS without creating parallel control planes, weakening Zero Trust controls, or making ATLAS dependent on a single model or agent provider.

ATLAS remains the sovereign control plane for identity, tenant isolation, policy, cost governance, audit, memory of record, release evidence, and tool authorization. External AI runtimes are governed execution backends.

## Existing ATLAS Baseline

The implementation must extend, not replace, the current ATLAS architecture:

- `supabase/functions/atlas-copilot/intelligence-gateway.mjs` already provides provider-neutral routing across `atlas-local`, `openai`, `bedrock`, `gemini`, and `codex-sovereign`, plus `auto` and `council` modes.
- The Intelligence Gateway already supports reasoning profiles, provider verification, fallback, cost policy, emergency budget controls, conversation persistence, telemetry, provenance, and tool proposals.
- `supabase/functions/atlas-copilot/agentic-core.mjs` already enforces `organization_id`, `user_id`, permissions, approvals, risk levels, and audit logging for tool execution.
- The repository already requires deterministic CI evidence including tests, ATLAS Consensus, CodeQL, build/readiness checks, deployment evidence, and exact-SHA production verification.

No new subsystem may duplicate these responsibilities.

## Scope

This design transfers five current AI-dev-stack capabilities into ATLAS:

1. Managed agent-runtime support, including OpenAI Agents API as an optional execution backend.
2. Model-aware OpenAI routing for GPT-6.1 Sol / Astra-class workloads using existing OpenAI provider boundaries.
3. Gemini 4 Argon readiness through the existing Gemini provider boundary, enabled only after authenticated availability is verified.
4. Programmatic GitHub Copilot code review as an additional, non-authoritative CI review signal.
5. Agentic security taskflows as evidence-producing complements to CodeQL and deterministic security checks.

The work also standardizes provider-memory boundaries, observability, and fail-closed release semantics for these capabilities.

## Non-Goals

- Do not replace ATLAS Intelligence Gateway with OpenAI Agents API, Gemini, GitHub Copilot, or any provider-specific runtime.
- Do not store canonical enterprise memory exclusively inside a provider-managed memory feature.
- Do not allow AI review or AI security findings to bypass deterministic tests, CodeQL, ATLAS Consensus, approvals, or release gates.
- Do not claim Gemini 4 Argon or any newly announced model is operational until ATLAS has authenticated, capability-verified evidence from the configured account/API.
- Do not automatically enable paid model usage outside existing ATLAS cost-policy rules.
- Do not create a second conversation store, approval system, audit log, tenant model, or release-control plane.

## Target Architecture

```text
ATLAS UI / Module / Automation
        |
        v
ATLAS Intelligence Gateway
  - normalize request
  - tenant / permission context
  - intent + capability profile
  - provider + model selection
  - cost policy
  - fallback policy
        |
        v
ATLAS Agent Runtime Abstraction
  - native ATLAS execution
  - OpenAI managed agent runtime adapter
  - future managed runtimes
        |
        v
Provider Adapter Layer
  - ATLAS Local
  - OpenAI
  - Gemini
  - Bedrock
  - Codex Sovereign
        |
        v
ATLAS Tool Gateway
  - RBAC
  - tenant boundary
  - approval gate
  - risk classification
  - audit
        |
        v
GitHub / Supabase / Cloudflare / business modules / approved tools
        |
        v
Telemetry + Evidence + Release Gates
```

ATLAS owns the decision to invoke an external runtime. External runtimes never become the authority for tenant identity, permissions, canonical memory, or deployment truth.

## 1. Managed Agent Runtime Integration

### Runtime contract

Introduce a provider-neutral runtime abstraction above provider adapters. A managed runtime implementation may orchestrate multi-step or multi-agent execution, but receives a fully normalized ATLAS execution context and returns an ATLAS-normalized result.

The runtime contract must carry:

- `organization_id`
- `user_id`
- `session_id`
- `request_id`
- `trace_id`
- requested capabilities
- selected provider/model policy
- bounded conversation context
- tool allowlist/proposals
- approval state
- cost policy outcome

The runtime must not receive unrestricted provider credentials, direct database authority, or permission to execute ATLAS tools outside `AtlasAgenticDispatcher`.

### OpenAI Agents API

OpenAI Agents API is treated as one runtime backend, not as ATLAS itself.

Allowed responsibilities:

- hosted agent execution
- provider-side short-lived working memory
- multi-agent orchestration
- computer-use execution where explicitly enabled

ATLAS-retained responsibilities:

- canonical conversation state
- tenant identity
- authorization
- tool execution approval
- audit trail
- provider/model selection policy
- cost policy
- durable memory of record
- release evidence

Computer-use actions must be exposed as explicit governed tool proposals and must not silently execute high-risk writes.

## 2. Model-Aware Routing

Provider identity and model identity are separate concepts.

`openai` remains one ATLAS provider. GPT-6.1 Sol and Astra-class models are model choices inside that provider, not new provider IDs.

`gemini` remains one ATLAS provider. Gemini 4 Argon, once verified available, is a model choice inside that provider.

### Model policy inputs

Model selection may consider:

- requested reasoning profile: `fast`, `balanced`, `deep`
- capability requirements such as coding, computer use, long-horizon reasoning, security analysis, or general generation
- configured and verified availability
- tenant policy
- explicit provider/model pinning
- cost policy
- cached-context economics
- provider health / rate limits
- fallback eligibility

### Fail-closed behavior

A model that is announced publicly but not verified in the configured ATLAS environment is `unavailable`, not `ready`.

If an explicitly requested model is unavailable, the request fails with an evidence-based availability error unless the user requested `auto` routing and fallback is allowed by policy.

No UI may display `connected`, `available`, `verified`, or equivalent readiness claims without authenticated evidence.

## 3. Gemini 4 Argon Readiness

Add support through the existing Gemini adapter only after the following are all true:

1. The configured Gemini account/API authenticates successfully.
2. The model is returned or accepted by the actual provider API used by ATLAS.
3. A bounded inference test succeeds.
4. Capabilities are recorded from observed behavior and provider metadata, not marketing copy alone.
5. Cost/usage information required by ATLAS policy is known or usage is blocked pending approval.

Until then, Argon may exist in a discovery/readiness registry as `announced_unverified`, never as an executable verified model.

## 4. OpenAI GPT-6.1 Sol / Astra Routing

Add model metadata to the OpenAI adapter and model-selection layer so ATLAS can route by workload rather than hard-coding one model.

Expected policy direction:

- `fast`: lowest-cost verified model satisfying the request.
- `balanced`: GPT-6.1 Sol-class model when its capabilities satisfy the task and cost policy permits it.
- `deep`: highest-capability verified model allowed by tenant/cost policy, with Sol eligible as fallback.

These are policy defaults, not hard guarantees. Explicit tenant rules and verified provider capability data take precedence.

Prompt/context caching should be observable in usage telemetry when supported. Cached-context savings must not be assumed unless provider usage evidence confirms them.

## 5. Programmatic Copilot Code Review

GitHub Copilot code review becomes an additional review signal in the ATLAS software-delivery pipeline.

Target pipeline:

```text
TDD
-> focused tests
-> typecheck / lint / dependency gates
-> CodeQL
-> ATLAS Consensus
-> Copilot programmatic review
-> material finding resolution
-> merge eligibility
-> build + production readiness
-> deploy
-> exact-SHA production verification
```

### Authority model

Copilot review is advisory evidence. It cannot independently authorize merge or production deployment.

A Copilot review failure may block the pipeline when ATLAS policy classifies the finding as material, but Copilot approval never substitutes for deterministic checks.

### Finding normalization

Copilot findings must be normalized into ATLAS review evidence with at least:

- repository
- PR number
- head SHA
- finding identifier
- path / location when available
- severity or ATLAS-mapped risk
- review effort level
- status: `open`, `resolved`, `dismissed_with_reason`
- evidence timestamp

Only findings attached to the exact PR head SHA count toward release evidence.

## 6. Agentic Security Taskflows

Introduce reusable security taskflows that decompose specific vulnerability investigations into bounded steps.

Initial taskflow classes should focus on areas already relevant to ATLAS:

- auth / session boundary violations
- tenant-isolation failures
- SSRF / unsafe URL handling
- injection / unsafe parsing
- webhook signature or replay weaknesses
- workflow-permission and CI trust-boundary errors
- secret exposure / unsafe logging

### Evidence standard

An AI-generated security finding is a hypothesis until reproduced.

A finding becomes `verified` only when ATLAS records reproducible evidence such as:

- deterministic failing test
- static-analysis finding with stable rule/evidence
- reproducible request/response showing the defect
- sandboxed proof that demonstrates the security boundary failure

Unreproduced model output must remain `unverified` and cannot be represented as a confirmed vulnerability.

### Relationship to CodeQL

Agentic security augments CodeQL. It does not replace CodeQL, dependency scanning, tests, or manual policy gates.

## 7. Memory and State Boundaries

ATLAS conversation/audit storage is canonical.

Provider-side memory may be used only as:

- ephemeral working state
- performance optimization
- temporary execution context

Provider-side memory must have an ATLAS-owned reference and retention policy where supported. Sensitive enterprise context must not be copied into provider memory unless policy explicitly permits that provider and data class.

ATLAS must be able to reconstruct the authoritative execution record from its own persisted evidence without relying on a provider-memory dashboard.

## 8. Tool Governance

All external runtime tool requests flow through the existing ATLAS Tool Gateway / Agentic Core.

Rules:

- tenant is derived from authenticated ATLAS context, never trusted from tool arguments
- permissions are enforced before execution
- HIGH and CRITICAL writes require approval unless an existing, explicit policy grants a narrower automated path
- tool execution emits audit events for authorization, success, and failure
- direct database access by external agents remains prohibited
- computer-use is modeled as governed actions with explicit risk classification

## 9. Cost Governance

Existing zero-cost-first and emergency fallback behavior remains authoritative.

New models/runtimes must integrate with the same cost-decision model:

- explicit allowed providers/models
- paid-single-model permission
- council permission
- automatic budget caps
- emergency fallback budget
- usage telemetry

No implementation may silently turn a previously zero-cost workflow into a paid path.

If provider cost cannot be bounded or estimated safely, ATLAS must require explicit approval or deny automatic execution according to policy.

## 10. Observability and Provenance

Each AI execution must preserve or extend the current ATLAS telemetry envelope with:

- request / trace / conversation IDs
- organization and actor identifiers
- runtime backend
- provider
- model
- reasoning profile
- capabilities requested / used
- fallback attempts
- cost decision
- provider usage
- latency
- tool proposals and executed tools
- approval references
- provider/model verification state
- provenance/sources where provided

For multi-agent execution, record contributing agents/providers/models without exposing hidden chain-of-thought. Store outputs, decisions, tool evidence, and concise rationale metadata only.

## 11. Failure Handling

### Provider/runtime unavailable

- Explicit provider/model/runtime request: fail closed with normalized error.
- `auto` mode: fall back only to verified candidates allowed by cost and tenant policy.

### Rate limit

Use existing retry/fallback semantics. Never bypass cost or tenant policy to escape a rate limit.

### Managed-runtime partial failure

Persist partial execution evidence and mark the request failed or incomplete. Do not report `completed` unless ATLAS receives a valid terminal result and required tool actions have reached valid states.

### Tool failure

Tool errors remain tool errors. A model-generated narrative cannot convert a failed write into success.

### Review/security service unavailable

Required deterministic gates remain active. Whether an AI-only review gate blocks release is determined by repository policy; unavailable AI review must never be misreported as passed.

## 12. Security Requirements

- No provider API keys in frontend code, logs, prompts, or repository content.
- Server-side provider adapters only.
- Existing multi-tenant and RBAC boundaries remain mandatory.
- External runtimes receive least-privilege context and tools.
- High-risk tool actions require explicit ATLAS approval paths.
- Audit records must be append-only through existing governed mechanisms.
- Provider webhooks/callbacks, if introduced, require signature verification and replay protection.
- Computer-use/browser automation must have domain/tool allowlists and bounded sessions.
- Sensitive prompt/context data must follow provider/data-class policy.

## 13. Testing Strategy

Implementation must use RED -> GREEN TDD for production behavior.

Required test groups:

### Routing tests

- verified Sol-class model selected for an eligible balanced workload
- explicit unavailable model fails closed
- `auto` uses only verified fallback models
- announced-but-unverified Argon is not executable
- tenant/provider/model policy restrictions are honored
- paid fallback cannot bypass zero-cost/cost policy

### Runtime tests

- managed runtime receives normalized ATLAS context
- managed runtime cannot execute tools directly
- runtime tool proposals pass through ATLAS policy/approval evaluation
- partial runtime failures do not produce `completed`
- provider memory is never the sole canonical state

### Copilot review tests

- review is attached to exact PR head SHA
- stale review evidence from an older SHA is rejected
- AI approval does not bypass deterministic checks
- material open finding blocks only according to explicit repository policy

### Security-taskflow tests

- unverified AI findings remain hypotheses
- verified findings require reproducible evidence
- tenant/auth/webhook/URL threat classes map to structured evidence

### Regression tests

- current Intelligence Gateway auto/council routing remains compatible
- existing cost-policy behavior remains intact
- existing Agentic Core RBAC/approval/audit behavior remains intact

## 14. Release and Production Verification

Implementation is not complete at merge.

Required release evidence for the exact merged SHA:

1. Focused tests pass.
2. Repository-wide required tests/checks pass.
3. ATLAS Consensus required checks pass.
4. CodeQL required analysis passes.
5. Copilot review evidence is present if configured as required for the changed surface.
6. Build + Production Readiness Gate passes.
7. Deployment succeeds through the canonical production path.
8. Production verification confirms the exact merged SHA.
9. P0 public routes pass the ATLAS Network fail-closed matrix.
10. New AI runtime/provider readiness endpoints or diagnostics report only authenticated, evidence-backed state.

A deployment with failing P0 production assertions is not verified.

## 15. Rollout

Roll out in guarded phases while keeping the existing ATLAS path operational:

1. Add model/runtime metadata and contracts with all new execution disabled by default.
2. Add tests and readiness probes.
3. Enable verified OpenAI model-aware routing under existing cost policy.
4. Add managed runtime adapter behind an explicit feature/policy gate.
5. Add Gemini Argon readiness discovery; enable execution only after authenticated verification.
6. Add Copilot programmatic review as advisory evidence, then optionally promote selected finding classes to blocking by repository policy.
7. Add agentic security taskflows in report-only mode, then promote only evidence-backed classes to blocking gates.

Rollback must be possible by disabling each new runtime/model/review/taskflow policy without removing the existing Intelligence Gateway.

## 16. Acceptance Criteria

The transfer is accepted only when all of the following are demonstrated with evidence:

- ATLAS still owns identity, tenant isolation, permissions, approvals, canonical memory, audit, and release truth.
- No parallel router, agent authorization plane, or conversation store was introduced.
- OpenAI models are selected inside the existing `openai` provider boundary.
- Gemini models are selected inside the existing `gemini` provider boundary.
- Announced-but-unverified models cannot be represented or executed as verified.
- Managed agent execution cannot bypass the ATLAS Tool Gateway.
- Provider-side memory is non-canonical.
- Copilot programmatic review cannot substitute for tests, CodeQL, Consensus, build/readiness, or production verification.
- Agentic security findings cannot be called verified without reproducible evidence.
- Existing cost controls remain authoritative.
- Existing Intelligence Gateway and Agentic Core regression tests remain green.
- Exact-SHA production verification proves the deployed revision.
- P0 ATLAS Network routes pass fail-closed production checks before the deployment is considered verified.

## 17. Implementation Boundary

This specification authorizes an implementation plan, not direct modification of production code. The implementation plan must identify exact files, interfaces, RED/GREEN test steps, commits, PR/CI gates, merge criteria, deployment path, and final E2E evidence required by this design.
