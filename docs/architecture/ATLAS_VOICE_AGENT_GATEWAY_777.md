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
5. `executeAgentSpeech` performs an additional trusted-store permission read **after synthesis and before returning bytes**. If consent/grant was revoked, grant expired, tenant changed, provider binding changed or the read fails, discard the generated audio. Abort signals suppress delivery, and cooperating adapters should cancel work promptly; the policy gate alone is not proof of instantaneous GPU-job termination.
6. `atlas_local` is the preferred engine category. `external_adapter` is opt-in.
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
- Bind authenticated agent routes to `executeAgentSpeech` with `refreshAuthorization` sourcing trusted persistence; wire `AbortSignal` through all real adapters and prove revocation/cancellation against concurrent synthesis.
- Verify consent coverage for public distribution and real communications.
- Integration tests for organization RLS, storage, latency, idempotency, cancellation,
  render bytes, ASR pronunciation and voice quality using consented recordings.
- WCAG, ES/EN UI, mobile/iOS + Windows, CI, exact SHA, production E2E.
- Do not spend provider credits, merge or deploy automatically.

## Verification evidence

The changes are deliberately pure TypeScript with synthetic fixtures.
A local isolated TypeScript compile and 20/20 Node tests passed, including cancellation and consent-revocation races, using synthetic data. These are isolated rule checks, not live provider integration.
Repository Vitest, full CI, infrastructure and E2E remain unverified until their
actual results are inspected. This document is not production certification.

## RUN 009 — reuse existing generic Native Composer TTS

ATLAS already contains `services/creator-native/native_composer.py`, which uses a
locally installed eSpeak runtime for **generic** narration. Rather than adding
a parallel service, this PR extends that exact Native Composer with:

- `services/creator-native/speech.py`: bounded `synthesize_generic_speech`,
  no network calls, no speaker training, no personal voice model or reference.
- `POST /speech` on the existing token-protected `services/creator-native/app.py`,
  requiring explicit `{"mode":"generic","text":"...","locale":"es-ES"}`.
  Response: `audio/wav`, `x-atlas-voice-mode: generic`, `cache-control: private,no-store`.
- Only explicitly supported Spanish/English locale mappings are accepted.
  The speech text has a 1000-character cap, speed limits and short subprocess timeout.
  The private/ephemeral WAV file is deleted after generation.
- Tests verify no authentication -> 401, authenticated WAV output, and
  reject personal-voice/speaker references, unsanctioned locales and malformed inputs.

**Do not label eSpeak output as a user personal voice or as a clone.**
This path is a first-party, self-hosted generic fallback only, and is not
automatically mapped into agent personal-voice profiles. The `atlas_local`
voice-agent adapter remains blocked until a user-owned model is verified and
the secure, revocable Voice-to-Native transport is completed.

No external provider fees or uploads are required for the generic TTS.
Runtime deployment and real production synthesis remain P0 pending.

## RUN 010 — authenticated Voice Studio → local native speech

The native generic WAV engine now has a server-side adapter inside the **existing**
`atlas-voice-provider` Edge Function and a first-party client surface.
No independent platform, identity authority or new payment provider was introduced.

- `GET /functions/v1/atlas-voice-provider?api=status&provider=atlas_native_generic`
  authenticates `voice.personal.read`, checks the self-hosted Composer readiness
  and reports `synthesis_verified:false` until generation actually succeeds.
- `POST /functions/v1/atlas-voice-provider?api=speech&provider=atlas_native_generic`
  authenticates `voice.personal.use`, enforces explicit `mode:generic`, exact
  locale/rate/text limits, stores metadata-only audit before and after synthesis,
  rechecks identity and permissions before delivering audio, checks WAV headers
  and stamps synthetic-generic disclosure. It never selects a clone or paid fallback.
- `AtlasVoiceApi` provides authenticated methods; `AtlasNativeNarration`
  presents local speech **before** optional ElevenLabs in existing Voice Studio.
  The UI cannot generate when runtime readiness is unavailable. Audio is a
  browser-local object URL, revoked on exit or next generation.
- Tests cover validation, response provenance, upstream errors, tenant-selected
  headers, UI readiness gates and audit routing.
- Composer secret names reuse `ATLAS_NATIVE_COMPOSER_URL` and
  `ATLAS_NATIVE_COMPOSER_TOKEN`; they must be configured privately for the
  Voice Provider runtime, not added to public Git.

**P0 release blockers:** deployed Edge version, self-hosted Composer configuration,
real authenticated E2E, per-tenant concurrency/quotas, CPU/memory cost limits,
revocation race tests, and genuine user-owned multilingual clone evaluation.
Passing build/CI cannot establish these production properties.
