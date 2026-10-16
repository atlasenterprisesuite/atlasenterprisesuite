# ATLAS Creator / Studio

Owner: ATLAS Studio. Integrations: ATLAS Identity, Security, Voice, Knowledge Atlas and Supabase.

## Product contract

- Routes: `/studio`, `/studio/create`, `/studio/write`, `/studio/content`, `/studio/web-launch`, `/studio/library`, `/studio/providers`, `/studio/teleprompter`, and existing `/studio/voice`.
- Every route is protected by ATLAS Identity and active organization membership.
- Image, video, music, voice and visual-location features expose provider readiness truthfully.
- No external provider is labeled connected until its authorization and a successful readiness check are verified.
- Generation results become assets only after the provider response is received and persistence succeeds.
- Visual-location analysis is opt-in, confidence-bearing and prohibited from silent tracking.

## Supabase contract

Production persistence requires tenant-scoped creator projects, generations, assets, content workspaces, web-launch blueprints, provider connections and audit events with row-level security. This UI intentionally shows a configuration-required or empty state until those migrations and authorized provider credentials exist.


## Web Launch Lab

`/studio/web-launch` is the canonical seven-stage website planning workspace. It reuses ATLAS Identity, organization-scoped Creator persistence, audit logging and Creator Library assets. It does not infer competitor research, fabricate proof, or invoke paid providers. Deployment readiness remains fail-closed: the canonical public domain, Web Launch route and critical ATLAS Network routes must verify before production is considered verified.


## Writing Desk

`/studio/write` is the governed ATLAS writing surface. It reuses the authenticated `atlas-copilot` intelligence bus rather than creating a parallel provider path. Quick actions remain editable, generation is disabled until server-reported provider readiness is verified, and user-supplied source text is preserved as an explicit boundary.

Text-like files are extracted locally in the browser up to 2 MB. Image-note extraction uses the browser's native local TextDetector only when that capability actually exists; unsupported OCR and unsupported document formats fail closed instead of fabricating extracted text. Generated drafts do not imply that an attachment was parsed unless extraction succeeded.


## Brand Experience QR + photographic 360

`/studio/web-launch#brand-experience` reuses the canonical profile and existing authenticated Studio/Web Launch route. QR is generated fully in-browser as ISO QR byte mode (ECC M, versions 1–10), only for validated HTTPS URLs, with a four-module quiet zone and explicit SVG download. No QR SaaS, redirect, tracking or request to the destination is performed. Unsupported/oversized URLs fail closed, and QR output does not attest ownership or destination safety. Destination must be inspected and scanned by an authorized person before packaging print.

The photo viewer accepts only 1–36 uniquely named JPEG/PNG/WebP files (<=6 MB each, <=96 MB total) and rotates an ordered, local image sequence. It only labels a set 'photographic 360°' after 12+ frames and explicit user confirmation of full 360° coverage; it does not claim a synthesized 3D model. Pointer drag, keyboard, next/previous controls and a labeled range are supported. No file is uploaded, published, charged or persisted by this component. React object URLs are revoked on clear/unmount. Release remains under exact-SHA global fail-closed checks.
