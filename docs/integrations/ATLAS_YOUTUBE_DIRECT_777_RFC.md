# ATLAS YouTube Direct — 777 REVIEW (Design RFC, not production)

Status: DESIGN ONLY. P0 NO-GO until implemented, verified, authorized, and deployed.

## Goal and scope
Operate three distinct YouTube channels from ATLAS Enterprise Suite: GTA Universe 777, AI Revolution 777, and Future World 777. Remove the need for vidIQ/HubSpot intermediary apps. Do **not** attempt to bypass Google's identity or authorization controls: YouTube writes require Google OAuth 2.0 and YouTube Data API permissions. No passwords or Google verification codes are collected by ATLAS.

## Flow
1. Channel owner opens ATLAS `/youtube/connect`; ATLAS creates short-lived, one-use OAuth state + PKCE challenge tied to tenant, user, device, and requested scopes.
2. Owner explicitly consents at Google's consent screen. OAuth callback verifies state, PKCE and issuer; backend exchanges authorization code server-side, never in browser JS.
3. Store refresh token only as encrypted secret (KMS/secret manager); do not log or expose it. Store channel IDs, granted scope, expiry, revoked status, and consent evidence. Use minimum necessary scopes.
4. Authorized RBAC editor creates original video + metadata; media stored private with tenant-scoped access and content integrity SHA-256.
5. Scheduler places an idempotent job with desired time and channel ID in a durable queue. An authorized worker validates active consent, tenant, content ownership, quotas, media readiness, token validity, and publication policy immediately before upload.
6. For YouTube publishing use official YouTube Data API supported upload and scheduling behavior, including current platform restrictions and OAuth verification/audit requirements. Do not claim publication until the platform returns a video ID and a subsequent read confirms required status.
7. Webhook/polling reconciliation records actual platform state, timestamp, attempts, errors, video URL and channel. Quota/revocation failure => fail closed; retry bounded with backoff. Do not repost blindly after timeouts.
8. Allow revoke immediately: disable new jobs and purge token material under retention policy; record audit event.

## Proposed components
- `apps/web`: YouTube Direct connection screen, channel chooser, schedule calendar, permission/revocation controls, real status and error screens.
- Shared adapter in existing ATLAS Manager services (confirm appropriate package from repository first): OAuth session handler, token vault interface, YouTube API client.
- Supabase `atlas-core`: `youtube_connections`, `youtube_drafts`, `youtube_publication_jobs`, `youtube_publication_events`; enforce tenant RLS and server-side RBAC, unique idempotency keys.
- Worker/queue: durable scheduled dispatch, lease/heartbeat/replay, rate/quota controls, dead letter triage.
- GitHub Actions: unit/integration/security tests, PR CI, build and deployment evidence linked to exact commit SHA.

## P0 acceptance criteria (all must pass)
- OAuth state replay, CSRF, scope escalation and cross-tenant credential access tests fail closed.
- Consent missing/revoked/expired blocks scheduling dispatch and publishing.
- No raw OAuth refresh tokens or user media appear in client logs, traces, analytics or CI output.
- Request/retry idempotency prevents duplicate uploads.
- Platform API rejects or quota limits yield truthful pending/failed states; scheduling claims require official confirmation.
- Per-channel isolation: no drafts, jobs or credentials can cross tenant/user/channel authorization boundaries.
- Accessible mobile and desktop UI; permission status and pending state clearly visible.
- End-to-end sandbox/test-channel upload, scheduled publication and revocation tested; live production connection must be explicit.
- CI, PR review, merge, deployment and production E2E verified against exact SHA before marking COMPLETE.

## Phase plan
A. Inventory existing auth, secret vault, ATLAS Manager, queue and Supabase migrations before writing new code.
B. TDD for OAuth isolation, revocation, retries, audit and API mock edge cases.
C. Implement connection and consent UI + secure callback, then channel list/read permissions.
D. Add drafts, media validation and queue; add publication worker and reconciliation.
E. Run unit, integration, E2E, accessibility and production verification. P0 failures block promotion.

## Authorization boundary
The user's approval to design/build ATLAS YouTube Direct does not itself grant a Google OAuth token or YouTube publishing access. Google must complete its official consent flow, and any separate costs/third-party scope approvals remain gated.
