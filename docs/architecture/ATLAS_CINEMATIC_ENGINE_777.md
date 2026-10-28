# ATLAS Cinematic Engine 777 — isolated composition increment

Date: 2026-10-28. Status: **offline proof only; P0 NOT CLOSED**.

## Reuse and boundaries

The canonical product remains ATLAS Studio / Director and its versioned
`ProductionSpec`. `services/creator-native/cinematic_composer.py` is a
deterministic local *composition* extension, not a new product, publishing app,
text-to-video model or paid-provider adapter.

The existing `native_composer.py` remains unchanged. This increment **is not
called** by `atlas-creator-native` Edge, `NativeComposerHandler` or the
Social Publisher. Do not report it as production-ready or expose a public route.

## What this code can do

- Stage image/video shots from a controlled, local media directory.
- Apply still-image camera zoom, portrait scale/crop and scene crossfades.
- Compose an optional pre-recorded voice and low-level local soundbed.
- Burn an explicitly staged SRT subtitle file.
- Export H.264/AAC MP4 and check dimensions/codecs with ffprobe.
- Enforce limits on shot count/duration, aspect ratio, frame rate and
  filename extensions, and reject path traversal and symlinks.

This code **does not** create photorealistic human performances, emotional
speech synthesis, licensed source media or a content-moderation decision.

## Safe execution

Only execute from an isolated, unprivileged worker with no network egress and
CPU/memory/time limits. ffmpeg can parse complex third-party containers; an
application-level filename allowlist alone cannot guarantee sandbox isolation.
Provide media by an authorized staging job, not by arbitrary client filenames.

The fixture tests rely only on the Python standard library and ffmpeg/ffprobe
being installed, and can be invoked with:

`python -m unittest discover -s services/creator-native -p 'test_cinematic_composer.py' -v`

For offline work, import `cinematic_composer.render(spec, asset_root, path)`
from a trusted Python entrypoint. The interface is intentionally *not* a
public API. A spec includes `size` (portrait WxH), `fps`, `dissolve`,
`scenes: [{media, duration, motion}]`, optional `voice`, `soundbed` and
`captions`, where each media reference is a basename of a pre-staged file.

## Unresolved release gates (fail closed)

P0 — Asset provenance, rights and creator approval; true tenant-isolated
staging and authorization of every media reference; revoke access when org
membership changes; private Creator asset storage; transaction/version
binding to `ProductionSpec` and per-job audit evidence; no-egress sandbox;
resource quotas; robust output ownership, cleanup, cancellation and crash
recovery; exact-SHA tests and security review; native readiness gate plus
production E2E to Creator Library; video/voice quality acceptance.

P1 — Smartphone caption safe zones, color/contrast, loudness mastering,
translations and detailed visual QA.

## Reel 01 acceptance

For «¿Humanos o robots?»: preserve the original approved narration. A
composition smoke render is *not* the approved final Reel. Final release
requires scene-specific moving footage or separately authorized generative
video, a natural approved voice, verified soundtrack rights, visual continuity,
caption verification, and human editorial signoff. Never publish
automatically.

## Evidence discipline

A merged commit would not prove runtime readiness. All claims must link to an
exact SHA plus CI and functional checks; P0 remains open in the absence of
those results. Never infer platform connection from the UI's disabled
publish button or infer zero infrastructure cost from a local renderer.
