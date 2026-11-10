# ATLAS Spotify Music & Connect — AUTH-001 source-only branch

Status: **PR-only / not connected / not deployed / P0 NO-GO**
Owner authority: GitHub repository read + focused Spotify branch / PR ONLY.
Explicitly excluded: Spotify private-account access, token exchange, Supabase/Cloudflare modifications, merge, deployment, provider spending.

## Reuse

- Existing authenticated ATLAS Studio route: /studio/mix (Local DJ).
- Existing local-browser audio processing is untouched; Spotify audio must never be recorded, downloaded, remixed or synced to video by this integration.
- Existing ATLAS Identity and organization-specific provider custody must be reused before OAuth is ever enabled.

## Implemented source contract

1. Spotify URL analyzer: strict HTTPS host and path checks; public resource normalization; short-link destination stays **unverified**, no redirect following.
2. Studio companion section: local, no-network URL identification and Spotify-native device handoff instructions. Does not display "connected".
3. Spotify PKCE-S256 utilities: minimal read/modify playback scopes, random verifier/state, explicit callback validation. They do **not** perform authorization, token exchange or token persistence.
4. Injected-token Spotify Connect transport: list available devices, read player state, transfer to a single selected device with playback off by default. This is *not wired to a user account* without separate consent.

## P0 gates

- Spotify app quota mode, Premium requirement and commercial policy eligibility must be verified.
- Explicit separate account authorization **AUTH-002** required before any Spotify login, authorization or private-resource API call.
- Token vault, organization/user binding, expiration, revocation, CSRF one-time consume, rate limiting, auditing and live E2E require a reviewed ATLAS auth/provider implementation.
- Source CI exact-SHA, UI accessibility, responsive/browser E2E, production authorization and verification remain open.
- GitHub PR CI may run. It is not permission to deploy or merge.

Sources: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
https://developer.spotify.com/documentation/web-api/reference/get-a-users-available-devices
https://developer.spotify.com/documentation/web-api/reference/transfer-a-users-playback
https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide
