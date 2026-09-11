# ATLAS Inclusive Communication — Design

## Purpose

ATLAS Inclusive Communication is a cross-suite accessibility capability owned by ATLAS Connect. It makes communication preferences and assistive interaction available throughout the existing ATLAS web shell without creating a parallel application.

The initial production-safe milestone provides the universal accessibility shell, per-user functional preferences, confidence-gated interpretation behavior, a communication settings route, explicit provider capability states, and integration contracts for future ASL recognition, ASL avatar rendering, captions, haptics, Braille hardware and human interpreters.

## Principles

1. ATLAS adapts to the user's functional communication preference; users are not required to disclose a medical diagnosis.
2. No external capability is presented as live unless a real provider/device is configured and verified.
3. Sign-language interpretation uncertainty must be visible and must gate sensitive actions.
4. Accessibility functionality is cross-suite infrastructure and must remain available while navigating Finance, Health, Studio and future modules.
5. Existing ATLAS authentication, tenant boundaries and application shell remain authoritative.
6. The first milestone must not persist camera or microphone recordings.

## Architecture

### Universal shell

`AtlasAccessibility` is mounted inside the existing `AtlasShell` so its launcher, captions surface and accessibility state remain present across routes.

### Profile model

`AccessibilityProfile` stores functional preferences only:

- `userId`
- `preferredInput`: `asl | voice | text | braille | haptic`
- `preferredOutput`: `text | asl_avatar | voice | braille`
- `captionsEnabled`
- `brailleMode`
- `hapticIntensity`: `off | low | medium | high`
- `screenReaderOptimized`
- `motionReduced`
- `highContrast`
- `textSizeScale`

The browser stores a local preference snapshot keyed by the authenticated user id when available, otherwise a neutral local profile id. A later Supabase-backed profile may synchronize the same contract once a dedicated table and RLS policy are deployed. This milestone must not fabricate server persistence when it is unavailable.

### Capability state

External capabilities have explicit state: `available`, `unavailable`, or `not_configured`.

Initial defaults:

- Live captions: browser-dependent and may be unavailable until a speech provider is connected.
- ASL recognition: `not_configured` until a real vision/recognition adapter is connected.
- ASL avatar: `not_configured` until a verified renderer/provider exists.
- Braille hardware: `unavailable` unless browser/device capability detection proves otherwise.
- Human interpreter: `not_configured` until a real escalation provider is connected.

### Confidence engine

`AtlasConfidenceEngine.evaluate(score)` enforces a normalized score from 0 to 1:

- `score > 0.98`: autonomous execution may proceed for non-sensitive actions.
- `0.74 <= score <= 0.98`: require explicit confirmation.
- `score < 0.74`: block automated execution and offer clarification or human escalation.

Sensitive actions must remain confirmation-gated even when confidence is high; downstream modules remain responsible for their own RBAC and authorization checks.

### Settings route

Global route: `/settings/accessibility/communication`.

The route edits functional preferences without asking the user to declare a disability or diagnosis. Controls must be labeled, keyboard-operable and compatible with screen readers. Unsupported device-dependent choices remain visible with an unavailable/not-configured explanation instead of pretending activation succeeded.

### Action boundary

`AtlasAccessibility` emits typed accessibility actions rather than logging to the console:

- `ACCESSIBILITY_PROFILE_UPDATED`
- `ACCESSIBILITY_CONFIRM_INTERPRETATION`
- `ACCESSIBILITY_INTERPRETATION_BLOCKED`
- `ACCESSIBILITY_ESCALATE_HUMAN`
- `ACCESSIBILITY_CAPTIONS_REQUESTED`

The shell owns the cross-suite event boundary. Business modules decide whether a requested operation is allowed and must continue to enforce their own RBAC, tenancy and validation.

## UI behavior

The global launcher remains fixed and keyboard reachable. Opening it produces a modal dialog with:

- current communication mode;
- provider/capability status;
- transcript/interpretation region with `aria-live`;
- confidence status;
- confirmation controls when required;
- navigation to Communication Settings;
- close control with proper dialog semantics.

A captions surface appears only when captions are enabled. It must not claim to be listening if there is no connected speech provider; instead it displays a truthful configuration state.

## Privacy and safety

- Camera and microphone access are not requested by default.
- No audio/video recording is persisted in this milestone.
- The component must never claim a human interpreter is connected when no provider exists.
- Braille and haptic capabilities must be capability-checked.
- Sensitive actions remain subject to module-level authorization, regardless of confidence score.
- Confidence values and interpretation text are transient UI state unless a future audited persistence contract is explicitly introduced.

## Testing

Required tests cover:

1. Confidence thresholds and invalid scores.
2. Profile defaults and local persistence.
3. Global launcher/modal rendering across the shell.
4. Medium-confidence interpretation requiring confirmation.
5. Low-confidence interpretation blocking execution and exposing escalation.
6. Settings route renders and updates preferences.
7. Unsupported capabilities render truthful states.
8. Existing Finance/Health/Studio routes remain reachable.

## Out of scope for this milestone

- Production ASL computer-vision model.
- Production 3D sign-language avatar renderer.
- Human interpreter marketplace/provider connection.
- Clinical interpretation or medical decision automation.
- Persisting raw camera/microphone data.
- Claiming complete refreshable-Braille hardware support without device validation.

These capabilities will plug into the interfaces created here and must be separately verified before production status changes from `not_configured`/`unavailable` to `available`.