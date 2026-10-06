# ATLAS Assistant 2.0 Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing `/assistant` into the Phase 1 ATLAS Intelligence Workspace with truthful Chat/Work/Build experiences, server-authored capability readiness, normalized workspace requests/results, and durable execution-state UI without weakening existing provider, tenant, approval, cost, voice, history, or attachment gates.

**Architecture:** Extend the existing `atlas-copilot` status/chat contracts rather than adding a new backend. A focused workspace-capability helper owns server readiness mapping, `apps/web/src/assistant/client.ts` owns shared TypeScript contracts, and small Assistant components are composed into the existing `UnifiedAIChatPage.tsx`. Chat continues through `IntelligenceRouter`; Work reuses background execution; Build is offered only when a verified build runtime contract is satisfied and otherwise fails closed.

**Tech Stack:** React 18, TypeScript 5.7, Supabase Edge Functions/Deno-compatible TypeScript + `.mjs` helpers, Vitest 5, existing ATLAS `atlas-copilot`/Background Brain/Tool Gateway contracts.

**Spec:** `docs/superpowers/specs/2026-10-06-atlas-assistant-2-intelligence-workspace-design.md`

## Global Constraints

- `/assistant` remains the canonical route; no parallel assistant product.
- Existing provider modes remain: `auto`, `atlas-local`, `openai`, `bedrock`, `gemini`, `codex-sovereign`, `council`.
- Existing reasoning profiles remain: `fast`, `balanced`, `deep`.
- Provider readiness and workspace capability readiness remain separate concepts.
- Attachments remain fail-closed until secure malware scanning/ingestion is verified.
- Web research, memory, Projects, artifacts, computer operations, and unverified app sources must not be represented as operational in Phase 1.
- Explicit provider modes keep current no-silent-fallback behavior.
- Credentials/tokens remain server-side and source references are re-authorized server-side.
- Work reuses Background Brain/current Work orchestration; Build does not claim repository access without verified developer/repository readiness.
- Existing Assistant history, voice/translation, mobile behavior, tenant isolation, RBAC, approvals, cost policy, audit, and production verification must not regress.
- No production/deployment completion claim without fresh CI/build and route verification evidence.

## Review Focus

- Status responses with zero verified providers: Chat/Work must not appear ready and the UI must remain usable for history/settings.
- `build` requested while developer/repository runtime is not verified: return a normalized gated/configuration error; never fall back to ordinary chat.
- Existing attachment state remains unavailable/gated: UI must not upload bytes or label attachments as ready.
- A background Work request that returns queued/running: render durable execution state and preserve the same conversation ID while polling.
- Existing voice/translator interactive turns: must continue using interactive execution and must not be forced into Work/background routing.

---

### Task 1: Server-authored workspace capability manifest

**Files:**
- Create: `supabase/functions/atlas-copilot/workspace-capabilities.mjs`
- Modify: `supabase/functions/atlas-copilot/index.ts`
- Modify: `apps/web/src/assistant/client.ts`
- Create: `tests/unit/atlas-assistant-workspace-capabilities.test.ts`
- Modify: `tests/unit/atlas-assistant-client.test.ts`

**Interfaces:**
- Consumes: current provider readiness array, diarization/readiness metadata, existing attachment fail-closed state, optional verified build-runtime boolean supplied by the server boundary.
- Produces: `AtlasAssistantCapabilityId`, `AtlasAssistantCapabilityState`, `AtlasAssistantCapability`, `workspace_capabilities` on `AssistantStatusResponse`, and `buildWorkspaceCapabilities(input) -> AtlasAssistantCapability[]`.

- [ ] **Step 1: Write the failing capability-manifest unit tests**

Cover these assertions in `tests/unit/atlas-assistant-workspace-capabilities.test.ts`:
- at least one verified provider makes `chat` ready;
- no verified provider makes `chat` and `work` unavailable;
- `work` is ready only when provider execution and background execution are available;
- `build` is `configuration_required` unless build runtime/repository readiness is explicitly verified;
- `attachments` is gated/configuration-required while secure ingestion is false;
- `web-research`, `artifacts`, and `computer` remain gated in Phase 1;
- no capability state is derived from a UI/menu flag.

- [ ] **Step 2: Run RED**

Run: `npm test -- tests/unit/atlas-assistant-workspace-capabilities.test.ts`

Expected: FAIL because `workspace-capabilities.mjs` / `buildWorkspaceCapabilities` does not exist.

- [ ] **Step 3: Implement the minimal capability helper and status contract**

Implement in `workspace-capabilities.mjs`:

```ts
buildWorkspaceCapabilities(input: {
  providers: Array<{ id: string; verified: boolean; state: string }>;
  backgroundReady: boolean;
  buildRuntimeReady: boolean;
  attachmentPipelineReady: boolean;
  voiceReady: boolean;
}): Array<{
  id: 'chat' | 'work' | 'build' | 'web-research' | 'attachments' | 'voice' | 'apps' | 'knowledge' | 'artifacts' | 'computer';
  state: 'ready' | 'gated' | 'unavailable' | 'configuration_required';
  reason: string | null;
  permissions: string[];
  supports_background: boolean;
}>;
```

Wire its result into authenticated `api=status`. Add matching exported client types and optional `workspace_capabilities` field.

- [ ] **Step 4: Add client contract assertions**

Update `tests/unit/atlas-assistant-client.test.ts` to assert that `getAssistantStatus()` preserves `workspace_capabilities` and that no client helper fabricates readiness when the field is absent.

- [ ] **Step 5: Run GREEN for Task 1**

Run: `npm test -- tests/unit/atlas-assistant-workspace-capabilities.test.ts tests/unit/atlas-assistant-client.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat(assistant): add workspace capability manifest`

### Task 2: Normalized Chat/Work/Build request and result contract

**Files:**
- Modify: `apps/web/src/assistant/client.ts`
- Modify: `supabase/functions/atlas-copilot/index.ts`
- Create: `supabase/functions/atlas-copilot/workspace-request.mjs`
- Create: `tests/unit/atlas-assistant-workspace-request.test.ts`
- Modify: `tests/unit/atlas-background-brain.test.ts`

**Interfaces:**
- Consumes: `workspace_capabilities` from Task 1 and existing `sendAssistantWorkspaceMessage`, chat endpoint, Background Brain, provider modes/profiles.
- Produces: `AtlasAssistantExperience`, `AtlasContextSource`, `AtlasWorkspaceRequest`, `AtlasWorkspaceResult`, `sendAssistantWorkspaceRequest(input)`, and server-side `normalizeWorkspaceRequest(input, capabilities)`.

- [ ] **Step 1: Write failing normalized-request tests**

Assert:
- `chat` preserves requested provider/profile and defaults to interactive/auto execution without inventing sources;
- `work` normalizes to background execution and keeps the same conversation ID when supplied;
- `build` fails with `capability_configuration_required`/`build_runtime_unavailable` when capability is not ready and never downgrades to Chat;
- requested source refs are rejected when state is not `ready`;
- attachment/project source refs are rejected while those capabilities are gated;
- voice/translator requests can explicitly remain interactive.

- [ ] **Step 2: Run RED**

Run: `npm test -- tests/unit/atlas-assistant-workspace-request.test.ts`

Expected: FAIL because workspace request normalizer/types do not exist.

- [ ] **Step 3: Implement request normalizer and client function**

Client signature:

```ts
sendAssistantWorkspaceRequest(input: {
  experience: 'chat' | 'work' | 'build';
  message: string;
  conversationId?: string | null;
  mode: AssistantMode;
  profile: AssistantProfile;
  executionMode?: 'auto' | 'interactive' | 'background';
  sourceRefs?: AtlasContextSource[];
  requestedCapabilities?: AtlasAssistantCapabilityId[];
}): Promise<AtlasWorkspaceResult>;
```

Keep `sendAssistantWorkspaceMessage` as a backward-compatible Chat wrapper so existing Creator/Voice code does not break.

Server normalizer must validate capability state before execution and return normalized errors. Work routes into existing background execution; Build is fail-closed until build readiness is verified.

- [ ] **Step 4: Run GREEN for request/background behavior**

Run: `npm test -- tests/unit/atlas-assistant-workspace-request.test.ts tests/unit/atlas-background-brain.test.ts tests/unit/atlas-assistant-client.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat(assistant): normalize chat work build execution`

### Task 3: Intelligence Workspace UI composition

**Files:**
- Create: `apps/web/src/components/assistant/AssistantExperienceSwitcher.tsx`
- Create: `apps/web/src/components/assistant/AssistantCapabilityMenu.tsx`
- Create: `apps/web/src/components/assistant/AssistantExecutionCard.tsx`
- Modify: `apps/web/src/modules/intelligence/UnifiedAIChatPage.tsx`
- Modify: `apps/web/src/modules/intelligence/UnifiedAIChat.css`
- Create: `tests/unit/atlas-assistant-intelligence-workspace-ui.test.tsx`
- Modify: `tests/unit/atlas-assistant-workspace.test.ts`

**Interfaces:**
- Consumes: capability manifest and workspace request/result contracts from Tasks 1-2.
- Produces: accessible Chat/Work/Build switcher, capability menu with truthful ready/gated states, and execution cards for queued/running/completed/failed/configuration-required results.

- [ ] **Step 1: Write failing UI tests**

Using React Testing Library where practical, assert:
- Chat/Work/Build controls are keyboard accessible and expose selected state;
- selecting Work sends `experience='work'` and background execution through `sendAssistantWorkspaceRequest`;
- selecting gated Build disables execution and shows the server reason;
- attachment/research capability controls show gated state and never expose an active upload/research action;
- queued/running Work results render an execution card rather than a fabricated completed assistant message;
- switching experiences does not clear the current conversation ID/history;
- provider/profile selectors remain available.

- [ ] **Step 2: Run RED**

Run: `npm test -- tests/unit/atlas-assistant-intelligence-workspace-ui.test.tsx tests/unit/atlas-assistant-workspace.test.ts`

Expected: FAIL because the workspace components/experience behavior do not exist.

- [ ] **Step 3: Implement minimal components and integrate them**

Keep state ownership in `UnifiedAIChatPage` but extract rendering/responsibility into the three new components. Do not duplicate Work, Build, Image, Voice, Knowledge, or Analytics module implementations; deep-link or route through existing contracts.

- [ ] **Step 4: Preserve interactive voice/translation behavior**

Ensure existing translator/conversation voice paths continue sending interactive Chat requests and are not implicitly changed by a stale Work/Build UI selection.

- [ ] **Step 5: Run GREEN for UI and existing Assistant regression tests**

Run: `npm test -- tests/unit/atlas-assistant-intelligence-workspace-ui.test.tsx tests/unit/atlas-assistant-workspace.test.ts tests/integration/atlas-assistant-mainline.test.tsx tests/unit/assistant-voice.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat(assistant): unify chat work build workspace UI`

### Task 4: Integration, fail-closed regression, and production verification contract

**Files:**
- Modify: `tests/integration/atlas-assistant-mainline.test.tsx`
- Create: `tests/integration/atlas-assistant-intelligence-workspace.test.tsx`
- Modify: `tests/unit/atlas-assistant-provider-readiness.test.ts`
- Modify: `docs/architecture/ATLAS_ENTERPRISE_INTELLIGENCE_PARITY.md`
- Modify only if required by current route coverage: `.github/workflows/atlas-unified-ai-chat-ci.yml`, `data/ops/global-production-verification.json`, `tests/integration/global-production-verification.test.ts`

**Interfaces:**
- Consumes: all Phase 1 interfaces.
- Produces: regression evidence that one conversation can span Chat and Work state, Build stays fail-closed without runtime readiness, and existing Assistant production route verification remains intact.

- [ ] **Step 1: Write failing integration assertions before any required production-contract changes**

Assert:
- the same conversation ID survives Chat -> Work transitions;
- background result polling reconciles into that conversation;
- Build unavailable state is explicit and does not call ordinary provider execution;
- capability/provider readiness are independently represented;
- history, provider/profile controls, and voice translator remain intact;
- `/assistant` remains covered by production verification and no new P0 dependency is silently introduced.

- [ ] **Step 2: Run RED if a regression/contract gap exists**

Run: `npm test -- tests/integration/atlas-assistant-intelligence-workspace.test.tsx tests/integration/atlas-assistant-mainline.test.tsx tests/unit/atlas-assistant-provider-readiness.test.ts`

Expected: new assertions fail until integration wiring is complete. If an assertion already passes because earlier tasks fully satisfy it, record that specific pre-existing behavior and add the next missing acceptance assertion before changing production code.

- [ ] **Step 3: Implement only the integration fixes required by failing tests**

No unrelated refactors. Preserve fail-closed attachment/research/build behavior.

- [ ] **Step 4: Run focused GREEN**

Run: `npm test -- tests/unit/atlas-assistant-workspace-capabilities.test.ts tests/unit/atlas-assistant-workspace-request.test.ts tests/unit/atlas-assistant-intelligence-workspace-ui.test.tsx tests/integration/atlas-assistant-intelligence-workspace.test.tsx tests/integration/atlas-assistant-mainline.test.tsx`

Expected: PASS.

- [ ] **Step 5: Run repository verification**

Run in order:
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:integration`
- `npm run build`

Expected: all PASS. Any unrelated baseline failure must be reported by exact test/job name; do not hide it.

- [ ] **Step 6: Update parity documentation and commit**

Document Chat/Work/Build, capability manifest, gated Phase 1 capabilities, and truthful readiness boundaries.

Commit message: `test(assistant): verify intelligence workspace phase 1`

## Final branch verification

- Compare branch against its merge base with `main`.
- Review all changed files against the spec and this plan.
- Re-run focused tests after any review fix.
- Open PR only after the branch is internally green.
- Observe PR CI; fix failures with a new failing regression test first when behavior is involved.
- Merge/deploy only under existing repository/production approval rules.
- After deployment, verify `https://www.atlasenterprisesuite.com/` and `/assistant` plus any applicable P0/P1 health routes before marking production verified.
