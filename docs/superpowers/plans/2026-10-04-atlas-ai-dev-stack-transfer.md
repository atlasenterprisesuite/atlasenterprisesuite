# ATLAS AI Dev Stack Transfer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend ATLAS's existing sovereign Intelligence and Agentic Core with evidence-backed model-aware routing, an optional OpenAI managed-agent runtime, verified Gemini readiness, programmatic Copilot review evidence, and reproducible agentic-security taskflows without introducing a parallel control plane.

**Architecture:** Keep `intelligence-gateway.mjs`, `provider-registry.mjs`, ATLAS conversation/audit storage, cost policy, and the existing Tool Gateway/Agentic Core authoritative. Add small provider-neutral contracts for model/runtime metadata and security evidence; provider-specific execution remains behind server-side adapters. Release stays fail-closed through ATLAS Consensus, CodeQL, `verify-build-readiness`, canonical Cloudflare deploy, and exact-SHA global production verification.

**Tech Stack:** Deno/Supabase Edge Functions, JavaScript/TypeScript, Vitest, GitHub Actions, GitHub REST API, OpenAI Responses API + Agents API beta, Gemini API, Cloudflare Workers.

**Spec:** `docs/superpowers/specs/2026-10-04-atlas-ai-dev-stack-transfer-design.md`

## Global Constraints

- ATLAS remains authoritative for identity, `organization_id`, permissions, approvals, canonical memory, audit, cost policy, and release truth.
- Do not create a second router, tenant model, conversation store, approval service, or release-control plane.
- OpenAI models remain under provider ID `openai`; Gemini models remain under provider ID `gemini`.
- Provider/model/runtime readiness is evidence-based. Public announcements alone never produce `verified` state.
- Existing zero-cost-first and emergency-fallback policy remains authoritative.
- Provider API keys remain server-side and must never appear in source, UI, logs, prompts, or committed fixtures.
- Managed-runtime tool requests become ATLAS tool proposals; external runtimes may not execute privileged ATLAS writes directly.
- Provider memory is non-canonical. ATLAS must persist the authoritative execution record.
- AI review/security signals augment deterministic checks and never replace tests, CodeQL, ATLAS Consensus, build/readiness, or production verification.
- Production remains fail-closed. A deployment is not verified until the exact merged SHA passes canonical production verification and required P0 routes.

## Review Focus

- Explicit model pin points at a configured provider but an unverified/nonexistent model: fail closed; never silently substitute unless request mode is `auto` and policy allows fallback.
- Managed agent returns a plausible narrative after a tool action failed or remained pending: request cannot become `completed` based on text alone.
- Provider memory/session disappears or expires: ATLAS conversation/audit evidence remains sufficient to reconstruct the authoritative record.
- Copilot review belongs to an older PR head SHA: reject it as stale release evidence even if all comments were resolved.
- AI security taskflow produces a high-severity hypothesis without deterministic reproduction: retain `unverified`; never promote it to a confirmed vulnerability or blocking finding.

---

### Task 1: Add model-aware routing metadata without changing provider identity

**Files:**
- Create: `supabase/functions/atlas-copilot/model-policy.mjs`
- Modify: `supabase/functions/atlas-copilot/intelligence-gateway.mjs`
- Modify: `supabase/functions/atlas-copilot/provider-registry.mjs`
- Modify: `tests/unit/atlas-unified-ai-chat-routing.test.ts`
- Modify: `tests/unit/atlas-unified-ai-chat-governance.test.ts`

**Interfaces:**
- Consumes: existing provider readiness objects `{ id, configured, verified, model, capabilities, profiles, ... }`.
- Produces: `normalizeModelPin(value) -> string|null`, `selectVerifiedModel({ provider, profile, explicitModel }) -> { model, verification_state, reason }`, normalized request field `model`, and route field `model`.

- [ ] **Step 1: Write failing routing tests**
  - Balanced OpenAI route may select its verified configured Sol-class model.
  - Explicit `model` must match the selected provider's verified model or throw `model_unavailable`.
  - `auto` may move to another verified provider after a model mismatch only when existing fallback policy permits it.
  - Provider ID remains `openai`/`gemini`; model names never become provider IDs.

- [ ] **Step 2: Run RED**

  Run: `npx vitest run tests/unit/atlas-unified-ai-chat-routing.test.ts tests/unit/atlas-unified-ai-chat-governance.test.ts`

  Expected: FAIL because model pin/selection metadata does not yet exist.

- [ ] **Step 3: Implement the minimal pure model policy**
  - `normalizeModelPin(value)` accepts only non-empty strings.
  - `selectVerifiedModel({ provider, profile, explicitModel })` uses the readiness evidence already supplied to the router.
  - Never converts `announced_unverified`, unavailable, or unprobed state into `verified`.
  - Extend `normalizeIntelligenceRequest()` with `model` while preserving all current callers.
  - Extend route metadata with `model` and `model_verification_state`.

- [ ] **Step 4: Run GREEN and regressions**

  Run: `npx vitest run tests/unit/atlas-unified-ai-chat-routing.test.ts tests/unit/atlas-unified-ai-chat-governance.test.ts tests/unit/atlas-unified-ai-chat-gateway.test.ts`

  Expected: PASS.

- [ ] **Step 5: Commit**

  `git commit -m "feat(ai): add governed model-aware routing"`

---

### Task 2: Make OpenAI and Gemini readiness evidence model-specific

**Files:**
- Modify: `supabase/functions/atlas-copilot/openai-responses-adapter.mjs`
- Modify: `supabase/functions/atlas-copilot/gemini-adapter.mjs`
- Modify: `supabase/functions/atlas-copilot/provider-registry.mjs`
- Modify: `supabase/functions/atlas-copilot/index.ts`
- Modify: `tests/unit/atlas-unified-ai-chat-adapters.test.ts`
- Modify: `tests/unit/atlas-unified-ai-chat-source-contract.test.ts`

**Interfaces:**
- Consumes: profile model maps from server environment.
- Produces: adapter `probe({ profile, model? })`; readiness field `model_verification_state`; OpenAI defaults that can route balanced work to `gpt-6.1-sol` when explicitly configured/verified; Gemini discovery state `announced_unverified` for Argon until provider API evidence exists.

- [ ] **Step 1: Write failing adapter/readiness tests**
  - OpenAI uses only the model configured for the route and returns the provider-reported model/usage.
  - OpenAI `probe({model})` verifies the actual model endpoint before marking it executable.
  - Gemini verifies a model only if `models.get`/provider API accepts it; a merely configured Argon name that returns 404 remains unverified.
  - Gemini readiness may expose `announced_unverified` as discovery metadata but execution rejects it.
  - Prompt-cache savings are reported only from provider usage; no synthetic savings number.

- [ ] **Step 2: Run RED**

  Run: `npx vitest run tests/unit/atlas-unified-ai-chat-adapters.test.ts tests/unit/atlas-unified-ai-chat-source-contract.test.ts`

  Expected: FAIL on model-specific probe/readiness assertions.

- [ ] **Step 3: Implement adapter changes**
  - Keep Responses API as the normal OpenAI generation path.
  - Preserve existing Astra-specific reasoning compatibility while adding Sol recognition without inventing unsupported controls.
  - Preserve `store:false` and tenant-isolated prompt-cache key behavior.
  - Keep Gemini on `v1beta/models/{model}` verification and `:generateContent` execution.
  - Do not set an Argon production default until authenticated API evidence confirms it.

- [ ] **Step 4: Run GREEN**

  Run: `npx vitest run tests/unit/atlas-unified-ai-chat-adapters.test.ts tests/unit/atlas-unified-ai-chat-source-contract.test.ts tests/unit/atlas-unified-ai-chat-governance.test.ts`

  Expected: PASS.

- [ ] **Step 5: Commit**

  `git commit -m "feat(ai): verify models before execution"`

---

### Task 3: Add provider-neutral managed agent runtime and OpenAI Agents adapter

**Files:**
- Create: `supabase/functions/atlas-copilot/agent-runtime.mjs`
- Create: `supabase/functions/atlas-copilot/openai-agents-runtime.mjs`
- Modify: `supabase/functions/atlas-copilot/intelligence-gateway.mjs`
- Modify: `supabase/functions/atlas-copilot/index.ts`
- Create: `tests/unit/atlas-managed-agent-runtime.test.ts`
- Modify: `tests/unit/atlas-unified-ai-chat-gateway.test.ts`

**Interfaces:**
- Consumes: normalized ATLAS principal, route/model, bounded conversation history, instructions, cost decision, and existing Tool Gateway.
- Produces: `createAgentRuntimeRegistry({ runtimes })`, runtime contract `execute({ context, route, instructions, input, tool_policy, trace_id })`, `createOpenAIAgentsRuntime({ apiKey, enabled, environment, fetchFn })`.

- [ ] **Step 1: Write failing runtime tests**
  - Disabled managed runtime returns `runtime_not_enabled` without provider traffic.
  - Runtime request carries ATLAS trace/session metadata but not raw tenant authority in tool arguments.
  - OpenAI Agents session uses only an allowed environment (`openai_hosted`, `self_hosted`, `none`).
  - Computer-use capability is absent unless explicitly enabled by ATLAS policy.
  - Runtime-returned tool requests become `tool_calls`/proposals and are not executed by the runtime adapter.
  - Partial/failed managed execution cannot return ATLAS `execution_state: completed`.
  - Runtime/session identifiers are stored only as provider references; ATLAS conversation remains canonical.

- [ ] **Step 2: Run RED**

  Run: `npx vitest run tests/unit/atlas-managed-agent-runtime.test.ts tests/unit/atlas-unified-ai-chat-gateway.test.ts`

  Expected: FAIL because managed runtime contracts do not exist.

- [ ] **Step 3: Implement runtime abstraction and OpenAI adapter**
  - Gate with server configuration such as `ATLAS_OPENAI_AGENTS_ENABLED=false` by default.
  - Use Agents API session/task semantics behind the runtime adapter; preserve current Responses adapter for ordinary inference.
  - Pass only bounded context and approved runtime capabilities.
  - Normalize runtime outputs to existing gateway result shape.
  - External runtime never receives an API for direct database mutation; privileged effects remain Tool Gateway proposals.

- [ ] **Step 4: Integrate gateway selection**
  - Add normalized optional `runtime` request field (`native` default, `openai-agents` explicit/eligible).
  - Explicit unavailable runtime fails closed.
  - `auto` runtime selection cannot bypass provider or cost policy.
  - Persist `runtime_backend`, provider session reference, terminal state, and tool proposal evidence in ATLAS telemetry.

- [ ] **Step 5: Run GREEN + existing gateway regression**

  Run: `npx vitest run tests/unit/atlas-managed-agent-runtime.test.ts tests/unit/atlas-unified-ai-chat-gateway.test.ts tests/unit/atlas-unified-ai-chat-routing.test.ts tests/unit/atlas-unified-ai-chat-governance.test.ts`

  Expected: PASS.

- [ ] **Step 6: Commit**

  `git commit -m "feat(ai): add governed managed agent runtime"`

---

### Task 4: Harden computer-use and managed-runtime tool governance

**Files:**
- Modify: `supabase/functions/atlas-copilot/tool-gateway.mjs`
- Modify: `supabase/functions/atlas-copilot/agentic-core.mjs`
- Modify: `supabase/functions/atlas-copilot/openai-agents-runtime.mjs`
- Modify: `tests/unit/atlas-unified-ai-chat-governance.test.ts`
- Modify: `tests/unit/atlas-managed-agent-runtime.test.ts`

**Interfaces:**
- Consumes: runtime tool proposals.
- Produces: normalized proposal metadata including `runtime`, `risk_class`, `side_effect`, `required_permissions`, `target_domain` when applicable, and `provider_session_id` reference; existing `AtlasAgenticDispatcher` remains the only execution authority.

- [ ] **Step 1: Write failing governance tests**
  - Browser/computer-use navigation is denied outside configured domain allowlist.
  - Mutating browser action is approval-required even when runtime claims success.
  - `organization_id` supplied by a runtime/tool argument cannot override authenticated context.
  - Missing permission stays denied.
  - A failed/pending tool cannot be represented as executed merely because the model output says it succeeded.

- [ ] **Step 2: Run RED**

  Run: `npx vitest run tests/unit/atlas-unified-ai-chat-governance.test.ts tests/unit/atlas-managed-agent-runtime.test.ts`

  Expected: FAIL on new computer-use/runtime governance assertions.

- [ ] **Step 3: Implement minimal policy metadata and enforcement**
  - Preserve current dedupe and approval semantics.
  - Treat computer-use writes as side effects.
  - Derive tenant exclusively from ATLAS context.
  - Emit audit metadata without storing screenshots or hidden reasoning unless an existing approved evidence path explicitly requires them.

- [ ] **Step 4: Run GREEN**

  Run: `npx vitest run tests/unit/atlas-unified-ai-chat-governance.test.ts tests/unit/atlas-managed-agent-runtime.test.ts tests/unit/atlas-unified-ai-chat-gateway.test.ts`

  Expected: PASS.

- [ ] **Step 5: Commit**

  `git commit -m "feat(ai): govern managed runtime tool actions"`

---

### Task 5: Add programmatic Copilot review as exact-SHA advisory evidence

**Files:**
- Create: `scripts/atlas-copilot-review-evidence.mjs`
- Create: `.github/workflows/atlas-copilot-review.yml`
- Create: `tests/integration/atlas-copilot-review.test.ts`
- Modify: `.github/workflows/github-security-baseline.yml`
- Modify: `docs/governance/MAIN_BRANCH_REQUIRED_POLICY.md`

**Interfaces:**
- Consumes: GitHub PR number, repository, PR head SHA, GitHub token, Copilot review/review-comment API data.
- Produces: normalized JSON evidence `{ repository, pr_number, head_sha, requested, completed, effort, findings[], stale, blocking_decision }`.

- [ ] **Step 1: Write failing integration/source-contract tests**
  - Workflow requests reviewer `copilot-pull-request-reviewer[bot]` using GitHub review-request API semantics.
  - Workflow permissions are minimum required; no `write-all` and no `pull_request_target`.
  - Evidence collector rejects reviews/comments not anchored to current PR head SHA.
  - Default mode is advisory: Copilot approval does not satisfy ATLAS deterministic gates.
  - Service unavailable/missing Copilot entitlement yields explicit `unavailable` evidence, never `passed`.

- [ ] **Step 2: Run RED**

  Run: `npx vitest run tests/integration/atlas-copilot-review.test.ts`

  Expected: FAIL because workflow/evidence collector do not exist.

- [ ] **Step 3: Implement request + evidence collection**
  - Use GitHub REST reviewer request rather than a second review service.
  - Normalize comments/reviews; never treat prose approval as deterministic release evidence.
  - Record head SHA and stale status.
  - Keep blocking policy explicit and off by default until selected classes are intentionally promoted.

- [ ] **Step 4: Run GREEN and security workflow contracts**

  Run: `npx vitest run tests/integration/atlas-copilot-review.test.ts tests/integration/global-production-verification.test.ts`

  Expected: PASS.

- [ ] **Step 5: Commit**

  `git commit -m "feat(ci): add exact-sha Copilot review evidence"`

---

### Task 6: Add evidence-producing agentic security taskflows

**Files:**
- Create: `supabase/functions/atlas-copilot/security-taskflows.mjs`
- Create: `tests/unit/atlas-security-taskflows.test.ts`
- Modify: `supabase/functions/atlas-copilot/index.ts`
- Modify: `tests/unit/atlas-unified-ai-chat-source-contract.test.ts`

**Interfaces:**
- Produces: `SECURITY_TASKFLOW_CLASSES`, `normalizeSecurityFinding(input)`, `verifySecurityFinding({ finding, evidence })`.
- Finding state is one of `hypothesis | verified | dismissed`; `verified` requires deterministic evidence kind from an allowlist such as `failing_test`, `static_analysis`, `reproducible_http`, `sandbox_proof`.

- [ ] **Step 1: Write failing tests**
  - Threat classes cover auth/session, tenant isolation, SSRF/URL handling, injection/parsing, webhook/replay, CI trust boundary, and secret/logging exposure.
  - Model severity alone never sets `verified`.
  - Missing reproduction evidence remains `hypothesis`.
  - Evidence is tenant/trace scoped and sanitized.
  - A verified finding records exact reproduction type/reference without hidden chain-of-thought.

- [ ] **Step 2: Run RED**

  Run: `npx vitest run tests/unit/atlas-security-taskflows.test.ts`

  Expected: FAIL because taskflow/evidence contract does not exist.

- [ ] **Step 3: Implement report-only taskflow contract**
  - No autonomous blocking behavior in this task.
  - Expose taskflows through existing ATLAS Copilot/service boundary only where authenticated context and permissions are present.
  - Keep CodeQL and dependency scanning independent.

- [ ] **Step 4: Run GREEN**

  Run: `npx vitest run tests/unit/atlas-security-taskflows.test.ts tests/unit/atlas-unified-ai-chat-source-contract.test.ts`

  Expected: PASS.

- [ ] **Step 5: Commit**

  `git commit -m "feat(security): add reproducible agentic security evidence"`

---

### Task 7: Expose truthful readiness and preserve canonical telemetry

**Files:**
- Modify: `supabase/functions/atlas-copilot/index.ts`
- Modify: `supabase/functions/atlas-copilot/atlas-intelligence-store.mjs` only if the existing request/message JSON envelopes cannot hold the new runtime/model metadata without schema change.
- Modify: `tests/unit/atlas-unified-ai-chat-gateway.test.ts`
- Modify: `tests/unit/atlas-unified-ai-chat-source-contract.test.ts`
- Create: `tests/integration/atlas-ai-dev-stack-readiness.test.ts`

**Interfaces:**
- Readiness output must distinguish `configuration-required`, `configured-unverified`, `verified`, `rate-limited`, `unavailable`, and model discovery state such as `announced_unverified`.
- Telemetry records `runtime_backend`, provider, model, model verification state, profile, fallback attempts, cost decision, usage, tool proposals, approvals/references, latency, and terminal execution state.

- [ ] **Step 1: Write failing readiness/telemetry tests**
  - No `connected`/`verified` claim for unverified model/runtime.
  - Argon cannot appear as executable when provider probe has not verified it.
  - Managed-runtime session reference may be present while ATLAS conversation remains canonical.
  - Provider usage/cached-token telemetry is passed through but not fabricated.
  - Partial runtime execution persists evidence and returns non-completed state.

- [ ] **Step 2: Run RED**

  Run: `npx vitest run tests/unit/atlas-unified-ai-chat-gateway.test.ts tests/unit/atlas-unified-ai-chat-source-contract.test.ts tests/integration/atlas-ai-dev-stack-readiness.test.ts`

  Expected: FAIL on the new truthful-readiness contract.

- [ ] **Step 3: Implement the minimal readiness/telemetry changes**
  - Reuse current readiness cache and provider registry.
  - Extend existing JSON telemetry envelopes instead of adding a parallel store.
  - Keep secrets and raw credentials out of responses/evidence.

- [ ] **Step 4: Run GREEN**

  Run: `npx vitest run tests/unit/atlas-unified-ai-chat-gateway.test.ts tests/unit/atlas-unified-ai-chat-source-contract.test.ts tests/integration/atlas-ai-dev-stack-readiness.test.ts`

  Expected: PASS.

- [ ] **Step 5: Commit**

  `git commit -m "feat(ai): expose evidence-backed runtime readiness"`

---

### Task 8: Full verification, PR, CI, merge, deploy, and exact-SHA E2E

**Files:**
- Modify only if required by acceptance tests: `data/ops/global-production-verification.json`, `tests/integration/global-production-verification.test.ts`, `.github/workflows/global-production-verify.yml`, `.github/workflows/cloudflare-deploy.yml`.
- Do not add a new production pipeline if the existing canonical pipeline can prove the new runtime/readiness surface.

**Interfaces:**
- Consumes: Tasks 1-7.
- Produces: PR evidence, exact-head CI evidence, merged SHA, exact-SHA deployment evidence, and fail-closed production verification.

- [ ] **Step 1: Run focused AI/security tests**

  Run:
  `npx vitest run tests/unit/atlas-unified-ai-chat-routing.test.ts tests/unit/atlas-unified-ai-chat-adapters.test.ts tests/unit/atlas-unified-ai-chat-governance.test.ts tests/unit/atlas-unified-ai-chat-gateway.test.ts tests/unit/atlas-managed-agent-runtime.test.ts tests/unit/atlas-security-taskflows.test.ts tests/integration/atlas-copilot-review.test.ts tests/integration/atlas-ai-dev-stack-readiness.test.ts`

  Expected: PASS, zero failures.

- [ ] **Step 2: Run full repository verification**

  Run: `npm run verify:all`

  Expected: exit 0, including audit, design verification, typecheck, unit, integration, edge, Python, neural, navigation, and production build.

- [ ] **Step 3: Inspect the complete diff against the spec**
  - No provider credentials.
  - No duplicate router/store/approval plane.
  - New runtimes disabled by default unless authenticated policy enables them.
  - AI signals remain non-authoritative relative to deterministic gates.

- [ ] **Step 4: Open PR to `main` and request Copilot review evidence**
  - Confirm PR head SHA is the same SHA reviewed by focused tests and CI.
  - Resolve material review threads or document dismissals with reason.

- [ ] **Step 5: Require exact-head GitHub gates before merge**
  - `ATLAS 3-of-3 Consensus` success.
  - `CodeQL Advanced` success for applicable languages.
  - `verify-build-readiness` success.
  - Feature-specific AI/Copilot review workflow success or truthful advisory-unavailable evidence according to policy.
  - No unresolved material review thread.

- [ ] **Step 6: Merge only the verified PR head**
  - Use normal PR merge path; no direct push to `main`.
  - Record merged SHA.

- [ ] **Step 7: Verify merged SHA independently**
  - Confirm `ATLAS Build + Production Readiness Gate` re-runs on the merged `main` SHA.
  - Confirm canonical `ATLAS Cloudflare Worker Deploy` runs for that SHA.
  - Confirm `ATLAS Global Production Verification` executes in `fail-closed` mode.

- [ ] **Step 8: Run/observe production E2E evidence**
  - Exact production version tag must equal merged SHA.
  - P0 public/critical routes remain green according to `data/ops/global-production-verification.json`.
  - ATLAS Manager readiness remains reachable.
  - AI readiness/diagnostics expose only authenticated evidence-backed provider/model/runtime state.
  - If edge challenge requires the authorized verifier, require authorized OIDC fallback success; never convert challenge/failure into direct success.

- [ ] **Step 9: Final acceptance review**
  - Check every acceptance criterion in the spec against a test, CI check, PR evidence item, or production observation.
  - Any missing evidence remains incomplete; do not mark the transfer production-verified.

## Execution Method

Use **Native execution in the current session** unless a later blocker forces a different path. The tasks share the same gateway/provider contracts and benefit from one coherent implementation context. A full-branch review is required before PR/merge, and all completion claims require fresh verification evidence.
