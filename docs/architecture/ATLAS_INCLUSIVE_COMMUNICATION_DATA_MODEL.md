# ATLAS Inclusive Communication — Canonical Data Model

## Purpose

This layer makes inclusive communication durable without creating a second accessibility profile system. User communication preferences remain in `public.atlas_user_preferences.preferences.accessibilityCommunication`. Personal Voice remains in the existing `atlas_voice_*` schema. Telephony remains in `atlas_call_*`.

The new database layer stores the orchestration, consent, accessibility, evidence and audit state required to communicate across modalities without claiming unsupported capabilities.

## Canonical entities

| Entity | Purpose |
|---|---|
| `atlas_inclusive_communication_sessions` | Tenant-scoped multimodal communication session and retention boundary. |
| `atlas_inclusive_communication_participants` | Human, interpreter, assistant, automation, system and external participation. |
| `atlas_inclusive_communication_messages` | Ordered communication envelopes with modality, language, confidence and sensitivity state. |
| `atlas_inclusive_communication_derivations` | Transcription, translation, captions, sign rendering, audio description, simplification, Braille and haptic derivations. |
| `atlas_inclusive_consents` | Explicit consent records for recording, translation, interpreter handoff, voice clone, research, retention and assistive devices. |
| `atlas_assistive_device_bindings` | User-owned device/capability records. Client-created records cannot self-promote to `verified`. |
| `atlas_sign_language_readiness` | Per-organization language/provider rollout state. Verification requires Deaf-community validation. |
| `atlas_interpreter_sessions` | Human interpreter handoff lifecycle and provider evidence. |
| `atlas_accessibility_validation_runs` | Automated, keyboard, screen-reader, device, sign-language, DeafBlind and human-pilot validation runs. |
| `atlas_accessibility_validation_evidence` | Immutable references to validation evidence. |
| `atlas_inclusive_audit_events` | Redacted governance/audit trail for inclusive communication actions. |

## Security invariants

1. All tenant data is scoped by `org_id`.
2. RLS is enabled on every new table.
3. Session content is readable only by active organization members who are active session participants.
4. Direct browser writes to communication messages, derivations, interpreter state, readiness, validation and audit tables are denied.
5. Session creation and message append use governed RPCs.
6. Medium-confidence interpretation requires confirmation; low-confidence interpretation is blocked.
7. Sensitive actions require confirmation regardless of confidence.
8. Assistive-device records created by a user cannot mark themselves `verified`.
9. Sign-language readiness cannot become `verified` until `deaf_community_validated=true`.
10. Anonymous table access is revoked.
11. Raw audio/video/image biometric payloads are not stored in this layer; only governed media references are allowed.
12. Accessibility-triggered downstream business actions remain subject to the target module's own tenant, RBAC and domain validation.

## Retention

Communication sessions default to a 30-day retention window unless policy sets another value or legal hold is active. `atlas_inclusive_purge_expired()` performs governed retention cleanup and is intentionally not executable by ordinary authenticated clients.

## Existing systems deliberately reused

- `atlas_user_preferences`: accessibility/communication preferences.
- `atlas_voice_*`: Personal Voice profiles, recordings, consent, generation and private voice storage.
- `atlas_call_*`: telephony provider and call-state persistence.
- `organization_members`: tenant membership.
- Existing ATLAS authentication and downstream permission/RBAC functions.

## Production truth

Database presence does not make any external capability production-ready. Sign recognition, sign-language avatar output, live captions, Braille hardware, haptic hardware and interpreter handoff remain fail-closed until provider/device/human evidence satisfies the existing Inclusive Communication validation protocol.
