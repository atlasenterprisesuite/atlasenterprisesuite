# ATLAS Unified AI Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing ATLAS Copilot into one governed multi-provider assistant that supports Auto, ChatGPT/OpenAI, Gemini, Codex Sovereign, and Council modes without weakening tenant, permission, audit, side-effect, or cost controls.

**Architecture:** Extend the existing `supabase/functions/atlas-copilot` gateway/router rather than creating a second chat service. Provider adapters share one contract, routing returns an explicit plan, council execution produces provider contributions before deterministic ATLAS reconciliation, and all external tool actions remain proposals behind the ATLAS Tool Gateway.

**Tech Stack:** TypeScript/JavaScript modules, Supabase Edge Functions (Deno), React/ATLAS web shell where applicable, Vitest/current repository test stack.

**Spec:** `docs/superpowers/specs/2026-09-15-atlas-unified-ai-chat-design.md`

## Global Constraints
- ATLAS Assistant remains one canonical conversation surface.
- `chatgpt.com` is an optional external link, never the internal API backend.
- OpenAI uses the server-side Responses API adapter.
- No fictional model identifier is a production default.
- Provider credentials are server-side secrets only.
- Explicit provider mode never silently falls back to another provider.
- Council requires at least two verified providers.
- Provider tool calls are proposals; side effects run at most once through ATLAS authorization.
- Preserve authenticated tenant scope, `intelligence.use`, audit/telemetry, and conversation persistence.
- No provider may independently authorize cost, mutation, render, deploy, or other sensitive action.
- Tests must not call paid providers.

---

### Task 1: Multi-provider routing contract
**Files:** Modify `supabase/functions/atlas-copilot/intelligence-gateway.mjs`; create/modify focused unit tests under the repository's existing intelligence test location.
**Produces:** route modes `auto | openai | gemini | codex-sovereign | council` and explicit `RoutePlan` metadata.
- [ ] Write failing tests for deterministic Auto selection, explicit-provider no-fallback, Council minimum of two verified providers, unavailable provider reporting, and stable provider ordering.
- [ ] Run focused tests and verify RED for missing multi-provider behavior.
- [ ] Implement router normalization and RoutePlan with `mode`, `providers`, `profile`, `capabilities`, `fallback_used`, and `reason`.
- [ ] Run focused tests and verify GREEN.
- [ ] Commit `feat(intelligence): add governed multi-provider routing`.

### Task 2: Remove fictional OpenAI defaults and harden adapter readiness
**Files:** Modify `supabase/functions/atlas-copilot/openai-responses-adapter.mjs`; tests.
**Produces:** OpenAI adapter requiring configured model identifiers and truthful readiness/error states.
- [ ] Write failing tests proving an absent model is `provider_not_configured`, configured models are probed, Responses requests use only configured model IDs, and secrets never appear in returned errors.
- [ ] Run focused tests and verify RED.
- [ ] Remove `gpt-6-astra` defaults; resolve models only from injected server configuration.
- [ ] Normalize 401/403 to provider auth/config failure, 429 to rate-limited, and 5xx/network failures to unavailable.
- [ ] Run focused tests and verify GREEN.
- [ ] Commit `fix(intelligence): require verified OpenAI model configuration`.

### Task 3: Gemini provider adapter
**Files:** Create `supabase/functions/atlas-copilot/gemini-adapter.mjs`; tests.
**Produces:** `createGeminiAdapter({ apiKey, models, fetchFn })` implementing `descriptor`, `probe`, and `execute`.
- [ ] Write failing adapter contract tests with mocked HTTP responses and zero real provider traffic.
- [ ] Verify RED.
- [ ] Implement server-only Gemini execution/readiness with normalized ATLAS results and errors.
- [ ] Verify GREEN.
- [ ] Commit `feat(intelligence): add Gemini adapter`.

### Task 4: Codex Sovereign adapter
**Files:** Create `supabase/functions/atlas-copilot/codex-sovereign-adapter.mjs`; tests.
**Produces:** an adapter for configured sovereign runtime endpoint/token/model with the same provider contract.
- [ ] Write failing tests for unconfigured state, verified health probe, execution, timeout/unavailable normalization, and token redaction.
- [ ] Verify RED.
- [ ] Implement server-side runtime adapter; do not assume a runtime exists unless health verification passes.
- [ ] Verify GREEN.
- [ ] Commit `feat(intelligence): add Codex Sovereign adapter`.

### Task 5: Provider registry and readiness
**Files:** Create `supabase/functions/atlas-copilot/provider-registry.mjs`; modify `index.ts`; tests.
**Produces:** one registry that reads server configuration, constructs all adapters, probes them, and returns sanitized readiness metadata.
- [ ] Write failing tests for mixed states: OpenAI verified, Gemini configuration-required, Codex unavailable.
- [ ] Verify RED.
- [ ] Implement registry with no secret-bearing fields and no provider calls beyond health/model verification.
- [ ] Replace the current single-provider `providerState()` path in `index.ts`.
- [ ] Verify GREEN.
- [ ] Commit `feat(intelligence): centralize provider readiness`.

### Task 6: Unified gateway execution and provider switching
**Files:** Modify `intelligence-gateway.mjs`, `index.ts`, store tests.
**Produces:** one conversation that preserves history while mode/provider changes per turn.
- [ ] Write failing integration tests: turn 1 OpenAI, turn 2 Gemini with same conversation ID; routing metadata accurately records each turn.
- [ ] Verify RED.
- [ ] Extend normalized request with `mode`; execute the selected adapter through the registry; persist actual providers/models/routing metadata.
- [ ] Verify GREEN.
- [ ] Commit `feat(intelligence): support provider switching in one conversation`.

### Task 7: Council orchestration and deterministic reconciliation
**Files:** Create `supabase/functions/atlas-copilot/council-orchestrator.mjs`; modify gateway; tests.
**Produces:** parallel provider contributions plus one deterministic ATLAS synthesis input/output contract.
- [ ] Write failing tests for two-success council, one-provider failure, fewer than two verified providers, disagreement preservation, and stable contribution order.
- [ ] Verify RED.
- [ ] Implement bounded concurrent execution with `Promise.allSettled`, provider contribution records, and deterministic reconciliation that receives outputs/provenance only—not hidden reasoning.
- [ ] Verify GREEN.
- [ ] Commit `feat(intelligence): add ATLAS council orchestration`.

### Task 8: Governed tool proposal gateway
**Files:** Create `supabase/functions/atlas-copilot/tool-gateway.mjs`; tests; integrate gateway result metadata.
**Produces:** normalized `AtlasToolProposal`, stable proposal hash/de-duplication, permission/risk/cost decision, and no duplicate side effects.
- [ ] Write failing tests for duplicate proposals from two providers, read-only allowed path, permission denial, mutation approval requirement, and cost approval requirement.
- [ ] Verify RED.
- [ ] Implement pure proposal normalization/policy decision first; external execution remains delegated to existing ATLAS action/approval infrastructure.
- [ ] Verify GREEN.
- [ ] Commit `feat(intelligence): govern provider tool proposals`.

### Task 9: Cost policy
**Files:** Create `supabase/functions/atlas-copilot/cost-policy.mjs`; integrate router/index; tests.
**Produces:** `evaluateIntelligenceCostPolicy()` that can allow a route, require approval, or deny council/provider execution.
- [ ] Write failing tests for zero allowance, explicit provider allowance, council requiring multi-call authorization, and no silent provider substitution.
- [ ] Verify RED.
- [ ] Implement policy as deterministic pre-execution gate using organization/request configuration only.
- [ ] Verify GREEN.
- [ ] Commit `feat(intelligence): enforce AI cost policy`.

### Task 10: Unified Assistant UI modes
**Files:** Modify `supabase/functions/atlas-copilot/ui.mjs`; UI-focused tests if supported by current test stack.
**Produces:** mode selector (Auto, ChatGPT, Gemini, Codex Sovereign, Council), profile selector, provider readiness display, contribution badges, and optional `Open in ChatGPT` external link.
- [ ] Write failing DOM/string behavior tests for mode values, profile values, readiness state rendering, and no secret/model fabrication in client HTML.
- [ ] Verify RED.
- [ ] Implement responsive/keyboard-accessible controls that submit `mode` and `intent` to the existing chat endpoint.
- [ ] Render actual provider contribution metadata returned by the server.
- [ ] Verify GREEN.
- [ ] Commit `feat(assistant): add unified multi-AI controls`.

### Task 11: Studio orchestration compatibility
**Files:** Modify `packages/creator/studio_orchestration.ts` only if required; tests `tests/unit/atlas-studio-orchestration.test.ts`.
**Produces:** consistent provider naming/readiness while preserving `mayAuthorizeRender=false` and `mayAuthorizeCost=false` for every AI participant.
- [ ] Add failing tests for shared provider identities and unchanged human authorization constraints.
- [ ] Verify RED only if code changes are required; otherwise document that existing behavior already satisfies the spec and keep production code unchanged.
- [ ] Run tests and verify GREEN.
- [ ] Commit only if code/test changes are needed.

### Task 12: Security, telemetry, and backward compatibility
**Files:** Modify `index.ts`, store/gateway tests, security tests.
**Produces:** sanitized status/readiness APIs, backward-compatible legacy request shape, and auditable routing metadata.
- [ ] Write failing tests for tenant isolation, `intelligence.use`, legacy `{message, context}` request compatibility, secret redaction, provider/model/routing telemetry, and normalized all-provider failure.
- [ ] Verify RED.
- [ ] Implement minimal compatibility/security changes.
- [ ] Verify GREEN.
- [ ] Commit `fix(intelligence): harden unified assistant boundaries`.

### Task 13: Full verification and integration gate
**Files:** Documentation only if verified implementation changes interfaces.
- [ ] Run `npm ci`.
- [ ] Run `npm run typecheck`.
- [ ] Run focused intelligence/assistant tests.
- [ ] Run `npm run test:unit` if present.
- [ ] Run `npm run test:integration` if present.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Verify test fixtures made zero real paid-provider calls.
- [ ] Inspect diff for secrets/tokens and confirm no fictional model default remains.
- [ ] Verify existing Creator/Studio tests remain green.
- [ ] Only after all gates pass, open/refresh the PR; merge/deploy remains a separate side-effect gate requiring fresh verified evidence and any existing repository approval requirements.
