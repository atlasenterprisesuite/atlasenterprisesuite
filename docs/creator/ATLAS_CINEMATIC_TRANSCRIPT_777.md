# ATLAS Cinematic Captions & Interactive Transcript — RUN 001

## Purpose and reuse

The user-provided YouTube screenshot is a functional reference for cinematic video, captions and interactive transcript, not a source for copying third-party content or code.

Canonical repository: atlasenterprisesuite/atlasenterprisesuite. Existing route: /studio/create?type=video.

This change extends ATLAS Director with a collapsible local editor instead of another app, backend, provider or charge. The existing Director, Motion Designer, Creator Library, production permissions, version gates and ATLAS Native Composer are unchanged.

## Implemented on the feature branch (not a production claim)

- Import authorized local video up to 500 MB using browser object URLs, revoked on cleanup.
- Import UTF-8 SRT/VTT or paste timed captions; strict millisecond parser; fail closed on malformed times, invalid intervals or overlaps.
- Create timed cues at the real video playhead; edit start/end/text; remove cues.
- Search transcript case-insensitively and accent-insensitively; seek to matching cue start; show synchronized caption overlay.
- Preview cinematic red, monochrome, gold or original styles; add optional opening title.
- Export SRT and WebVTT locally.
- Conditionally render a real captioned video using Canvas capture + Web Audio original-audio routing + MediaRecorder, capped at ten minutes and 1280-pixel long edge. The downloadable file is exposed only on successful browser recording with a nonempty Blob, and its MP4/WebM type depends on browser support.
- No uploads, remote provider calls, publishing, billing, external ASR, or backend changes.

## Security and truth boundaries

- Local editing is separate from ATLAS Director persisted ProductionSpec. It does not grant creator.generate, bypass RBAC/RLS, or claim that existing native renders have acquired these cues.
- Rights acknowledgment is required in the browser before rendering. This is not server-side proof of licensing.
- Input is rendered as literal React text or Canvas fillText. Subtitle data is never interpreted as HTML.
- Export fails closed on invalid, overlapping, unsorted, empty or out-of-duration cues.
- Browser video export requires verified runtime APIs (MediaRecorder, Canvas capture, Web Audio), user-triggered playback and valid media. Unsupported devices cannot export video. Captions and previews can still work.
- Source files remain on the device unless the user explicitly downloads output. The app does not retain uploaded files across sessions.
- Original video audio is recorded through a MediaStreamAudioDestinationNode, not simulated. Actual audio continuity and quality must be verified with real video fixtures.
- Render refuses excessive caption length rather than silently claiming all text was burned in; standalone SRT/VTT export may still work.

## Verification matrix

| Gate | Code or evidence | Status |
| --- | --- | --- |
| Timed captions parser, roundtrip, search and fail-closed | tests/unit/atlas-cinematic-captions.test.ts | Await exact SHA CI |
| Director route, import/search/edit failures | tests/integration/atlas-cinematic-transcript-studio.test.tsx | Await exact SHA CI |
| Typecheck, full regression, build and security | npm run verify:all | Await CI |
| Actual video render with retained audio, A/V sync, captions | Browser playback and resulting video | P0 pending |
| Keyboard, screenreader, mobile and responsive | CSS and human/browser E2E | P0 pending |
| Authenticated route, permission enforcement, tenant isolation | Existing Director guard unchanged; security review needed | P0 pending |
| Cloudflare production route and exact SHA | Deployment manifest and live verification | P0 pending |

**Overall: P0 NO-GO** until all required validation and release evidence exists.

## Known limitations and next steps

1. Automatic speech-to-text is NOT connected. A local authorized ASR model or a verified tenant-scoped service is required to create timings from audio.
2. The local browser recorder is not a replacement for a native compositor; unsupported codec/browser, inactive tab, autoplay, and mobile restrictions can prevent export. Inspect any generated video before publishing.
3. Separate soundtrack mixing, bilingual translation, word-by-word highlighting, and cloud asset persistence are not implemented.
4. Existing Voice Transcripts data structures are not an arbitrary-media transcription engine. Do not claim otherwise.
5. Existing native production captions do not automatically consume the new local edit timeline. A future governed persistence mapping must be tested before asserting an integration with server rendering.

## Runbook

1. Under authenticated ATLAS, open /studio/create?type=video and expand Cinematic Captions & Interactive Transcript.
2. Select a video with editing rights. Import SRT/VTT or add cues while previewing.
3. Search and seek transcript cue times against the actual video and audio; adjust text and timing.
4. Export subtitles locally. For video export, acknowledge rights and check local recorder capability.
5. Download and inspect video output, sound, timing, layout and rights before considering publication.
6. Never merge or deploy without exact-HEAD successful CI, required security/accessibility review, E2E and production SHA evidence.
