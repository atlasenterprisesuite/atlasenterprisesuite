# ATLAS Secure Data Room 777 — consolidated audit checkpoint

Checkpoint under review: PR #948, branch feat/secure-data-room-777-tdd-20261029.
Scope: predeploy only. No production migration, merge, or deployment authorized.

## Evidence confirmed
- PostgreSQL 17 workflow succeeded on commit 122be7aa071055e88db7f66f1f4f13762c7270c5.
- Its job log shows successful disposable PostgreSQL startup, minimal role/schema bootstrap, deny-default migration, RLS/privilege assertions, locked-authorization migration, and negative authorization/sequential revocation SQL.
- The deny-default schema has no application policies or grants; this is intentionally unavailable, not a usable document service.
- HTTP handler returns no document bytes or signed URLs.
- Edge entrypoint deliberately returns deny decisions because document, membership, grant, and active-session resolvers are not implemented.

## New work in this checkpoint
- Added a two-session PostgreSQL concurrency runner. Transaction A acquires document and grant row locks through the authorization function; transaction B attempts revocation and must wait; a subsequent authorization must return false.
- Added that runner to the dedicated PostgreSQL 17 workflow.
- Existing negative SQL covers cross-tenant scope, unauthorized actor, and sequential grant revocation.

## P0 blockers
1. The authorization SQL function is not granted to any runtime role and is not connected to a document delivery transaction.
2. Active organization membership and authoritative session revocation are not checked by the SQL function.
3. No secure document read/storage delivery path exists; the HTTP handler is an authorization-only empty response.
4. The current concurrency test proves lock ordering for a grant update, not revocation of an already completed external download or an atomic read-and-stream transaction.
5. Direct PostgreSQL execution of the new two-session test must be observed on the exact current SHA.
6. Full E2E tests, required-check exact-SHA certification, and independent security review remain outstanding.

## Release decision
P0 NO-GO. Do not merge or deploy. Do not create permissive RLS policies or issue signed storage URLs until identity, membership, grant, tenant, revocation, audit, and delivery are implemented and tested together.
