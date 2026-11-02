# ATLAS 777 PostgreSQL 17 — verified bootstrap provenance (2026-11-02)

Status: P0 NO-GO. Read-only catalog inspection of authoritative Supabase project atlas-core (ggmanzcgtlrvqfoccgsh), PostgreSQL 17.6.1.147. No production DDL or data mutations.

## Verified existing objects

- Native Supabase: auth.users (table), auth.uid() (SQL STABLE function, JWT sub from request.jwt.claim.sub or request.jwt.claims).
- ATLAS: public.organizations, public.identity_permissions, public.identity_role_permissions (tables).
- ATLAS: public.has_identity_permission(uuid,text) (SQL STABLE function), public.audit_row_change() (PL/pgSQL SECURITY DEFINER trigger function).

All seven were confirmed by pg_catalog on atlas-core. Their presence in production does NOT mean they exist in the isolated GitHub Actions PostgreSQL service.

## Newly identified transitive dependencies (must not be stubbed)

- has_identity_permission() reads public.organization_members and public.organization_role_permissions, joins public.identity_role_permissions, checks membership.status='active' and membership.user_id=auth.uid(), and applies organization role overrides before default role permissions.
- audit_row_change() calls public.redact_atlas_audit_jsonb(jsonb) and inserts into public.audit_logs; it calls auth.uid().
- Original People migration: supabase/migrations/20260923201500_atlas_people_core.sql.
- Original Advisory migration: supabase/migrations/20260918031500_advisory_office_core.sql.

## Next required implementation

1. Recover authoritative foundational migration history and full DDL (constraints, indexes, grants, RLS, ownership, triggers), including the five additional transitive dependencies above. Read-only catalog output alone is not a complete migration.
2. Reconstruct Supabase native auth bootstrap in isolated infrastructure and ATLAS migrations in dependency order. No permissive synthetic substitutes.
3. Execute original People and Advisory migrations in isolated PG17, then RED/GREEN identity, A/B isolation, membership/permission revocation concurrency and exact-SHA CI.
4. Keep the fail-closed prerequisite gate enabled. Do not merge or deploy until P0 certified.

Evidence: live read-only queries against pg_class/pg_proc/pg_namespace, pg_get_functiondef, and information_schema.columns on 2026-11-02. Do not copy production tenant records into test fixtures.

## 2026-11-02 RUN 2.0 MAX — additional read-only catalog verification

- Verified current `auth.uid()` is `LANGUAGE sql STABLE SECURITY INVOKER` and reads `request.jwt.claim.sub` or `request.jwt.claims` as a UUID. Its existence in production is **not** a native Auth bootstrap for a disposable PostgreSQL instance.
- Verified `public.has_identity_permission(uuid,text)` currently is `LANGUAGE sql STABLE SECURITY INVOKER` with `search_path=public,pg_temp`. The recovered 20260809 identity migration instead declares it `SECURITY DEFINER`: historical migration text is **not** equivalent to the current production security definition. Bootstrap must reproduce the current effective contract and privilege model before testing.
- Verified `public.audit_row_change()` currently is a `SECURITY DEFINER` trigger function with `search_path=public` that calls `public.redact_atlas_audit_jsonb(jsonb)`, `auth.uid()` and writes `public.audit_logs`. Verified redactor is `IMMUTABLE STRICT SECURITY INVOKER` with recursive JSONB redaction. Do not replace it with an empty/no-op audit stub.
- Verified `auth.users` is owned by `supabase_auth_admin`, has RLS enabled; relevant ATLAS tables are owned by `postgres` and have RLS enabled. No production tenant rows were queried.
- Recovered files `tests/security/recovered/20260808183211_atlas_core_schema.sql` and `20260809032705_atlas_identity_foundation.sql` are real historical migrations, but **not** an authorized drop-in PG17 bootstrap: native Supabase Auth roles/schema and later security changes remain unresolved.
- Current `.github/workflows/atlas-777-isolated-postgres.yml` intentionally fails the prerequisites gate and ends with unconditional NO-GO. Do not remove the fail-closed gate, change `auth.uid()` to a permissive stub, or treat engine smoke as RPC certification.

Next: recover exact Auth dependency graph and current grants/owners/policies; build an isolated deterministic bootstrap only after matching provenance, then run original People/Advisory migrations and two-session negative revocation tests on PostgreSQL 17. P0 remains OPEN.
