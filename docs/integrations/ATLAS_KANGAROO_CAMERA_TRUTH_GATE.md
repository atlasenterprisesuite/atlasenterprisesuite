# ATLAS Cameras — Kangaroo integration truth gate

Status: **prototype / NOT deployed / no Kangaroo account or stream connected**. Tracking: #798, PR #799.

## What is verified
The owner supplied screenshots of the Kangaroo app with Indoor + Outdoor Cam settings, event playback and download/share controls. This supports a manual file-export workflow, not a third-party camera-control API.

## Supported integration phases
1. **Manual import:** owner exports a clip from Kangaroo and uploads it through a future authenticated ATLAS UI. Do not enable the feature until signed upload, file validation, malware scanning, storage policy, RLS and audit logs exist.
2. **Provider-approved pairing:** only if Kangaroo documents and authorizes an API, SDK or compatible standard. Obtain owner consent and provider-scoped tokens, stored server-side.
3. **Live view and actions:** only when a provider adapter demonstrates the specific capability with an end-to-end device test.

## API boundary
The `packages/cameras/capability-gate.ts` gate is a reusable authorization primitive, **not an HTTP endpoint**. It must execute on the trusted server, with authenticated tenant and camera grants derived from the database. Never trust a client-supplied `tenantId`, `allowedCameraIds` or `capabilities`. A client may request a capability but may not grant it.

Default capabilities are all false. A provider adapter may set a capability true only after verified provider support. Unsupported live view or remote control returns `capability_unavailable`; do not scrape Kangaroo sessions or intercept credentials.

## Release blockers (P0)
- Server-side authenticated routes and trusted device registry
- Supabase schema and tenant-isolated RLS verified with negative tests
- Signed upload flow, file type/size checks, malware scanning, retention and encrypted storage
- Consent, audit log, access revocation, rate limits and secret storage
- Vendor compatibility proof for any live-control operation
- CI, security scanning, exact-SHA production deployment and E2E proof

The GitHub PR is a first code increment only. No production status can be inferred from source commits or passing unrelated checks.
