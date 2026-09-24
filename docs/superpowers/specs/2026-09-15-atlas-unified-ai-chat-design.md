# ATLAS Unified AI Chat — Design Specification

Date: 2026-09-15
Status: Approved
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Target branch: `feat/atlas-unified-ai-chat`
Owner: ATLAS Assistant / Intelligence Platform

## Purpose
Create one canonical ATLAS Assistant conversation surface that can route a user request to OpenAI/ChatGPT, Gemini, Codex Sovereign, or a governed multi-provider council while preserving tenant isolation, RBAC, auditability, truthful provider readiness, and explicit cost/side-effect gates.

The ChatGPT website (`https://chatgpt.com`) may be exposed only as an optional external convenience link. It is not embedded as the internal backend. ATLAS talks to OpenAI through the server-side OpenAI API adapter.

## Existing architecture to preserve
The current ATLAS copilot already has:
- an authenticated Supabase Edge Function entry point;
- an `IntelligenceRouter`;
- provider/store boundaries;
- persisted conversations and telemetry;
- OpenAI Responses API adapter support;
- `chatgpt`, `gemini`, and `codex-sovereign` identities in Studio orchestration;
- tenant, permission, audit, render, and cost rules.

This project extends those patterns rather than introducing a second assistant application.

## Canonical flow
`User -> ATLAS Assistant -> IntelligenceRouter -> Provider Adapter(s) -> Tool Gateway -> deterministic reconciliation -> persisted ATLAS response`

ATLAS is always the canonical owner of the conversation. Providers are execution/reasoning participants, never owners of tenant state or permission decisions.

## User-selectable modes
The unified assistant supports five modes:

1. `auto` — ATLAS chooses the best verified provider for the requested capabilities and profile.
2. `openai` — route only to the OpenAI adapter.
3. `gemini` — route only to the Gemini adapter.
4. `codex-sovereign` — route only to the Codex Sovereign adapter.
5. `council` — route the same normalized request to two or more verified providers, then reconcile their outputs into one ATLAS response.

A requested provider that is not verified returns a truthful `configuration_required`, `unavailable`, or `rate_limited` state; ATLAS never silently claims that provider ran.

## Reasoning profiles
Keep the existing `fast`, `balanced`, and `deep` profiles. Provider adapters translate these into provider-specific settings. The router may downgrade a profile only when the user selected `auto` and the downgrade is explicitly reported in routing metadata. Provider-specific modes never silently fall back to another provider.

## Provider model configuration
No fictional or hard-coded model identifier is allowed as a production default. OpenAI, Gemini, and Codex Sovereign model/runtime identifiers come from server-side configuration. Readiness verifies that configured targets are usable before a request is marked provider-verified.

OpenAI uses the Responses API server-side. API keys remain in secrets/environment only and are never returned to the browser, written to repository files, persisted in conversation records, or included in logs.

## Provider adapter interface
Each provider implements the same interface:

```ts
type IntelligenceProviderId = 'openai' | 'gemini' | 'codex-sovereign';

type ProviderDescriptor = {
  id: IntelligenceProviderId;
  configured: boolean;
  verified: boolean;
  capabilities: string[];
  profiles: Array<'fast' | 'balanced' | 'deep'>;
  model: string | null;
};

type ProviderResult = {
  provider: IntelligenceProviderId;
  model: string | null;
  text: string;
  capabilities_used: string[];
  usage: Record<string, unknown>;
  provenance: unknown[];
  tool_calls: AtlasToolCall[];
};
```

Adapters must implement `descriptor()`, `probe()`, and `execute()`. Provider-specific API details do not leak into the router or UI.

## Router contract
`IntelligenceRouter.route()` receives mode, intent/profile, requested capabilities, provider readiness and cost policy. It returns an explicit route plan:

```ts
type RoutePlan = {
  mode: 'auto' | IntelligenceProviderId | 'council';
  providers: IntelligenceProviderId[];
  profile: 'fast' | 'balanced' | 'deep';
  capabilities: string[];
  fallback_used: boolean;
  reason: string;
};
```

Rules:
- explicit provider mode selects only that provider;
- `auto` chooses from verified providers in deterministic preference order based on capability fit;
- `council` requires at least two verified providers;
- unverified providers are excluded from `auto`/`council` and reported in readiness metadata;
- the router never authorizes tool mutations or costs.

## Council orchestration
Council execution runs provider calls independently against the same normalized conversation context. Partial failures are recorded. If at least two providers succeed, a deterministic reconciliation stage produces the final ATLAS response.

The reconciliation stage receives only provider outputs, provenance, tool proposals, and the normalized user request. It does not receive provider chain-of-thought. It must preserve disagreements when they are material rather than fabricate consensus.

Council mode never duplicates an external side effect. Provider tool requests are proposals only; ATLAS Tool Gateway de-duplicates, validates, and authorizes execution once.

## Tool Gateway
All provider tool/function calls are converted into ATLAS tool proposals. A tool proposal includes:
- `tool_name`;
- normalized arguments;
- provider source;
- risk class;
- required permissions;
- side-effect classification;
- cost classification;
- proposal hash for de-duplication.

The gateway validates tenant scope, RBAC, schema, risk and approval policy before execution. Read-only tools may execute automatically when policy allows. Mutating, external, cost-bearing or security-sensitive actions retain the existing ATLAS approval rules.

## Conversation and persistence
One ATLAS conversation ID spans provider switches. Messages persist as user/assistant/tool events with routing metadata:
- requested mode;
- selected providers;
- profile;
- provider/model actually used;
- fallback metadata;
- tool proposal/execution references;
- telemetry IDs;
- latency and usage when available.

The UI may show compact provenance/provider badges without exposing secrets or private chain-of-thought.

## UI
ATLAS Assistant remains one chat surface. Add a compact mode selector with:
- Auto
- ChatGPT
- Gemini
- Codex Sovereign
- Council

Add a reasoning selector: Fast / Balanced / Deep.

The conversation header shows verified provider readiness. Message metadata can show which provider(s) actually contributed. If a selected provider is not configured, the composer remains usable but submission returns a clear configuration-required state and offers the appropriate setup action to authorized administrators.

An optional `Open in ChatGPT` external link may open `https://chatgpt.com` in a new tab/window; it does not transfer private ATLAS conversation data automatically.

## Security and privacy
- Provider credentials are server-side secrets only.
- Never include API keys or tokens in logs, client bundles, telemetry, audit payloads or prompts.
- Tenant and user context are resolved server-side from authenticated ATLAS session data.
- Provider input contains only the minimum authorized conversation/module context.
- Tool calls are schema validated and permission checked.
- No arbitrary remote URL fetching based solely on provider output.
- No arbitrary shell/JavaScript execution from model output.
- No cross-tenant conversation retrieval.
- No provider is allowed to bypass approval gates.

## Cost governance
Provider calls are considered cost-bearing unless explicitly zero-cost. The router receives policy describing allowed providers, per-request ceilings and organization limits. Council mode is disabled when policy cannot authorize its expected cost. A provider being configured does not mean calls are automatically authorized.

## Error model
Normalize provider failures into:
- `provider_not_configured`
- `provider_unavailable`
- `provider_rate_limited`
- `provider_auth_failed`
- `capability_unavailable`
- `permission_denied`
- `cost_approval_required`
- `tool_approval_required`
- `internal_error`

Never fabricate a completed response when all selected providers fail.

## Testing
Unit tests cover router selection, explicit-provider no-fallback behavior, council minimum-provider rules, deterministic provider ordering, normalized errors, tool de-duplication, permission/cost gates and provider metadata.

Adapter tests mock network boundaries and verify no secret appears in emitted telemetry/log payloads. Integration tests cover authenticated conversation persistence and provider switching within the same conversation.

UI tests cover mode/profile selection, readiness states, disabled/unconfigured provider feedback, provider badges, responsive behavior, keyboard navigation and screen-reader labels.

## Acceptance criteria
1. ATLAS presents one assistant conversation surface for OpenAI, Gemini and Codex Sovereign.
2. `auto`, explicit-provider, and `council` routing are deterministic and testable.
3. OpenAI runs through a server-side Responses API adapter; `chatgpt.com` is never treated as the backend API.
4. No fictional model identifier is a production default.
5. A selected unconfigured provider reports truthful configuration-required state.
6. Council mode cannot duplicate side effects and requires at least two verified providers.
7. Tool execution remains behind tenant/RBAC/risk/cost/approval gates.
8. Provider switches preserve the same ATLAS conversation.
9. Provider/model/routing metadata is auditable without exposing secrets or chain-of-thought.
10. Existing Creator/Studio orchestration remains compatible.
11. Typecheck, focused unit/integration tests, full tests and build pass before merge.
12. No merge or production deployment occurs without fresh verification evidence.
