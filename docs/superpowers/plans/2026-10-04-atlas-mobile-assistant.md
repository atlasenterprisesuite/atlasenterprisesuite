# ATLAS Mobile Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ATLAS Assistant work as a deliberate mobile/iPad conversation experience with persisted history, search, resume, truthful provider state and responsive interaction.

**Architecture:** Extend the existing `atlas-copilot` history APIs and `UnifiedAIChatPage` instead of creating a second assistant. Keep conversation persistence and provider readiness server-authoritative; add focused client history/search/sync utilities and split oversized UI responsibilities into components as needed.

**Tech Stack:** React 18, TypeScript 5.7, Vitest, existing `apps/web/src/assistant/*`, `supabase/functions/atlas-copilot`, ATLAS session/org scoping.

**Spec:** `docs/superpowers/specs/2026-10-04-atlas-mobile-experience-design.md`

## Global Constraints

- Reuse `/assistant`, `atlas-copilot`, existing organization scoping and provider readiness contracts.
- Do not fabricate conversations or provider states.
- Conversation search must only search content the authenticated user is authorized to retrieve.
- Offline drafts may remain local only until an acknowledged send; mutations are not successful before server acknowledgement.
- Unknown provider evidence remains unverified/unavailable.
- Preserve the existing desktop Assistant behavior while adding mobile/tablet layouts.

## Review Focus

- History request succeeds with an empty array -> show real empty state, not demo data.
- Conversation disappears between list and open -> recover with not-found/error state and refresh history.
- Search query contains accents/case/punctuation -> deterministic normalized matching without leaking other tenant data.
- Network drops after user taps send -> preserve unsent input and do not append an acknowledged user turn twice.
- Provider becomes unverified after a conversation is opened -> composer remains gated according to current readiness, not stale status.

---

### Task 1: Normalize conversation history and client-side search

**Files:**
- Create: `apps/web/src/assistant/history.ts`
- Modify: `apps/web/src/assistant/client.ts`
- Modify: `apps/web/src/assistant/types.ts`
- Test: `tests/unit/assistant-history.test.ts`

**Interfaces:**
- Consumes: existing `AssistantConversation`, `listAssistantConversations()`, `getAssistantConversation()`.
- Produces: `AssistantConversationSummary`, `normalizeConversationList()`, `searchAssistantConversations(conversations, query, limit)`, `ConversationSyncCursor`.

- [ ] **Step 1: Write failing tests** for newest-first ordering, null titles, empty history, accent/case-insensitive search, stable IDs and result limits.
- [ ] **Step 2: Run** `npx vitest run tests/unit/assistant-history.test.ts` and verify FAIL.
- [ ] **Step 3: Extend** assistant types with `ConversationSyncCursor` and normalized summary metadata; do not duplicate the mobile package's generic cursor semantics.
- [ ] **Step 4: Implement** `normalizeConversationList()` and `searchAssistantConversations()` in `history.ts`.
- [ ] **Step 5: Add** optional `cursor`/`limit` support to `listAssistantConversations()` only if the existing edge function supports it; otherwise keep current endpoint contract and paginate locally without pretending server pagination exists.
- [ ] **Step 6: Run** the focused test and verify PASS.
- [ ] **Step 7: Commit** `feat: add assistant history normalization`.

### Task 2: Harden server history/conversation operations

**Files:**
- Modify: `supabase/functions/atlas-copilot/index.ts`
- Test: `tests/integration/assistant-mobile-history-api.test.ts`

**Interfaces:**
- Consumes: existing `api=history` and `api=conversation&id=...` operations.
- Produces: stable organization-scoped history ordering and explicit not-found/authorization errors without cross-tenant disclosure.

- [ ] **Step 1: Write failing integration tests** for authenticated history, cross-org conversation ID, missing conversation ID, empty history and deterministic ordering.
- [ ] **Step 2: Run** `npx vitest run tests/integration/assistant-mobile-history-api.test.ts` and verify FAIL for the uncovered cases.
- [ ] **Step 3: Modify** only the existing history/conversation branches in `atlas-copilot/index.ts`; preserve current provider/chat behavior.
- [ ] **Step 4: Ensure** unauthorized/missing IDs return a non-disclosing error contract and no conversation payload.
- [ ] **Step 5: Run** the integration test and verify PASS.
- [ ] **Step 6: Commit** `fix: harden assistant history tenancy`.

### Task 3: Build a dedicated responsive history surface

**Files:**
- Create: `apps/web/src/modules/intelligence/AssistantHistoryPanel.tsx`
- Create: `apps/web/src/modules/intelligence/AssistantConversationList.tsx`
- Modify: `apps/web/src/modules/intelligence/UnifiedAIChatPage.tsx`
- Modify: `apps/web/src/modules/intelligence/UnifiedAIChat.css`
- Test: `tests/integration/assistant-mobile-history-ui.test.tsx`

**Interfaces:**
- Consumes: history helpers from Task 1 and existing `UnifiedAIChatPage` conversation-open flow.
- Produces: mobile drawer / tablet split history with search, loading, empty, error, selected and retry states.

- [ ] **Step 1: Write failing UI tests** for loading, empty, list/search, selected conversation, retry after error, phone drawer and tablet split mode.
- [ ] **Step 2: Run** `npx vitest run tests/integration/assistant-mobile-history-ui.test.tsx` and verify FAIL.
- [ ] **Step 3: Extract** history rendering from `UnifiedAIChatPage.tsx` into `AssistantHistoryPanel` and `AssistantConversationList`; keep message composition/provider code in its existing owner.
- [ ] **Step 4: Add** responsive CSS breakpoints that intentionally switch phone/tablet layout rather than scaling desktop widths.
- [ ] **Step 5: Run** the UI test and verify PASS.
- [ ] **Step 6: Commit** `feat: add mobile assistant history surface`.

### Task 4: Make send/retry/offline state acknowledgement-safe

**Files:**
- Create: `apps/web/src/assistant/sendState.ts`
- Modify: `apps/web/src/modules/intelligence/UnifiedAIChatPage.tsx`
- Test: `tests/unit/assistant-send-state.test.ts`
- Test: `tests/integration/assistant-offline-send.test.tsx`

**Interfaces:**
- Produces: `AssistantSendState = idle | sending | acknowledged | failed | offline` and `resolveSendOutcome()`.
- Consumes: existing `sendAssistantWorkspaceMessage()` response and browser online/offline events.

- [ ] **Step 1: Write failing unit tests** proving no acknowledged state without a successful server response and no duplicate optimistic message after retry.
- [ ] **Step 2: Implement** `resolveSendOutcome()` and idempotent local message correlation IDs.
- [ ] **Step 3: Run** unit tests and verify PASS.
- [ ] **Step 4: Write failing UI test** for going offline before send, network failure after click, retry success and preserved composer text.
- [ ] **Step 5: Integrate** the state machine into `UnifiedAIChatPage.tsx`; reads may retry automatically, sends do not auto-retry without explicit user action/idempotency evidence.
- [ ] **Step 6: Run** both tests and verify PASS.
- [ ] **Step 7: Commit** `fix: make assistant sends acknowledgement safe`.

### Task 5: Add current provider/readiness evidence to the mobile composer

**Files:**
- Modify: `apps/web/src/modules/intelligence/UnifiedAIChatPage.tsx`
- Modify: `apps/web/src/modules/intelligence/UnifiedAIChat.css`
- Reuse: `apps/web/src/assistant/client.ts`
- Test: `tests/integration/assistant-provider-readiness-ui.test.tsx`

**Interfaces:**
- Consumes: `getAssistantStatus()`, `hasVerifiedAssistantProvider()`, `assistantProviderSummary()`.
- Produces: visible `verified / configured-unverified / configuration-required / unavailable` composer state and gating.

- [ ] **Step 1: Write failing UI tests** for verified provider, configured-unverified provider, no provider and status refresh changing from verified to unavailable.
- [ ] **Step 2: Modify** the composer/header so sending is enabled only according to the current verified provider contract or an already supported local path.
- [ ] **Step 3: Ensure** stale status is visibly stale/unverified rather than silently retaining the old badge.
- [ ] **Step 4: Run** the test and verify PASS.
- [ ] **Step 5: Commit** `feat: surface assistant provider evidence`.

### Task 6: Assistant mobile regression verification

**Files:**
- Modify only if verification identifies a defect in Tasks 1-5.

**Interfaces:**
- Produces: testable Assistant mobile slice ready for integration with the mobile foundation.

- [ ] **Step 1: Run** `npx vitest run tests/unit/assistant-capabilities.test.ts tests/unit/assistant-storage.test.ts tests/unit/assistant-history.test.ts tests/unit/assistant-send-state.test.ts`.
- [ ] **Step 2: Run** the new Assistant integration tests and existing relevant Assistant route/UI tests.
- [ ] **Step 3: Run** `npm run typecheck`.
- [ ] **Step 4: Run** `npm run build`.
- [ ] **Step 5: Verify** `/assistant` at phone, tablet and desktop viewports in the execution environment; record screenshots/evidence only when actual browser tooling is available.
- [ ] **Step 6: Commit verification fixes, if any** as `fix: close assistant mobile regression gaps`.
