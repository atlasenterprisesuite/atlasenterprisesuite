# Telnyx Slot Reuse Design

## Goal
Activate the existing ATLAS Telnyx telephony runtime without increasing Supabase Edge Function count.

## Approved approach
Reuse exactly two already-disabled one-time Edge Function slots:

- `atlas-cloudflare-seed-build-once` becomes the outbound/readiness Telnyx runtime.
- `atlas-cloudflare-main-build-once` becomes the Telnyx webhook runtime.

The canonical source remains:

- `supabase/functions/atlas-communication-telephony/index.ts`
- `supabase/functions/atlas-communication-telephony-webhook/index.ts`
- shared Telnyx helpers under `supabase/functions/_shared/`

No provider logic is duplicated or weakened. Runtime aliases must use the current hardened canonical implementation from `main`.

## Frontend routing
`apps/web/src/lib/telephonyApi.ts` must target the reused outbound runtime slug instead of the undeployable canonical slug.

Readiness:
`/functions/v1/atlas-cloudflare-seed-build-once?api=readiness`

Outbound call:
`/functions/v1/atlas-cloudflare-seed-build-once?api=call`

The configured Telnyx webhook URL must point to:
`https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-cloudflare-main-build-once`

## Security constraints
- Keep JWT verification enabled for the user-facing outbound/readiness function.
- Keep JWT verification disabled only for the webhook runtime because Telnyx authenticates via Ed25519 signature verification in the function body.
- Do not expose Telnyx API keys, Supabase service-role keys, webhook public keys, or secret values in client code, logs, PR descriptions, or chat.
- Readiness remains fail-closed until provider API authentication, connection ID, from number, HTTPS webhook URL, and Telnyx public key are all configured and valid.
- Preserve tenant isolation, RBAC, audit logging, and signed webhook verification.

## Verification
- TDD must prove the frontend uses the reused runtime slug.
- Repository verification and CI must pass before merge.
- Supabase must show both reused functions active after deployment.
- Provider readiness must report `verified: true` only after real Telnyx configuration exists.
- A real E2E call is only considered complete after provider acceptance and signed lifecycle webhook evidence are recorded.
