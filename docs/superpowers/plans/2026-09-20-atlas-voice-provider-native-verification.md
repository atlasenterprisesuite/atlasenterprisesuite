# ATLAS Voice Provider + Native Verification Implementation Plan

**Goal:** Add a real OpenAI Custom Voice provider behind ATLAS Voice and complete a native Apple Personal Voice bridge verification harness without overstating physical-device verification.

**Spec:** `docs/superpowers/specs/2026-09-06-atlas-personal-voice-design.md`

## Provider
- Reuse the existing Supabase `OPENAI_API_KEY`; never expose it to web/native clients.
- Add `atlas-voice-provider` with JWT + ATLAS organization/permission checks.
- Probe Custom Voice read access with `GET /v1/audio/consent_phrases`.
- Probe write eligibility with a deliberately incomplete `POST /v1/audio/voice_consents`; 400/422 means the endpoint is authorized while 401/403/404 remains fail-closed.
- Create consent from a private ATLAS sample, create a voice from a matching private sample, and synthesize through `POST /v1/audio/speech` using `{ id: voice_* }`.
- Persist only provider resource IDs and provider status; never the OpenAI API key.
- Add an AI-generated voice disclosure to provider speech responses.
- Keep telephony false until the Telecom integration is separately verified.

## Data
- Extend Voice consent rows with provider consent metadata.
- Add provider state/evidence fields needed for lifecycle and cleanup.
- Add native verification evidence rows, self-scoped by RLS.
- Generation state updates are server-controlled through the Edge Function.

## Web
- Replace the disabled Generate view with live provider readiness.
- When Custom Voice is eligible, guide the user to record the exact current consent phrase and a 10–30 second reference sample.
- Keep generation disabled when provider eligibility is absent.

## Apple native
- Implement `native/apple-personal-voice-bridge` per the existing approved plan.
- Add status, explicit authorization request, Personal Voice enumeration, and local playback only.
- Add a native verification report API containing platform/OS/auth/voice-count/local-playback evidence and no audio.
- macOS CI: `swift test` + `swift build`.
- iOS SDK CI: compile the package against a generic iOS Simulator destination with code signing disabled.
- Do not mark physical-device verification complete from simulator or CI.

## Production gates
1. RED tests recorded.
2. Full Node unit/integration/typecheck/build GREEN.
3. Swift macOS tests/build GREEN and iOS SDK compile GREEN.
4. Edge Function deployed with `verify_jwt=true`.
5. OpenAI Custom Voice readiness probed against the production key.
6. Merge + production deployment verification.
7. Registry states updated only to evidence actually observed.
