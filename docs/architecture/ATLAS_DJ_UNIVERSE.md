# ATLAS DJ Universe — local mixer MVP

Status: implementation proposed in PR; not production verified.

## Placement
- Canonical route: `/studio/dj`, inside the existing `RequireAtlasIdentity` boundary.
- Existing `/studio/create?type=music` remains the music-generation planning/gated provider workspace.
- No duplicate asset store, provider registry, user identity, or tenant service is introduced.

## Executable scope
- Two independent HTMLMediaElement audio decks with local file selection.
- Play/pause, cue-to-start, time display, seek, per-deck level.
- Equal-power crossfader and master level (local browser playback).
- Files remain on the user's device; object URLs are revoked on replacement and unmount.
- Keyboard-accessible controls and responsive layout.

## Explicit exclusions / fail-closed
- No AI AutoMix, beatmatching, BPM analysis, waveform, stems, recording, cue monitoring, streaming, video, karaoke, MIDI/HID, DVS, hardware readiness, cloud persistence, or external catalog import.
- No rights to commercial music are implied. The user must possess necessary performance/broadcast licenses.
- Browser codec and autoplay restrictions apply. An unsupported audio file is reported as an error.
- Volume crossfading is not equivalent to a low-latency professional audio engine. For stage-grade reliability, future iterations require measured native DSP latency, audio device routing, and hardware qualification.
- No paid AI provider is invoked.

## Test and release gates
- Unit: `npx vitest run tests/unit/atlas-dj-mixer.test.ts`.
- Typecheck: `npm run typecheck`.
- Build: `npm run build`.
- UI: authenticate, open `/studio/dj`, load two permitted local audio files, play both, verify A/B and center crossfade, adjust master/deck levels, seek, cue, and verify mobile/keyboard behavior.
- P0 production verification: `/`, `/health` or canonical gateway health, and `/studio/dj` with authorized session, including HTTP status, TLS, required security headers and app route rendering. A 200 HTML shell alone does not prove that authenticated DJ playback works.
- Deployment must remain fail-closed until CI, authorization, actual playback smoke tests and P0 public checks have evidence.

## Future milestones
1. AudioWorklet-based deterministic low-latency mixing with metering, EQ and limiter.
2. Offline waveform/BPM/key analysis with provenance and CPU limits.
3. Licensed MIDI/HID mappings, headphones cue, multi-output routing.
4. Optional AI stems, AutoDJ and karaoke/video, subject to readiness and content rights.
5. Authorized recordings, event workflows, Creator Library and paid subscriptions.
