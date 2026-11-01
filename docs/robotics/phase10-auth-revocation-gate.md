# Robotics F10 — isolated authorization / PostgreSQL revocation gate

## Verified source
- packages/robotics/h-series-catalog.ts F9 blob: 390a4ec4ae19f758115d12f8860a4ee74a0da132
- tests/unit/robotics-h-series-catalog.test.ts F9 blob: fe3bf49cb53f8da16d85244c3dfb78254bc3cebe
- supabase/migrations/20260912_universal_execution_engine.sql blob: c72aea25950a31565f7290c3702d5b4fcc45a789
- Existing execution RLS policies use auth.uid() and organization_members(status='active') for SELECT. This does not independently prove tenant_id mapping or effective execution.read grants.

## F10 changes
- Server-only readAuthorizedHSeriesCatalog uses verifiedSession() and canReadCatalog() provider callbacks.
- It does not accept actor identity from a request payload, never uses service_role, and rejects missing/mismatched session, revocation, and authorization outages.
- Eight Vitest negative/positive cases authored; not executed.
- These are interfaces; no production session or authoritative membership implementation is wired.

## PostgreSQL disposable two-session test contract (NOT executed)
Fixture: org A and B, tenant A and B, user U with active membership A and execution.read. Use a non-bypass authenticated role, RLS enabled and verified.
1. Session S1 starts READ COMMITTED transaction and acquires FOR UPDATE on U's organization_members(A) row.
2. S2 attempts revocation of that same membership and must wait; verify via pg_locks / pg_stat_activity with bounded timeout.
3. S1 rechecks auth.uid(), org tenant mapping and effective execution.read while holding membership lock, then reads catalog. S1 commits.
4. S2 revokes membership and commits. A fresh S1 read must deny.
5. Reverse ordering: S2 revokes and commits before S1 locks/rechecks. S1 must deny.
6. Cross-org B, cross-tenant B, revoked role permission, null auth.uid(), and forged request actor must deny.
7. Ensure no SECURITY DEFINER/service_role bypass; check role grants, FORCE RLS, audit, timeout and deadlock cases.

## Critical caveat
Existing organization_members revocation implementation has NOT been shown to share a lock contract with catalog reads. A lock acquired only in a proposed test does not prove production revocation serialization. A real PostgreSQL integration must be built and tested after examining all membership mutations and effective permission functions.

## Execution status
No psql or Vitest executable was present in the available local container; TypeScript compiler exists but full repository/dependencies are not mounted, so a meaningful repository typecheck was not run. No PostgreSQL SQL executed, no CI proof. P0 NO-GO. No merge, deploy, physical hardware control.
