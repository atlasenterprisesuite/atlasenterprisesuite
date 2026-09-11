# ATLAS Assistant Avatar + Voice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the approved ATLAS 3D avatar as the authenticated persistent ATLAS Assistant, backed by existing Supabase Identity and `atlas-copilot`, with truthful text/voice capability states and no new mutating assistant actions.

**Architecture:** Mount one assistant surface in `AtlasShell`; reuse `atlasSession.ts` for identity/organization and `supabase/functions/atlas-copilot` for governed intelligence. The browser never calls OpenAI directly. Voice is capability-driven and opt-in; microphone activation is never automatic.

**Tech Stack:** React 18, TypeScript, React Router, Vitest, Supabase Auth/RLS/Edge Functions, existing ATLAS CSS, existing OpenAI Responses adapter behind `atlas-copilot`.

**Spec:** `docs/superpowers/specs/2026-09-11-atlas-assistant-avatar-voice-design.md`

## Global Constraints

- Reuse `supabase/functions/atlas-copilot`; do not create a second AI gateway.
- Do not call OpenAI directly from the browser.
- Do not show false `listening`, `speaking`, `streaming`, or native Personal Voice states.
- The assistant must resolve a valid session and active organization before presenting itself as an authenticated workspace assistant.
- The microphone never activates automatically at login.
- Speech output defaults off under `atlas_assistant_speech_enabled`.
- The greeting is session-scoped under `atlas_assistant_greeted`.
- Spoken output always has visible text.
- No new mutating assistant actions are introduced in this milestone.
- Run `npm run verify:cloudflare` before any production claim.

---

### Task 1: Assistant foundations and approved avatar asset

**Files:**
- Create: `apps/web/public/atlas/assistant/atlas-assistant-avatar.png`
- Create: `apps/web/src/assistant/types.ts`
- Create: `apps/web/src/assistant/routeContext.ts`
- Create: `apps/web/src/assistant/storage.ts`
- Create: `apps/web/src/assistant/capabilities.ts`
- Test: `tests/unit/assistant-route-context.test.ts`
- Test: `tests/unit/assistant-storage.test.ts`
- Test: `tests/unit/assistant-capabilities.test.ts`

**Interfaces:**
- Produces `AtlasAssistantCapability`, `AtlasCapabilityState`, `AtlasAssistantUiState`, `AtlasAssistantContext`.
- Produces `resolveAssistantModule(pathname)`.
- Produces speech/greeting local-storage helpers using the exact keys in Global Constraints.
- Produces `microphoneCapabilityFromBrowser(...)`.

- [ ] Write failing unit tests for route mapping, storage defaults/persistence, and microphone capability mapping.
- [ ] Run focused unit tests and verify they fail because the modules do not exist.
- [ ] Implement the minimal modules with exact state names from the spec.
- [ ] Add the approved transparent 512px avatar at the canonical public path.
- [ ] Run focused unit tests and verify PASS.
- [ ] Commit `feat(assistant): add avatar asset and assistant foundations`.

### Task 2: Identity-aware client for existing ATLAS copilot

**Files:**
- Create: `apps/web/src/assistant/client.ts`
- Modify only if required: `apps/web/src/lib/atlasSession.ts`
- Test: `tests/unit/assistant-client.test.ts`
- Test: `tests/integration/assistant-copilot-session.test.ts`

**Interfaces:**
- `getAssistantStatus()` calls `/functions/v1/atlas-copilot?api=status` with the existing bearer token.
- `sendAssistantMessage({message, pathname, conversationId, modality})` resolves active organization, maps pathname to module, and calls `?api=chat`.
- Provider errors must remain visible; unsuccessful HTTP responses must throw instead of being rendered as valid assistant replies.

- [ ] Write failing client tests that assert bearer auth, active organization use, and module mapping.
- [ ] Run tests and verify FAIL.
- [ ] Implement the minimal copilot client; do not duplicate provider credentials or auth state.
- [ ] Add integration coverage for expired/no-session and active organization behavior.
- [ ] Run focused tests and verify PASS.
- [ ] Commit `feat(assistant): add governed copilot client runtime`.

### Task 3: Persistent authenticated launcher and panel

**Files:**
- Create: `apps/web/src/components/assistant/AtlasAssistant.tsx`
- Create: `apps/web/src/components/assistant/AtlasAssistantLauncher.tsx`
- Create: `apps/web/src/components/assistant/AtlasAssistantPanel.tsx`
- Create: `apps/web/src/components/assistant/AtlasAssistantMessageList.tsx`
- Modify: `apps/web/src/components/AtlasShell.tsx`
- Modify: `apps/web/src/styles.css`
- Test: `tests/integration/atlas-shell-assistant.test.tsx`

**Behavior:**
- Resolve `getActiveAtlasOrganization()` before showing the launcher.
- Hide on invalid/expired/no-org state without pretending the assistant is connected.
- Mount once in `AtlasShell` so route changes do not remount the conversation surface.
- Show one text greeting per browser session; never activate the microphone automatically.
- Text submission uses `sendAssistantMessage` and shows explicit thinking/error/idle state changes.

- [ ] Write failing integration tests for authenticated visibility, unauthenticated hiding, panel open/close, greeting guard, and route persistence.
- [ ] Run tests and verify FAIL.
- [ ] Implement launcher/panel/message list and mount in `AtlasShell`.
- [ ] Add responsive/accessibility styles using the existing ATLAS visual language.
- [ ] Run integration tests and verify PASS.
- [ ] Commit `feat(assistant): mount persistent authenticated assistant`.

### Task 4: Truthful browser voice capabilities

**Files:**
- Create: `apps/web/src/assistant/voice.ts`
- Create: `apps/web/src/assistant/useAssistantVoice.ts`
- Modify: `apps/web/src/components/assistant/AtlasAssistantPanel.tsx`
- Test: `tests/unit/assistant-voice.test.ts`
- Test: `tests/integration/assistant-voice-states.test.tsx`

**Behavior:**
- `detectSpeechOutputCapability()` reports ready only when browser speech synthesis exists.
- Microphone state is ready only after real capture is active; denied/unsupported states never show `listening`.
- Speech output is opt-in and defaults off.
- `streaming` and native Personal Voice remain unavailable in the web client.
- No fake lip-sync.

- [ ] Write failing unit/integration tests for unsupported, denied, granted, speaking and cleanup states.
- [ ] Run tests and verify FAIL.
- [ ] Implement media capture/speech helpers and panel controls.
- [ ] Stop media tracks on completion/unmount and always leave transient UI states on error.
- [ ] Run focused tests and verify PASS.
- [ ] Commit `feat(assistant): add truthful browser voice capability handling`.

### Task 5: Voice Studio assistant identity

**Files:**
- Modify: `apps/web/src/modules/voice/VoiceStudioPage.tsx`
- Modify: `apps/web/src/styles.css`
- Test: `tests/integration/voice-studio-assistant-card.test.tsx`

**Behavior:**
- Surface the same canonical avatar and ATLAS Assistant identity in Voice Studio.
- Preserve existing truthful wording around Apple Personal Voice and unverified voice providers.

- [ ] Write failing integration test for the assistant identity card.
- [ ] Run test and verify FAIL.
- [ ] Add the assistant identity card without weakening existing capability warnings.
- [ ] Run test and verify PASS.
- [ ] Commit `feat(voice): surface ATLAS Assistant identity in Voice Studio`.

### Task 6: Verification and PR readiness

- [ ] Run assistant unit tests.
- [ ] Run assistant integration tests.
- [ ] Run `npm run verify:cloudflare`.
- [ ] Confirm no browser-to-OpenAI request exists and no new mutating assistant action exists.
- [ ] Confirm speech defaults off, microphone is never automatic, and unsupported streaming/native Personal Voice remain unavailable.
- [ ] Review the complete branch diff against the approved spec.
- [ ] Open a PR to `main` only after the verification evidence above is available; do not merge without explicit authorization.
