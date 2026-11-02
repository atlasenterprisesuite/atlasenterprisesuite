# ATLAS 777 — PR #978 Auth dependency completion (P0, metadata-only)

Source: authorized read-only PostgreSQL 17.6 catalog inspection of atlas-core. Prior exact-SHA: `c3b76670630defaace2125f89d803e9c2d7e98ea`. No live rows or secrets accessed; no database mutations.

## Auth and ownership

- `auth.uid()` is owned by `supabase_auth_admin`, SQL STABLE, SECURITY INVOKER; it resolves a UUID from `request.jwt.claim.sub` or the `sub` field of `request.jwt.claims`.
- `auth.users` is owned by `supabase_auth_admin` and has RLS enabled. It is a Supabase Auth-managed table: **do not manufacture a replacement DDL or reuse production user data**.
- `public.organizations`, `public.organization_members`, `public.identity_role_permissions`, and `public.organization_role_permissions` are owned by `postgres` and have RLS enabled; FORCE RLS is disabled on the two core organization tables.
- `identity_role_permissions` has PK `(role,permission_code)`, role CHECK, and FK to `identity_permissions(code)`.
- `organization_role_permissions` has PK `(org_id,role,permission_code)`, role CHECK, FK to `organizations(id)` ON DELETE CASCADE, FK to `identity_permissions(code)` ON DELETE CASCADE, and FK `updated_by` to `auth.users(id)`.

## Verified triggers and transitive dependencies

- `public.organization_members`: BEFORE UPDATE `atlas_updated_organization_members` calls `public.set_updated_at()`; BEFORE INSERT/UPDATE OF role,user_id `trg_atlas_enforce_synthetic_e2e_role` calls `public.atlas_enforce_synthetic_e2e_role()` (SECURITY DEFINER, reads `auth.users`).
- `public.organizations`: BEFORE UPDATE `atlas_updated_organizations` calls `public.set_updated_at()`; AFTER INSERT `atlas_seed_work_modules` calls `public.seed_atlas_work_modules()` (SECURITY DEFINER, writes `organization_modules`).
- `public.set_updated_at()` sets `new.updated_at=now()`.
- `public.seed_atlas_work_modules()` inserts/upserts `work_graph` and `conversation_execution` module rows; this creates a transitive dependency on the exact `organization_modules` schema and its unique constraint.
- `public.atlas_enforce_synthetic_e2e_role()` modifies role assignments for two reserved synthetic test identities. This is a genuine production trigger; preserve its behavior in a parity test without copying live user records.
- `public.is_org_member` and `public.has_org_role` delegate to SECURITY DEFINER `atlas_private` functions; `public.has_identity_permission` depends on both permission tables and `auth.uid()`.

## Unresolved gates — fail closed

1. Verify full Auth-managed schema/role semantics in a supported disposable Supabase/PostgreSQL 17 environment, not a hand-built approximation of `auth.users`.
2. Recover full `identity_permissions` and `organization_modules` DDL, triggers, policies and grants; certify function execution privileges and ownership across all dependencies.
3. Verify grant issuer/session ledger and version-controlled migration for `atlas_chatgpt_oauth_grants` (absent from inspected live public schema). Do not create or imply a production grant table.
4. Only after dependency closure, create a disposable isolated bootstrap and execute PG17-NEG-01..10 from `atlas-777-pr978-pg17-bootstrap-negative-tdd-contract.md` with real role switching, transaction ordering, and exact-SHA logs.
5. Do not run negative fixtures on atlas-core or production. No RED/GREEN evidence yet. **P0 NO-GO**.

This is an evidence ledger, not an executable bootstrap or a claim of PG17 test success.
