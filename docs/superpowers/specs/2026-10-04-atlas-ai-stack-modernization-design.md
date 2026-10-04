# ATLAS AI Stack Modernization Design

Date: 2026-10-04
Branch: `feat/ai-stack-2026-10-04`

## Intent

Bring the current ATLAS intelligence stack up to the October 2026 provider/runtime baseline without replacing the existing `atlas-copilot` architecture. Success means provider-neutral model selection, explicit support for OpenAI GPT-6.1 Sol and Anthropic Claude Sonnet 5.5, fail-closed provider readiness, an audited OpenAI hosted computer-use lifecycle, reusable versioned security taskflows, and CI/production verification before any 100% claim.

## Current foundation

ATLAS already has a unified `IntelligenceRouter`, provider registry, cost policy, tenant-aware authentication, provider readiness probes, council routing, telemetry, a Tool Gateway, OpenAI/Bedrock/Gemini/local/Codex adapters, and an enterprise Assistant UI. The modernization extends those boundaries instead of introducing a parallel orchestration stack.

## Selected approach

Extend the existing provider/runtime model in place.

Alternatives rejected:

1. Replace `atlas-copilot` with a new orchestration framework. Rejected because it duplicates working governance, storage and cost controls and creates migration risk.
2. Hard-code the new model names into individual callers. Rejected because model churn would continue to break consumers and would defeat provider neutrality.
3. Extend the current registry with capability-aware model metadata and provider adapters. Selected because it preserves existing tenant, cost, audit and readiness contracts while allowing future models to be replaced centrally.

## Architecture

`ATLAS Assistant / Work -> IntelligenceRouter -> Provider Registry + Model Catalog -> provider adapter -> telemetry/audit`

For browser automation:

`ATLAS Work -> authenticated computer-use endpoint -> OpenAI Agent Runtime -> hosted browser session -> required-action surface -> result/activity -> explicit cleanup -> audit`

For security automation:

`Security Taskflow definition -> ordered immutable steps -> existing intelligence gateway/provider routing -> evidence per step -> remediation proposal -> regression verification`

## Model catalog

Create a first-party model catalog that maps logical workload classes to provider/model candidates while keeping environment overrides authoritative.

Initial verified public model identifiers:

- OpenAI balanced/default: `gpt-6.1-sol`
- OpenAI deep: `gpt-6-astra`
- OpenAI fast/high-volume: `gpt-6-luna`
- Anthropic default profiles: `claude-sonnet-5-5`

Application code must continue to request modes/profiles/capabilities rather than importing these identifiers directly.

## Provider contract

Add `anthropic` to provider IDs, registry ordering, readiness output, allowed/zero-cost policy filtering and UI mode types. The Anthropic adapter uses server-side `ANTHROPIC_API_KEY`, the Messages API, `claude-sonnet-5-5` by default, and a live model-capability probe before it can be reported verified.

No provider may be surfaced as live solely because a secret exists.

## Capabilities

Expand normalized capabilities to include:

- `generation`
- `reasoning`
- `computer_use`
- `multi_agent`

Provider descriptors advertise only capabilities that the implemented adapter/runtime can actually execute. `computer_use` is not treated as ordinary chat execution; it is handled by the governed agent-runtime endpoint.

## OpenAI hosted computer use

Add a dedicated runtime adapter around the Agents API `/v1/agents/sessions` lifecycle. It must:

- require the existing authenticated ATLAS organization context;
- use server-side `OPENAI_API_KEY` only;
- default to `gpt-6.1-sol`, with environment override;
- create hosted browser sessions with screenshots opt-in;
- permit only explicit lifecycle actions: create session, send events/input, inspect session, list activity items, delete session;
- surface `required_actions` instead of automatically approving website origins or authentication;
- never auto-submit credentials;
- preserve fail-closed HTTP/provider errors;
- avoid logging screenshots, credentials or raw sensitive browser activity;
- expose enough metadata for caller-side audit and cleanup.

The runtime must not claim a task completed until the upstream session reports a terminal successful state.

## Security taskflows

Create versioned immutable taskflow definitions. Initial `authorized-code-audit.v1` steps:

1. `recon`
2. `hypothesis`
3. `code_search`
4. `vulnerability_analysis`
5. `exploitability_check`
6. `evidence`
7. `remediation`
8. `regression_test`

The module validates taskflow IDs/versions, enforces stable ordering, and returns a serializable execution plan that existing authorized workers can execute. It does not itself bypass repository permissions or run offensive actions.

## UI/readiness

Both the React Assistant and the Edge fallback UI add Anthropic as a selectable provider. Provider status remains disabled unless readiness is `verified`. Readiness responses publish model/capability metadata and the computer-use runtime state without exposing credentials.

## Cost and safety

Existing zero-cost-first policy remains authoritative. Anthropic is paid and therefore blocked automatically when zero-cost enforcement disallows paid providers. OpenAI computer use is also cost-sensitive and must not be invoked through ordinary zero-cost auto-routing.

All credentials remain server-side. Tenant isolation, RBAC, approval boundaries and evidence-based status language are unchanged.

## Acceptance criteria

1. `gpt-6.1-sol`, `gpt-6-astra`, `gpt-6-luna`, and `claude-sonnet-5-5` exist only in central runtime/catalog configuration, not scattered caller logic.
2. `anthropic` can be selected, probed and executed when configured; otherwise it fails closed and reports configuration-required/unavailable truthfully.
3. Router tests cover Anthropic and new capabilities without breaking current zero-cost/fallback behavior.
4. OpenAI computer-use lifecycle methods are unit tested for create/send/read/items/delete and fail-closed error mapping.
5. Required actions are surfaced, never auto-approved; authentication values are never logged or stored by the adapter.
6. Security taskflow definitions are immutable, versioned and unit tested for exact step ordering and invalid IDs.
7. Assistant UI/types/readiness expose Anthropic consistently.
8. Focused unit tests pass, then full repository typecheck/unit/integration/build/security gates pass in CI.
9. Merge/deploy occurs only after required checks are green.
10. Production is considered verified only when the deployed SHA matches merged `main` and P0 routes/health pass under the existing global production verifier.

## Non-goals

- Replacing the existing conversation store, Tool Gateway or cost policy.
- Automatically approving browser origin/sign-in requests.
- Claiming Anthropic or OpenAI computer use is operational when provider credentials or upstream entitlement are missing.
- Bypassing external provider billing, safety controls or account requirements.
