# ATLAS 777 F11 — Authentic catalog read-only findings (P0 NO-GO)

Project: atlas-core (Supabase ref ggmanzcgtlrvqfoccgsh). Observed PostgreSQL 17.6; project healthy. Only read-only catalog SQL was issued; no TRUNCATE, REVOKE, DDL, merge or deploy.

## Verified provenance
Production migration ledger lists `20260808183211_atlas_core_schema`, `20260809032705_atlas_identity_foundation`, `20260809032710_atlas_identity_audit_hardening`, `20260809032746_atlas_identity_invoker_hardening`, `20260809040445_atlas_identity_member_admin`, `20260809040925_atlas_identity_hierarchy_locking`. Corresponding SQL source candidates are in `tests/security/recovered/`. Migration names do **not** prove byte-identical production DDL.

## Effective privileges — critical finding
Read-only `pg_class`/ `pg_namespace` and `has_table_privilege(role, oid, 'TRUNCATE')` confirmed effective TRUNCATE for **both** anon and authenticated on all seven public tables:
`organizations`, `organization_members`, `organization_modules`, `identity_permissions`, `identity_role_permissions`, `organization_role_permissions`, `audit_logs`.
`aclexplode(coalesce(relacl,acldefault('r',relowner)))` independently confirmed **direct** TRUNCATE ACL entries for anon and authenticated on all seven tables. RLS enabled on all seven; RLS does not protect TRUNCATE. This is a privilege exposure, not proof that a public HTTP endpoint can execute TRUNCATE. Do not attempt exploitation or data changes.

## Owners and function posture
All seven public tables owner `postgres`. `auth.users` owner `supabase_auth_admin`, RLS enabled, no anon/authenticated TRUNCATE. `auth.uid()` and `auth.jwt()` are SECURITY INVOKER; `public.has_identity_permission(uuid,text)` is SECURITY INVOKER; `public.audit_row_change()` SECURITY DEFINER and no anon/authenticated EXECUTE. `atlas_private.is_org_member(uuid)` and `atlas_private.has_org_role(uuid,text[])` SECURITY DEFINER and authenticated EXECUTE. Schema `atlas_private` USAGE granted authenticated, denied anon.

## Remediation plan — do not execute against production
1. Reproduce actual roles and ACLs in a disposable PG17 database; ensure ownership and inheritance equivalence.
2. Write a minimal migration to REVOKE TRUNCATE on the seven named tables from anon and authenticated, after dependency/privilege review; avoid changing service_role/postgres or other privileges.
3. Negative TDD: before fix, catalog detects exposure; after fix, has_table_privilege false for both roles on all seven; SELECT/INSERT/UPDATE/RPC authorization unaffected; tenant A/B and revocation concurrent tests.
4. Verify authentic Supabase Auth and complete transitive DDL, triggers, RLS policies, ownership, grants; no fake auth stubs.
5. Run isolated PG17 tests and exact-SHA CI. Require explicit production authorization separately.

## Blockers
No authentic PG17 bootstrap has been executed. No isolated negative test was executed in this run. No CI exact-SHA certification. P0 Fail Closed.
