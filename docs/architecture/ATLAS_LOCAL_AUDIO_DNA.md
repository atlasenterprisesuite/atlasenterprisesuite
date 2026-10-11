# ATLAS Audio DNA — browser-local analysis v1

**Status:** implementation candidate, awaiting current-head CI and merge. **Route:** `/studio/mix` (existing ATLAS Identity gate). Builds on draft local DJ PR #773 and aligns with the wider architecture draft #642.

## Scope

- Analyze explicitly selected, user-authorized audio files in the browser, without network upload or an external AI provider.
- Decode only files up to 30 MB to protect mobile memory; inspect at most the first 90 seconds, then release `AudioContext` resources.
- Provide **estimated** BPM from RMS onset novelty/autocorrelation; no automatic beatgrid or synchronization.
- Provide **estimated** musical key using a windowed FFT, 12-tone chroma profile correlation, and confidence gate. Report unknown when the evidence is too weak.
- Provide RMS, peak dBFS and normalized energy, without falsely implying LUFS compliance.
- Derive optional BPM/Camelot mix ordering from estimates, retaining editable manual values.
- No cloud storage, export, licensed-content streaming, transcription, proprietary key library, scraping, or automatic publication.

## Correctness and security boundaries

1. Audio analysis is initiated by a user action and runs in the current browser. No `fetch`, external HTTP, or provider credentials.
2. Analyses are temporary in React state; object URLs are revoked when tracks are removed or the workspace unmounts.
3. Zero-RMS audio and clips shorter than four seconds cannot claim BPM or key. The algorithm returns `null` for uncertain interpretations.
4. Samples and sample rate must be finite and valid. File size and maximum inspected time are bounded. Decoder errors display failure, rather than fabricated metadata.
5. Numeric confidence is **heuristic consistency**, not a calibrated percentage probability of truth. Users must review values before commercial performance.
6. Data is not persisted to tenant storage; integration with Creator Library and provenance requires a separate rights/RBAC/RLS and persistence implementation before it can be claimed.
7. Crossfading remains browser-local playback; no DSP tempo sync, DJ stem separation, mastering or export is implied.
8. The feature must remain blocked from production certification until current-SHA tests, security checks and E2E verification pass.

## TDD / verification

- Pure unit tests cover silence, invalid PCM, metronome examples at 120/128 BPM and ambiguous/clean chroma profiles.
- Existing Local DJ integration test verifies truthful capability boundaries, control state and navigation.
- Typecheck and production build use the existing ATLAS CI workflow; no parallel pipeline.
- After merge/deploy, verify the exact deployed SHA, authenticated route, two browser-decodable files and resulting metadata in a supported mobile browser.
