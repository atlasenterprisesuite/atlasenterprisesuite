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
