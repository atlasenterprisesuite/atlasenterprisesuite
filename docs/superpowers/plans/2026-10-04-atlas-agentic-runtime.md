# ATLAS Agentic Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing `atlas-copilot` intelligence bus with governed durable agents, computer-use approvals, multi-agent delegation, Gemini tool normalization, deterministic workflows, GitHub review automation hooks, and x402-ready metering without creating a second AI architecture.

**Architecture:** Keep provider routing and policy in `atlas-copilot`; add focused provider-neutral runtime modules and extend existing adapters. Provider-specific features are exposed only through verified readiness and ATLAS policy. Tool, cost, tenancy, approval, and audit gates remain authoritative.

**Tech Stack:** TypeScript/JavaScript ESM, Supabase Edge Functions/Deno, npm workspaces, Vitest, GitHub Actions, Cloudflare production verifier.

**Spec:** `docs/superpowers/specs/2026-10-04-atlas-agentic-runtime-design.md`

## Global Constraints

- Reuse existing `atlas-copilot`, provider registry, tool gateway, cost policy, agent registry, auth, store, and audit patterns.
- Do not create a parallel orchestrator or provider registry.
- Fail closed when credentials, beta access, provider readiness, payment readiness, or authorization is absent.
- GitHub remains source of truth; Cloudflare remains production verification boundary.
- Never commit API keys, wallet keys, tokens, signatures, or credentials.
- Preserve current unified-chat behavior.

## Review Focus

- Unverified provider advertising a capability as live: tests must prove execution remains blocked.
- Provider-generated tool call attempting write/payment without approval: tests must prove it cannot execute directly.
- Multi-agent workflow mutating the same resource concurrently: tests must prove deterministic ownership/denial.
- x402 metadata present without payment runtime readiness: tests must return `payment_required`/configuration state, never fake settlement.
- Provider failure during parallel workflow: tests must preserve partial evidence and return deterministic failed/degraded state.

---

### Task 1: Normalize Agentic Capabilities

**Files:**
- Modify: `supabase/functions/atlas-copilot/provider-registry.mjs`
- Modify: `supabase/functions/atlas-copilot/openai-responses-adapter.mjs`
- Modify: `supabase/functions/atlas-copilot/gemini-adapter.mjs`
- Test: `tests/unit/atlas-agentic-runtime-capabilities.test.ts`

**Interfaces:**
- Consumes: existing provider descriptors and readiness probes.
- Produces: normalized `feature_support` booleans for `background`, `multi_agent`, `computer_use`, `function_calling`, `remote_mcp`, `programmatic_tool_calling`, `dynamic_workflows`.

- [ ] Write failing descriptor/readiness tests.
- [ ] Run focused test and verify failure.
- [ ] Normalize feature support in provider registry and adapters.
- [ ] Run focused test and verify pass.
- [ ] Commit.

### Task 2: OpenAI Governed Agent Sessions

**Files:**
- Create: `supabase/functions/atlas-copilot/openai-agents-adapter.mjs`
- Create: `supabase/functions/atlas-copilot/agent-session-runtime.mjs`
- Modify: `supabase/functions/atlas-copilot/index.ts`
- Test: `tests/unit/atlas-agent-session-runtime.test.ts`

**Interfaces:**
- Consumes: `normalizeAgentContext`, provider readiness, ATLAS permissions.
- Produces: `createSession`, `runTurn`, `submitApproval`, `getSession`, `closeSession`; OpenAI adapter uses `/v1/agents/sessions` and `OpenAI-Beta: agents=v1`.

- [ ] Write failing tests for secret-free headers/body, session creation, unverified-provider denial, and computer-use approval normalization.
- [ ] Run focused test and verify failure.
- [ ] Implement minimal session runtime and OpenAI adapter.
- [ ] Add `api=agent-session` dispatch through existing auth/CORS/error handling.
- [ ] Run focused test and verify pass.
- [ ] Commit.

### Task 3: Multi-Agent Delegation Guardrails

**Files:**
- Modify: `packages/agent-registry/src/types.ts`
- Modify: `packages/agent-registry/src/defaultAgents.ts`
- Create: `packages/agent-registry/src/delegationPolicy.ts`
- Test: `tests/unit/atlas-agent-delegation-policy.test.ts`

**Interfaces:**
- Consumes: `AtlasAgentDefinition`, permissions, workflow resource ownership.
- Produces: `evaluateDelegation({parent, child, depth, resourceKeys})` returning allow/deny plus reason.

- [ ] Write failing depth/permission/same-resource tests.
- [ ] Run focused test and verify failure.
- [ ] Implement delegation policy and agent capability additions.
- [ ] Run focused test and verify pass.
- [ ] Commit.

### Task 4: Gemini Function Calling Through ATLAS Tool Gateway

**Files:**
- Modify: `supabase/functions/atlas-copilot/gemini-adapter.mjs`
- Modify: `supabase/functions/atlas-copilot/tool-gateway.mjs`
- Test: `tests/unit/atlas-gemini-tools.test.ts`

**Interfaces:**
- Consumes: provider function-call parts and ATLAS tool metadata.
- Produces: normalized `tool_calls` matching the existing ATLAS proposal shape.

- [ ] Write failing Gemini function-call normalization tests including malformed arguments and write-risk calls.
- [ ] Run focused test and verify failure.
- [ ] Implement request tool declaration support and response normalization.
- [ ] Ensure side-effecting calls reach `approval_required`, not `accepted`.
- [ ] Run focused test and verify pass.
- [ ] Commit.

### Task 5: Deterministic Dynamic Workflow Runtime

**Files:**
- Create: `supabase/functions/atlas-copilot/workflow-runtime.mjs`
- Create: `supabase/functions/atlas-copilot/workflows/code-change-review-v1.mjs`
- Modify: `supabase/functions/atlas-copilot/index.ts`
- Test: `tests/unit/atlas-dynamic-workflow-runtime.test.ts`

**Interfaces:**
- Consumes: registered agents, step executors, delegation policy, CI/review adapters.
- Produces: `createWorkflowRuntime({executors, clock})` with `execute`, `resume`, `getRun`; step types `task|parallel|verify|checkpoint`.

- [ ] Write failing sequential/parallel/checkpoint/failure tests.
- [ ] Run focused test and verify failure.
- [ ] Implement workflow state machine with traceable step outputs.
- [ ] Add `atlas-code-change-review-v1` definition.
- [ ] Add `api=workflow` dispatch through existing auth/CORS/error handling.
- [ ] Run focused test and verify pass.
- [ ] Commit.

### Task 6: GitHub Code Review Adapter Boundary

**Files:**
- Create: `packages/agent-registry/src/githubReviewPolicy.ts`
- Modify: `supabase/functions/atlas-copilot/workflows/code-change-review-v1.mjs`
- Test: `tests/unit/atlas-github-review-policy.test.ts`

**Interfaces:**
- Consumes: repository/PR identity, ATLAS approval state, CI state, provider readiness.
- Produces: `evaluateGithubReviewRequest(...)` that returns `allowed|approval_required|denied`; execution remains external to ATLAS core and cannot merge/deploy.

- [ ] Write failing authorization/readiness tests.
- [ ] Run focused test and verify failure.
- [ ] Implement policy and workflow hook.
- [ ] Run focused test and verify pass.
- [ ] Commit.

### Task 7: Tool Metering and x402-Ready Decisions

**Files:**
- Modify: `supabase/functions/atlas-copilot/tool-gateway.mjs`
- Create: `supabase/functions/atlas-copilot/metering-policy.mjs`
- Test: `tests/unit/atlas-tool-metering.test.ts`

**Interfaces:**
- Consumes: tool proposal metering metadata and runtime payment readiness.
- Produces: normalized `payment_required` decisions without settlement secrets.

- [ ] Write failing free/internal/x402 tests and secret-leak tests.
- [ ] Run focused test and verify failure.
- [ ] Implement metering normalization and policy.
- [ ] Preserve existing accepted/approval_required/denied behavior for unmetered tools.
- [ ] Run focused test and verify pass.
- [ ] Commit.

### Task 8: Regression and Production Gates

**Files:**
- Modify: `tests/unit/atlas-unified-ai-chat-governance.test.ts` only if compatibility assertions require updates.
- Modify: `.github/workflows/global-production-verify.yml` only if a new truthful readiness route assertion is needed.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: evidence that existing chat still works and new capability readiness is truthful.

- [ ] Run all new focused tests.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Open PR to `main` with exact test evidence.
- [ ] Verify required checks; repair failures before merge.
- [ ] Merge only after required gates pass.
- [ ] Verify deployment and public production routes against exact merged SHA.
- [ ] Record external provider gates that remain configuration-required/configured-unverified.
