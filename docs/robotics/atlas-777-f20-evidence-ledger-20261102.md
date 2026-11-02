# ATLAS 777 — Robotics #970 F20 evidence ledger (2026-11-02)

Status: **P0 NO-GO**, isolated research only. No physical actuation, production migration, merge or deploy.

## Exact-SHA evidence

- Verified branch HEAD before this ledger: `138cc15025bad90c2db7d54507b05b66333854c1`.
- Robotics PostgreSQL 17 workflow run `41445030971`, job `125275893088`: completed success; SQL negative-test step success.
- Security Baseline and Sentinel Shield success at observation; other five workflows still running. Recheck all workflows on the resulting ledger commit; old green is not proof for a new SHA.
- Earlier workflow `41441172214` completed success at `8ac270c113451f3aa48d625527d0ff028735f651`.
- SQL-only pull-request filter omission corrected in `138cc150`: includes original simulation migration, phase5 prototype and F19 guarded SQL.

## Inspected source and exact limitations

- `tests/robotics/f19_real_sql_gate.py` loads the two original SQL files and validates FORCE RLS, zero permissive policies, ordinary-role ACL denial, and cross-tenant/actor negative calls. It creates a *test-only* `auth.uid()` from `test.verified_actor`; this is not Supabase JWT identity proof.
- `tests/robotics/f19_guarded_sql_gate.py` installs test-only `has_identity_permission()` and `auth.uid()` definitions. Positive authorization is not certified.
- `tests/robotics/f19_original_sql_transaction_proof.py` uses two actual PostgreSQL connections and lock ordering for membership revoke-first and complete-first; however, the privileged CI fixture manually locks `organization_members`, not the authoritative deployed mutation path. It does not prove role/permission revocation or production RLS.
- `tests/robotics/postgres_membership_revocation_proof.py` uses simplified `test_members` and `test_runs` tables, not deployed schema.
- `packages/robotics/h-series-supabase-auth.ts` calls `auth.getUser(token)` and then `auth.getUser()` to compare token/user binding, checks active membership/organization and `has_identity_permission(o,p)`. Its `ScopedSupabaseReader` interface alone cannot establish that the injected client uses a non-bypass caller JWT. `tenantId=orgId` remains a compatibility assumption requiring authoritative validation.

## P0 acceptance gates

1. Obtain and verify actual `atlas-core` Auth/JWT caller-scoped Supabase client, no `service_role` or owner bypass, and actual tenant/org mapping.
2. Establish `execution.read` and `execution.write` permission policy with real migrations, including revocation, without production grants.
3. Test real original organization membership/role-permission mutation paths under two independent non-bypass transactions at READ COMMITTED; check lock ordering, after-revoke denial and cross-org negative cases.
4. Prove ordinary-role FORCE RLS, ACL, missing JWT, forged actor, stale/replayed token, inactive org and membership, role revocation, and concurrent operations on original SQL.
5. Revalidate Vitest, typecheck, all required CI checks and PostgreSQL 17 proof at the final exact SHA.

No claim of completed integration or certification is made by this ledger.
