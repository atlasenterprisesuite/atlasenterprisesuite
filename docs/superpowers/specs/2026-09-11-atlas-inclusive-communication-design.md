# ATLAS Inclusive Communication — Design

## Purpose

ATLAS Inclusive Communication is a cross-suite accessibility capability owned by ATLAS Connect. It makes communication preferences and assistive interaction available throughout the existing ATLAS web shell without creating a parallel application.

The initial production-safe milestone provides the universal accessibility shell, per-user functional preferences, confidence-gated interpretation behavior, a communication settings route, explicit provider capability states, an international sign-language research registry, and integration contracts for future sign-language recognition/avatar rendering, captions, haptics, Braille hardware and human interpreters.

## Principles

1. ATLAS adapts to the user's functional communication preference; users are not required to disclose a medical diagnosis.
2. No external capability is presented as live unless a real provider/device is configured and verified.
3. Sign-language interpretation uncertainty must be visible and must gate sensitive actions.
4. Accessibility functionality is cross-suite infrastructure and must remain available while navigating Finance, Health, Studio and future modules.
5. Existing ATLAS authentication, tenant boundaries and application shell remain authoritative.
6. The first milestone must not persist camera or microphone recordings.
7. Sign languages are distinct natural languages. ATLAS must never infer a person's sign language from country, locale or spoken language.
8. A researched language is not a supported language until its provider/model, linguistic behavior and Deaf-community validation are evidenced.

## Architecture

### Universal shell

`AtlasAccessibility` is mounted inside the existing `AtlasShell` so its launcher, captions surface and accessibility state remain present across routes.

### Profile model

`AccessibilityProfile` stores functional preferences only:

- `userId`
- `preferredInput`: `asl | voice | text | braille | haptic` (`asl` remains an internal compatibility key meaning sign-language input)
- `preferredOutput`: `text | asl_avatar | voice | braille` (`asl_avatar` remains an internal compatibility key meaning sign-language avatar output)
- `preferredSignLanguage`: explicitly selected ISO 639-3 code or `null`; never inferred
- `captionsEnabled`
- `brailleMode`
- `hapticIntensity`: `off | low | medium | high`
- `screenReaderOptimized`
- `motionReduced`
- `highContrast`
- `textSizeScale`

When an ATLAS session is authenticated, the existing Supabase `public.atlas_user_preferences` table is the account-level source of truth. Accessibility preferences are namespaced under `preferences.accessibilityCommunication` so unrelated user preferences are preserved. The existing table already uses `user_id` as its primary key and RLS restricts SELECT/INSERT/UPDATE to the authenticated user. No duplicate accessibility table is introduced.

The browser also stores a versioned local snapshot keyed by user id. That local copy is a cache/offline fallback and is the only persistence used when no authenticated ATLAS session exists.

### Sign-language research registry

`data/accessibility/sign-languages.ts` is a provenance-controlled discovery and rollout registry. It supports multiple languages per country/territory and keeps every seeded language at `productStatus: research_only` with `deafCommunityValidated: false`.

The registry is not a declaration of model support. Country is a discovery dimension only. Production enablement is language-specific and requires verified linguistic/provider evidence plus Deaf-community validation.

### Capability state

External capabilities have explicit state: `available`, `unavailable`, or `not_configured`.

Initial defaults:

- Live captions: `not_configured` until a verified speech provider is connected.
- Sign-language recognition: `not_configured` until a real adapter validated for the selected sign language is connected.
- Sign-language avatar: `not_configured` until a renderer validated for the selected sign language exists.
- Braille hardware: `unavailable` unless browser/device capability and physical-device validation prove otherwise.
- Human interpreter: `not_configured` until a real escalation provider is connected.

### Confidence engine

`AtlasConfidenceEngine.evaluate(score)` enforces a normalized score from 0 to 1:

- `score >= 0.98`: autonomous execution may proceed for **non-sensitive** actions.
- `0.74 <= score < 0.98`: require explicit confirmation.
- `score < 0.74`: block automated execution and offer clarification or human escalation when a real provider exists.

Sensitive actions remain confirmation-gated even when confidence is high; downstream modules remain responsible for their own RBAC, tenancy and authorization checks.

### Settings route

Global route: `/settings/accessibility/communication`.

The route edits functional preferences without asking the user to declare a disability or diagnosis. It includes explicit sign-language selection populated from the research registry. Controls must be labeled, keyboard-operable and compatible with screen readers. Unsupported device-dependent choices remain visible with an unavailable/not-configured explanation instead of pretending activation succeeded.

The page saves optimistically to the local cache and synchronizes through the authenticated Supabase REST/RLS boundary when a session exists. The UI reports whether preferences are synchronized, local-only, saving or temporarily unable to sync.

### Action boundary

`AtlasAccessibility` emits typed accessibility actions rather than logging to the console:

- `EXECUTE_ACCESSIBILITY_ACTION`
- `ACCESSIBILITY_PROFILE_UPDATED`
- `ACCESSIBILITY_CONFIRM_INTERPRETATION`
- `ACCESSIBILITY_INTERPRETATION_BLOCKED`
- `ACCESSIBILITY_ESCALATE_HUMAN`
- `ACCESSIBILITY_CAPTIONS_REQUESTED`

Interpretation/execution/escalation payloads include the explicitly selected sign-language code when applicable. The shell owns the cross-suite event boundary. Business modules decide whether a requested operation is allowed and must continue to enforce their own RBAC, tenancy and validation.

## UI behavior

The global launcher remains fixed and keyboard reachable. Opening it produces a modal dialog with:

- current communication mode;
- explicitly selected sign language when present;
- provider/capability status;
- transcript/interpretation region with `aria-live`;
- confidence status;
- confirmation controls when required;
- navigation to Communication Settings;
- keyboard focus containment, Escape close and focus return to the launcher.

A captions surface appears only when captions are enabled. It must not claim to be listening if there is no connected speech provider; instead it displays a truthful configuration state.

## Privacy and safety

- Camera and microphone access are not requested by default.
- No audio/video recording is persisted in this milestone.
- The component must never claim a human interpreter is connected when no provider exists.
- Braille and haptic capabilities must be capability-checked and then physically validated before production claims.
- Sensitive actions remain subject to module-level authorization, regardless of confidence score.
- Accessibility profile data is limited to functional preferences and stored through the existing user-preferences RLS boundary when authenticated.
- Confidence values and interpretation text remain transient UI state and are not persisted by this milestone.

## Validation architecture

The validation protocol lives at `docs/validation/atlas-inclusive-communication-validation.md` and is divided into four evidence layers:

1. automated WCAG 2.2 AA audit, keyboard and named screen-reader validation;
2. confidence-engine, profile-persistence, RLS and authorization validation;
3. physical camera/audio, Braille and haptic validation;
4. human pilot validation under the principle “Nothing About Us Without Us.”

`.github/workflows/accessibility-validation.yml` adds an axe-based automated gate and focused accessibility tests. Automated scans are a gate, not a substitute for assistive-technology or human testing.

## Testing

Required automated tests cover:

1. confidence thresholds and invalid scores, including `0.98` as high confidence;
2. profile defaults, explicit sign-language preference and local persistence;
3. preservation of unrelated `atlas_user_preferences.preferences` keys when accessibility settings are merged;
4. global launcher/modal rendering across the shell;
5. keyboard focus containment and focus return;
6. medium-confidence interpretation requiring confirmation;
7. low-confidence interpretation blocking execution and exposing escalation;
8. Settings route renders and updates preferences;
9. unsupported capabilities render truthful states;
10. international registry invariants, including countries with multiple sign languages;
11. automated validation-pipeline contract;
12. existing Finance/Health/Studio routes remain reachable.

## Out of scope for this milestone

- Production computer-vision recognition for any sign language.
- Production 3D sign-language avatar renderer.
- Human interpreter marketplace/provider connection.
- Clinical interpretation or medical decision automation.
- Persisting raw camera/microphone data.
- Claiming complete refreshable-Braille hardware support without device validation.
- Claiming a language is production-supported merely because it is present in the research registry or legally recognized.

These capabilities plug into the interfaces created here and must be separately verified before production status changes from `not_configured`/`unavailable` to `available` or a language advances beyond `research_only`.
