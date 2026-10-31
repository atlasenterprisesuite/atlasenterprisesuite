# ATLAS 777 — Advisory / Data Room security gate (isolated)

Status: **P0 OPEN / NO-GO**. This document is a test contract, not proof of executed tests.
Source branch: PR #961 head `dcfb06512020cc0369e955992b4e24f6b4921c40`.
Related: PR #946 and PR #948. Do not merge/deploy this branch.

## Existing components to reuse
- Advisory: `public.advisory_actor_org()`, firm membership RPC hardening, `scripts/advisory-db-preflight.mjs`, `scripts/advisory-postgres-smoke.sh`, isolated CI.
- Data Room: `packages/security/secure-data-room-{policy,read-boundary,trusted-adapter,http}.ts`. Existing Edge function deliberately denies all access; do not turn on until authoritative sources are integrated.

## P0-A: deterministic revocation interleavings
Use a disposable offline PostgreSQL instance, non-root, private Unix socket, no production credentials, no service_role subject calls. Record server version, migration checksum/order, transaction isolation and role/grants. Seed synthetic org A/B, firm A1/A2/B1, user U1, and synthetic client/engagement. Test both ordering directions with two independent database connections:

1. T1 starts authorized Advisory write, pauses after membership verification but before INSERT/COMMIT. T2 revokes U1 firm membership and commits. Resume T1. **Required:** no write commits after effective revocation. If the implementation allows this, mark RED and redesign with a documented common lock/serialization point for write and revoke; do not falsely accept snapshot checks.
2. T2 takes the revocation lock first, commits; T1 then attempts each write RPC. **Required:** deny; zero rows.
3. T1 locks the authorization record first and writes; T2 revokes after T1 commits. **Required:** serial order is explicit, no write commits after revocation.
4. Repeat for organization membership, session expiry, cross-firm client/engagement identifiers, and actor with two active organizations.
5. Exercise deadlock retry and lock timeout. **Required:** fail closed, no partially committed writes, bounded retry policy, SQLSTATE and before/after snapshots.

A test that only asserts SQL text or sequential membership checks does **not** satisfy P0-A.

## P0-B: Data Room authoritative boundary
- Keep the Edge entrypoint denying access until server-side identity/session revocation, document scope, membership, grants and RLS are implemented and tested.
- Never trust tenant/org IDs or boolean authorization flags supplied by clients.
- Negative E2E: revoked session, revoked grant, removed membership, cross-tenant document, concurrent revoke/read, malformed ID, missing bearer, stale cached decision, service-role exposure and signed URL persistence.
- No document bytes or signed URLs may be returned by the existing read authorization endpoint.
- Verify every denial returns no sensitive body and `Cache-Control: no-store`.

## Evidence required before changing NO-GO
Exact head SHA and clean checkout; executed command and exit code; test fixtures and deterministic synchronization logs; full CI jobs and conclusions; RLS/grants evidence; reviewer signoff; browser/API E2E; production deployment SHA only after separate authorization. A green environment smoke test is not an authorization proof.

## Related release gates
Ride #958: recheck exact-head CI, cancellation races and authenticated route E2E.
GPS #954: integration, accessibility, provider attribution and external-service failure handling.

No production SQL, merge, deployment, paid calls, or customer data authorized by this document.
