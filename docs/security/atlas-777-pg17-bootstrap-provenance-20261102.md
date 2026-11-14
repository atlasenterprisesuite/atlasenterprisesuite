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

## RUN 2.0 MAX — Auth/profile/module schema metadata and Browser regression (2026-11-02)

Read-only catalog queries recovered all 35 current column names, types, nullability and defaults of `auth.users` (including the generated `confirmed_at` expression), plus the columns of `public.profiles` and `public.organization_modules`. These are **metadata only**, not user records. This column inventory alone is not a complete native Supabase Auth bootstrap: PK/FK/index/check constraints, schema and role privileges, extensions, managed Auth dependencies, trigger enablement and default ACL still require provenance and verification.

Current RLS policy catalog: `public.profiles` has `profiles_self` for `authenticated` ALL, `USING` and `WITH CHECK` both require `id=(SELECT auth.uid())`. `public.organization_modules` has four `authenticated` policies: `modules_read` uses `is_org_member(org_id)`, and `modules_insert`/`modules_update`/`modules_delete` require owner/admin via `has_org_role(org_id,ARRAY['owner','admin'])` (update also has WITH CHECK). No user rows queried. These policies create additional dependency edges to `auth.uid`, `is_org_member`, and `has_org_role`.

Independent #976 Browser regression at SHA `a9dbe0864a7e9d831ba03686309e3fb5a5f76008`: consensus security job 125267560094 failed unit test `tests/unit/sovereign-browser.test.ts:30`: expected `unsafe_navigation` for reserved/internal DNS suffixes but got `browser_action_not_allowed`. 1612 tests passed, 1 failed. This is a concrete regression to fix on #976's own branch, not in Foundation #974.

Fail Closed: no incomplete PG17 bootstrap was wired, no People/Advisory migrations or negative runtime tests were executed. Production remains untouched.

## RUN NEXT — constraints, indexes, roles and default ACL provenance

Read-only catalog inspection on atlas-core (no application/user rows):

- `auth.users`: 3 constraints (`users_pkey`, `users_phone_key`, `users_email_change_confirm_status_check`) and 15 indexes, including partial unique indexes for non-SSO email and token columns. The table is managed by `supabase_auth_admin` and is not equivalent to an `id`-only substitute.
- `public.profiles`: `profiles_pkey` and `profiles_id_fkey REFERENCES auth.users(id) ON DELETE CASCADE`; corresponding primary-key index.
- `public.organization_modules`: composite `organization_modules_pkey(org_id,module_code)` and FK to `public.organizations(id) ON DELETE CASCADE`; corresponding primary-key index.
- Role attributes observed: `anon` and `authenticated` are NOLOGIN/INHERIT/NOBYPASSRLS; `authenticator` LOGIN/NOINHERIT/NOBYPASSRLS; `service_role` NOLOGIN/INHERIT/BYPASSRLS; `supabase_auth_admin` LOGIN/NOINHERIT/NOBYPASSRLS; `postgres` LOGIN/INHERIT/BYPASSRLS (not superuser). These are observed attributes, not instructions to grant elevated privileges in a fixture.
- Default ACLs differ by creator and schema: `auth` objects owned by `supabase_auth_admin` grant tables/sequences/functions to `postgres` and `dashboard_user`; `public` objects created by `postgres` have function EXECUTE restricted to `postgres` and `service_role`, whereas `public` objects created by `supabase_admin` have broader function default EXECUTE. Reproducing only per-object grants misses creator-specific default ACL semantics.

P0 still OPEN: verify role membership inheritance, exact Auth schema constraints/indexes/extension dependencies, schema privileges and current migration chain before wiring any bootstrap. This is catalog provenance, not a PostgreSQL 17 execution result.

## RUN NEXT — schema ACL and role membership provenance (2026-11-02)

Read-only production `pg_namespace` and `pg_auth_members` catalog queries, no user/tenant rows:

- `auth` schema owner is `supabase_admin`; `supabase_auth_admin` and `dashboard_user` have USAGE+CREATE; `anon`, `authenticated`, `service_role` and `postgres` have USAGE. This is distinct from the owner of `auth.users` (`supabase_auth_admin`).
- `public` schema owner is `pg_database_owner`, with USAGE for PUBLIC (`=U`) and explicitly for `postgres`, `anon`, `authenticated`, `service_role`; no CREATE for those four roles in the returned schema ACL.
- `authenticator` has memberships in `anon`, `authenticated`, and `service_role` with `inherit_option=false`, `set_option=true`, `admin_option=false`. The `SET ROLE` boundary is security-significant.
- `postgres` has inherited memberships in `anon`, `authenticated`, `service_role`, `authenticator`, plus managed roles. Do **not** copy broad managed privileges into a test role or infer client permissions from postgres-owned execution.

Exact-SHA CI on `8fb127d5620083f05f56cb759aef1ce6543663ea` still fails the isolated PostgreSQL 17 prerequisites gate, run 41443624952, before People migration. Browser #976 commit `9d8e999f27ec3c548e972ca4ce617eddf9caecf4` has successful Consensus CI and unit suite at that SHA, with readiness gate still running at observation. No complete native Auth/bootstrap proof yet; P0 remains OPEN.

## RUN NEXT — native Auth helpers and trigger enablement (2026-11-02)

Read-only live `pg_proc` inspection confirms `auth.uid()`, `auth.jwt()` and `auth.role()` are owned by `supabase_auth_admin`, `LANGUAGE sql STABLE`, `SECURITY INVOKER`, and read JWT request GUCs. `auth.uid()` returns UUID from `request.jwt.claim.sub` or `request.jwt.claims` JSON `sub`; `auth.jwt()` returns JSONB from `request.jwt.claim` or `request.jwt.claims`; `auth.role()` returns text from `request.jwt.claim.role` or JSON claims `role`. Their ACLs differ: `auth.jwt` grants EXECUTE to PUBLIC, while `auth.uid`/`auth.role` ACLs do not list PUBLIC EXECUTE. Preserve exact definitions and privileges, not a mock identity constant.

Live `pg_trigger` shows all seven non-internal triggers on `auth.users`, `public.profiles`, `public.organization_modules`, `public.organizations`, `public.organization_members` are enabled `O` (origin/local): `atlas_auth_user_profile`, `atlas_updated_profiles`, `atlas_updated_organization_modules`, `atlas_seed_work_modules`, `atlas_updated_organizations`, `atlas_updated_organization_members`, `trg_atlas_enforce_synthetic_e2e_role`. All require faithful function and relation dependencies.

Exact-SHA CI on Foundation `66bdb68b2641ab02de48a82d6a0309e48b060817`: isolated PostgreSQL 17 runtime run 41444184366 fails at original People prerequisite gate, while Security Baseline and Sentinel succeeded at time checked. Browser #976 advanced to HEAD `3ccb44edd03c56c4dbab66bea0213b3180281d91`; its new CI was queued/pending and earlier green checks do not certify that HEAD.

No native Auth bootstrap installed into PG17; the CI workflow still runs smoke then prerequisite gate without loading recovered migrations. P0 NO-GO until Auth schema/roles/ACL/trigger graph and original migrations can be replayed and verified in isolation.

## RUN NEXT — executable bootstrap gate review (2026-11-02)

Rechecked `.github/workflows/atlas-777-isolated-postgres.yml` and `tests/security/atlas-777-people-real-dependencies.sql` at `5ffface7fa8f79da06cd0900613a3bb2b498732c`. Workflow runs a genuine PostgreSQL 17 container, validates engine/isolation, then checks seven prerequisites and executes original People SQL **without loading recovered foundation SQL**. A final unconditional P0 NO-GO explicitly rejects premature 22-RPC certification. This explains the repeatable prerequisite failure; removing the gate or introducing placeholder objects is not an acceptable fix.

The original `20260923201500_atlas_people_core.sql` references `auth.users` via worker/creator/approval foreign keys, inserts identity permissions, attaches `audit_row_change()` triggers, enables RLS, and uses `has_identity_permission()` and `auth.uid()` in policies. Recovered historical SQL is explicitly marked source-only in `tests/security/recovered/README.md`. The missing complete native Auth role/schema/ACL/index/trigger chain still blocks faithful replay.

CI on the previous Foundation SHA `5ffface7fa8f79da06cd0900613a3bb2b498732c` was queued/pending when checked; Browser #976 moved to `8f4278676aef0e6c4b5b761ca86b3ab05c2e9fbc`, with only Security Baseline and Sentinel success at observation. Other PRs: #968 `609217b7` 4/4 listed success, #948 `8fce4d6b` 8/8, #977 `7350d417` 8/8. These workflow counts do not certify outstanding P0 acceptance tests.

NO-GO: no isolated bootstrap run of the original People/Advisory migrations and no new negative runtime evidence. Keep fail-closed prerequisite and unconditional rejection intact until exact provenance and reproducible E2E evidence exist.

## RUN NEXT — native Supabase Auth transitive graph, 2026-11-02

Read-only catalog enumeration of `auth` relations (no data rows) returned 27 regular tables and one sequence, all owned by `supabase_auth_admin`, including `users`, `identities`, `sessions`, `refresh_tokens`, MFA tables, OAuth clients/authorizations/consents, SAML/SSO, SCIM, WebAuthn, and Auth migration history. `pg_constraint` returned 24 native Auth foreign keys, e.g. identities/sessions/MFA factors -> users, refresh_tokens -> sessions, OAuth authorizations -> clients/users, and SAML relay states -> flow_state/SSO providers. This establishes that the full managed Auth schema is significantly larger than the minimum seven-object People prerequisite gate.

The Supabase `list_migrations` API enumerates **ATLAS project migrations** in ascending version order, starting `20260808183211 atlas_core_schema`; this does **not** provide the managed GoTrue/Supabase Auth internal migration SQL. Do not mistake project migration history for the native Auth bootstrap. The Auth schema also has `auth.schema_migrations` owned by `supabase_auth_admin`, but its contents were intentionally not read. To reproduce a faithful local Auth instance, obtain a pinned, authentic Supabase Auth migration chain/version and verify schema/ACL/function/trigger parity before integrating the isolated PG17 workflow.

No new PG17 bootstrap executed: no authenticated native Auth DDL chain has been recovered and proven complete. P0 Fail Closed remains mandatory.

## RUN NEXT — upstream native Supabase Auth provenance and parity gap (2026-11-02)

Official upstream source candidates identified:

- `https://github.com/supabase/auth/tree/master/migrations`: GoTrue/Supabase Auth's native migration chain, applied by Auth's own migration command. Its `00_init_auth_schema.up.sql` has an older `auth.users` definition and `auth.uid()` implementation.
- `https://github.com/supabase/auth/blob/master/migrations/20220224000811_update_auth_functions.up.sql`: upstream `auth.uid()` reads `request.jwt.claim.sub` with JSON `request.jwt.claims` fallback, matching the current atlas-core function body inspected from `pg_proc`. This is **partial function provenance**, not proof of deployed Auth release.
- `https://github.com/supabase/postgres/tree/develop/migrations`: native Postgres initialization, role/schema/default-ACL migrations; upstream README specifies initialization scripts before database migrations. The moving `develop` branch must **not** be used as a reproducible version pin.

The current atlas-core catalog contains 27 Auth tables and one sequence with 24 native Auth FKs, including modern MFA, OAuth, SSO/SCIM and WebAuthn. The upstream initial schema is much older, and a complete version/commit plus ordered migration replay and parity comparison (columns, constraints, indexes, triggers, owner, grants, default ACL, policies and function definitions) is still missing. Do not use only `00_init_auth_schema.up.sql`, or substitute minimal `auth.users`/`auth.uid` objects.

Revalidated #974 HEAD `20d24ed2d3bfe482bd9a3e4b54780182b2e31b4c`: eight workflows were queued/pending/in progress at observation, including PG17. #976 HEAD `8f4278676aef0e6c4b5b761ca86b3ab05c2e9fbc`: Security Baseline, Sentinel and CodeQL successful, remaining checks running. Neither HEAD certified for P0.

No new isolated bootstrap, People/Advisory migration, or negative runtime suite executed. P0 NO-GO.
