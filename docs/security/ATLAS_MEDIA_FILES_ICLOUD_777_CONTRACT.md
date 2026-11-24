# ATLAS Media & Files 777 — iCloud import contract

Status: predeploy design only. NO-GO until implementation, tests, authorization review and exact-SHA CI.

## Existing components to reuse
- `packages/core/src/libraryRouting.ts` for routing hints, not authorization.
- `/studio/library` Creator Library UI.
- Existing local file-selection patterns in Brand Experience.

## Boundaries
1. Browser selects files through user action (file picker); no claim of general iCloud Photos or iCloud Drive API access.
2. A native Apple bridge, if developed later, requires separately scoped Photos/Files authorization, visible revocation, and platform review.
3. All imports default to private and never become organization-shared based on filename, MIME, inferred tags or classification.
4. Require authenticated subject and explicit destination tenant; verify effective membership server-side for every upload/read/delete.
5. Use private storage, per-object ownership, short-lived signed URLs, audit logs, quotas, malware/content validation, and verified SHA-256.
6. Metadata must not leak cross-tenant names, thumbnails, EXIF/GPS, file hashes, or object keys.
7. No background sync or deletion of Apple originals without explicit, separately granted permission.

## Negative TDD acceptance
- Deny unauthenticated upload and read.
- Deny cross-tenant reads and writes even with guessed object keys.
- Deny revoked membership and expired sessions immediately at authorization boundary.
- Deny file type spoofing, oversize files, path traversal, unsafe previews and unsupported content.
- Deny import to shared workspace without explicit selection.
- Ensure duplicate hashes cannot expose another user's object.
- Verify aborted upload cleanup and idempotent retries.
- Verify deletion and revocation invalidate future access.

## Release gates
P0: authoritative tenant authorization, RLS, secure storage, revocation, upload constraints, negative tests, isolated E2E and exact-SHA CI all verified.
No SQL production, merge, deploy, provider spending or Apple account connection in this PR.
