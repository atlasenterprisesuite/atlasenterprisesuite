# ATLAS Inclusive Communication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add and validate a production-safe universal accessibility layer in the existing ATLAS web shell with functional communication preferences, language-specific sign-language selection, confidence gating, truthful provider/device states, WCAG automation, and evidence gates for assistive technology, hardware and human validation.

**Architecture:** Extend the existing React/Vite `apps/web` application and mount `AtlasAccessibility` once in the current `AtlasShell`. Reuse `atlas_user_preferences` for authenticated profile persistence. Keep provider/device-dependent sign-language recognition/avatar, Braille and interpreter capabilities behind explicit capability states. Use a provenance-controlled sign-language research registry and never infer a sign language from country or spoken language.

**Tech Stack:** React 18, TypeScript, React Router, Vitest, Testing Library, Supabase REST/RLS, browser local cache, GitHub Actions, axe-core CLI.

**Spec:** `docs/superpowers/specs/2026-09-11-atlas-inclusive-communication-design.md`

**Validation protocol:** `docs/validation/atlas-inclusive-communication-validation.md`

## Global Constraints

- Reuse the existing `apps/web` shell and route graph; do not create a parallel application.
- Do not persist camera or microphone recordings in this milestone.
- Do not mark sign-language recognition/avatar, Braille hardware or human interpreter integrations as live without verified providers/devices.
- Use confidence thresholds exactly: high `>= 0.98`, medium `>= 0.74 && < 0.98`, low `< 0.74`.
- A high-confidence interpretation may auto-execute only when the requested action is non-sensitive.
- Sensitive downstream actions always remain confirmation-, RBAC-, tenant- and authorization-gated.
- `preferredSignLanguage` is explicit and stores a language identifier; never derive it from locale, country or spoken language.
- A sign language present in the research registry remains `research_only` until provider, linguistic and Deaf-community evidence exists.
- Browser API presence is not evidence that a physical assistive device is connected.
- Keep current Finance, Health, Studio and identity behavior intact.
- No production-ready claim is allowed without fresh execution evidence.

---

### Task 1: Confidence and profile domain

**Files:**
- `apps/web/src/types/accessibility.ts`
- `apps/web/src/services/AtlasConfidenceEngine.ts`
- `apps/web/src/services/accessibilityProfile.ts`
- `tests/unit/accessibility-confidence.test.ts`
- `tests/unit/accessibility-profile.test.ts`

**Required behavior:**

- `0.98` and above is high confidence.
- `0.74` through below `0.98` requires confirmation.
- below `0.74` blocks automation.
- invalid normalized scores throw.
- profile defaults do not infer a sign language.
- explicit `preferredSignLanguage` round-trips through local cache and authenticated preferences.
- `atlas_user_preferences.preferences` keys unrelated to accessibility survive every update.
- `default_org_id` is preserved so existing RLS membership checks remain effective.

**Verification command:**

```bash
npx vitest run tests/unit/accessibility-confidence.test.ts tests/unit/accessibility-profile.test.ts
```

---

### Task 2: Universal accessibility component

**Files:**
- `apps/web/src/components/AtlasAccessibility.tsx`
- `apps/web/src/accessibility.css`
- `tests/integration/atlas-accessibility-shell.test.tsx`

**Required behavior:**

- keyboard-reachable global launcher;
- modal dialog with `aria-modal`, named heading and `aria-live` interpretation status;
- focus enters the modal, remains contained while open, closes with Escape, and returns to launcher;
- capability labels are sign-language agnostic;
- selected sign-language code is included in interpretation/escalation action payloads;
- provider states are truthful;
- medium confidence requires confirmation;
- low confidence blocks execution;
- sensitive actions require confirmation even at high confidence;
- no fake avatar/camera/listening/interpreter state.

**Verification command:**

```bash
npx vitest run tests/integration/atlas-accessibility-shell.test.tsx
```

---

### Task 3: Communication settings and authenticated persistence

**Files:**
- `apps/web/src/modules/settings/AccessibilityCommunicationSettings.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/components/AtlasShell.tsx`
- `tests/integration/accessibility-settings-route.test.tsx`

**Required behavior:**

- route `/settings/accessibility/communication`;
- labeled controls for input/output, explicit sign language, captions, text scale, contrast, motion, screen-reader optimization, Braille preference and haptics;
- sign-language selector is populated from the research registry and does not infer a choice;
- local cache works without authentication;
- authenticated sessions synchronize through `atlas_user_preferences` under existing RLS;
- UI reports local-only/saving/synced/failed status truthfully.

**Verification command:**

```bash
npx vitest run tests/integration/accessibility-settings-route.test.tsx tests/unit/accessibility-profile.test.ts
```

---

### Task 4: International sign-language research registry

**Files:**
- `data/accessibility/sign-languages.ts`
- `tests/unit/sign-language-registry.test.ts`

**Required behavior:**

- ISO 639-3 identifier per seeded language;
- multiple sign languages may map to one country/territory;
- country is a discovery dimension only;
- all seed entries remain `research_only` and `deafCommunityValidated: false`;
- provenance uses verified registry-level sources rather than fabricated per-language URLs;
- legal recognition must never be interpreted as ATLAS model readiness.

**Verification command:**

```bash
npx vitest run tests/unit/sign-language-registry.test.ts
```

---

### Task 5: Hardware/API truthfulness boundary

**Files:**
- `apps/web/src/services/accessibilityDeviceCapabilities.ts`
- `tests/unit/accessibility-device-capabilities.test.ts`

**Required behavior:**

- probe only browser API surface for `getUserMedia`, vibration, WebHID and WebBluetooth;
- never request permissions during a capability probe;
- never enumerate or pair devices during a capability probe;
- API presence returns `api_available_unverified`, not `available` or `connected`;
- missing API returns `unavailable`.

**Verification command:**

```bash
npx vitest run tests/unit/accessibility-device-capabilities.test.ts
```

Physical camera/audio, Braille and haptic validation remains a separate external evidence gate.

---

### Task 6: WCAG automated validation gate

**Files:**
- `.github/workflows/accessibility-validation.yml`
- `tests/integration/accessibility-validation-contract.test.ts`
- `docs/validation/atlas-inclusive-communication-validation.md`

**Required behavior:**

- locked dependency install;
- TypeScript and production build before browser audit;
- production preview server;
- axe-core CLI pinned to an explicit version;
- WCAG 2.2 A/AA tags included;
- `--exit` converts accessibility violations into CI failure;
- audit core routes including Communication Settings;
- run focused confidence/profile/device/registry/component/settings validation tests;
- automated scan is documented as necessary but insufficient for full conformance.

**Verification command:**

```bash
npx vitest run tests/integration/accessibility-validation-contract.test.ts
```

**CI evidence command:** execute the `ATLAS Accessibility Validation` workflow and inspect every step/result. A workflow that fails before steps start is infrastructure failure and does not count as an accessibility result.

---

### Task 7: Manual assistive-technology, hardware and human evidence

**Protocol:** `docs/validation/atlas-inclusive-communication-validation.md`

Required real-world matrix:

- VoiceOver on iOS and macOS;
- TalkBack on Android;
- NVDA and JAWS on Windows;
- keyboard-only critical flows;
- physical refreshable Braille device(s), documenting manufacturer/model/firmware;
- camera/microphone capture after a real recognition/caption provider exists;
- real haptic discrimination testing on supported devices;
- Deaf, hard-of-hearing, blind, low-vision and DeafBlind participant pilots;
- language-specific signer cohorts before enabling a sign language in production;
- real interpreter handoff tests after a provider is configured.

For every result capture environment/version, task, pass/fail, defect severity and evidence reference.

Statuses requiring unavailable external resources must remain `BLOCKED_EXTERNAL`, not be silently converted to PASS or FAIL.

---

### Task 8: Full verification and release boundary

Run from repository root:

```bash
npm ci
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

Then execute the `ATLAS Accessibility Validation` workflow and inspect its step-level evidence.

Before merge/deploy, audit for fake claims such as `connected`, `live`, `listening`, `render active`, fabricated interpreter state, or unsupported device success. Any external feature without verified integration must remain `not_configured`, `unavailable`, `api_available_unverified`, `research_only`, `PENDING` or `BLOCKED_EXTERNAL` as applicable.

Only after fresh validation evidence may the PR leave draft status and proceed through the normal ATLAS merge/deployment approval boundary.
