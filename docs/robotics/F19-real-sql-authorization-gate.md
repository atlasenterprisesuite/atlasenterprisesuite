# Robotics H-Series F19 — real SQL authorization gate (isolated only)

Status: P0 NO-GO. This contract is not evidence that production authorization works.

## Preconditions
- PostgreSQL 17 disposable service; no production secrets or network.
- Apply a minimal fixture for public.organizations and public.organization_members in a fresh database.
- Apply the exact, unmodified files:
  - supabase/migrations/20261101_robotics_simulation_isolated_draft.sql
  - docs/robotics/phase5-postgres-isolated-prototype.sql
- Assert RLS is enabled and forced on both Robotics tables; inspect pg_policies and ACLs.
- Never use the privileged CI database owner as a substitute for an authenticated RLS test role.

## Negative assertions (all must pass)
1. Unauthenticated, anon and authenticated roles cannot invoke reserve, complete, halt, revoke or read either Robotics table.
2. Actor A cannot claim actor B, even if caller supplies B's UUID; absent an identity-bound entrypoint, fail the gate rather than exposing functions.
3. Organization A cannot inspect or mutate B; assert via an unprivileged connection, not owner bypass.
4. Membership inactive/revoked and organization inactive both deny operations.
5. Revoke organization_members while reserve/complete is in flight using two actual connections under READ COMMITTED. Show row-lock blocking and the reverse ordering; deny post-revocation operations.
6. Role and permission revocation must also be serialized or the operation must fail closed.
7. Invalid or absent tenant binding denies without side effects.
8. All evidence must include SHA, Postgres version, executed SQL file checksums, job logs and cleanup.

## Known blocking defects
- SQL functions accept caller-supplied actor_id and do not verify auth.uid().
- Grant-row lock does not serialize external organization_members revocation.
- Draft has no ordinary-role RLS policies by design. Adding permissive policies is forbidden until trusted identity and transaction binding are implemented.
- The previously passing isolated test uses simplified test tables, not the exact Robotics SQL.

## Acceptance
Keep P0 NO-GO until tests execute against the exact SQL and all negative checks pass. Never merge or deploy based only on green generic CI.
