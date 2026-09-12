# ATLAS Personal Voice + Apple Personal Voice Bridge Design

## Status
Approved in chat on 2026-09-06 and hardened after review. This is the canonical design for ATLAS Personal Voice and its optional Apple Personal Voice bridge.

## Objective
Build a governed ATLAS Voice capability that lets a user create and manage an ATLAS-owned personal voice and, on supported Apple devices, optionally authorize ATLAS to use the user's Apple Personal Voice locally.

## Ownership and Module Classification
- Primary owner: `ATLAS Voice`
- Secondary integrations: `ATLAS Voice Assistant`, `ATLAS Connect`, `ATLAS Telecom`, `ATLAS Automations`, `ATLAS Security`
- ATLAS Voice owns voice profiles, consent, permissions, provider capability checks, and audit.
- Downstream modules request voice use through ATLAS Voice and do not own or directly access a model by default.

## Architecture Decision
Adopt hybrid option C:
1. **ATLAS Personal Voice Engine** — ATLAS-owned capture, quality validation, consent, generation-provider integration, permissions, and lifecycle.
2. **Apple Personal Voice Bridge** — native device adapter that requests Apple authorization and performs only platform-supported local operations.

The web app must never pretend to expose Apple-native Personal Voice APIs. Until a supported native ATLAS client exists, web surfaces show a truthful `Requires ATLAS iOS app` capability state.

## Non-Goals
- Do not export or host Apple Personal Voice as an ATLAS model.
- Do not fabricate generation, availability, device support, call support, or connection states.
- Do not make a personal voice tenant-owned by default.
- Do not permit silent administrator assignment of another user's voice.
- Do not create a parallel ATLAS application or duplicate shell, navigation, auth, permission, or deployment systems.

## Routes
Primary route:
- `/voice/personal-voice`

Subroutes:
- `/voice/personal-voice/setup`
- `/voice/personal-voice/sound-check`
- `/voice/personal-voice/record`
- `/voice/personal-voice/review`
- `/voice/personal-voice/generate`
- `/voice/personal-voice/library`
- `/voice/personal-voice/apple`
- `/voice/personal-voice/permissions`

Future-safe Voice family:
- `/voice`
- `/voice/personal-voice`
- `/voice/assistant`
- `/voice/speech`
- `/voice/transcription`
- `/voice/calls`
- `/voice/automations`
- `/voice/integrations`

## UX Flow
ATLAS voice creation:
`Welcome → Consent & Ownership → Microphone Setup → Sound Check → Guided Recording → Quality Review → Generate → Verification → Ready`

Apple bridge:
`Capability Check → Request Permission → Authorization Result → Select Available Voice → Test Locally → Enable for ATLAS`

Mobile uses a one-task-per-screen flow with large controls and visible progress. Desktop and tablet use the ATLAS shell, breadcrumbs, and status panels. The design follows the clarity and hierarchy of the supplied Apple reference screens without copying Apple assets or UI literally.

## Functional Requirements
### My Voices
Show real metadata only:
- name
- language
- provider
- status
- created timestamp
- allowed ATLAS consumers
- last used timestamp when available
- verified device scope when available

Actions:
- `Test Voice`
- `Use in ATLAS`
- `Manage Permissions`
- `Rename`
- `Delete`

### Guided Recording
Each phrase supports:
- `Play phrase`
- `Record`
- `Stop`
- `Replay`
- `Accept`
- `Retry`

Progress is persisted and resumable.

### Sound Check
Measure only signals available in the current environment:
- microphone availability
- input detected
- clipping
- low volume / excessive silence
- background noise
- volume consistency

Any unsupported measurement is `Unavailable`, not `Pass`.

### Quality Review
Buckets:
- `Accepted samples`
- `Needs retry`
- `Rejected`
- `Missing`

Generation remains disabled until provider prerequisites are actually satisfied.

### Generation
States:
- `queued`
- `processing`
- `verifying`
- `ready`
- `failed`

If no real provider exists, expose `Voice generation provider not configured` and do not synthesize fake readiness.

## Domain Model
Create a dedicated `packages/voice/` domain.

Core entities:
- `VoiceProfile`
- `VoiceProvider`
- `VoiceProviderCapabilities`
- `RecordingSession`
- `VoiceSample`
- `QualityAssessment`
- `VoiceGenerationJob`
- `VoicePermission`
- `VoiceConsent`
- `VoiceAuditEvent`

`VoiceProfile.status`:
- `draft`
- `sound_check`
- `recording`
- `reviewing`
- `ready_to_generate`
- `generating`
- `ready`
- `suspended`
- `deleted`

Error codes:
- `microphone_denied`
- `quality_failed`
- `generation_failed`
- `provider_unavailable`
- `authorization_required`

## Provider Capability Contract
Every provider must declare:
- `localPlayback`
- `audioExport`
- `realtimeStream`
- `telephony`
- `serverSynthesis`

A downstream action is enabled only if the selected provider declares the required capability.

Initial providers:
- `AtlasVoiceProvider`
- `ApplePersonalVoiceProvider`

Apple Personal Voice must not be treated as exportable audio, telephony-capable, stream-capable, or server-synthesis-capable unless a future Apple API explicitly permits and device validation confirms that capability.

## Shared Permission Model
Before Voice permissions are introduced, `packages/core` must be generalized beyond its current accounting-only permission type. ATLAS modules must coexist without unsafe casts.

Voice permission vocabulary:
- `voice.personal.read`
- `voice.personal.create`
- `voice.personal.record`
- `voice.personal.generate`
- `voice.personal.use`
- `voice.personal.delete`
- `voice.apple.request`
- `voice.apple.use`
- `voice.integration.manage`

Critical rule: access to ATLAS does not automatically grant permission to use another person's voice.

## Consent and Anti-Impersonation
A new ATLAS-owned personal voice requires:
- explicit ownership/consent attestation
- consent-version capture
- an in-session voice challenge recorded during the creation session
- successful ownership/permission checks before becoming generation-eligible

Public, telecom, or automated external use requires stricter scoped authorization than private/local assistant playback.

## Data Boundaries
Persist separately:
- `VoiceProfile`: metadata and lifecycle state
- `RecordingSession`: progress and attempts
- `VoiceSample`: encrypted audio reference plus quality result
- `VoiceGenerationJob`: provider, state, output reference
- `VoiceConsent`: version, scope, timestamps
- `VoicePermission`: allowed consumers/scopes
- `VoiceAuditEvent`: immutable metadata-only audit trail

Storage rules:
- encrypt raw recordings at rest
- encrypt ATLAS-generated models at rest
- restrict access to owner and authorized services
- never store raw audio in audit events
- never store Apple Personal Voice as an ATLAS model
- for Apple, store only bridge configuration, authorization state, and audit metadata needed by policy

## Deletion Semantics
`Delete Voice` must:
- revoke all ATLAS consumer permissions
- cancel pending generation jobs when supported
- delete raw samples according to retention policy
- request provider-side deletion for ATLAS-owned generated models when supported
- retain only minimum permitted audit metadata
- never retain raw audio inside audit records

## Security Gate
Sensitive operations pass:
`Identity → Tenant Scope → User Ownership → Permission → Consent Scope → Provider Capability → Audit`

Explicit authorization is required for:
- generation
- assistant enablement
- telecom/call enablement
- external/public automation use
- permission expansion
- deletion

## UI States
Required:
- loading
- empty
- microphone denied
- offline
- permission denied
- provider unavailable
- generation failed
- voice ready
- voice suspended
- voice deleted

Interactive controls must expose applicable active, hover, selected, loading, disabled, error, and success states.

## Responsive Requirements
Verify desktop, tablet, and mobile.

## Testing
Unit:
- state transitions
- permissions
- provider capabilities
- quality rules
- deletion policy
- error mapping

Integration:
- routes
- microphone permission handling
- session resume
- quality-review progression
- generation-state behavior
- audit creation
- unsupported Apple-web state

E2E/device:
- create flow through actual available capability
- retry/cancel/back flows
- provider unavailable flow
- delete flow
- Apple bridge verified on a supported device before Apple readiness is claimed

## Production Gates
- `typecheck PASS`
- `unit tests PASS`
- `integration tests PASS`
- `production build PASS`
- responsive checks PASS
- microphone flows PASS
- RBAC/ownership PASS
- audit PASS
- no secrets exposed PASS
- Apple native device verification PASS before Apple bridge is marked operational

## Deployment
Use the existing ATLAS pipeline:
`implementation → review → QA → CI → approval → deploy → /healthz → route verification → functional verification`

Do not create a parallel deploy mechanism.

## Implementation Split
Because the approved design spans two independently testable subsystems, implementation is split into coordinated plans:
1. `2026-09-06-atlas-personal-voice-core-web.md`
2. `2026-09-06-atlas-apple-personal-voice-bridge.md`

The core/web plan ships first. The Apple bridge plan depends on a supported native ATLAS client surface and must not block truthful web delivery.

## Acceptance Criteria
1. `ATLAS → Voice → Personal Voice` is a governed route inside the existing shell.
2. ATLAS-owned voice creation progresses only through real available capabilities.
3. Unsupported provider capabilities are visibly unavailable.
4. Ownership, consent, RBAC, and audit are enforced.
5. Delete semantics revoke access and remove sensitive data according to policy.
6. Apple Personal Voice remains native/device-local and is never misrepresented as a server model.
7. The module passes the same build, test, CI, and production verification discipline as existing ATLAS modules.
