# ATLAS Reel Evidence Lab 777 — Sovereign media evidence

Status: **candidate / P0 NO-GO** until branch CI, protected-route verification, and production exact-SHA E2E have passed.

## Integration
- Canonical home: `/studio/content`, behind existing ATLAS identity; adds a link to `/tools/atlas-reel-evidence-lab.html`.
- Hosted assets: `apps/web/public/tools/atlas-reel-evidence-lab.html` + same-origin `atlas-reel-evidence-lab.js` to satisfy the Cloudflare CSP (`script-src 'self'`).
- Portable offline build: one self-contained HTML file with the same JavaScript inlined **for download and local-file execution only**, not for deployment under the strict CSP. Do not weaken CSP to accommodate it.
- No new service, database, secrets, account integration, npm dependency, or vendor browser runtime.

## Implemented, evidence-based behavior
1. An HTTP(S) URL is normalized to a reference and tracking parameters are removed. It is never treated as fetched Reel content.
2. Local authorized video/audio is played from a transient `blob:` URL without transmission. Browser-supported duration and dimensions appear only after metadata loading.
3. A user can capture up to 10 current video frames with timestamps; all frame pixels are drawn locally.
4. Text and transcripts are **user supplied**. Token extraction returns only literal hashtags, mentions and URLs in supplied text; it is not automatic OCR, speech recognition or semantic analysis.
5. User claims have explicit source and evidence; a supported/contradicted claim is rejected without evidence text. Such labels are a user's assessment, not independent verification.
6. Video playback can drive a Web Audio frequency visualizer if supported by the browser.
7. Explicit JSON/Markdown export, clipboard export (when authorized by browser), printing, bounded JSON import and session deletion are available.
8. SHA-256 is computed from full bytes when Web Crypto is available and file size is <=64 MiB. Otherwise it reports an unavailable/size-limit state, never a fabricated digest.
9. No third-party API or autonomous harvesting. External links open only after user clicks them.

## Tests and validation
- `npm run typecheck`
- `npm run test:unit -- --run tests/unit/atlas-reel-evidence-lab.test.ts` or `npx vitest run tests/unit/atlas-reel-evidence-lab.test.ts`
- `npm run verify:all`
- Test a local 2s MP4: the player should show 00:02 and native 320x180 dimensions, capture a frame at a given time, register an unverified claim, reject an unsupported 'supported' claim, export JSON and import it.
- Verify Cloudflare serves both HTML and JS with the intended correct MIME types, the same-origin script executes under the CSP, `/studio/content` is protected, and the exact deployed commit matches CI.
- A passing screenshot is not production proof.

## Boundaries / roadmap
No browser-only tool can guarantee access to arbitrary Instagram Reels, private follows, comments or audio from a URL. Official APIs depend on eligible accounts and permissions. Do not bypass consent, platform access control or anti-automation barriers. A future native/local agent may add offline ASR/OCR models, batch ingestion of user-provided files, source-backed claim verification, encrypted persistence and immutable audit events, each with separate acceptance criteria and permission gates.

## Data minimization
No background jobs, cookies, video upload, analytics or silent synchronization. Data is kept in current page memory unless the user exports it. Exported JSON includes frame thumbnails and personal text, but **not** the video file; protect the export appropriately. File hash is unavailable above the memory safety threshold, and an imported hash is not proof that the currently selected video matches.
