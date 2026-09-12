# ATLAS Creator / Studio

Owner: ATLAS Studio. Integrations: ATLAS Identity, Security, Voice, Knowledge Atlas and Supabase.

## Product contract

- Routes: `/studio`, `/studio/create`, `/studio/library`, `/studio/providers`, and existing `/studio/voice`.
- Every route is protected by ATLAS Identity and active organization membership.
- Image, video, music, voice and visual-location features expose provider readiness truthfully.
- No external provider is labeled connected until its authorization and a successful readiness check are verified.
- Generation results become assets only after the provider response is received and persistence succeeds.
- Visual-location analysis is opt-in, confidence-bearing and prohibited from silent tracking.

## Supabase contract

Production persistence requires tenant-scoped creator projects, generations, assets, provider connections and audit events with row-level security. This UI intentionally shows a configuration-required or empty state until those migrations and authorized provider credentials exist.
