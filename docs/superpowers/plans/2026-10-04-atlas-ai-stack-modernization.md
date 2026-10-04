# ATLAS AI Stack Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize ATLAS Intelligence for GPT-6.1 Sol, Claude Sonnet 5.5, capability-aware routing, governed OpenAI hosted computer use, and versioned security taskflows.

**Architecture:** Extend the existing `atlas-copilot` router/provider registry rather than replace it. Keep provider model IDs centralized, keep provider readiness fail-closed, expose computer use as a separate authenticated lifecycle adapter, and use immutable taskflow definitions that authorized workers execute through existing governance.

**Tech Stack:** TypeScript, JavaScript ESM, Deno Edge Functions, React 18, Vitest, GitHub Actions, Supabase Edge Functions.

**Spec:** `docs/superpowers/specs/2026-10-04-atlas-ai-stack-modernization-design.md`

## Global Constraints

- Preserve existing tenant isolation and `intelligence.use` authentication.
- Existing zero-cost-first policy remains authoritative.
- Never surface a provider as verified without an upstream readiness probe.
- Never auto-approve computer-use website origin or authentication requests.
- Never log/store browser screenshots or credentials in the new runtime adapter.
- Default model IDs: `gpt-6-luna`, `gpt-6.1-sol`, `gpt-6-astra`, `claude-sonnet-5-5`.
- Production completion requires green CI and exact-SHA production verification.

## Review Focus

- Paid Anthropic/OpenAI paths remain blocked under zero-cost enforcement unless policy explicitly allows them.
- Missing/invalid provider credentials return truthful configuration/auth states rather than false readiness.
- `computer_use` cannot silently fall through the ordinary chat adapter.
- Required-action payloads are surfaced without auto-consent or secret persistence.
- Existing auto/council routing order and fallback semantics stay deterministic after Anthropic is added.

---

### Task 1: Central model catalog and capability-aware provider IDs

**Files:**
- Create: `supabase/functions/atlas-copilot/model-catalog.mjs`
- Modify: `supabase/functions/atlas-copilot/intelligence-gateway.mjs`
- Modify: `supabase/functions/atlas-copilot/provider-registry.mjs`
- Test: `tests/unit/atlas-ai-model-catalog.test.ts`
- Test: `tests/unit/atlas-unified-ai-chat-routing.test.ts`

**Interfaces:**
- Produces: `MODEL_CATALOG`, `defaultProfileModels(providerId)`, `providerModelMetadata(providerId, model)`.
- Expands provider ID domain with `anthropic` and capabilities with `computer_use`, `multi_agent`.

- [ ] **Step 1: Write failing tests** asserting catalog defaults, immutable metadata, Anthropic routing, and rejection of unsupported capabilities.
- [ ] **Step 2: Run** `npx vitest run tests/unit/atlas-ai-model-catalog.test.ts tests/unit/atlas-unified-ai-chat-routing.test.ts` and confirm failure before implementation.
- [ ] **Step 3: Implement** catalog and router/registry domain changes with no behavior change to existing verified providers.
- [ ] **Step 4: Re-run focused tests** and require zero failures.
- [ ] **Step 5: Commit** `feat(ai): add capability-aware model catalog`.

### Task 2: Anthropic Sonnet 5.5 provider adapter

**Files:**
- Create: `supabase/functions/atlas-copilot/anthropic-messages-adapter.mjs`
- Modify: `supabase/functions/atlas-copilot/index.ts`
- Test: `tests/unit/atlas-anthropic-messages-adapter.test.ts`
- Modify test: `tests/unit/atlas-unified-ai-chat-gateway.test.ts`
- Modify test: `tests/unit/atlas-unified-ai-chat-governance.test.ts`

**Interfaces:**
- Produces: `createAnthropicMessagesAdapter({apiKey,models,fetchFn})` with `descriptor()`, `probe()`, `execute()`.
- Consumes: catalog default `claude-sonnet-5-5`; env overrides `ATLAS_ANTHROPIC_MODEL[_FAST|_BALANCED|_DEEP]` and `ANTHROPIC_API_KEY`.

- [ ] **Step 1: Write failing adapter/governance tests** for configuration-required, successful probe, Messages API execution, auth/rate-limit/server errors, and paid-provider policy behavior.
- [ ] **Step 2: Run focused tests** and confirm they fail for missing adapter/provider support.
- [ ] **Step 3: Implement minimal Anthropic adapter** using server-side key and Messages API; add provider to `index.ts` runtime/registry/readiness/modes.
- [ ] **Step 4: Re-run focused tests** and require zero failures.
- [ ] **Step 5: Commit** `feat(ai): integrate Claude Sonnet 5.5 provider`.

### Task 3: OpenAI GPT-6.1 defaults and governed computer-use lifecycle

**Files:**
- Modify: `supabase/functions/atlas-copilot/openai-responses-adapter.mjs`
- Create: `supabase/functions/atlas-copilot/openai-agent-runtime.mjs`
- Modify: `supabase/functions/atlas-copilot/index.ts`
- Test: `tests/unit/atlas-openai-responses-adapter.test.ts`
- Create: `tests/unit/atlas-openai-agent-runtime.test.ts`

**Interfaces:**
- Produces: `createOpenAIAgentRuntime({apiKey,model,fetchFn})` with `descriptor()`, `createSession()`, `sendEvents()`, `getSession()`, `listItems()`, `deleteSession()`.
- `index.ts` exposes authenticated `?api=computer-use` actions and returns required actions without auto-approval.

- [ ] **Step 1: Write failing tests** for GPT-6.1 reasoning support and complete computer-use session lifecycle/error mapping.
- [ ] **Step 2: Run focused tests** and verify failures before implementation.
- [ ] **Step 3: Update OpenAI profile defaults** to Luna/Sol/Astra through the central catalog and advertise only implemented capabilities.
- [ ] **Step 4: Implement computer-use runtime** against `/v1/agents/sessions`, with `OpenAI-Beta: agents=v1`, explicit lifecycle actions, safe metadata, and no automatic approvals.
- [ ] **Step 5: Wire authenticated edge endpoint** and readiness metadata.
- [ ] **Step 6: Re-run focused tests** and require zero failures.
- [ ] **Step 7: Commit** `feat(ai): add governed OpenAI computer use`.

### Task 4: Versioned security taskflows

**Files:**
- Create: `supabase/functions/atlas-copilot/security-taskflows.mjs`
- Create: `tests/unit/atlas-security-taskflows.test.ts`
- Modify: `docs/architecture/ATLAS_AI_UNIVERSE.md`

**Interfaces:**
- Produces: `SECURITY_TASKFLOWS`, `getSecurityTaskflow(id,version)`, `createSecurityExecutionPlan({id,version,target})`.
- Initial flow: `authorized-code-audit.v1` with exactly eight ordered steps from recon through regression test.

- [ ] **Step 1: Write failing tests** for immutable exact ordering, invalid ID/version, and serializable execution plan.
- [ ] **Step 2: Run focused test** and confirm failure before implementation.
- [ ] **Step 3: Implement immutable definitions/validation** without executing offensive actions or bypassing repository permissions.
- [ ] **Step 4: Document integration** with existing Tool Gateway/audit workers.
- [ ] **Step 5: Re-run test** and require zero failures.
- [ ] **Step 6: Commit** `feat(security): add versioned AI audit taskflows`.

### Task 5: Assistant UI/types/readiness parity and release gates

**Files:**
- Modify: `apps/web/src/assistant/client.ts`
- Modify: `apps/web/src/modules/intelligence/UnifiedAIChatPage.tsx`
- Modify: `supabase/functions/atlas-copilot/ui.mjs`
- Modify: `tests/unit/atlas-unified-ai-chat-ui.test.ts`
- Modify: `docs/architecture/ATLAS_ENTERPRISE_INTELLIGENCE_PARITY.md`

**Interfaces:**
- Adds `anthropic` to `AssistantMode` and both provider selectors.
- Status/readiness exposes Anthropic and computer-use runtime availability truthfully.

- [ ] **Step 1: Update/write failing UI/type assertions** for Anthropic and model/runtime status.
- [ ] **Step 2: Run focused UI tests** and verify failure before implementation.
- [ ] **Step 3: Implement UI/type/readiness parity** with no false live-state claims.
- [ ] **Step 4: Run all focused AI tests**.
- [ ] **Step 5: Run repository gates:** `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run verify:edge`, `npm run verify:neural`, `npm run verify:navigation`, `npm run build`.
- [ ] **Step 6: Open PR** with evidence and let GitHub Actions run the canonical CI suite.
- [ ] **Step 7: Resolve every blocking CI/security finding**, then merge only when required checks are green.
- [ ] **Step 8: Verify production** using the existing global production verifier and exact deployed SHA comparison; P0 failures remain blocking.

## Self-review

Spec coverage: all acceptance criteria map to Tasks 1-5. The plan deliberately keeps provider secrets/configuration outside source control and treats missing credentials/entitlement as a runtime readiness blocker rather than fabricating success.

Type consistency: `anthropic` is added once to the provider/mode domain and propagated to backend registry, client type, React selector and Edge fallback selector.

Proportion: implementation reuses existing registry/router/store/governance boundaries and introduces only four focused modules instead of replacing the intelligence subsystem.
