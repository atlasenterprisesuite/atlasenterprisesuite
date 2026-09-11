# ATLAS Assistant Avatar + Voice Design

## Status
Approved in chat on 2026-09-11. This document defines the canonical design for the authenticated ATLAS Assistant experience that uses the approved 3D avatar as the visible assistant identity inside ATLAS Enterprise Suite.

## Goal
When an authorized user signs in to ATLAS, the product should present a persistent ATLAS Assistant represented by the approved 3D avatar. The assistant must be able to greet the user, expose truthful listening/speaking capability states, understand current route/module context, and execute only actions permitted by the authenticated ATLAS identity, organization membership, RBAC boundary, and connected provider capabilities.

## Current verified foundation
- `ATLAS Identity` already authenticates through Supabase and validates an active organization membership before protected routes continue.
- `/studio/voice` is already protected by `RequireAtlasIdentity`.
- `ATLAS Voice Studio` already states that voice generation, streaming, telephony, export, and native Personal Voice must not be represented as connected until a real provider or native bridge is verified.
- `AtlasShell` is the shared global application shell and is the correct integration point for a persistent assistant surface.

## Scope
This feature adds one authenticated ATLAS Assistant surface across the web application, beginning with:

1. Product-ready avatar asset in the canonical web app.
2. Persistent assistant launcher in `AtlasShell` on desktop, tablet, and mobile.
3. Expandable assistant panel with route-aware context.
4. Greeting flow after successful identity and organization validation.
5. Capability state model for text, microphone input, speech output, streaming, and optional native Personal Voice.
6. Strict authorization boundaries for any action request.
7. Audit-friendly action handoff contract for modules that later expose executable assistant actions.
8. Accessibility behavior aligned with ATLAS Inclusive Communication principles.

## Non-goals for this milestone
- Do not claim telephony, native Apple Personal Voice, wake-word background listening, autonomous financial execution, clinical decision execution, or unrestricted cross-tenant actions.
- Do not fabricate connected provider states.
- Do not replace existing module UIs with chat-only workflows.
- Do not add an unrestricted agent capable of arbitrary browser or infrastructure actions from the client.

## Visual identity
The approved asset is the glossy 3D designer-toy ATLAS avatar generated on 2026-09-11: one male floating head, long sculpted wavy hair, beard, oversized blue wraparound sunglasses, ATLAS emblem, subtle Venezuelan identity detail, and transparent background for in-product use.

Canonical target path:

`apps/web/public/atlas/assistant/atlas-assistant-avatar.png`

The same image is used for:
- global assistant launcher;
- assistant panel header;
- optional login/session-success greeting treatment;
- ATLAS Voice Studio assistant identity card.

The formal executive portrait remains separate from this feature and is not substituted for the in-product assistant avatar.

## Architecture

### 1. Global assistant shell
Add `AtlasAssistant` to `AtlasShell` so it is mounted once and survives route changes.

Responsibilities:
- show avatar launcher;
- manage expanded/collapsed panel state;
- observe current route;
- display capability state;
- dispatch text/voice requests through a single assistant runtime interface;
- never bypass route-level authorization.

### 2. Assistant runtime boundary
Create a focused client module that separates UI from capability and authorization logic.

Proposed interface:

```ts
export type AtlasAssistantCapability =
  | 'text'
  | 'microphone'
  | 'speech-output'
  | 'streaming'
  | 'native-personal-voice';

export type AtlasCapabilityState = 'ready' | 'permission-required' | 'configuration-required' | 'unavailable';

export type AtlasAssistantContext = {
  pathname: string;
  organizationId: string;
  role: string;
};

export type AtlasAssistantRequest = {
  input: string;
  modality: 'text' | 'voice';
  context: AtlasAssistantContext;
};
```

The UI consumes capability states; it does not infer them from visual conditions.

### 3. Identity and organization source of truth
Reuse the existing Supabase-backed session helpers. The assistant must not create a parallel authentication state.

Before any assistant request that can access protected organization data:
- resolve the active ATLAS organization;
- include the authenticated organization id and role in the request context;
- reject requests if the session is expired, invalid, or has no active organization.

### 4. Route context
The assistant receives the current `pathname` from React Router. Route context is descriptive, not authorization.

Examples:
- `/finance/accounting/accounts-payable` -> assistant may explain or query AP only through approved AP data interfaces.
- `/health/...` -> assistant must preserve existing research/clinical boundaries.
- `/studio/voice` -> assistant may expose voice capability controls.

The current route must never expand privileges.

## Assistant state model

UI state:
- `closed`
- `idle`
- `thinking`
- `listening`
- `speaking`
- `error`

Rules:
- `listening` is shown only after browser microphone permission is granted and real capture is active.
- `speaking` is shown only while a verified speech-output provider or supported browser/native mechanism is actively producing output.
- `thinking` is used only after a request has been accepted by the runtime.
- failure returns to `idle` after a visible error message; it must not silently continue.

## Voice capability contract

### Browser microphone
Use browser media APIs only when available and after explicit user permission.

Capability mapping:
- API unsupported -> `unavailable`
- API supported, no permission -> `permission-required`
- permission granted and capture verified -> `ready`

### Speech output
This milestone must support truthful provider selection. If no real provider is configured, show `configuration-required` and keep text assistant behavior available.

### Native Personal Voice
The web client must continue to report this as unavailable unless running through the separately verified native ATLAS Apple bridge on supported hardware.

## Greeting behavior
After ATLAS Identity validates both session and active organization, the assistant may present a one-time greeting per browser session.

Default web-safe behavior:
- avatar appears immediately;
- text greeting is allowed;
- spoken greeting occurs only if speech output is verified ready and user settings permit it;
- no automatic microphone activation.

The greeting should be concise and contextual, for example by naming the active ATLAS workspace without exposing sensitive organization data unnecessarily.

## Action authorization model
Assistant responses and executable actions are different capabilities.

Every executable action must pass through a typed module action adapter with:
- action id;
- organization id;
- required permission;
- input schema;
- confirmation requirement;
- execution result;
- audit metadata.

The first milestone may expose zero mutating actions and still be complete. Read-only contextual assistance is preferred until each module action adapter is separately verified.

The assistant must never:
- infer permission from UI visibility;
- use organization ids supplied only by free-form model text;
- execute a mutation because the model suggested it;
- bypass an existing module confirmation or approval workflow.

## Data and privacy
- Reuse existing Supabase session and RLS boundaries.
- Do not persist raw microphone audio by default.
- Do not log passwords, access tokens, refresh tokens, or secrets.
- Conversation persistence is out of scope unless a governed storage contract is added later.
- Any future persisted transcript must be tenant-scoped and covered by explicit retention rules.

## Accessibility
The assistant must not depend on voice alone.

Required equivalents:
- all spoken output has visible text;
- all voice controls have keyboard-accessible controls and labels;
- microphone state has text and non-audio status indication;
- assistant can operate fully in text mode;
- reduced-motion preference disables nonessential avatar animation;
- screen readers receive state changes through appropriate live regions;
- speech output can be disabled independently of text assistance.

## UI behavior

### Desktop
- circular or softly squared avatar launcher anchored to the lower workspace edge without covering critical table actions;
- expanded panel overlays the workspace rather than changing route layout;
- panel includes avatar, state label, transcript/messages, input, microphone control, and close/minimize control.

### Tablet/mobile
- launcher remains reachable above safe-area insets;
- expanded panel uses a near-full-width sheet;
- touch targets meet mobile accessibility sizing;
- no hover-only controls.

## Styling
Reuse the existing ATLAS dark-blue shell, gradients, borders, and cyan accent language. Do not introduce a separate visual system.

Avatar animation is optional and limited to subtle state treatments such as glow/pulse around the launcher. The first implementation must not fake lip-sync.

## Error handling
Required user-visible cases:
- session expired;
- no active organization;
- microphone unsupported;
- microphone permission denied;
- voice provider not configured;
- voice provider unavailable;
- assistant request failed;
- action not authorized;
- action requires confirmation.

No error path may leave the assistant visually stuck in `listening`, `thinking`, or `speaking`.

## Testing strategy

### Unit
- capability mapping from browser/provider state;
- assistant UI state transitions;
- route context mapping;
- greeting session guard;
- action authorization preconditions.

### Integration
- authenticated user with active organization can open assistant;
- unauthenticated/expired session cannot issue protected assistant requests;
- `/studio/voice` remains identity-gated;
- assistant survives route navigation through `AtlasShell`;
- denied microphone permission never displays `listening`;
- unavailable speech provider never displays `speaking`;
- mobile layout does not cover primary navigation or critical controls.

### Regression
Run the canonical verification gate:

`npm run verify:cloudflare`

The feature is not production-ready unless typecheck, unit tests, integration tests, audit gate, and production build pass.

## Rollout

### Phase 1 — visual + text runtime foundation
- add approved avatar asset;
- add global launcher/panel;
- connect current route and authenticated organization context;
- implement text-only assistant contract and truthful capability states.

### Phase 2 — browser voice
- microphone permission/capture;
- verified speech-output provider or supported browser mechanism;
- greeting speech when ready;
- no wake-word or background recording.

### Phase 3 — governed module actions
Add typed action adapters one module at a time, beginning with low-risk/read-only actions. Mutations require explicit permission and confirmation contracts.

## Acceptance criteria
The milestone passes when all of the following are verified:

1. The approved avatar is loaded from the canonical app, not from a temporary external URL.
2. The assistant is visible from authenticated ATLAS workspaces and persists across route changes.
3. The assistant uses the active Supabase-backed organization context rather than a demo hard-coded tenant for protected requests.
4. Text assistant mode works even when voice is unavailable.
5. Microphone and speech states are truthful and permission/provider-driven.
6. No microphone is activated automatically at login.
7. No unsupported native Personal Voice capability is claimed in the web app.
8. Action execution is denied unless a typed adapter and permission contract explicitly allow it.
9. Desktop, tablet, and mobile layouts are usable and accessible.
10. `npm run verify:cloudflare` passes before any production claim.
11. Production deployment is separately verified before describing the feature as live on `atlasenterprisesuite.com`.
