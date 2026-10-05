# ATLAS Multi-Provider Intelligence Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing governed ATLAS Assistant so Anthropic/Claude, xAI/Grok, Mistral, Cohere, DeepSeek, and Perplexity can participate as verified providers without weakening ATLAS routing, tenant, cost, audit, provenance, privacy, or side-effect controls.

**Architecture:** Keep one canonical ATLAS Assistant. Centralize provider/capability contracts, add six isolated server-side adapters, make routing capability/trait/cost-aware, keep final cost authorization in the existing cost gate, and keep every external action behind ATLAS Tool Gateway. Provider capabilities are configuration- and readiness-derived rather than inferred from brand names.

**Tech Stack:** JavaScript/TypeScript modules, Supabase Edge Functions/Deno, React 18, TypeScript 5.7, Vitest 5, Vite 6, existing ATLAS store/cost/Tool Gateway infrastructure.

**Spec:** `docs/superpowers/specs/2026-10-05-atlas-multi-provider-intelligence-expansion-design.md`

## Global Constraints

- Extend the existing Unified AI Chat; do not create a second assistant, store, router, or orchestration stack.
- Preserve existing providers: `atlas-local`, `openai`, `bedrock`, `gemini`, `codex-sovereign`.
- Add exactly: `anthropic`, `xai`, `mistral`, `cohere`, `deepseek`, `perplexity`.
- Functional capabilities: `generation`, `reasoning`, `coding`, `research`, `grounded-search`, `rag`, `multimodal`.
- Routing traits: `low-cost`, `local-private`; these are preferences/constraints, not semantic capabilities.
- Provider/model/preset identifiers remain server-configured; no permanent marketing-model defaults.
- A successful base probe establishes only `generation`. Extra capabilities are advertised only when enabled in server configuration and verified by the adapter/runtime contract.
- Explicit provider mode never falls back to another provider.
- `auto` may fall back only to verified, capability-compatible, policy-eligible providers.
- `council` requires at least two verified compatible providers and remains cost-bounded.
- Router may use cost policy to filter/order candidates, but it never authorizes spend. Final authorization remains `evaluateIntelligenceCostPolicy()` in the gateway immediately before provider execution.
- Provider tool calls are proposals. Tool Gateway owns schema publication, RBAC, risk, cost, approval, de-duplication, and execution decisions.
- Tool schemas exposed to a provider come only from `toolGateway.catalog({context})`; arbitrary provider-requested tools are never trusted.
- New mutation tools are not invented in this project. The catalog exposes only registered ATLAS tool definitions; an empty catalog is valid.
- External side effects execute at most once.
- Credentials never enter browser payloads, repository files, conversation content, telemetry, audit payloads, or logs.
- Provider private reasoning is not persisted or exposed; DeepSeek `reasoning_content` is discarded from ATLAS output/provenance.
- Perplexity uses the current Agent API integration surface, not the retired Sonar Chat Completions path.
- All adapter tests use mocked `fetchFn`; zero real paid-provider calls are allowed in tests.
- No merge/deploy/completion claim without fresh evidence for the exact implementation SHA.

## Locked Self-Review Decisions

1. **Cost routing vs authorization:** add `deriveIntelligenceRoutingPolicy(policy)` in `cost-policy.mjs`. It returns non-authorizing routing metadata (`allowed_providers`, `zero_cost_providers`, `enforce_zero_cost`). `router.route()` receives this derived policy to exclude impossible candidates and prefer eligible zero-cost routes. `evaluateIntelligenceCostPolicy()` remains the only final spend decision.
2. **Capability verification:** each new adapter receives configured `capabilities` and `routingTraits`. `generation` is added only after the configured model/preset passes readiness. Additional capabilities are intersected with adapter-supported capability names and configuration; unsupported/unconfigured claims never appear as verified readiness.
3. **Tool publication:** extend Tool Gateway with an optional registered tool-definition catalog and `catalog({context})`. The gateway passes the authorized schema-only catalog into `adapter.execute({tools})`; the returned function/tool call is still re-normalized and re-evaluated before any action. No provider can self-authorize a tool.

## Review Focus

1. Unknown/duplicate capability or mode values must never select an unintended provider.
2. `['coding','low-cost']` must require coding and treat low-cost only as a routing trait.
3. Configured credential + unusable model/preset must remain unverified and fail closed in explicit mode.
4. Malformed provider tool arguments must be denied and never execute, even when response text is otherwise valid.
5. Partial/duplicate citation objects must be bounded, deduplicated, provider-attributed, and safe for persistence/UI.

---

### Task 1: Canonical provider/capability contract

**Files:**
- Create: `supabase/functions/atlas-copilot/provider-contract.mjs`
- Modify: `supabase/functions/atlas-copilot/intelligence-gateway.mjs`
- Modify: `supabase/functions/atlas-copilot/provider-registry.mjs`
- Create: `tests/unit/atlas-intelligence-provider-contract.test.ts`

**Interfaces:** Produces `INTELLIGENCE_PROVIDER_IDS`, `INTELLIGENCE_MODES`, `INTELLIGENCE_CAPABILITIES`, `ROUTING_TRAITS`, `PROVIDER_STABLE_ORDER`, and `partitionIntelligenceRequirements(values)`.

- [ ] Write failing tests asserting the exact 11 provider IDs, `auto + providers + council`, no duplicate IDs, stable order, deduplication of `['coding','low-cost','coding']`, and `capability_unavailable` for unknown requirements.
- [ ] Run `npx vitest run tests/unit/atlas-intelligence-provider-contract.test.ts`; verify RED because the canonical module does not exist.
- [ ] Create `provider-contract.mjs`; move provider/capability constants out of gateway and registry into this module.
- [ ] Run `npx vitest run tests/unit/atlas-intelligence-provider-contract.test.ts tests/unit/atlas-unified-ai-chat-gateway.test.ts`; verify GREEN.
- [ ] Commit `refactor(intelligence): centralize provider capability contract`.

### Task 2: Cost-aware deterministic routing without cost authorization

**Files:**
- Modify: `supabase/functions/atlas-copilot/cost-policy.mjs`
- Modify: `supabase/functions/atlas-copilot/intelligence-gateway.mjs`
- Modify: `supabase/functions/atlas-copilot/provider-registry.mjs`
- Modify: `tests/unit/atlas-unified-ai-chat-gateway.test.ts`
- Create: `tests/unit/atlas-intelligence-provider-registry.test.ts`

**Interfaces:** Produces `deriveIntelligenceRoutingPolicy(policy)` and route metadata `{capabilities,routing_traits,providers,fallback_providers,profile,reason,fallback_used}`.

- [ ] Write failing tests: explicit `anthropic` never falls back; `coding + low-cost` requires coding then prefers a zero-cost eligible provider; `local-private` excludes remote providers; `research + grounded-search` requires both; configured-unverified providers are excluded from Auto; Council requires two compatible providers; a cost-denied provider is excluded when another compatible policy-eligible candidate exists; final spend still calls `evaluateIntelligenceCostPolicy()`.
- [ ] Run `npx vitest run tests/unit/atlas-unified-ai-chat-gateway.test.ts tests/unit/atlas-intelligence-provider-registry.test.ts`; verify RED.
- [ ] Implement `deriveIntelligenceRoutingPolicy()` as a pure non-authorizing view of policy; pass it into `router.route()`; partition semantic capabilities from routing traits; preserve final gateway cost authorization immediately before execution.
- [ ] Extend readiness sanitation for `routing_traits` and `feature_support` without secrets.
- [ ] Re-run the focused tests; verify GREEN.
- [ ] Commit `feat(intelligence): route by verified capability cost policy`.

### Task 3: Tool Gateway schema catalog and proposal safety

**Files:**
- Modify: `supabase/functions/atlas-copilot/tool-gateway.mjs`
- Create: `tests/unit/atlas-intelligence-tool-catalog.test.ts`
- Modify: `tests/unit/atlas-unified-ai-chat-gateway.test.ts`

**Interfaces:** `createToolGateway({definitions=[]})`; produces `catalog({context}) -> AtlasToolDefinition[]` and preserves `evaluate({proposals,context})`.

- [ ] Write failing tests proving catalog returns only registered definitions allowed by permissions, strips executor/internal fields, never contains secrets, is empty when no definitions exist, rejects malformed proposal arguments, and still de-duplicates identical side-effect proposals.
- [ ] Run `npx vitest run tests/unit/atlas-intelligence-tool-catalog.test.ts tests/unit/atlas-unified-ai-chat-gateway.test.ts`; verify RED.
- [ ] Extend Tool Gateway with schema-only catalog output while preserving existing evaluate semantics; require proposal `arguments` to be a plain object or deny with `invalid_arguments`.
- [ ] Update intelligence gateway to obtain `tools = toolGateway.catalog({context:principal})` and pass only schema metadata to adapters/Council.
- [ ] Re-run focused tests; verify GREEN.
- [ ] Commit `feat(intelligence): publish governed tool schema catalog`.

### Task 4: Anthropic/Claude adapter

**Files:**
- Create: `supabase/functions/atlas-copilot/anthropic-adapter.mjs`
- Create: `tests/unit/atlas-anthropic-adapter.test.ts`

**Interface:** `createAnthropicAdapter({apiKey,models,capabilities,routingTraits,fetchFn=fetch,baseUrl='https://api.anthropic.com'})`; implements `descriptor`, `probe`, `execute({context,route,instructions,input,tools,max_output_tokens})`.

- [ ] Write failing tests for unconfigured state, successful readiness, server-configured model use, text parsing, authorized tool-schema serialization, tool-use normalization to ATLAS proposals, secret-safe errors, and 401/403/429/5xx normalization; assert thinking/private reasoning blocks are not returned.
- [ ] Run `npx vitest run tests/unit/atlas-anthropic-adapter.test.ts`; verify RED.
- [ ] Implement the direct Anthropic Messages adapter; advertise only configured/verified capabilities.
- [ ] Re-run the test; verify GREEN.
- [ ] Commit `feat(intelligence): add Anthropic provider adapter`.

### Task 5: xAI/Grok adapter

**Files:**
- Create: `supabase/functions/atlas-copilot/xai-adapter.mjs`
- Create: `tests/unit/atlas-xai-adapter.test.ts`

**Interface:** `createXaiAdapter({apiKey,models,capabilities,routingTraits,fetchFn=fetch,baseUrl='https://api.x.ai'})`.

- [ ] Write failing tests for configuration/readiness/error normalization, configured model use, text/tool-call normalization, authorized tool schema mapping, and search/multimodal flags only when configuration enables them; search results become provenance, not authorization.
- [ ] Run `npx vitest run tests/unit/atlas-xai-adapter.test.ts`; verify RED.
- [ ] Implement xAI as its own provider identity/telemetry boundary even if protocol shapes are compatible with OpenAI.
- [ ] Re-run; verify GREEN.
- [ ] Commit `feat(intelligence): add xAI provider adapter`.

### Task 6: Mistral/Devstral adapter

**Files:**
- Create: `supabase/functions/atlas-copilot/mistral-adapter.mjs`
- Create: `tests/unit/atlas-mistral-adapter.test.ts`

**Interface:** `createMistralAdapter({apiKey,models,capabilities,routingTraits,fetchFn=fetch,baseUrl='https://api.mistral.ai'})`.

- [ ] Write failing tests for stateless Chat Completions, readiness/errors, text parsing, multiple tool calls in stable order, authorized tool schemas, and `coding`/`rag`/`multimodal` only when configured; no provider-side persistent Agent entity is required.
- [ ] Run the focused test; verify RED.
- [ ] Implement the minimal stateless Mistral adapter.
- [ ] Re-run; verify GREEN.
- [ ] Commit `feat(intelligence): add Mistral provider adapter`.

### Task 7: Cohere RAG/citation adapter

**Files:**
- Create: `supabase/functions/atlas-copilot/cohere-adapter.mjs`
- Create: `tests/unit/atlas-cohere-adapter.test.ts`

**Interface:** `createCohereAdapter({apiKey,models,capabilities,routingTraits,fetchFn=fetch,baseUrl='https://api.cohere.com'})`.

- [ ] Write failing tests for v2 Chat, readiness/errors, response text, `message.citations` normalization/deduplication, authorized tool schemas/tool calls, minimum-context document handling, and secret-safe failure payloads.
- [ ] Run the focused test; verify RED.
- [ ] Implement Cohere; normalize citations to bounded ATLAS provenance and send private tenant documents only when already authorized in normalized request context.
- [ ] Re-run; verify GREEN.
- [ ] Commit `feat(intelligence): add Cohere RAG provider adapter`.

### Task 8: DeepSeek reasoning/coding adapter

**Files:**
- Create: `supabase/functions/atlas-copilot/deepseek-adapter.mjs`
- Create: `tests/unit/atlas-deepseek-adapter.test.ts`

**Interface:** `createDeepSeekAdapter({apiKey,models,capabilities,routingTraits,fetchFn=fetch,baseUrl='https://api.deepseek.com'})`.

- [ ] Write failing tests for direct DeepSeek identity, readiness/errors, text/tool-call normalization, authorized tool schemas, invalid JSON tool args rejection, `reasoning_content` removal, and reasoning/tool-choice incompatibility failing truthfully rather than silently changing modes; assert `low-cost` is configuration/policy data, not adapter hard-code.
- [ ] Run the focused test; verify RED.
- [ ] Implement DeepSeek with separate credential/readiness/telemetry namespace despite protocol compatibility.
- [ ] Re-run; verify GREEN.
- [ ] Commit `feat(intelligence): add DeepSeek provider adapter`.

### Task 9: Perplexity Agent API research adapter

**Files:**
- Create: `supabase/functions/atlas-copilot/perplexity-agent-adapter.mjs`
- Create: `tests/unit/atlas-perplexity-agent-adapter.test.ts`

**Interface:** `createPerplexityAgentAdapter({apiKey,presets,capabilities,routingTraits,fetchFn=fetch,baseUrl})`; initial ATLAS mutation `tool_calls` remains empty.

- [ ] Write failing tests proving the current Agent API configuration is used and Sonar Chat Completions is not; preset/profile is server-configured; cited sources normalize/dedupe safely; usage is preserved; no ATLAS mutation proposal is emitted; auth/rate-limit/network errors normalize.
- [ ] Run the focused test; verify RED.
- [ ] Implement research-only Perplexity adapter; provider web/code/MCP features remain retrieval/runtime capabilities and cannot bypass ATLAS Tool Gateway.
- [ ] Re-run; verify GREEN.
- [ ] Commit `feat(intelligence): add Perplexity Agent research adapter`.

### Task 10: Server-side configuration, capability verification, and readiness

**Files:**
- Modify: `supabase/functions/atlas-copilot/index.ts`
- Modify: `supabase/functions/atlas-copilot/provider-registry.mjs`
- Create: `tests/integration/atlas-multi-provider-runtime.test.ts`

**Interfaces:** consumes Tasks 1–9; status returns every canonical provider/mode in stable order.

**Server configuration:**
- Secrets: `ANTHROPIC_API_KEY`, `XAI_API_KEY`, `MISTRAL_API_KEY`, `COHERE_API_KEY`, `DEEPSEEK_API_KEY`, `PERPLEXITY_API_KEY`.
- Model/preset mappings: `ATLAS_<PROVIDER>_MODEL_FAST|BALANCED|DEEP`; Perplexity uses `ATLAS_PERPLEXITY_PRESET_FAST|BALANCED|DEEP` plus `ATLAS_PERPLEXITY_AGENT_BASE_URL`.
- Feature gates: `ATLAS_<PROVIDER>_CAPABILITIES` and `ATLAS_<PROVIDER>_ROUTING_TRAITS` as comma-separated canonical values. Unknown values fail configuration validation; absent extra-capability config means only successfully probed base generation is advertised.

- [ ] Write failing integration tests: all provider IDs/modes in stable status order; missing secrets => configuration-required; unusable configured target => configured-unverified/unavailable; extra capabilities appear only when configured and verified; unknown capability config fails safe; no secret values/names in status JSON.
- [ ] Run `npx vitest run tests/integration/atlas-multi-provider-runtime.test.ts`; verify RED.
- [ ] Wire six adapter factories from server config in `index.ts`; keep target IDs nullable; validate capability/trait config through Task 1 contract; never invent model IDs.
- [ ] Run `npx vitest run tests/integration/atlas-multi-provider-runtime.test.ts tests/integration/atlas-assistant-mainline.test.tsx`; verify GREEN.
- [ ] Commit `feat(intelligence): wire governed provider readiness`.

### Task 11: Heterogeneous Council, provenance, and tool proposal reconciliation

**Files:**
- Modify: `supabase/functions/atlas-copilot/council-orchestrator.mjs`
- Modify: `supabase/functions/atlas-copilot/intelligence-gateway.mjs`
- Modify: `supabase/functions/atlas-copilot/tool-gateway.mjs` only if Task 3 tests expose a required safety fix
- Create: `tests/unit/atlas-multi-provider-council.test.ts`
- Modify: `tests/unit/atlas-unified-ai-chat-gateway.test.ts`

- [ ] Write failing tests: Council combines heterogeneous verified providers under policy; completion timing does not change contribution order; citations dedupe without losing provider attribution; duplicate mutation proposals yield one approval candidate; malformed tool args are denied without crashing response; fewer than two eligible/successful providers fails; private reasoning is absent.
- [ ] Run the two focused Council/gateway test files; verify RED.
- [ ] Pass the same authorized tool catalog to Council participants; normalize/dedupe contributions/provenance/proposals while keeping Tool Gateway as the only side-effect decision point.
- [ ] Re-run; verify GREEN.
- [ ] Commit `feat(intelligence): govern heterogeneous AI council results`.

### Task 12: Dynamic `/assistant`, cost/privacy telemetry, and backward compatibility

**Files:**
- Modify: `apps/web/src/assistant/client.ts`
- Modify: `apps/web/src/modules/intelligence/UnifiedAIChatPage.tsx`
- Modify: `supabase/functions/atlas-copilot/ui.mjs`
- Modify: `supabase/functions/atlas-copilot/cost-policy.mjs` only if focused tests expose missing provider-generic behavior
- Modify: `tests/unit/atlas-unified-ai-chat-ui.test.ts`
- Modify: `tests/unit/atlas-unified-ai-chat-gateway.test.ts`
- Modify: `tests/integration/atlas-multi-provider-runtime.test.ts`
- Modify: `tests/integration/atlas-memory-core.test.ts` only for secret/private-reasoning regressions if needed

- [ ] Write failing tests that UI modes are driven by server `status.modes`/`status.providers`, new unconfigured providers do not disable the composer, explicit selection is submitted unchanged, keyboard labels remain accessible, paid new providers remain denied/approval-required unless policy authorizes them, low-cost never overrides a denial, mixed-provider Council remains cost-gated, telemetry records actual provider/model without secrets/private reasoning, legacy assistant requests still work, and all-provider failure never fabricates an answer.
- [ ] Run focused UI/gateway/runtime/memory tests; verify RED where behavior is missing.
- [ ] Implement dynamic mode/readiness rendering and only the minimal provider-generic policy/telemetry compatibility changes required; do not create browser-to-provider calls.
- [ ] Run focused tests plus `npm run typecheck`; verify GREEN.
- [ ] Commit `feat(assistant): expose governed multi-provider intelligence`.

### Task 13: Full verification, PR, CI, merge/deploy, and production evidence

**Files:** documentation only if a documented interface changed.

- [ ] Run `npm ci`; require exit 0.
- [ ] Run all new focused tests: provider contract, registry, Tool Gateway catalog, six provider adapters, Council, unified gateway/UI, and multi-provider runtime; require PASS and zero real provider network calls.
- [ ] Run `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run verify:edge`, `npm run verify:neural`, `npm run verify:navigation`, `npm run build`; require exit 0 for each.
- [ ] Run `npm run verify:cloudflare`; require exit 0. If infrastructure/audit prevents it, record the exact failing command and do not substitute a success claim.
- [ ] Inspect diff for secrets, browser provider calls, private reasoning persistence, permanent model/preset defaults, retired Perplexity Sonar dependency, and duplicated provider lists.
- [ ] Open implementation PR against `main` containing spec/plan paths, provider matrix, readiness behavior, focused/full verification evidence, security/cost invariants, and any provider still configuration-required.
- [ ] Inspect fresh CI for the exact PR head SHA, including applicable CodeQL/security/readiness/deploy gates; older `main` checks do not count.
- [ ] Merge only after required CI is green using the repository-approved PR path; no direct implementation push to `main`.
- [ ] Verify production deployment used the merged exact SHA.
- [ ] Run `npm run verify:production:global` or CI equivalent against production; verify `/assistant`, existing providers, and truthful readiness of every new provider.
- [ ] Mark complete only with PR number, merge SHA, CI evidence, deployment evidence, production E2E evidence, and explicit list of providers not yet production-configured.
