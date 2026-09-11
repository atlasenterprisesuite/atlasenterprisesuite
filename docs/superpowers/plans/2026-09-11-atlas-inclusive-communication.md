# ATLAS Inclusive Communication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production-safe universal accessibility layer to the existing ATLAS web shell with functional communication preferences, confidence gating, truthful provider states, and a global Communication Settings route.

**Architecture:** Extend the existing React/Vite `apps/web` application and mount `AtlasAccessibility` in the current `AtlasShell`. Keep provider-dependent ASL recognition/avatar/Braille/interpreter capabilities behind explicit capability states and typed adapter boundaries so ATLAS never presents simulated integrations as live.

**Tech Stack:** React 18, TypeScript, React Router, Vitest, Testing Library, browser localStorage, existing ATLAS shell and session architecture.

**Spec:** `docs/superpowers/specs/2026-09-11-atlas-inclusive-communication-design.md`

## Global Constraints

- Reuse the existing `apps/web` shell and route graph; do not create a parallel application.
- Do not persist camera or microphone recordings.
- Do not mark ASL recognition, ASL avatar, Braille hardware or human interpreter integrations as live without verified providers/devices.
- Use confidence thresholds exactly as specified: high `> 0.98`, medium `0.74–0.98`, low `< 0.74`.
- Sensitive downstream actions remain subject to module-level RBAC and confirmation.
- Keep current Finance, Health, Studio and identity behavior intact.

---

### Task 1: Confidence and profile domain

**Files:**
- Create: `apps/web/src/types/accessibility.ts`
- Create: `apps/web/src/services/AtlasConfidenceEngine.ts`
- Create: `apps/web/src/services/accessibilityProfile.ts`
- Test: `tests/unit/accessibility-confidence.test.ts`
- Test: `tests/unit/accessibility-profile.test.ts`

**Interfaces:**
- Produces: `AccessibilityProfile`, `AccessibilityInputMode`, `AccessibilityOutputMode`, `AccessibilityCapabilityState`.
- Produces: `AtlasConfidenceEngine.evaluate(score): ConfidenceEvaluation`.
- Produces: `defaultAccessibilityProfile(userId)`, `loadAccessibilityProfile(userId)`, `saveAccessibilityProfile(profile)`.

- [ ] **Step 1: Write failing confidence tests**

Test exact threshold behavior: `0.99` autonomous, `0.98` confirmation, `0.74` confirmation, `0.739` blocked, and invalid values rejected.

- [ ] **Step 2: Verify confidence tests fail because the service does not exist**

Run: `npm test -- tests/unit/accessibility-confidence.test.ts`

Expected: FAIL due to missing `AtlasConfidenceEngine` module.

- [ ] **Step 3: Implement strict accessibility types and confidence engine**

Implement normalized score validation and the exact three-level policy.

- [ ] **Step 4: Write failing profile persistence tests**

Cover defaults, save/load roundtrip, per-user key isolation, and corrupt-storage fallback.

- [ ] **Step 5: Verify profile tests fail**

Run: `npm test -- tests/unit/accessibility-profile.test.ts`

- [ ] **Step 6: Implement browser profile persistence**

Use a versioned localStorage key `atlas_accessibility_profile:v1:<userId>`. Store only functional preferences.

- [ ] **Step 7: Run Task 1 tests**

Run: `npm test -- tests/unit/accessibility-confidence.test.ts tests/unit/accessibility-profile.test.ts`

Expected: PASS.

### Task 2: Universal accessibility component

**Files:**
- Create: `apps/web/src/components/AtlasAccessibility.tsx`
- Create: `apps/web/src/accessibility.css`
- Test: `tests/integration/atlas-accessibility-shell.test.tsx`

**Interfaces:**
- Consumes: `AccessibilityProfile`, `AtlasConfidenceEngine`.
- Produces: `AtlasAccessibility` with props `initialProfile`, `onProfileChange`, `onActionTriggered`, optional capability overrides.

- [ ] **Step 1: Write failing component tests**

Verify launcher exists, modal opens, truthful provider status appears, medium confidence requires confirmation, low confidence blocks execution, and settings navigation is present.

- [ ] **Step 2: Verify tests fail because the component does not exist**

Run: `npm test -- tests/integration/atlas-accessibility-shell.test.tsx`

- [ ] **Step 3: Implement minimal component**

Use a keyboard-reachable launcher, `role="dialog"`, `aria-modal`, `aria-live` interpretation region, focusable controls, explicit capability status cards, and no fake avatar/camera/live listening claims.

- [ ] **Step 4: Implement typed interpretation input boundary**

Expose a safe internal handler that accepts recognized text + confidence + sensitivity flag. High confidence executes only non-sensitive actions; medium requires confirmation; low blocks.

- [ ] **Step 5: Run Task 2 tests**

Run: `npm test -- tests/integration/atlas-accessibility-shell.test.tsx`

Expected: PASS.

### Task 3: Communication settings route

**Files:**
- Create: `apps/web/src/modules/settings/AccessibilityCommunicationSettings.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/AtlasShell.tsx`
- Test: `tests/integration/accessibility-settings-route.test.tsx`

**Interfaces:**
- Consumes: `AccessibilityProfile` and profile persistence helpers.
- Produces route `/settings/accessibility/communication`.

- [ ] **Step 1: Write failing route test**

Render the app at `/settings/accessibility/communication`, assert the page heading and labeled controls, change captions/high-contrast/text-size settings, and assert persistence through the profile service.

- [ ] **Step 2: Verify route test fails**

Run: `npm test -- tests/integration/accessibility-settings-route.test.tsx`

- [ ] **Step 3: Implement settings page**

Use typed selects and checkboxes, add explanations for provider/device-dependent modes, and avoid asking for diagnoses.

- [ ] **Step 4: Register global Settings navigation and route**

Add a `Settings` item to the existing shell navigation and route the communication page through `App.tsx`.

- [ ] **Step 5: Run Task 3 test**

Run: `npm test -- tests/integration/accessibility-settings-route.test.tsx`

Expected: PASS.

### Task 4: Mount the universal layer in AtlasShell

**Files:**
- Modify: `apps/web/src/components/AtlasShell.tsx`
- Modify: `apps/web/src/styles.css`
- Test: `tests/integration/atlas-accessibility-shell.test.tsx`
- Test: existing route tests under `tests/integration`

**Interfaces:**
- Consumes: profile helpers and `AtlasAccessibility`.
- Produces: one persistent cross-route accessibility layer.

- [ ] **Step 1: Extend failing shell test to navigate between modules**

Confirm the launcher remains present after route navigation and profile changes remain loaded.

- [ ] **Step 2: Mount `AtlasAccessibility` once in `AtlasShell`**

Load the current local profile at shell initialization, update it through the component, and emit browser `CustomEvent('atlas-accessibility-action')` events instead of `console.log` placeholders.

- [ ] **Step 3: Apply global accessibility presentation state**

Apply high-contrast, reduced-motion, text-scale and screen-reader optimization classes/data attributes to the shell without breaking existing styles.

- [ ] **Step 4: Run shell + existing route tests**

Run: `npm run test:integration`

Expected: PASS.

### Task 5: Full verification and provider boundary audit

**Files:**
- Modify only if verification exposes defects.

- [ ] **Step 1: Run unit tests**

Run: `npm run test:unit`

Expected: PASS.

- [ ] **Step 2: Run integration tests**

Run: `npm run test:integration`

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 4: Run production build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Audit truthfulness**

Search the implementation for simulated claims such as `Render Active`, `Escuchando canal`, `connected`, `live`, or fake provider/device success. Any external feature without verified integration must remain `not_configured` or `unavailable`.

- [ ] **Step 6: Commit coherent implementation and open a PR to `main`**

PR description must separate implemented capabilities from external dependencies still required for ASL recognition, avatar rendering, Braille hardware and human interpreter services.