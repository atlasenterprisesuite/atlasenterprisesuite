# ATLAS Assistant Avatar + Voice Design

## Status
Approved in chat on 2026-09-11 and self-reviewed against the current canonical repository. This document defines the canonical design for the authenticated ATLAS Assistant experience that uses the approved 3D avatar as the visible assistant identity inside ATLAS Enterprise Suite.

## Goal
When an authorized user signs in to ATLAS, the product should present a persistent ATLAS Assistant represented by the approved 3D avatar. The assistant must be able to greet the user, expose truthful listening/speaking capability states, understand current route/module context, and execute only actions permitted by the authenticated ATLAS identity, organization membership, RBAC boundary, and connected provider capabilities.

## Current verified foundation
- `ATLAS Identity` already authenticates through Supabase and validates an active organization membership before protected routes continue.
- `/studio/voice` is already protected by `RequireAtlasIdentity`.
- `ATLAS Voice Studio` already states that voice generation, streaming, telephony, export, and native Personal Voice must not be represented as connected until a real provider or native bridge is verified.
- `AtlasShell` is the shared global application shell and is the correct integration point for a persistent assistant surface.
- `supabase/functions/atlas-copilot` already provides the governed ATLAS intelligence runtime using authenticated organization/user context, the `intelligence.use` permission, provider readiness probes, the OpenAI Responses API adapter, and tenant/user-scoped conversation storage.

## Scope
This feature adds one authenticated ATLAS Assistant surface across the web application, beginning with:

1. Product-ready avatar asset in the canonical web app.
2. Persistent assistant launcher in `AtlasShell` on desktop, tablet, and mobile.
3. Expandable assistant panel with route-aware context.
4. Greeting flow after successful identity and organization validation.
5. Reuse of the existing `atlas-copilot` Edge Function for text intelligence rather than creating a parallel AI backend.
6. Capability state model for text, microphone input, speech output, streaming, and optional native Personal Voice.
7. Strict authorization boundaries for any action request.
8. Audit-friendly action handoff contract for modules that later expose executable assistant actions.
9. Accessibility behavior aligned with ATLAS Inclusive Communication principles.

## Non-goals for this milestone
- Do not claim telephony, native Apple Personal Voice, wake-word background listening, autonomous financial execution, clinical decision execution, or unrestricted cross-tenant actions.
- Do not fabricate connected provider states.
- Do not replace existing module UIs with chat-only workflows.
- Do not add an unrestricted agent capable of arbitrary browser or infrastructure actions from the client.
- Do not introduce a second conversation store, authentication system, or AI provider gateway when `atlas-copilot` already provides those responsibilities.

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
- show avatar launcher only when an authenticated session and active organization can be resolved;
- manage expanded/collapsed panel state;
- observe current route;
- display capability state;
- dispatch text/voice requests through a single assistant client runtime;
- never bypass route-level authorization.

If identity is unavailable, expired, or has no active organization, the assistant must not present itself as an authenticated workspace assistant.

### 2. Assistant client runtime boundary
Create a focused web client module that separates UI from capability and authorization logic while reusing the existing Supabase-backed `atlas-copilot` backend.

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

### 3. Existing ATLAS intelligence runtime
Text requests must reuse `supabase/functions/atlas-copilot`.

The existing backend already:
- resolves the authenticated Supabase user from the bearer token;
- resolves active organization membership;
- verifies `intelligence.use` (or wildcard) permission;
- rejects organization ids that are not part of the authenticated user's active memberships;
- probes the configured OpenAI provider before representing it as ready for a request;
- uses the OpenAI Responses API with `store:false` at the provider;
- records ATLAS-side conversations, messages, and request status in organization-scoped storage;
- scopes ordinary users to conversations they created, while management access is permission-gated.

The web assistant should call the existing `atlas-copilot?api=status`, `?api=chat`, `?api=history`, and `?api=conversation` contracts as appropriate. It must not duplicate provider keys or call OpenAI directly from the browser.

For the first milestone, `streaming` remains `unavailable` because the current `atlas-copilot` chat path returns a completed response rather than a verified streaming channel.

### 4. Identity and organization source of truth
Reuse the existing Supabase-backed session helpers. The assistant must not create a parallel authentication state.

Before any assistant request that can access protected organization data:
- resolve the active ATLAS organization;
- include the authenticated organization id in the request body/header expected by `atlas-copilot`;
- allow the server to resolve and enforce the actual user, membership, role, and permissions;
- reject requests if the session is expired, invalid, has no active organization, or lacks `intelligence.use`.

Client route context is descriptive and must never be treated as authorization evidence.

### 5. Route context
The assistant receives the current `pathname` from React Router and maps it to an ATLAS module identifier supplied to the existing copilot request contract.

Examples:
- `/finance/accounting/accounts-payable` -> module `finance.accounting.accounts-payable`;
- `/health/...` -> module under `health.*` while preserving existing research/clinical boundaries;
- `/studio/voice` -> module `studio.voice`.

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
- `speaking` is shown only while a verified speech-output mechanism is actively producing output.
- `thinking` is used only after a request has been accepted by the ATLAS copilot runtime.
- failure returns to `idle` after a visible error message; it must not silently continue.

## Voice capability contract

### Browser microphone
Use browser media APIs only when available and after explicit user permission.

Capability mapping:
- API unsupported -> `unavailable`
- API supported, no permission -> `permission-required`
- permission granted and capture verified -> `ready`

Automatic microphone activation at login is forbidden.

### Speech output
The first implementation may use a supported browser speech mechanism only if it is actually available at runtime. Otherwise speech output is `unavailable` or `configuration-required`; text remains available.

Speech is opt-in. The persistent preference key is:

`atlas_assistant_speech_enabled`

Default value: `false`.

The assistant never changes this setting without an explicit user action.

### Native Personal Voice
The web client must continue to report this as unavailable unless running through the separately verified native ATLAS Apple bridge on supported hardware.

## Greeting behavior
After ATLAS Identity validates both session and active organization, the assistant may present a one-time greeting per browser session.

Session guard key:

`atlas_assistant_greeted`

Default behavior:
- avatar appears after authenticated organization context resolves;
- one concise text greeting may be shown once per browser session;
- spoken greeting occurs only when `atlas_assistant_speech_enabled` is `true` and speech output is verified ready;
- no automatic microphone activation.

The greeting may name the current ATLAS workspace but must not unnecessarily expose sensitive organization data.

## Conversation behavior
The web assistant reuses ATLAS copilot conversation persistence instead of introducing another store.

Rules:
- conversation ids come only from successful `atlas-copilot` responses/history;
- the client does not accept arbitrary cross-user conversation ids as trusted data;
- server-side organization and ownership checks remain authoritative;
- the OpenAI provider call continues to use `store:false`;
- ATLAS-side conversation retention follows the existing copilot storage contract until a separate retention policy is approved.

Raw microphone audio is not persisted by this milestone.

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

The first milestone exposes no new mutating assistant actions. Read-only contextual assistance is the acceptance target until each module action adapter is separately designed and verified.

The assistant must never:
- infer permission from UI visibility;
- use organization ids supplied only by free-form model text;
- execute a mutation because the model suggested it;
- bypass an existing module confirmation or approval workflow.

## Data and privacy
- Reuse existing Supabase session, membership, permission, and RLS boundaries.
- Do not persist raw microphone audio.
- Do not log passwords, access tokens, refresh tokens, provider keys, or other secrets.
- Reuse existing tenant/user-scoped ATLAS copilot conversation storage rather than adding another persistence layer.
- Provider-side OpenAI response storage remains disabled by the existing adapter (`store:false`).

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
- panel includes avatar, state label, conversation messages, text input, microphone control, speech preference control, and close/minimize control.

### Tablet/mobile
- launcher remains reachable above safe-area insets;
- expanded panel uses a near-full-width sheet;
- touch targets meet mobile accessibility sizing;
- no hover-only controls.

## Styling
Reuse the existing ATLAS dark-blue shell, gradients, borders, and cyan accent language. Do not introduce a separate visual system.

Avatar animation is limited to subtle state treatments such as glow/pulse around the launcher. The first implementation must not fake lip-sync.

## Error handling
Required user-visible cases:
- session expired;
- no active organization;
- missing `intelligence.use` permission;
- copilot provider not configured;
- copilot provider unavailable or rate-limited;
- microphone unsupported;
- microphone permission denied;
- speech mechanism unavailable;
- assistant request failed;
- action not authorized;
- action requires confirmation.

No error path may leave the assistant visually stuck in `listening`, `thinking`, or `speaking`.

## Testing strategy

### Unit
- capability mapping from browser/provider state;
- assistant UI state transitions;
- route-to-module context mapping;
- greeting session guard;
- speech preference default and persistence;
- action authorization preconditions.

### Integration
- authenticated user with active organization and `intelligence.use` can open assistant and call existing `atlas-copilot`;
- unauthenticated/expired session cannot issue protected assistant requests;
- active member without `intelligence.use` receives a permission error rather than an apparently connected assistant;
- `/studio/voice` remains identity-gated;
- assistant survives route navigation through `AtlasShell`;
- provider `not_configured`, `configured_unverified`, and `unavailable` states are surfaced truthfully;
- denied microphone permission never displays `listening`;
- unavailable speech mechanism never displays `speaking`;
- mobile layout does not cover primary navigation or critical controls.

### Regression
Run the canonical verification gate:

`npm run verify:cloudflare`

The feature is not production-ready unless audit, typecheck, unit tests, integration tests, and production build pass.

## Rollout

### Phase 1 — visual + governed text assistant
- add approved avatar asset;
- add global launcher/panel;
- connect current route and authenticated organization context;
- reuse `atlas-copilot` status/chat/history/conversation APIs;
- expose truthful text/provider states.

### Phase 2 — browser voice
- microphone permission and capture;
- speech output only when supported and opted in;
- optional spoken greeting when ready;
- no wake-word or background recording;
- streaming remains unavailable until a real streaming backend exists.

### Phase 3 — governed module actions
Add typed action adapters one module at a time, beginning with low-risk/read-only actions. Mutations require explicit permission and confirmation contracts.

## Acceptance criteria
The milestone passes when all of the following are verified:

1. The approved avatar is loaded from the canonical app, not from a temporary external URL.
2. The assistant is visible only after authenticated ATLAS organization context resolves and persists across route changes.
3. Text requests reuse `atlas-copilot`; no duplicate AI gateway or direct browser-to-OpenAI call is added.
4. The assistant uses server-enforced Supabase user, organization membership, role, and `intelligence.use` permission boundaries.
5. Text assistant mode works even when microphone and speech output are unavailable.
6. Provider readiness is truthful and comes from the existing copilot status/probe contract.
7. Microphone and speech states are permission/capability-driven.
8. No microphone is activated automatically at login.
9. Speech defaults off and requires explicit opt-in.
10. No unsupported native Personal Voice or streaming capability is claimed in the web app.
11. No new mutating assistant action is exposed in this milestone.
12. Desktop, tablet, and mobile layouts are usable and accessible.
13. `npm run verify:cloudflare` passes before any production claim.
14. Production deployment is separately verified before describing the feature as live on `atlasenterprisesuite.com`.
