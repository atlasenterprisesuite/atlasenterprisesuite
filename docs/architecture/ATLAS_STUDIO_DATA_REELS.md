# ATLAS Studio Data Reels · Motion Engine v1

This is an extension of the **existing** Motion Designer inside ATLAS Director (`/studio/create?type=video`), not a parallel creative platform, renderer, publisher or paid-media integration.

## Production workflow

1. In Director > Motion Designer enter a title and 1–5 lines of `Label | Value | https://public-source`.
2. A deterministic generator validates fields and HTTPS source syntax, then creates an editable portrait `ProductionSpec.motionComposition` (1080×1920, 30fps).
3. Facts appear as timed text layers with opacity animation. Each fact has a source text layer visible in the composition and a full source URL retained in motion metadata.
4. The Director updates duration, aspect ratio and title together through its existing reducer. The composition remains a **dirty draft** until explicitly saved and reviewed.
5. Editing a generated fact invalidates its claimed attribution. Removing a corresponding source or altering the number of facts also blocks the existing Director validation gate.
6. The existing native-render policy still requires verified native `motion-composition-v1` support, identity, permission, version lock, audio/readiness and human action.

## Truth and limitations

A syntactically valid HTTPS URL is **not evidence** that a number is factually accurate, licensed or current. Source links are supplied by the user, never automatically fetched or marked verified. Review by a person is mandatory before publishing.

This slice does not implement data retrieval, chart plotting, video rendering, TTS, independent fact-checking, creator-asset persistence, social account access, a public render service or third-party subscriptions. The existing Motion Designer displays text and source attribution as a local deterministic timeline preview; it does not claim a completed MP4.

No production merge/deploy is authorized by this change without exact-head CI, security/tenancy verification and E2E evidence. P0 fails closed.
