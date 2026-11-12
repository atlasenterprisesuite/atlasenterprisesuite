# ATLAS 777 PR #978 — Effective TRUNCATE privileges P0 (read-only audit)

Checkpoint `aee5aab4963a293fc79c09b8be85f37a40b20b4c`. Source: authorized **catalog-only SELECT** on atlas-core PostgreSQL 17.6. No TRUNCATE, DML, production mutation, secrets, or user rows.

## Effective privileges (confirmed)

PostgreSQL `has_table_privilege(role_oid, table, 'TRUNCATE')` returned **true** for both `anon` and `authenticated` on both `public.identity_permissions` and `public.organization_modules`. `has_schema_privilege(role_oid,'public','USAGE')` also returned **true** for both roles. Both roles have `rolinherit=true`, `rolcanlogin=false`, `rolbypassrls=false`, and are not superusers. `authenticator` is LOGIN, NOINHERIT, has membership in `anon`, `authenticated`, and `service_role` with `set_option=true`, but itself does not inherit TRUNCATE. This supports a database-level authorization exposure if a privileged SQL execution path can run under the switched API role; it does **not** establish that PostgREST exposes a TRUNCATE endpoint or that an attacker has such a SQL execution path.

`service_role` has TRUNCATE and BYPASSRLS, and `postgres` owns the relevant tables; do not alter those roles in this PR.

## Proposed least-privilege remediation (NOT APPLIED)

After owner/security review, stage a separate audited migration containing only targeted `REVOKE TRUNCATE ON TABLE public.identity_permissions, public.organization_modules FROM anon, authenticated;`. Check for PUBLIC grants, inherited grants, default privileges, and application requirements before approving; verify effective privilege becomes false in a disposable environment. Do not change atlas-core during this review.

## Negative TDD — disposable PG17 only (NOT EXECUTED)

1. PG17-NEG-11: `SET ROLE authenticated`, verify `has_schema_privilege` and `has_table_privilege` before/after migration, and require TRUNCATE privilege false after revoke.
2. PG17-NEG-12: Repeat for `anon`.
3. PG17-NEG-15: As authenticator with approved role switch to anon/authenticated, confirm effective TRUNCATE privilege false after revoke. Verify schema USAGE and role membership separately.
4. PG17-NEG-16: Verify RLS SELECT/INSERT/UPDATE/DELETE isolation remains unchanged for A/B organizations after targeted revoke; TRUNCATE must be denied without actually truncating any non-disposable table.
5. PG17-NEG-17: Check inherited/PUBLIC privileges and prove no remaining privilege source regrants TRUNCATE.

## Release gate

P0 remains **NO-GO**. Database effective grants are confirmed; external exploitability through a public API is **not demonstrated**. An authentic disposable Supabase/Auth bootstrap is still missing; no PostgreSQL negative tests or remediation were executed. No merge/deploy/costs/secrets.
