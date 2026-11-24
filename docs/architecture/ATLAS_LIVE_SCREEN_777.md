# ATLAS Live Screen Intelligence 777 — gated foundation

Status: **P0 OPEN / NOT LIVE**. This is a policy-only Swift package, not an iPhone screen capture implementation.

## Reuse
- Device OS: `apps/web/src/modules/device-os/DeviceOSPage.tsx`
- Intelligence Gateway: `supabase/functions/atlas-copilot/intelligence-gateway.mjs`
- Existing Apple speech design: `native/apple-personal-voice-bridge`
- Existing vision route: `supabase/functions/atlas-sign-interpret/index.ts`

## Proposed architecture
Explicit user ReplayKit Broadcast Upload Extension consent → native frame sampler → on-device sensitive-data redaction → short-lived authenticated transport → server-side verified JWT, organization membership and RBAC → bounded visual inference → textual response → authorized on-device AVSpeechSynthesizer. No passive capture or remote device control.

## Security gates before any frame transport
1. Native ReplayKit broadcast extension with OS-visible capture indicator and user-controlled stop.
2. Verified server-side authorization for every session; tenant ID must come from authenticated membership, never a client claim.
3. Ephemeral session credentials, sequence and timestamp validation, request size/rate limits, strict TLS and cost limits.
4. Redact notifications, password fields, financial/health content and system permission prompts; fail closed when redaction cannot be guaranteed.
5. No raw-frame logging, analytics or persistence by default. Audit only metadata without images, secrets or transcript content.
6. Real capability negotiation for image understanding: the current intelligence gateway lists only generation and reasoning; do not mislabel it as vision-ready.
7. Explicit consent for spoken output and interruption controls; never export Apple Personal Voice audio.
8. Unit/integration tests for consent, tenant isolation, revocation, replay, expired credentials, oversize frames, cost and rate limiting; physical iPhone end-to-end verification.

## Current limitations
No ReplayKit extension, transport endpoint, backend image inference, iOS host integration, or speech integration is implemented by this foundation. No CI/device tests have been verified. Do not merge or deploy while P0 remains open.
