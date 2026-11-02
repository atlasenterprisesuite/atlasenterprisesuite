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

## Read-only ACL/RLS reconciliation — 2026-11-02

Queried `pg_class.relacl`, owners and `pg_policies` on atlas-core; no tenant/user rows read or mutations made.

- `auth.users`: owner `supabase_auth_admin`, RLS enabled, no `anon`/`authenticated` table grant shown in explicit ACL. Native Auth ownership and role setup must be reproduced faithfully, not inferred from the ATLAS migrations.
- `public.audit_logs`: owner `postgres`, RLS enabled, ACL grants `anon=arwdDxtm` (including DML) and `authenticated=rDxtm`. Only an `authenticated` SELECT policy (`audit_read`, requiring `has_identity_permission(org_id,'audit.read')`) was returned. The broad `anon` ACL is defense-in-depth debt, **not** proof of anonymous write access because RLS may deny rows; verify role inheritance, other policies and runtime denial in isolated tests before changing grants.
- `public.organizations`: owner `postgres`, RLS enabled, ACL grants DML to `anon` and `authenticated`; policies returned only `org_read` (authenticated SELECT) and `org_update` (authenticated UPDATE). No INSERT policy was returned. Historical `org_create` policy is absent in the current catalog; investigate migration provenance before asserting bootstrap equivalence.
- `public.organization_members`, `public.organization_role_permissions`, `public.identity_permissions`, `public.identity_role_permissions`: RLS enabled; explicit ACLs and read policies differ from their historical source definitions. Do not infer effective access from ACLs alone.

P0 remains OPEN. A matching bootstrap requires role ownership, explicit and default privileges, current RLS policies, trigger dependencies and native Auth setup. No permission broadening or production edits authorized.

## 2026-11-02 RUN NEXT — live trigger provenance and CI gate

Read-only `pg_trigger`/`pg_get_triggerdef` query on atlas-core returned these **non-internal** triggers, without reading auth/user rows:

- `auth.users`: `atlas_auth_user_profile` — AFTER INSERT OR UPDATE OF `raw_user_meta_data` -> `handle_new_auth_user()`.
- `public.organization_members`: `atlas_updated_organization_members` — BEFORE UPDATE -> `set_updated_at()`; `trg_atlas_enforce_synthetic_e2e_role` — BEFORE INSERT OR UPDATE OF `role,user_id` -> `atlas_enforce_synthetic_e2e_role()`.
- `public.organizations`: `atlas_seed_work_modules` — AFTER INSERT -> `seed_atlas_work_modules()`; `atlas_updated_organizations` — BEFORE UPDATE -> `set_updated_at()`.

These are additional transitive dependencies for a faithful PostgreSQL 17 bootstrap. In particular, the auth.users trigger crosses the managed Auth/public boundary. Recover exact function definitions, ownership, grants, and trigger enablement before creating a fixture. Avoid synthetic trigger bodies and avoid executing auth/profile effects in production.

CI exact-SHA `1dae1c0fc2a773b9dd243461238971fba97879b4`: seven workflows SUCCESS and `ATLAS 777 Isolated PostgreSQL 17 Runtime` FAILURE (run 41440762396, job 125261732032). The prerequisite gate reports all seven expected foundational objects missing because recovered sources have not been loaded; this is a deliberate fail-closed outcome, not proof the recovered SQL is invalid.

P0 OPEN; no bootstrap execution, migration, merge, or deployment performed in this checkpoint.

## RUN NEXT — authoritative trigger function catalog, 2026-11-02

Live catalog read-only `pg_proc` returned exact current definitions, ownership and ACL (no user rows):

| Function | Owner | Security | EXECUTE ACL | Direct dependencies |
| --- | --- | --- | --- | --- |
| `public.handle_new_auth_user()` | `postgres` | DEFINER, `search_path=public` | `postgres`, `service_role` | `public.profiles(id,full_name,updated_at)` and `auth.users.raw_user_meta_data` trigger |
| `public.set_updated_at()` | `postgres` | INVOKER, `search_path=pg_catalog,public` | `postgres`, `service_role` | target row `updated_at` |
| `public.atlas_enforce_synthetic_e2e_role()` | `postgres` | DEFINER, `search_path=pg_catalog,public,auth,pg_temp` | `postgres`, `service_role` | reads `auth.users(id,email)`; mutates NEW.role on `organization_members` |
| `public.seed_atlas_work_modules()` | `postgres` | DEFINER, `search_path=public` | `postgres`, `service_role` | `public.organization_modules(org_id,module_code,enabled,launch_status,updated_at)` |

Both `public.profiles` and `public.organization_modules` exist in the live catalog, are owned by `postgres`, have RLS enabled and explicit `anon`/`authenticated`/`service_role` table ACLs. Their current policy and schema definitions, and the native `auth.users` schema/roles, must be recovered before faithful replay. Trigger function execution is not certified merely by recovering its DDL.

The Supabase migration history was enumerated in ascending version order. Relevant ordered versions include `20260808183211 atlas_core_schema`, `20260809032705 atlas_identity_foundation`, `20260809032710 atlas_identity_audit_hardening`, `20260809032746 atlas_identity_invoker_hardening`, `20260809040445 atlas_identity_member_admin`, `20260809040925 atlas_identity_hierarchy_locking`, `20260810021509 atlas_work_graph_conversation_execution`, `20260821174551 atlas_audit_recursive_secret_redaction`, `20260910111459 harden_synthetic_e2e_membership_roles_v1`. Migration-history names do not alone establish the complete dependency graph; no tenant bootstrap/data migrations should be replayed blindly.

P0 OPEN: native Supabase Auth bootstrap and transitive tables/policies remain incomplete. No SQL changes to production and no permissive stubs.
