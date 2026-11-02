# ATLAS 777 F15 — Gravity Chain evidence ledger

## Source chain
- F10 original DDL provenance; F11 read-only atlas-core ACL exposure; F12 isolated-only REVOKE; F13 RED/GREEN catalog contract; F14 ACL/RLS/owner preservation harness.
- Input SHA: `821926e67e54592b8e3e1b90e85eb2596a8a6b02`.
- F15 corrected F14 to require a genuine RED baseline before running the revocation, commit `72844ab3865a153718c94cbadf3fd7d2d69c4f0e`.

## Workflow audit
`.github/workflows/atlas-777-isolated-postgres.yml` uses `postgres:17`, checks server version and smoke, then invokes `atlas-777-people-real-dependencies.sql` without replaying the authentic foundation. Its final step explicitly exits nonzero to reject premature certification. Adding F14 after the existing prerequisites without an authentic bootstrap would not certify anything.

## Execution dependencies (P0)
1. Authentic Supabase Auth schema/roles/functions (`auth.users`, `auth.uid()`, `auth.jwt()`), not synthetic replacements.
2. Full original ATLAS Core/Identity/audit migrations and verified transitive functions/triggers.
3. Baseline ACL snapshot matching read-only atlas-core evidence; seven direct TRUNCATE grants on anon/authenticated.
4. Isolated PostgreSQL 17 RED F13 -> F12 REVOKE -> GREEN F13 -> F14 ACL/owner/policy equivalence.
5. Real tenant A/B RLS negative tests and concurrent revocation with distinct connections/transactions.
6. Workflow check-runs for exact HEAD SHA and independent Ruleset enforcement.

## Evidence limitations
No PostgreSQL 17 test was executed in this F15 cycle; no RED/GREEN database result, RLS A/B result, revocation concurrency result or exact-SHA CI proof exists. The workflow was inspected, **not weakened or declared green**. No Supabase DDL, merge, deploy, production mutation, secrets or spend.

**Decision: P0 NO-GO.**
