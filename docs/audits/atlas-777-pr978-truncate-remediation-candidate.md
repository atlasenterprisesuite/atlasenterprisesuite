# ATLAS 777 PR #978 — Targeted TRUNCATE remediation, preflight and rollback

Status: **PROPOSED ONLY — NOT APPLIED**. This file is a review artifact, **not** a Supabase migration. Prior verified exact-SHA `4851c4929d35e02713a55c128b7c35238ea1e283` passed all seven workflows. Catalog-only read confirmed both `anon` and `authenticated` have effective TRUNCATE and public schema USAGE on `public.identity_permissions` and `public.organization_modules`.

## ACL provenance

Direct table ACL TRUNCATE entries for each table: `postgres`, `anon`, `authenticated`, `service_role`. **No PUBLIC TRUNCATE ACL entry**. Both user-facing roles have effective TRUNCATE. This is a confirmed PostgreSQL privilege misconfiguration; a reachable public SQL execution path is not established. RLS does not restrict TRUNCATE.

## Review-only migration candidate (DO NOT RUN ON atlas-core)

```sql
BEGIN;
REVOKE TRUNCATE ON TABLE public.identity_permissions, public.organization_modules FROM anon, authenticated;
-- Confirm with has_table_privilege(role_oid,table_oid,'TRUNCATE') in the SAME isolated test DB.
-- Fail the migration transaction if effective privileges remain true.
COMMIT;
```

No production migration is authorized by this document. Revalidate current ACLs immediately before any separately approved deployment. Preserve `postgres` and `service_role` grants.

## Disposable PostgreSQL 17 verification plan

1. Use a fully isolated Supabase Auth-compatible PG17 environment with verified original roles, ownership, tables, triggers, and policy dependencies; never use real users or rows.
2. Before patch: verify effective TRUNCATE for `anon` and `authenticated` returns true on both tables (negative RED condition). No destructive SQL is needed to observe this.
3. Apply candidate REVOKE only in isolated DB. After patch: verify all four effective TRUNCATE checks return false; verify postgres/service_role remain true.
4. Confirm `authenticator` can switch to the two API roles, and the resulting effective privilege remains false.
5. Run the prior negative tests for A/B SELECT/UPDATE/INSERT/DELETE and issuer revocation concurrency using synthetic fixtures. Ensure no accidental grants or policies change.
6. Save test commands, logs, runner identity, PostgreSQL version and exact commit SHA. Require required checks and owner review before any production change.

## Rollback guidance

Do **not** automatically restore these unsafe privileges. If compatibility breaks, diagnose application dependencies and implement least-privilege service paths; any regrant requires an explicit security exception and separate approval.

## Release status

P0 NO-GO until isolated RED/GREEN, API exposure assessment, and controlled deployment verification. No production SQL writes, no merge, no deploy, no cost, no secrets.
