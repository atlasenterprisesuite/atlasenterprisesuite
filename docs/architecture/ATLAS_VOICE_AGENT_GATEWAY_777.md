# ATLAS Voice Agent Gateway — 777 REVIEW / Phase 1

## Canonical ownership

Extend `packages/voice` and `/voice/personal-voice` in the existing ATLAS application.
This phase introduces a concrete **policy + dispatch contract** for agent-generated speech.
It does **not** train a speech model, import private samples, enable live endpoints or deploy anything.

The source of truth remains ATLAS Voice. Agents, Creator Studio and any future
`ATLAS Local Speech Engine` must call the ATLAS Voice boundary; they never receive
raw source recordings, private provider keys or unrestricted model access.

## Trust boundary

1. ATLAS Identity authenticates the actor and resolves tenant + organization server-side.
2. Voice repository loads the owner-scoped VoiceProfile, active VoiceConsent,
   agent-specific permission grant and private provider binding **from trusted storage**.
   Never accept these records directly from an agent-supplied JSON body.
3. `authorizeAgentSpeech` checks tenant/org, `voice.personal.use`, ready status,
   ownership, consent version and revocation, consumer, explicit grant, grant expiry,
   purpose, language, style, provider readiness and capability. Denial is the default.
4. `executeAgentSpeech` audits the decision **before** generation, dispatches to the
   selected server-side adapter and audits the result. Audit records exclude the script,
   recording, voice resource ID, raw audio and provider credentials.
5. `atlas_local` is the preferred engine category. `external_adapter` is opt-in.
   There is no automatic fallback to HeyGen or any other third party.

## Languages and delivery

The user may request Spanish, English or other languages, and documentary,
educational, conversational, energetic, calm or neutral speaking styles.
A language/style must be both *granted* and *verified by the selected engine*.
Typed text and ChatGPT conversation history do not contain voice waveforms.
Do not claim that an English-trained voice is verified for Spanish until
naturalness/intelligibility evaluation passes.

Private assistant speech, studio previews, narration exports, public publications
and telephony are separate consent purposes. Public/telephony scopes require
additional explicit authorization, and unsupported device/provider capabilities
remain unavailable. Speech renders must not be labeled as genuine audio recordings.

## Existing components to reuse

- `packages/voice/src/{types,policy,capabilities,repository,deletion}.ts`
- `apps/web/src/modules/voice/{VoiceRoutes,voiceApi,PersonalVoicePage}.tsx`
- `supabase/functions/atlas-voice-provider/` (server-side integration reference)
- `atlas_voice_profiles`, `atlas_voice_consents`, RLS, Identity Foundation, shared audit
- Creator Studio / Dubbing Studio for script, time codes, subtitle alignment and export

## P0 unfinished, therefore NO-GO for release

- Build the actual first-party *on-device or self-hosted* speech synthesis service
  and select a compliant trainable multilingual model with documented licenses.
- Keep raw user recordings in encrypted private storage, not in the public Git repo,
  assistant transcripts, logs or pull requests.
- Implement server-side load/verification and persistence for grants, revocation,
  owner challenges, adapter bindings, per-language verification and audit events.
- Bind authenticated agent routes to `executeAgentSpeech` and implement real
  cancellation/permission revocation during concurrent synthesis.
- Verify consent coverage for public distribution and real communications.
- Integration tests for organization RLS, storage, latency, idempotency, cancellation,
  render bytes, ASR pronunciation and voice quality using consented recordings.
- WCAG, ES/EN UI, mobile/iOS + Windows, CI, exact SHA, production E2E.
- Do not spend provider credits, merge or deploy automatically.

## Verification evidence

The changes are deliberately pure TypeScript with synthetic fixtures.
A local isolated compile and 15 Node tests passed on the equivalent policy rules.
Repository Vitest, full CI, infrastructure and E2E remain unverified until their
actual results are inspected. This document is not production certification.
