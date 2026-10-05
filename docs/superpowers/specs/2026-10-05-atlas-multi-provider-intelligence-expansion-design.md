# ATLAS Multi-Provider Intelligence Expansion — Design Specification

Date: 2026-10-05
Status: Proposed for written-spec review
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Base branch: `main`
Working branch: `docs/atlas-multi-provider-intelligence-expansion`
Owner: ATLAS Assistant / Intelligence Platform

## 1. Purpose

Extend the existing ATLAS Unified AI Chat and IntelligenceRouter so ATLAS can govern additional useful AI providers without creating a second assistant, a parallel orchestration stack, or provider-owned business logic.

The expansion adds governed support for:

- `anthropic` — Claude;
- `xai` — Grok;
- `mistral` — Mistral / Devstral family through server-side configuration;
- `cohere` — Command family and enterprise RAG/citations;
- `deepseek` — reasoning/coding through its server-side API;
- `perplexity` — specialized grounded web research/search.

Existing providers remain first-class:

- `atlas-local`;
- `openai`;
- `bedrock`;
- `gemini`;
- `codex-sovereign`.

ATLAS remains the system of control. Providers are replaceable reasoning, generation, retrieval, coding, and multimodal execution participants.

## 2. Relationship to the existing approved design

This specification extends, but does not replace, `docs/superpowers/specs/2026-09-15-atlas-unified-ai-chat-design.md`.

The canonical flow remains:

`User -> ATLAS Assistant -> IntelligenceRouter -> Provider Adapter(s) -> Tool Gateway -> deterministic reconciliation -> persisted ATLAS response`

The following invariants from the existing design remain mandatory:

1. ATLAS owns conversation identity and tenant state.
2. Providers do not make authorization decisions.
3. Provider credentials stay server-side.
4. Explicit provider selection never silently falls back to another provider.
5. `auto` may fall back only under ATLAS policy and only to verified compatible providers.
6. `council` requires multiple verified compatible providers.
7. Provider tool calls are proposals, not executions.
8. ATLAS Tool Gateway performs schema validation, permission checks, risk classification, cost checks, approval gating, de-duplication, and execution.
9. Side effects execute at most once.
10. Provider/model/routing metadata is auditable without exposing private chain-of-thought or secrets.
11. No merge or deployment is considered complete without fresh verification evidence.

## 3. Current implementation baseline

The current runtime already contains:

- `supabase/functions/atlas-copilot/provider-registry.mjs`;
- `supabase/functions/atlas-copilot/intelligence-gateway.mjs`;
- `supabase/functions/atlas-copilot/council-orchestrator.mjs`;
- `supabase/functions/atlas-copilot/tool-gateway.mjs`;
- provider adapters for ATLAS Local, OpenAI, Amazon Bedrock, Gemini, and Codex Sovereign;
- `/assistant` UI through `apps/web/src/modules/intelligence/UnifiedAIChatPage.tsx`;
- focused unit/integration coverage for unified routing and UI.

The current provider order is fixed to:

`atlas-local -> openai -> bedrock -> gemini -> codex-sovereign`

The current gateway capability vocabulary is limited to:

- `generation`;
- `reasoning`.

This expansion must evolve those contracts rather than duplicate them.

## 4. Success criteria

The project succeeds when:

1. All six new providers can be represented by the canonical registry and readiness contract.
2. Each provider is activated only when configured and verified server-side.
3. The router can choose providers by capability fit, routing policy, readiness, and cost policy.
4. Explicit provider mode remains fail-closed and never silently substitutes another provider.
5. Council can include any compatible verified provider while preserving deterministic ordering and side-effect de-duplication.
6. Provider-specific citation/provenance information is normalized into ATLAS provenance.
7. Provider-specific tool calls are normalized into ATLAS tool proposals and never execute directly.
8. No API key, bearer token, credential, provider secret, or private reasoning is exposed to the browser, repository, telemetry, conversation content, or logs.
9. The `/assistant` surface can expose new providers without becoming visually unmanageable.
10. Provider model IDs remain server-configured rather than hard-coded product defaults.
11. Existing OpenAI, Bedrock, Gemini, ATLAS Local, Codex Sovereign, conversation persistence, Creator/Studio compatibility, and cost policy behavior remain backward compatible.
12. Focused tests, broader regression tests, build, security gates, CI, deploy, and production E2E verification pass before completion is claimed.

## 5. Non-goals

This expansion does not:

- clone vendor chat websites;
- embed vendor consumer products as ATLAS backends;
- allow providers to hold ATLAS authorization state;
- create independent provider-specific conversation databases;
- expose raw provider APIs directly to the browser;
- permit a provider to bypass Tool Gateway;
- automatically enable paid providers merely because credentials exist;
- hard-code current marketing model names as permanent product contracts;
- create a separate visible provider for every open-weight model;
- outsource ATLAS routing, governance, audit, or cost control to a third-party orchestration platform.

## 6. Design alternatives considered

### 6.1 Recommended: native provider adapters behind the existing ATLAS contract

Each provider receives a small server-side adapter implementing the same ATLAS descriptor/probe/execute contract.

Advantages:

- preserves ATLAS governance;
- provider-specific security differences stay isolated;
- citations, tool calls, multimodal inputs, usage, rate limits, and errors can be normalized correctly;
- providers remain replaceable;
- existing router, council, store, cost policy, and Tool Gateway remain reusable.

Cost:

- more adapter code and provider-specific tests.

Decision: selected.

### 6.2 Rejected: one generic “OpenAI-compatible” mega-adapter

Some vendors expose OpenAI-compatible APIs. A single generic adapter would reduce initial code, but it would hide important differences in:

- tool-call behavior;
- reasoning controls;
- citation/provenance structures;
- multimodal support;
- built-in search behavior;
- error semantics;
- rate-limit metadata;
- usage accounting;
- feature availability by model.

Decision: rejected as the canonical architecture. Shared internal helpers may still reduce duplication between adapters.

### 6.3 Rejected: outsource routing to a third-party AI gateway

A managed multi-model gateway could simplify provider selection but would move ATLAS policy decisions and telemetry boundaries outside the sovereign control plane.

Decision: rejected for canonical routing. External gateways may later exist only as optional transport adapters behind the same ATLAS policy boundary.

## 7. Canonical provider IDs

Extend the provider ID contract to:

```ts
type IntelligenceProviderId =
  | 'atlas-local'
  | 'openai'
  | 'bedrock'
  | 'gemini'
  | 'codex-sovereign'
  | 'anthropic'
  | 'xai'
  | 'mistral'
  | 'cohere'
  | 'deepseek'
  | 'perplexity';
```

Canonical user modes become:

```ts
type IntelligenceMode =
  | 'auto'
  | IntelligenceProviderId
  | 'council';
```

The provider list must exist in one canonical module or exported contract. The registry, router, UI, tests, readiness endpoint, and council must consume that contract rather than maintaining divergent copies.

## 8. Capability model

### 8.1 Functional capabilities

Extend functional capability routing to:

```ts
type IntelligenceCapability =
  | 'generation'
  | 'reasoning'
  | 'coding'
  | 'research'
  | 'grounded-search'
  | 'rag'
  | 'multimodal';
```

A provider may advertise a capability only when the configured runtime/model has been verified to support it.

### 8.2 Routing selectors

The approved design also requires:

- `low-cost`;
- `local-private`.

These are routing characteristics rather than semantic model capabilities. Internally they should be represented separately from functional capabilities:

```ts
type RoutingTrait =
  | 'low-cost'
  | 'local-private';
```

For compatibility, the request normalizer may accept these values in a unified `capabilities_requested` input, but the router must split functional requirements from routing traits before provider matching.

This prevents a provider from being treated as semantically incapable merely because it is not a “low-cost” route.

### 8.3 Capability verification

Capabilities are not inferred from provider brand names. They come from adapter descriptors and readiness probes tied to actual server-side configuration.

No model or provider is assumed to support every capability.

## 9. Provider descriptor contract

Extend the existing descriptor shape without leaking provider implementation details into the router:

```ts
type ProviderDescriptor = {
  id: IntelligenceProviderId;
  configured: boolean;
  capabilities: IntelligenceCapability[];
  routing_traits: RoutingTrait[];
  profiles: Array<'fast' | 'balanced' | 'deep'>;
  model: string | null;
  models?: Partial<Record<'fast' | 'balanced' | 'deep', string>>;
  api: string | null;
  backend: string | null;
  feature_support?: {
    tools?: boolean;
    citations?: boolean;
    multimodal?: boolean;
    search?: boolean;
    rag?: boolean;
    streaming?: boolean;
  };
};
```

Provider-specific optional metadata may remain in descriptors only when sanitized and useful for readiness/admin UI.

Secrets must never appear in descriptors.

## 10. Readiness contract

Every adapter must implement:

- `descriptor()`;
- `probe({ profile })`;
- `execute(...)`.

Readiness state remains normalized to:

- `verified`;
- `configuration-required`;
- `configured-unverified`;
- `rate-limited`;
- `unavailable`.

A configured credential is not sufficient for `verified`.

`probe()` must establish enough evidence that the configured endpoint/model is usable for the claimed profile/capabilities without performing a business side effect.

Readiness probes must be bounded, cost-aware, and safe to call from authorized status flows.

## 11. Provider-specific roles and constraints

### 11.1 Anthropic / Claude

Provider ID: `anthropic`.

Primary ATLAS roles:

- reasoning;
- coding;
- generation;
- multimodal when the configured runtime supports it;
- research only when an explicitly configured and policy-authorized search capability is available.

Implementation principles:

- use Anthropic server-side API contracts directly rather than treating Claude as an OpenAI clone;
- normalize Anthropic tool-use blocks into ATLAS tool proposals;
- provider-owned tool execution must not perform ATLAS business mutations;
- preserve provider protocol requirements internally without persisting private reasoning;
- model IDs and reasoning controls come from server configuration.

### 11.2 xAI / Grok

Provider ID: `xai`.

Primary ATLAS roles:

- reasoning;
- coding;
- generation;
- multimodal when verified;
- grounded search / X-aware research only when the relevant server-side tools are explicitly enabled by policy.

Implementation principles:

- use the server-side xAI API;
- built-in provider search is treated as retrieval, not authorization;
- external actions returned through function calling become ATLAS tool proposals;
- tool invocation costs must flow into ATLAS usage/cost telemetry where available;
- model IDs are server-configured.

### 11.3 Mistral / Devstral

Provider ID: `mistral`.

Primary ATLAS roles:

- generation;
- reasoning;
- coding;
- RAG;
- multimodal when verified.

Implementation principles:

- prefer direct stateless request/response integration for canonical ATLAS conversations;
- provider-side persistent Agent entities are not required for the initial implementation because ATLAS owns conversation state;
- normalize function calls into ATLAS tool proposals;
- provider built-in tools may be used only when explicitly authorized and when they do not duplicate ATLAS-native controls.

### 11.4 Cohere / Command

Provider ID: `cohere`.

Primary ATLAS roles:

- enterprise RAG;
- grounded generation;
- citations/provenance;
- generation;
- reasoning where supported by the configured runtime.

Implementation principles:

- normalize Cohere document/tool citations into ATLAS provenance;
- ATLAS remains responsible for retrieving private tenant documents unless a separately approved provider-side data path exists;
- tool calls become ATLAS proposals;
- private ATLAS documents are sent only under minimum-context and tenant authorization rules.

### 11.5 DeepSeek

Provider ID: `deepseek`.

Primary ATLAS roles:

- reasoning;
- coding;
- generation;
- low-cost routing when verified by current cost policy.

Implementation principles:

- compatibility with another vendor SDK does not collapse DeepSeek into that vendor's adapter;
- DeepSeek receives its own credential namespace, readiness state, telemetry identity, rate-limit handling, and policy entry;
- tool calls become ATLAS proposals;
- any “low-cost” trait is derived from ATLAS configuration/policy, not permanently asserted in code.

### 11.6 Perplexity

Provider ID: `perplexity`.

Primary ATLAS roles:

- `research`;
- `grounded-search`;
- cited web retrieval.

Perplexity is not the default general-purpose assistant provider in this phase.

Implementation principles:

- use Perplexity's server-side search/agent API only through the adapter;
- normalize returned sources into ATLAS provenance;
- do not treat a cited provider answer as automatically trusted — ATLAS preserves source metadata for inspection;
- the adapter must not create ATLAS mutation proposals in the initial phase;
- research costs and search/tool usage must be reported to ATLAS cost telemetry when available.

## 12. Open-weight models

Llama and other open-weight models do not automatically create new top-level provider identities.

They should normally be surfaced through:

- `atlas-local` when hosted by ATLAS;
- `bedrock` when served through approved AWS infrastructure;
- another future governed runtime adapter when operationally justified.

The user-facing provider represents the governed runtime/control boundary, not every underlying model family.

This avoids credential sprawl, duplicate UI modes, and false distinctions between models served by the same runtime.

## 13. Router design

The router receives:

- requested mode;
- reasoning profile;
- functional capabilities;
- routing traits;
- provider readiness;
- tenant/provider allowlist;
- preferred-provider policy;
- cost policy;
- emergency fallback policy where applicable.

### 13.1 Explicit provider mode

When `mode` is a provider ID:

1. select only that provider;
2. verify configured state;
3. verify readiness;
4. verify profile/capability fit;
5. evaluate cost policy;
6. execute or return a normalized failure.

No silent provider substitution is allowed.

### 13.2 Auto mode

`auto` selects from verified, allowed, capability-compatible providers.

Selection must be deterministic for identical readiness/policy input.

Routing priority is not a permanent “best model” ranking. It is a policy-driven ordered score based on:

1. capability fit;
2. routing-trait fit;
3. tenant/provider allowlist;
4. verified readiness;
5. configured preferred-provider policy;
6. cost policy;
7. deterministic stable provider tie-breaker.

Runtime fallback remains limited to retryable provider failures such as normalized unavailability/rate limiting and only when policy authorizes the fallback provider.

### 13.3 Council mode

Council:

- requires at least two verified compatible providers;
- sends the same normalized authorized context to each selected provider;
- does not share one provider's private reasoning with another;
- normalizes outputs, provenance, usage, and tool proposals;
- preserves material disagreement;
- de-duplicates identical tool proposals before any authorization/execution decision;
- is denied when cost policy cannot authorize expected multi-provider cost.

Council provider count should be bounded by policy rather than automatically invoking every configured provider.

## 14. Capability-oriented routing examples

Examples are illustrative policy behavior, not hard-coded model rankings.

### Coding request

`coding + reasoning`

Eligible examples may include:

- Codex Sovereign;
- OpenAI;
- Anthropic;
- xAI;
- Mistral;
- DeepSeek;
- ATLAS Local when verified for the capability.

### Grounded research request

`research + grounded-search`

Eligible examples may include:

- Perplexity;
- xAI when search is enabled;
- Anthropic when search is enabled;
- other future verified search-capable providers.

### Enterprise RAG request

`rag + generation`

Eligible examples may include:

- Cohere;
- Mistral;
- Bedrock;
- ATLAS Local when configured with the required retrieval path.

### Private/local request

`generation + local-private`

Only providers explicitly marked by ATLAS policy as satisfying the local/private boundary are eligible.

A cloud provider must never be inferred to satisfy `local-private` merely because it advertises enterprise privacy controls.

## 15. Cost governance

The existing cost-policy boundary remains authoritative.

Extend provider cost configuration so each provider can be classified as:

- disabled;
- allowed-within-budget;
- approval-required;
- zero-cost from ATLAS's current perspective;
- eligible for emergency fallback under a bounded reserve.

`low-cost` is dynamic policy metadata. It must not be hard-coded permanently to any provider.

Council must estimate/authorize aggregate provider cost before starting calls when possible.

Actual usage/cost telemetry should be recorded after execution when provider usage metadata is available.

Provider-native tool/search invocation costs must be included when the API exposes them.

## 16. Tool Gateway and side-effect safety

All provider function/tool requests are proposals.

Canonical flow:

`Provider -> normalized AtlasToolProposal -> Tool Gateway -> policy decision -> optional human approval -> single ATLAS execution`

No adapter may directly:

- send email;
- change GitHub state;
- merge a pull request;
- deploy production;
- change financial data;
- charge money;
- modify HR/payroll records;
- place calls/messages;
- mutate external SaaS state;
- execute arbitrary shell/code against production;
- bypass tenant/RBAC/cost/risk approval.

Built-in provider retrieval/search/code-interpreter capabilities are allowed only as provider-local computation/retrieval under policy. They do not gain ATLAS mutation authority.

## 17. Tool proposal normalization

Adapters normalize vendor-specific function calls into:

```ts
type AtlasToolProposal = {
  tool_name: string;
  arguments: Record<string, unknown>;
  provider: IntelligenceProviderId;
  provider_call_id: string | null;
  risk_class: string;
  side_effect: 'none' | 'external-read' | 'mutation';
  cost_class: string;
  required_permissions: string[];
  proposal_hash: string;
};
```

The proposal hash must be deterministic over normalized tool name, arguments, tenant scope, and relevant operation identity so Council cannot execute the same side effect twice.

Provider-generated IDs are metadata only and are not trusted de-duplication keys.

## 18. Provenance normalization

Normalize provider citations and search/retrieval sources into one ATLAS source format:

```ts
type AtlasProvenance = {
  provider: IntelligenceProviderId;
  kind: 'web' | 'document' | 'tool' | 'provider-citation' | 'internal';
  title?: string | null;
  url?: string | null;
  document_id?: string | null;
  snippet?: string | null;
  provider_source_id?: string | null;
  metadata?: Record<string, unknown>;
};
```

Rules:

- preserve source URLs when the provider returns them;
- never fabricate a URL;
- never expose credentials or signed secret URLs unnecessarily;
- tenant-private document identifiers remain tenant-scoped;
- provider citations are evidence metadata, not authorization or automatic truth guarantees.

## 19. Conversation ownership and provider switching

One ATLAS conversation ID remains valid while switching providers.

Persist:

- requested mode;
- selected provider(s);
- configured reasoning profile;
- requested capabilities;
- routing traits;
- actual provider/model used;
- fallback metadata;
- contributions in Council;
- normalized provenance;
- normalized tool proposal/execution references;
- usage/cost metadata;
- latency and trace IDs.

Do not persist provider private chain-of-thought.

Provider-specific opaque state may be persisted only when required to continue an API protocol safely and only in a server-side field that is not exposed as user-visible reasoning.

## 20. Error normalization

Preserve the existing error model and add only errors that represent genuinely new ATLAS states.

Canonical errors remain:

- `provider_not_configured`;
- `provider_unavailable`;
- `provider_rate_limited`;
- `provider_auth_failed`;
- `provider_verification_required`;
- `capability_unavailable`;
- `permission_denied`;
- `cost_approval_required`;
- `tool_approval_required`;
- `internal_error`.

Provider-specific HTTP/error codes must be normalized inside the adapter.

Provider error bodies must be sanitized before telemetry persistence.

## 21. Secrets and configuration

Each provider receives a distinct server-side configuration namespace.

Illustrative secret/config names may include:

- Anthropic API credential + configured models;
- xAI API credential + configured models;
- Mistral API credential + configured models;
- Cohere API credential + configured models;
- DeepSeek API credential + configured models;
- Perplexity API credential + configured API mode.

Exact secret names will be chosen during implementation to match repository conventions.

Rules:

- credentials never enter client bundles;
- credentials never appear in readiness responses;
- credentials never appear in git;
- credentials never appear in prompts;
- credentials never appear in audit payloads or conversation records;
- adapters must redact provider error content before logging;
- configuration presence alone never marks a provider `verified`.

## 22. UI design

ATLAS Assistant remains one surface.

The current flat provider selector will become difficult to scan with eleven providers plus `auto` and `council`.

The UI should therefore use a compact provider control with:

- Auto as the primary default;
- Council as a governed multi-provider mode;
- a searchable/scrollable provider list or grouped provider menu;
- provider readiness state;
- optional capability badges;
- clear configuration-required state for authorized admins;
- the existing Fast / Balanced / Deep reasoning control.

Suggested grouping:

- ATLAS: ATLAS Local, Codex Sovereign;
- OpenAI / hyperscaler: OpenAI, Bedrock, Gemini;
- Frontier providers: Anthropic, xAI, Mistral, Cohere, DeepSeek;
- Research: Perplexity.

Grouping is presentation only and must not affect routing policy.

The normal user does not need to understand vendor API details.

## 23. Admin/provider readiness UI

Authorized administrators should be able to see, without secrets:

- provider ID/display name;
- configured state;
- verified state;
- current configured model alias/identifier where safe;
- supported profiles;
- verified capabilities;
- feature support such as tools/citations/search/multimodal;
- last probe status/time if the existing readiness contract supports it;
- sanitized failure reason.

No admin UI in this scope writes raw credentials to a browser-visible persistent store.

## 24. Backward compatibility

The implementation must preserve:

- existing modes and API request shapes where possible;
- existing OpenAI behavior;
- Bedrock behavior;
- Gemini behavior;
- ATLAS Local behavior;
- Codex Sovereign behavior;
- current conversation IDs;
- current telemetry records;
- cost policy semantics;
- Tool Gateway semantics;
- existing Creator/Studio orchestration.

If the provider/capability enum expansion requires a versioned API response, add fields compatibly rather than renaming existing fields unnecessarily.

## 25. Shared adapter utilities

Provider adapters remain separate, but implementation may introduce narrowly scoped shared utilities for:

- safe JSON parsing;
- HTTP timeout/abort handling;
- sanitized error normalization;
- usage normalization;
- common tool-schema conversion;
- common provenance helpers;
- common credential/config presence checks.

Shared utilities must not erase provider-specific protocol semantics.

## 26. Network and timeout policy

Every provider request must have:

- bounded timeout;
- abort handling;
- normalized retryability classification;
- no unbounded provider-side agent loop;
- policy-bounded built-in search/tool use;
- no automatic retry of non-idempotent ATLAS mutations because mutations are outside provider adapters.

Auto runtime fallback must not cause an unbounded sequence of paid provider calls.

## 27. Data minimization

Before any provider call:

1. authenticate ATLAS principal;
2. resolve tenant scope;
3. enforce `intelligence.use` or stronger required permission;
4. load only the conversation/module context needed for the task;
5. remove secrets and unnecessary private fields;
6. apply provider allowlist/data-boundary policy;
7. evaluate cost policy.

Providers never receive the entire tenant database simply because they support long context.

## 28. Provider allowlists and sensitive workloads

Tenant policy may disallow specific cloud providers or capabilities.

The router must honor:

- organization provider allowlist;
- module-level restrictions where present;
- local/private routing requirement;
- cost restrictions;
- future data-residency restrictions.

Explicit selection of a policy-disallowed provider returns a truthful permission/policy failure rather than silently routing elsewhere.

## 29. Council reconciliation

Council reconciliation must remain deterministic at the ATLAS layer.

Inputs:

- normalized user request;
- provider outputs;
- normalized provenance;
- normalized tool proposals;
- provider/model contribution metadata;
- failure metadata.

The reconciler must:

- preserve material disagreement;
- never claim a failed provider contributed;
- avoid copying private reasoning;
- de-duplicate tool proposals;
- expose provider contributions at a safe summary level;
- fail truthfully if the policy-required minimum successful providers is not met.

## 30. Testing strategy

Implementation follows TDD.

### 30.1 Contract tests

Add tests proving:

- canonical provider IDs include all existing + six new providers;
- canonical modes include provider IDs + `auto` + `council`;
- request normalization accepts all new functional capabilities;
- routing selectors are normalized separately from functional capabilities;
- unknown providers/capabilities fail closed.

### 30.2 Registry tests

Add tests proving:

- readiness includes every canonical provider;
- missing adapter reports configuration-required;
- configured-but-unverified remains unavailable to routing;
- sanitized descriptor fields are returned;
- secret-like fields are never returned.

### 30.3 Router tests

Add tests for:

- explicit Anthropic no-fallback;
- explicit xAI no-fallback;
- explicit Mistral no-fallback;
- explicit Cohere no-fallback;
- explicit DeepSeek no-fallback;
- explicit Perplexity no-fallback;
- Auto capability fit;
- local-private enforcement;
- low-cost policy routing;
- stable deterministic tie-breaks;
- provider allowlist enforcement;
- Council minimum provider rule;
- Council bounded provider count;
- cost-denied providers excluded before execution where applicable.

### 30.4 Adapter tests

Each adapter gets mocked network tests for:

- descriptor;
- probe success/failure;
- execution success;
- auth failure;
- rate limit;
- timeout/unavailable;
- tool-call normalization when supported;
- provenance/citation normalization when supported;
- usage normalization;
- secret redaction;
- no direct side-effect execution.

### 30.5 Tool Gateway tests

Prove that:

- identical proposals from multiple providers de-duplicate;
- mutation proposals require existing ATLAS policy/approval;
- denied provider proposals do not execute;
- provider built-in retrieval is not mislabeled as an ATLAS mutation.

### 30.6 UI tests

Prove that:

- all canonical provider modes are reachable;
- Auto and Council remain prominent;
- new provider menu remains keyboard navigable;
- readiness states render truthfully;
- unconfigured providers provide clear feedback;
- capability/readiness metadata is accessible to screen readers;
- responsive behavior remains usable on mobile.

### 30.7 Regression tests

Existing unified assistant, cost, Council, provider, conversation, Creator/Studio, and production readiness tests must remain green.

## 31. Security tests

Automated checks must search server/client output and test fixtures to ensure provider secret environment variable names or representative secret values do not leak into:

- browser bundles;
- status/readiness JSON;
- conversation payloads;
- telemetry payloads;
- audit payloads;
- exception messages returned to clients.

Tests should also prove that provider-returned arbitrary URLs or tool names cannot automatically trigger fetches or mutations outside approved ATLAS paths.

## 32. Observability

Provider telemetry should support:

- requested mode;
- selected provider(s);
- actual provider/model;
- capability requirements;
- routing traits;
- readiness decision;
- fallback attempts;
- normalized failure reason;
- latency;
- provider-reported usage;
- estimated/actual cost when available;
- built-in search/tool usage when available;
- Council contribution status.

Do not store chain-of-thought.

## 33. Rollout strategy

Rollout is capability-gated, not all-at-once activation.

Recommended sequence:

1. expand canonical contracts and tests;
2. implement shared safe adapter helpers if needed;
3. add adapters behind configuration-required readiness;
4. add registry/router support;
5. add cost policy entries;
6. add UI provider discovery/readiness;
7. verify Council compatibility;
8. run focused tests;
9. run broader regression/build/security gates;
10. enable only providers with valid server-side configuration;
11. deploy through normal ATLAS release path;
12. perform production readiness/E2E verification without exposing secrets.

A provider may ship in code while remaining `configuration-required` in production until credentials and provider-specific configuration are authorized.

## 34. External API contract assumptions

Implementation must verify current official provider API documentation immediately before coding each adapter because vendor APIs and model names can change.

Current design assumptions:

- Anthropic supports server-side Messages/tool-use style integration and current-model reasoning/tool features;
- xAI exposes server-side response/tool APIs including function calling and optional built-in search tools;
- Mistral exposes function calling and agent/conversation tooling;
- Cohere exposes Chat/tool use and fine-grained citations/RAG grounding;
- DeepSeek exposes server-side tool calls and API compatibility patterns while remaining a distinct provider identity;
- Perplexity exposes dedicated web search and agent/research APIs with source-oriented retrieval.

These assumptions define adapter intent, not permanent endpoint/model constants.

## 35. Model lifecycle policy

No provider adapter hard-codes a marketing model name as an architectural requirement.

For every provider:

- model IDs are server-configured;
- readiness verifies configured model availability;
- deprecated/retired models result in readiness failure until configuration is updated;
- profile-to-model mapping may be changed without router/UI code changes;
- production does not silently switch to an unknown model unless ATLAS policy explicitly allows provider-managed aliases and records the actual returned model identity.

## 36. Files expected to change during implementation

Exact paths may be refined by the implementation plan, but expected areas include:

- `supabase/functions/atlas-copilot/provider-registry.mjs`;
- `supabase/functions/atlas-copilot/intelligence-gateway.mjs`;
- `supabase/functions/atlas-copilot/council-orchestrator.mjs` if required;
- `supabase/functions/atlas-copilot/cost-policy.mjs` if provider policy enumeration requires it;
- `supabase/functions/atlas-copilot/index.ts` for adapter wiring/readiness;
- six new provider adapter modules;
- optional focused shared adapter utility module(s);
- `apps/web/src/modules/intelligence/UnifiedAIChatPage.tsx` and related types/API client if needed;
- focused unit/integration/UI tests;
- provider/readiness documentation or env example files that contain names only, never secrets.

No unrelated ATLAS module refactor is part of this project.

## 37. Acceptance criteria

1. Provider IDs contain the five current providers plus Anthropic, xAI, Mistral, Cohere, DeepSeek, and Perplexity.
2. There is one canonical provider-ID source consumed by registry/router/UI/tests or equivalent compile/runtime-safe generation that prevents drift.
3. Functional capability routing supports `generation`, `reasoning`, `coding`, `research`, `grounded-search`, `rag`, and `multimodal`.
4. Routing supports `low-cost` and `local-private` as explicit policy traits/selectors.
5. Every provider implements or is represented through the existing descriptor/probe/execute adapter contract.
6. Missing configuration produces truthful configuration-required state.
7. Explicit provider modes never silently fall back.
8. Auto uses only verified, allowed, compatible providers and applies deterministic policy ordering.
9. Council uses at least two compatible verified providers, is policy-bounded, and cannot duplicate a side effect.
10. Provider tool/function calls never directly perform ATLAS mutations.
11. Provider citations/search sources normalize into ATLAS provenance.
12. Perplexity is initially specialized to research/grounded-search rather than becoming the default general assistant.
13. Llama/open-weight models route through governed runtimes such as ATLAS Local or Bedrock unless a future runtime adapter is separately justified.
14. No provider secret reaches browser code, repository contents, conversation payloads, logs, telemetry, audit payloads, or prompts.
15. Model IDs remain server-configured and readiness-verified.
16. Existing OpenAI, Bedrock, Gemini, ATLAS Local, and Codex Sovereign behavior remains backward compatible.
17. Existing conversation persistence and provider switching remain intact.
18. Cost policy covers new providers before paid execution is allowed.
19. UI remains accessible, responsive, and understandable with the expanded provider set.
20. TDD tests cover contracts, registry, router, each adapter, Tool Gateway behavior, UI, secret redaction, and regressions.
21. CI, security gates, build, and relevant production-readiness checks pass before merge.
22. Production deployment is verified against the exact deployed commit SHA.
23. Production E2E confirms provider readiness truthfully without requiring every provider to be configured.
24. Completion is not claimed without fresh evidence.

## 38. Implementation gate

This document is the architectural specification only.

No provider adapter, router change, UI change, production configuration, merge, or deployment is authorized by the design approval alone.

After this written specification is reviewed and explicitly approved, the next required artifact is the detailed implementation plan produced through the Superpowers writing-plans workflow. The implementation plan must define TDD order, exact file changes, verification commands/gates, PR/CI sequence, deployment sequence, and production E2E evidence requirements.
