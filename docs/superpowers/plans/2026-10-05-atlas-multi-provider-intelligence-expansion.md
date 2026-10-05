# ATLAS Multi-Provider Intelligence Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing governed ATLAS Assistant so Anthropic/Claude, xAI/Grok, Mistral, Cohere, DeepSeek, and Perplexity can participate as verified provider adapters without weakening ATLAS routing, cost, tenant, audit, provenance, or side-effect controls.

**Architecture:** Keep one canonical ATLAS Assistant and evolve the existing `provider-registry.mjs` + `intelligence-gateway.mjs` contract. Add one canonical provider/capability contract, six focused server-side adapters, deterministic capability/trait routing, normalized provenance/tool proposals, and dynamic UI readiness; all provider business mutations remain proposals behind ATLAS Tool Gateway.

**Tech Stack:** JavaScript/TypeScript modules, Supabase Edge Functions/Deno runtime, React 18, TypeScript 5.7, Vitest 5, Vite 6, existing ATLAS cost/store/tool-gateway infrastructure.

**Spec:** `docs/superpowers/specs/2026-10-05-atlas-multi-provider-intelligence-expansion-design.md`

## Global Constraints

- Extend the existing ATLAS Unified AI Chat; do not create a second assistant or orchestration stack.
- Existing providers remain first-class: `atlas-local`, `openai`, `bedrock`, `gemini`, `codex-sovereign`.
- Add exactly these top-level provider IDs in this phase: `anthropic`, `xai`, `mistral`, `cohere`, `deepseek`, `perplexity`.
- Functional capabilities are `generation`, `reasoning`, `coding`, `research`, `grounded-search`, `rag`, `multimodal`.
- Routing traits are `low-cost` and `local-private`; they are not semantic capabilities.
- Provider/model/preset identifiers come from server-side configuration; do not hard-code marketing model IDs as permanent defaults.
- Explicit provider mode never silently falls back to another provider.
- `auto` may fall back only to verified compatible providers and only under ATLAS policy.
- `council` requires at least two verified compatible providers and is bounded by cost policy.
- Provider tool/function calls are proposals only; ATLAS Tool Gateway owns schema validation, RBAC, risk, cost, approval, de-duplication, and execution.
- External side effects execute at most once.
- Credentials never enter browser payloads, repository files, conversation content, telemetry, audit payloads, or logs.
- Provider private reasoning must not be persisted or exposed. In particular, DeepSeek `reasoning_content` is never mapped into ATLAS response/provenance.
- Perplexity integration targets the current Agent API, not the retired Sonar Chat Completions surface.
- Tests use mocked `fetchFn` boundaries and perform zero real paid-provider calls.
- No merge/deploy/completion claim without fresh CI and production verification evidence.

## Review Focus

1. **Unknown/duplicate mode values:** malformed or repeated provider IDs must fail deterministically or normalize once; they must never select an unintended provider. Covered in Task 1 contract tests and Task 2 router tests.
2. **Mixed semantic capabilities and routing traits:** `['coding','low-cost']` must match coding capability first and treat `low-cost` only as route preference. Covered in Task 1 and Task 2.
3. **Provider returns valid text plus malformed tool arguments:** response text may survive, but malformed mutation proposals must be rejected/denied and never executed. Covered in Tasks 3–8 and Task 10.
4. **Citation/source objects are partial or duplicated:** normalized provenance must remain bounded, deduplicated, provider-attributed, and must not crash persistence/UI. Covered in Tasks 6, 8, 10, and 11.
5. **Configured credential but unusable model/preset:** readiness must be `configured-unverified`/`unavailable`, and explicit selection must fail closed rather than routing elsewhere. Covered in every adapter task plus Task 9 integration tests.

---

### Task 1: Canonical provider, capability, and routing-trait contract

**Files:**
- Create: `supabase/functions/atlas-copilot/provider-contract.mjs`
- Modify: `supabase/functions/atlas-copilot/intelligence-gateway.mjs`
- Modify: `supabase/functions/atlas-copilot/provider-registry.mjs`
- Create: `tests/unit/atlas-intelligence-provider-contract.test.ts`

**Interfaces:**
- Produces: `INTELLIGENCE_PROVIDER_IDS`, `INTELLIGENCE_MODES`, `INTELLIGENCE_CAPABILITIES`, `ROUTING_TRAITS`, `PROVIDER_STABLE_ORDER`.
- Produces: `partitionIntelligenceRequirements(values)` returning `{ capabilities: string[], routing_traits: string[] }`.
- Consumed by: router, registry, readiness/status wiring, Council selection, and server-exposed mode list.

- [ ] **Step 1: Write the failing canonical-contract tests**

Add tests asserting:

```ts
expect(INTELLIGENCE_PROVIDER_IDS).toEqual([
  'atlas-local','openai','bedrock','gemini','codex-sovereign',
  'anthropic','xai','mistral','cohere','deepseek','perplexity'
]);
expect(INTELLIGENCE_MODES).toEqual(['auto', ...INTELLIGENCE_PROVIDER_IDS, 'council']);
expect(partitionIntelligenceRequirements(['coding','low-cost','coding'])).toEqual({
  capabilities: ['coding'],
  routing_traits: ['low-cost']
});
expect(() => partitionIntelligenceRequirements(['unknown-capability'])).toThrowError(/capability_unavailable/);
```

Also assert no duplicate IDs and stable ordering.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run tests/unit/atlas-intelligence-provider-contract.test.ts`

Expected: FAIL because `provider-contract.mjs` and the new exports do not exist.

- [ ] **Step 3: Implement the canonical contract**

Create `provider-contract.mjs` with the exact exported constants above and:

`partitionIntelligenceRequirements(values: unknown[]) -> { capabilities: string[], routing_traits: string[] }`

Move duplicated provider/capability constants out of `intelligence-gateway.mjs` and registry-local order out of `provider-registry.mjs`; import the canonical values instead.

- [ ] **Step 4: Run focused tests and current gateway/registry tests**

Run: `npx vitest run tests/unit/atlas-intelligence-provider-contract.test.ts tests/unit/atlas-unified-ai-chat-gateway.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/atlas-copilot/provider-contract.mjs supabase/functions/atlas-copilot/intelligence-gateway.mjs supabase/functions/atlas-copilot/provider-registry.mjs tests/unit/atlas-intelligence-provider-contract.test.ts
git commit -m "refactor(intelligence): centralize provider capability contract"
```

### Task 2: Capability/trait-aware deterministic router and readiness

**Files:**
- Modify: `supabase/functions/atlas-copilot/intelligence-gateway.mjs`
- Modify: `supabase/functions/atlas-copilot/provider-registry.mjs`
- Modify: `tests/unit/atlas-unified-ai-chat-gateway.test.ts`
- Create: `tests/unit/atlas-intelligence-provider-registry.test.ts`

**Interfaces:**
- Consumes: Task 1 canonical provider/capability contract.
- Produces: route metadata containing `capabilities`, `routing_traits`, `providers`, `fallback_providers`, `profile`, `reason`, `fallback_used`.
- Produces: readiness entries with sanitized `routing_traits` and `feature_support`.

- [ ] **Step 1: Write failing router tests**

Add tests asserting:
- explicit `anthropic` selects only `anthropic` and never fallback;
- `coding + low-cost` excludes providers without `coding`, then prefers a verified provider carrying `low-cost` when policy allows;
- `research + grounded-search` selects only verified providers advertising both capabilities;
- `local-private` never routes to a remote provider;
- Council requires at least two providers matching semantic capabilities;
- duplicate requirements normalize once;
- a configured-but-unverified provider is excluded from `auto` and fails closed in explicit mode.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/unit/atlas-unified-ai-chat-gateway.test.ts tests/unit/atlas-intelligence-provider-registry.test.ts`

Expected: FAIL on new capability/trait routing and new provider readiness.

- [ ] **Step 3: Implement router matching and registry sanitization**

Update `normalizeIntelligenceRequest()` to partition semantic capabilities from routing traits. Update `createIntelligenceRouter()` so deterministic selection order is:

`capability fit -> routing-trait fit -> tenant/provider allowlist -> verified readiness -> preferred-provider policy -> cost eligibility input -> PROVIDER_STABLE_ORDER`.

Do not encode a permanent “best model” ranking.

Extend `safeDescriptor()` and `readiness()` to expose only sanitized `routing_traits` and feature support.

- [ ] **Step 4: Verify GREEN**

Run the same focused tests plus: `npx vitest run tests/unit/atlas-unified-ai-chat-gateway.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/atlas-copilot/intelligence-gateway.mjs supabase/functions/atlas-copilot/provider-registry.mjs tests/unit/atlas-unified-ai-chat-gateway.test.ts tests/unit/atlas-intelligence-provider-registry.test.ts
git commit -m "feat(intelligence): route by verified capabilities and traits"
```

### Task 3: Anthropic/Claude adapter

**Files:**
- Create: `supabase/functions/atlas-copilot/anthropic-adapter.mjs`
- Create: `tests/unit/atlas-anthropic-adapter.test.ts`

**Interfaces:**
- Produces: `createAnthropicAdapter({ apiKey, models, fetchFn = fetch, baseUrl = 'https://api.anthropic.com' })`.
- Adapter contract: `descriptor()`, `probe({profile})`, `execute({context, route, instructions, input, max_output_tokens})`.
- Output contract: `{ provider:'anthropic', model, text, capabilities_used, usage, provenance, tool_calls }`.

- [ ] **Step 1: Write failing adapter tests**

Assert:
- absent key/model => `provider_not_configured`;
- successful probe => `verified:true` without exposing key;
- execution uses the Anthropic Messages API and server-configured model;
- text blocks normalize into `text`;
- tool-use blocks normalize into ATLAS tool proposals but do not execute;
- 401/403 => `provider_auth_failed`, 429 => `provider_rate_limited`, network/5xx => `provider_unavailable`;
- response/error objects never contain the supplied API key;
- malformed tool input is denied/omitted rather than executed.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/unit/atlas-anthropic-adapter.test.ts`

- [ ] **Step 3: Implement the minimal direct Anthropic adapter**

Use Anthropic-native request/response parsing. Keep model IDs and capability flags injected from configuration; do not persist thinking/private reasoning blocks.

- [ ] **Step 4: Verify GREEN**

Run: `npx vitest run tests/unit/atlas-anthropic-adapter.test.ts`

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/atlas-copilot/anthropic-adapter.mjs tests/unit/atlas-anthropic-adapter.test.ts
git commit -m "feat(intelligence): add Anthropic provider adapter"
```

### Task 4: xAI/Grok adapter

**Files:**
- Create: `supabase/functions/atlas-copilot/xai-adapter.mjs`
- Create: `tests/unit/atlas-xai-adapter.test.ts`

**Interfaces:**
- Produces: `createXaiAdapter({ apiKey, models, fetchFn = fetch, baseUrl = 'https://api.x.ai' })`.
- Same normalized ATLAS adapter/result contract as Task 3.

- [ ] **Step 1: Write failing tests**

Assert configuration/probe/error normalization; server-configured model use; response text parsing; tool-call normalization; multimodal/search flags appear only when configuration advertises them; built-in search results become provenance only and never authorize ATLAS actions.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/unit/atlas-xai-adapter.test.ts`

- [ ] **Step 3: Implement xAI-native adapter**

Use the xAI server API through its own adapter even when the HTTP shape is OpenAI-compatible. Preserve `provider:'xai'`, separate credentials/telemetry, and normalized errors.

- [ ] **Step 4: Verify GREEN**

Run the same focused test.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/atlas-copilot/xai-adapter.mjs tests/unit/atlas-xai-adapter.test.ts
git commit -m "feat(intelligence): add xAI provider adapter"
```

### Task 5: Mistral/Devstral adapter

**Files:**
- Create: `supabase/functions/atlas-copilot/mistral-adapter.mjs`
- Create: `tests/unit/atlas-mistral-adapter.test.ts`

**Interfaces:**
- Produces: `createMistralAdapter({ apiKey, models, fetchFn = fetch, baseUrl = 'https://api.mistral.ai' })`.

- [ ] **Step 1: Write failing tests**

Assert configuration/probe/error normalization; direct Chat Completions request; text normalization; multiple/parallel `tool_calls` normalize into independent ATLAS proposals in stable response order; no provider-side Agent persistence is required; advertised `coding`, `rag`, `multimodal` capabilities come only from configured feature flags/readiness.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/unit/atlas-mistral-adapter.test.ts`

- [ ] **Step 3: Implement minimal stateless Mistral adapter**

Use direct request/response integration; do not create persistent Mistral Agent entities in this phase.

- [ ] **Step 4: Verify GREEN**

Run the same focused test.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/atlas-copilot/mistral-adapter.mjs tests/unit/atlas-mistral-adapter.test.ts
git commit -m "feat(intelligence): add Mistral provider adapter"
```

### Task 6: Cohere enterprise RAG/citations adapter

**Files:**
- Create: `supabase/functions/atlas-copilot/cohere-adapter.mjs`
- Create: `tests/unit/atlas-cohere-adapter.test.ts`

**Interfaces:**
- Produces: `createCohereAdapter({ apiKey, models, fetchFn = fetch, baseUrl = 'https://api.cohere.com' })`.
- Provenance output: normalized ATLAS source records containing provider attribution and citation/document IDs when returned.

- [ ] **Step 1: Write failing tests**

Assert v2 Chat request handling, response text extraction, `message.citations` normalization, duplicate citation de-duplication, tool-call normalization, minimum-context document handling, and secret-safe failures.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/unit/atlas-cohere-adapter.test.ts`

- [ ] **Step 3: Implement Cohere adapter**

Normalize citations into ATLAS provenance. Do not send private tenant documents unless they were already authorized and supplied in the normalized ATLAS request context.

- [ ] **Step 4: Verify GREEN**

Run the same focused test.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/atlas-copilot/cohere-adapter.mjs tests/unit/atlas-cohere-adapter.test.ts
git commit -m "feat(intelligence): add Cohere RAG provider adapter"
```

### Task 7: DeepSeek reasoning/coding adapter

**Files:**
- Create: `supabase/functions/atlas-copilot/deepseek-adapter.mjs`
- Create: `tests/unit/atlas-deepseek-adapter.test.ts`

**Interfaces:**
- Produces: `createDeepSeekAdapter({ apiKey, models, fetchFn = fetch, baseUrl = 'https://api.deepseek.com' })`.

- [ ] **Step 1: Write failing tests**

Assert direct DeepSeek provider identity; Chat Completions request; text and tool-call normalization; invalid JSON tool arguments are never executed; `reasoning_content` is ignored for persistence/output; thinking-mode/tool-choice incompatibility is represented as `capability_unavailable` or normalized provider failure rather than silently changing user mode; `low-cost` is supplied by ATLAS policy/config and not hard-coded in the adapter.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/unit/atlas-deepseek-adapter.test.ts`

- [ ] **Step 3: Implement DeepSeek adapter**

Keep separate credentials/readiness/telemetry despite protocol compatibility with other vendors.

- [ ] **Step 4: Verify GREEN**

Run the same focused test.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/atlas-copilot/deepseek-adapter.mjs tests/unit/atlas-deepseek-adapter.test.ts
git commit -m "feat(intelligence): add DeepSeek provider adapter"
```

### Task 8: Perplexity Agent API research adapter

**Files:**
- Create: `supabase/functions/atlas-copilot/perplexity-agent-adapter.mjs`
- Create: `tests/unit/atlas-perplexity-agent-adapter.test.ts`

**Interfaces:**
- Produces: `createPerplexityAgentAdapter({ apiKey, presets, fetchFn = fetch, baseUrl })`.
- Provider result is research-focused and returns normalized `provenance`; initial phase returns `tool_calls: []` for ATLAS mutations.

- [ ] **Step 1: Write failing tests**

Assert:
- adapter uses current Agent API configuration and never the retired Sonar Chat Completions route;
- configured preset/profile maps server-side without a hard-coded permanent model;
- cited URLs/sources normalize into ATLAS provenance;
- duplicate/partial sources are safe and bounded;
- research/search usage metadata is preserved when available;
- adapter emits no ATLAS mutation proposal in this phase;
- auth/rate-limit/network errors normalize correctly.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/unit/atlas-perplexity-agent-adapter.test.ts`

- [ ] **Step 3: Implement the research-only Perplexity Agent adapter**

Use server-injected Agent API base URL/presets. Treat web/code/MCP capabilities as provider retrieval/runtime features only; do not let them bypass ATLAS Tool Gateway for ATLAS-side actions.

- [ ] **Step 4: Verify GREEN**

Run the same focused test.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/atlas-copilot/perplexity-agent-adapter.mjs tests/unit/atlas-perplexity-agent-adapter.test.ts
git commit -m "feat(intelligence): add Perplexity Agent research adapter"
```

### Task 9: Server-side provider construction, env configuration, and readiness status

**Files:**
- Modify: `supabase/functions/atlas-copilot/index.ts`
- Modify: `supabase/functions/atlas-copilot/provider-registry.mjs`
- Create: `tests/integration/atlas-multi-provider-runtime.test.ts`

**Interfaces:**
- Consumes: all six adapter factories plus Task 1 contract.
- Produces: registry entries and status `providers`/`modes` for every canonical provider.
- Server configuration namespaces:
  - `ANTHROPIC_API_KEY`, `ATLAS_ANTHROPIC_MODEL_FAST|BALANCED|DEEP`
  - `XAI_API_KEY`, `ATLAS_XAI_MODEL_FAST|BALANCED|DEEP`
  - `MISTRAL_API_KEY`, `ATLAS_MISTRAL_MODEL_FAST|BALANCED|DEEP`
  - `COHERE_API_KEY`, `ATLAS_COHERE_MODEL_FAST|BALANCED|DEEP`
  - `DEEPSEEK_API_KEY`, `ATLAS_DEEPSEEK_MODEL_FAST|BALANCED|DEEP`
  - `PERPLEXITY_API_KEY`, `ATLAS_PERPLEXITY_PRESET_FAST|BALANCED|DEEP`, `ATLAS_PERPLEXITY_AGENT_BASE_URL`

- [ ] **Step 1: Write failing runtime integration tests**

With injected/mock environment and mocked fetches, assert:
- all canonical provider IDs appear in status in stable order;
- missing credentials produce `configuration-required` without throwing status endpoint errors;
- configured but failing probe produces `configured-unverified`/`unavailable` truthfully;
- no secret value appears anywhere in the JSON status payload;
- status `modes` comes from the canonical contract.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/integration/atlas-multi-provider-runtime.test.ts`

- [ ] **Step 3: Wire factories and configuration in `index.ts`**

Construct adapters only from server environment/configuration. Keep model/preset values nullable; missing values must not invent defaults.

- [ ] **Step 4: Verify GREEN plus existing mainline assistant integration**

Run: `npx vitest run tests/integration/atlas-multi-provider-runtime.test.ts tests/integration/atlas-assistant-mainline.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/atlas-copilot/index.ts supabase/functions/atlas-copilot/provider-registry.mjs tests/integration/atlas-multi-provider-runtime.test.ts
git commit -m "feat(intelligence): wire governed provider readiness"
```

### Task 10: Council, provenance, and tool-proposal safety across heterogeneous providers

**Files:**
- Modify: `supabase/functions/atlas-copilot/council-orchestrator.mjs`
- Modify: `supabase/functions/atlas-copilot/tool-gateway.mjs` only if current normalization cannot reject malformed proposal arguments safely
- Modify: `supabase/functions/atlas-copilot/intelligence-gateway.mjs`
- Modify: `tests/unit/atlas-unified-ai-chat-gateway.test.ts`
- Create: `tests/unit/atlas-multi-provider-council.test.ts`

**Interfaces:**
- Consumes: normalized provider results from Tasks 3–8.
- Produces: deterministic `contributions`, deduplicated `provenance`, and Tool Gateway proposal set.

- [ ] **Step 1: Write failing heterogeneous Council tests**

Assert:
- Council can combine e.g. `anthropic + cohere + perplexity` when all are verified/capable and policy allows;
- provider contribution order is deterministic regardless of completion timing;
- duplicate citations collapse without losing provider attribution;
- identical mutation proposals from two providers result in one approval candidate, never two executions;
- malformed tool arguments are denied and cannot crash the whole response;
- Council with only one successful/eligible provider fails according to existing minimum-provider rule rather than fabricating consensus;
- private reasoning fields are absent from contributions and persistence.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/unit/atlas-multi-provider-council.test.ts tests/unit/atlas-unified-ai-chat-gateway.test.ts`

- [ ] **Step 3: Implement only the normalization/reconciliation changes required**

Keep Tool Gateway as the only side-effect authorization point. Preserve existing proposal hashing/de-duplication if already sufficient; do not refactor unrelated action infrastructure.

- [ ] **Step 4: Verify GREEN**

Run the same focused tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/atlas-copilot/council-orchestrator.mjs supabase/functions/atlas-copilot/intelligence-gateway.mjs supabase/functions/atlas-copilot/tool-gateway.mjs tests/unit/atlas-unified-ai-chat-gateway.test.ts tests/unit/atlas-multi-provider-council.test.ts
git commit -m "feat(intelligence): govern heterogeneous AI council results"
```

### Task 11: Dynamic `/assistant` provider modes and readiness UI

**Files:**
- Modify: `apps/web/src/assistant/client.ts`
- Modify: `apps/web/src/modules/intelligence/UnifiedAIChatPage.tsx`
- Modify: `supabase/functions/atlas-copilot/ui.mjs`
- Modify: `tests/unit/atlas-unified-ai-chat-ui.test.ts`

**Interfaces:**
- Consumes: server `status.modes` and `status.providers` from Task 9.
- Produces: user-selectable provider modes without a second locally maintained provider list.

- [ ] **Step 1: Write failing UI/client tests**

Assert:
- readiness/mode rendering includes the six new providers when returned by status;
- provider selector is driven by server `modes`, not a hard-coded copy of all provider IDs;
- `auto` and `council` remain present;
- unconfigured providers display configuration-required/unavailable state without disabling the whole composer;
- selected explicit provider is submitted unchanged;
- no credential, raw endpoint secret, or invented model name appears in client/static HTML;
- keyboard labels remain accessible.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/unit/atlas-unified-ai-chat-ui.test.ts`

- [ ] **Step 3: Implement dynamic mode/readiness rendering**

In `client.ts`, treat provider IDs received from the server as governed opaque mode values while retaining typed `auto`/`council` semantics. In `UnifiedAIChatPage.tsx`, render provider options from status metadata with compact labels/readiness indicators rather than expanding permanent hard-coded tabs.

Keep the legacy Edge Function UI consistent only where it is still part of current tests/routes; do not restore a separate assistant backend.

- [ ] **Step 4: Verify GREEN + typecheck**

Run:
- `npx vitest run tests/unit/atlas-unified-ai-chat-ui.test.ts`
- `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/assistant/client.ts apps/web/src/modules/intelligence/UnifiedAIChatPage.tsx supabase/functions/atlas-copilot/ui.mjs tests/unit/atlas-unified-ai-chat-ui.test.ts
git commit -m "feat(assistant): expose governed provider expansion"
```

### Task 12: Cost policy, privacy, telemetry, and backward-compatibility gate

**Files:**
- Modify: `supabase/functions/atlas-copilot/cost-policy.mjs` only if tests show provider IDs are currently constrained
- Modify: `supabase/functions/atlas-copilot/intelligence-gateway.mjs` only if telemetry needs the new traits/provenance metadata
- Modify: `tests/unit/atlas-unified-ai-chat-gateway.test.ts`
- Modify/Create: `tests/integration/atlas-multi-provider-runtime.test.ts`
- Modify: `tests/integration/atlas-memory-core.test.ts` only for secret-leak regression coverage if appropriate

**Interfaces:**
- Produces: provider-agnostic cost decisions for all canonical provider IDs; sanitized routing/usage metadata; preserved legacy request compatibility.

- [ ] **Step 1: Write failing security/cost regression tests**

Assert:
- paid new providers are denied or approval-required unless policy authorizes them;
- `low-cost` routing trait never overrides an explicit paid-provider denial;
- Council cost gate applies to mixed old/new providers;
- usage metadata records actual provider/model/preset identity without credentials;
- legacy `{ message, context }`/existing assistant requests still work;
- API key env names/values do not appear in response, stored message, telemetry, or static UI;
- all-provider failure returns normalized failure and never a fabricated answer.

- [ ] **Step 2: Verify RED where behavior is missing**

Run: `npx vitest run tests/unit/atlas-unified-ai-chat-gateway.test.ts tests/integration/atlas-multi-provider-runtime.test.ts tests/integration/atlas-memory-core.test.ts`

- [ ] **Step 3: Implement minimal policy/telemetry changes**

Do not add provider-specific cost logic to the router. Cost eligibility stays in `cost-policy.mjs`/organization configuration; route traits are only selection signals after policy constraints.

- [ ] **Step 4: Verify GREEN**

Run the same focused tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/atlas-copilot/cost-policy.mjs supabase/functions/atlas-copilot/intelligence-gateway.mjs tests/unit/atlas-unified-ai-chat-gateway.test.ts tests/integration/atlas-multi-provider-runtime.test.ts tests/integration/atlas-memory-core.test.ts
git commit -m "fix(intelligence): harden multi-provider policy boundaries"
```

### Task 13: Full verification, PR, CI, merge/deploy, and production evidence

**Files:**
- Modify documentation only if implementation changed a documented contract.
- No production code should be added solely to make verification pass.

**Interfaces:**
- Consumes: completed Tasks 1–12.
- Produces: fresh evidence that the branch is safe to merge/deploy.

- [ ] **Step 1: Install exactly from lockfile**

Run: `npm ci`

Expected: exit 0.

- [ ] **Step 2: Run all focused multi-provider tests**

Run:

```bash
npx vitest run \
  tests/unit/atlas-intelligence-provider-contract.test.ts \
  tests/unit/atlas-intelligence-provider-registry.test.ts \
  tests/unit/atlas-anthropic-adapter.test.ts \
  tests/unit/atlas-xai-adapter.test.ts \
  tests/unit/atlas-mistral-adapter.test.ts \
  tests/unit/atlas-cohere-adapter.test.ts \
  tests/unit/atlas-deepseek-adapter.test.ts \
  tests/unit/atlas-perplexity-agent-adapter.test.ts \
  tests/unit/atlas-multi-provider-council.test.ts \
  tests/unit/atlas-unified-ai-chat-gateway.test.ts \
  tests/unit/atlas-unified-ai-chat-ui.test.ts \
  tests/integration/atlas-multi-provider-runtime.test.ts
```

Expected: all PASS; zero real provider network traffic.

- [ ] **Step 3: Run repository gates**

Run:
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:integration`
- `npm run verify:edge`
- `npm run verify:neural`
- `npm run verify:navigation`
- `npm run build`

Expected: all exit 0.

- [ ] **Step 4: Run the repository aggregate verification gate**

Run: `npm run verify:cloudflare`

Expected: exit 0. If audit/network infrastructure prevents this gate, record the exact failing command and do not substitute a success claim.

- [ ] **Step 5: Security/diff inspection**

Verify:
- no secret literal or test credential escaped fixtures;
- no new consumer-browser provider call exists;
- no provider private reasoning is persisted;
- no hard-coded permanent model/preset defaults were introduced;
- Perplexity code contains no production Sonar Chat Completions dependency;
- provider mode lists originate from the canonical contract/status flow;
- existing OpenAI/Gemini/Bedrock/ATLAS Local/Codex behavior remains green.

- [ ] **Step 6: Open implementation PR against `main`**

PR body must include:
- spec path;
- plan path;
- provider matrix and readiness behavior;
- focused test evidence;
- full gate evidence;
- security/cost invariants;
- any provider left configuration-required because production credentials/model IDs are absent.

- [ ] **Step 7: Inspect CI for the exact PR head SHA**

Require fresh passing evidence for repository-required CI (including CodeQL/security and production/readiness workflows that apply). Do not treat older `main` checks as evidence for the implementation SHA.

- [ ] **Step 8: Merge only after CI evidence is green**

Use the repository-approved PR path; do not direct-push implementation to `main`.

- [ ] **Step 9: Verify deployment from the merged exact SHA**

Confirm the production deployment workflow used the merged commit SHA and completed successfully.

- [ ] **Step 10: Run production E2E/readiness verification**

Run the existing global production verification path (`npm run verify:production:global`) or its CI equivalent against production. Verify `/assistant` loads, canonical existing providers remain healthy, and each new provider reports truthful readiness (`verified` only when actual production configuration/probe supports it; otherwise configuration-required/unavailable).

- [ ] **Step 11: Completion evidence**

Only mark the project complete when the final report contains:
- merged PR number;
- merge SHA;
- CI run/check evidence for that SHA;
- deployment evidence for that SHA;
- production E2E/readiness evidence;
- explicit list of any provider still not production-configured.
