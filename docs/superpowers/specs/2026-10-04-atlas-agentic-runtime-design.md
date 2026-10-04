# ATLAS Agentic Runtime — 2026 Change-Stack Parity Design

## Purpose

Extend the existing `atlas-copilot` intelligence bus so ATLAS can reproduce the practical capabilities represented by the major AI developer-stack changes announced between 2026-09-28 and 2026-10-04 without creating a parallel AI architecture.

The target is functional parity at the ATLAS capability layer, not vendor lock-in. Provider-specific features remain adapters behind ATLAS contracts and must fail closed when credentials, beta access, or runtime verification are missing.

## Outcomes

ATLAS SHALL provide five governed capabilities:

1. **Durable agent execution + computer use + multi-agent delegation**
   - OpenAI Agents API integration when explicitly configured and verified.
   - ATLAS-owned session metadata, policy, approvals, audit, and provider readiness.
   - No browser/desktop control without an explicit ATLAS policy decision.

2. **Cost-aware model routing for GPT-6.1 Sol-class workloads**
   - Support a distinct cost-optimized reasoning profile in the existing OpenAI adapter.
   - Preserve explicit provider selection semantics.
   - Reuse prompt caching and zero-cost/emergency budget policy already present.

3. **Gemini 4 Argon-class provider support**
   - Continue through the existing Gemini adapter.
   - Add tool/function-call normalization so Gemini can propose ATLAS tools through the same tool gateway used by other providers.
   - Model IDs remain environment-configurable; source code must not claim a model is available until probe verification passes.

4. **Deterministic dynamic workflows + automated code-review requests**
   - ATLAS defines reusable workflows in code with sequential, parallel, checkpoint, and verifier stages.
   - Workflow steps invoke registered ATLAS agents, not direct vendor authority.
   - GitHub review automation is an adapter/action behind ATLAS workflow policy; GitHub remains the source-of-truth/review surface.

5. **Machine metering + x402-compatible monetization boundaries**
   - Every callable ATLAS tool may declare metering metadata independent of billing provider.
   - The runtime can emit a normalized `payment_required` decision for protected tools.
   - Cloudflare Monetization Gateway/x402 integration remains optional and fail-closed until external readiness is verified.

## Existing Architecture Reused

The implementation MUST extend, not replace:

- `supabase/functions/atlas-copilot/provider-registry.mjs`
- `supabase/functions/atlas-copilot/intelligence-gateway.mjs`
- `supabase/functions/atlas-copilot/council-orchestrator.mjs`
- `supabase/functions/atlas-copilot/tool-gateway.mjs`
- `packages/agent-registry/*`
- existing cost policy, conversation store, auth, tenant isolation, audit, and provider readiness patterns

## Capability Contract

### Provider feature descriptors

Provider descriptors MAY expose a `feature_support` object with these normalized booleans:

- `background`
- `multi_agent`
- `computer_use`
- `function_calling`
- `remote_mcp`
- `programmatic_tool_calling`
- `dynamic_workflows`

Descriptors are informational only. Runtime execution requires a successful provider probe plus policy authorization.

### Agent sessions

A new `agent-session-runtime.mjs` provides provider-neutral methods:

- `createSession({ context, providerId, profile, capabilities, policy })`
- `runTurn({ session, input })`
- `submitApproval({ session, approval })`
- `getSession({ sessionId })`
- `closeSession({ sessionId })`

The OpenAI implementation may use `/v1/agents/sessions` with `OpenAI-Beta: agents=v1`. No provider session ID is exposed as an authority token. ATLAS stores only the minimum metadata needed for continuation and audit.

### Computer use policy

Computer-use requests SHALL be normalized into approval proposals with:

- origin/application
- requested action class
- reason
- risk class
- session ID
- provider request ID

The ATLAS policy defaults to approval-required for any sign-in, external write, purchase, destructive action, credential entry, or access outside an allowlisted origin/application. Website content is never treated as authorization.

### Multi-agent policy

ATLAS delegation observes both:

- provider-native multi-agent limits; and
- `AtlasAgentDefinition.maxDelegationDepth` and permission rules.

Parallel work is allowed only for independent tasks. Multiple agents SHALL NOT concurrently mutate the same file/resource without a deterministic workflow owner.

## Dynamic Workflow Runtime

Create a provider-neutral workflow engine with these step types:

- `task`
- `parallel`
- `verify`
- `checkpoint`

A workflow execution records:

- workflow ID/version
- run ID
- current state
- step inputs/outputs
- assigned agent IDs
- provider/model evidence
- approvals
- timestamps
- final status

The first built-in workflow is `atlas-code-change-review-v1`:

1. inspect change
2. parallel security/quality review
3. reconcile findings
4. request GitHub Copilot code review only if configured and policy-allowed
5. verify CI evidence
6. checkpoint before merge/deploy when policy requires it

GitHub Copilot never becomes the ATLAS orchestrator or deployment authority.

## Tool Calls and Function Calling

Provider adapters normalize tool/function calls to the existing proposal shape:

```text
{
  tool_name,
  arguments,
  risk_class,
  required_permissions,
  side_effect,
  cost_class,
  provider
}
```

The existing tool gateway remains the sole policy gate. Accepted read-only proposals may be executed by an authorized executor. Side-effecting or billable proposals require the configured approval policy.

## Metering Contract

Extend tool normalization with optional fields:

- `metering.mode`: `free | internal | x402`
- `metering.unit`
- `metering.amount`
- `metering.currency_or_asset`
- `metering.resource_id`

The gateway returns one of:

- `accepted`
- `approval_required`
- `payment_required`
- `denied`

No wallet private key, payment signature, or provider billing secret is stored in client-visible code or committed source.

## Routing and Models

OpenAI model IDs remain environment-configurable. Add defaults only where the repository already uses a default model pattern. A model is `verified` only after probe success.

Gemini model IDs remain environment-configurable. ATLAS may use Gemini 4 Argon only when the configured model probe succeeds.

No business logic may depend directly on one vendor model name.

## Security and Tenancy

Preserve all existing boundaries:

- organization/tenant isolation
- auth/session enforcement
- RBAC
- provider secrets server-side only
- explicit production/development separation
- immutable audit evidence for sensitive operations
- cost/spend gates
- fail-closed readiness

Computer-use and payment flows receive additional approval requirements; provider-native approval UX is not sufficient by itself.

## Observability

Every agent/workflow turn SHALL include a trace ID and record:

- provider
- model
- workflow/session identifiers
- latency
- usage
- tool proposals and decisions
- fallback attempts
- approvals/payment requirements
- errors

Provider-native IDs may be retained server-side for recovery but are never treated as ATLAS source-of-truth identifiers.

## API Surface

Extend `atlas-copilot` with versioned request modes rather than adding a parallel service:

- existing chat/intelligence requests remain backward compatible
- `api=agent-session` for governed durable agent sessions
- `api=workflow` for deterministic workflow execution/readback
- `api=readiness` includes normalized feature support

The exact endpoint dispatch follows existing `atlas-copilot` auth/CORS/error patterns.

## Testing Requirements

Add unit/source-contract tests that prove:

- provider descriptors expose truthful feature flags
- OpenAI agent-session requests include required beta header and never embed secrets
- computer-use requests are approval-gated
- multi-agent delegation respects depth and permission limits
- Gemini function calls normalize into ATLAS tool proposals
- workflow parallel/verify/checkpoint semantics are deterministic
- Copilot review automation is optional and cannot bypass ATLAS gates
- x402-protected tools return `payment_required` without exposing payment secrets
- old unified chat behavior remains compatible

Before production completion, run repository validation (`npm run typecheck`, `npm test`, `npm run build`) and the production verifier against the exact deployed revision.

## Definition of Done

The source implementation is complete only when all five capability families have executable ATLAS contracts and tests. Production parity for any provider-specific feature is complete only when the corresponding provider probe, credential/beta access, CI/deploy, and exact-revision production verification all pass. Missing external beta access must remain visibly `configuration-required` or `configured-unverified`, never simulated as live.
