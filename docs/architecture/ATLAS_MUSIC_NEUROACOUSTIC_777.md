# ATLAS Music Universe 777 — Neuroacoustic Sound Lab

**Change scope:** Local audio synthesis inside the existing ATLAS Studio Music Lab → `/studio/mix` route; no parallel application, audio-upload service, subscription, or new external provider.

## Delivered code (requires CI verification)

- Four perceived binaural-difference presets (2/7/10/40 Hz), made from independent stereo oscillators at 180 Hz and 182/187/190/220 Hz. Headphones and both stereo channels are necessary to perceive the intended difference. The 2–40 Hz difference is **not** a standalone audible carrier tone.
- Two original ambient instrumental synthesizer presets, three locally synthesized nature-like noise textures, and two independent 432/528 Hz reference tones.
- User-initiated playback only; short 5/10/20/30-minute automatic stop; one active session at a time; disposal on route unmount.
- Device-local Web Audio API; no mic, Spotify streaming, third-party music download, network access, user audio upload, persistence, commercial generation, analytics or provider budget.
- Low fixed signal gains. The module neither reproduces commercial recordings nor implies that a named song is binaural.
- Existing Audio DNA, creator routes, creative-engine readiness, authorization and DJ file-mixing controls remain unchanged.

## Claims and provenance

- All preset signals are **locally synthesized**, not licensed recordings or measured natural environments.
- The terms delta/theta/alpha/gamma are descriptive of the **perceived binaural difference** and are not EEG measurements or proof of neural entrainment.
- A single 432 Hz tone is not the same as tuning a complete recording to A4=432 Hz.
- No healing, DNA repair, brainwave synchronization, sleep, attention or therapeutic claims are made. User experience is subjective.
- Marconi Union, Brian Eno and Alan Walker are reference artists only; their audio is not bundled or streamed.

## Acceptance — 777 REVIEW

| Gate | Requirement | Evidence |
| --- | --- | --- |
| P0 | No automatic playback; no network or provider invocation | UI inspection + integration tests |
| P0 | Genuine L/R carrier difference, clearly distinguished from beatHz | Pure plan tests + mocked Web Audio unit test |
| P0 | Stop/disposal for active oscillator or noise sources | Unit test + manual browser verification pending |
| P0 | No unlicensed content copied, stored, or streamed | Source inspection + license review |
| P0 | Typecheck, focused unit/integration tests and build pass on exact commit | CI pending |
| P1 | Mobile and Safari headset playback, fade/click measurements | Manual device test pending |
| P1 | Screen reader and keyboard audit, ear-specific gain controls | Manual validation and future enhancement |

**Fail closed:** A pull request and code files are not a production deployment. Release only after verified exact-SHA CI and manual Web Audio browser checks; do not claim clinical results or paid streaming integration.
