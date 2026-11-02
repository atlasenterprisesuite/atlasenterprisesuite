# ATLAS 777 — foundation DDL extraction ledger (2026-11-02)

Status: **P0 NO-GO — partial catalog extraction, NOT a reproducible bootstrap**.

Base PR #974 exact HEAD: `2c9e68bb8e9e5d57451b046cbd6b3393bd6f4e8f`.
Source: authorized read-only pg_catalog and information_schema queries on atlas-core; no tenant rows or personal data read. This document is not a migration and must never be executed as SQL.

## Original migration history verified

- 20260808183211 atlas_core_schema
- 20260809032705 atlas_identity_foundation
- 20260809032710 atlas_identity_audit_hardening
- 20260809032746 atlas_identity_invoker_hardening
- 20260809040445 atlas_identity_member_admin
- 20260809040925 atlas_identity_hierarchy_locking
- 20260821174551 atlas_audit_recursive_secret_redaction

Original source files were not found at corresponding paths in the audited repository. A migration-history name does not provide its original SQL.

## Catalog-proven tables and dependencies

- `auth.users` (Supabase native; must use authentic Supabase auth bootstrap, not a permissive stand-in).
- `public.organizations`: FK created_by → auth.users; RLS policies org_read via is_org_member(id), org_update via has_org_role(id,['owner','admin']); triggers atlas_seed_work_modules and atlas_updated_organizations.
- `public.organization_members`: composite PK (org_id,user_id), FK organizations and auth.users, role CHECK; RLS member_read via is_org_member(org_id); triggers atlas_updated_organization_members and trg_atlas_enforce_synthetic_e2e_role.
- `public.identity_permissions`: PK code; identity_permissions_read RLS.
- `public.identity_role_permissions`: PK (role,permission_code), FK identity_permissions, role CHECK; identity_role_permissions_read RLS.
- `public.organization_role_permissions`: PK (org_id,role,permission_code), FK organizations, identity_permissions and auth.users; organization_role_permissions_read RLS via is_org_member(org_id).
- `public.audit_logs`: PK id, FK organizations and auth.users; audit_read via has_identity_permission(org_id,'audit.read').

All seven tables have relrowsecurity=true. The catalog also exposed definitions for `auth.uid()`, `public.has_identity_permission(uuid,text)`, `public.redact_atlas_audit_jsonb(jsonb)`, and `public.audit_row_change()`. Their full bodies, defaults, indexes, ownership, ACLs, triggers and dependent functions must be captured and verified before creating runnable DDL.

## Additional dependencies identified

- `public.is_org_member(uuid)` delegates to `atlas_private.is_org_member(uuid)`.
- `public.has_org_role(uuid,text[])` delegates to `atlas_private.has_org_role(uuid,text[])`.
- `public.audit_row_change()` depends on redaction, audit_logs and auth.uid().
- Triggers depend on `set_updated_at()`, `seed_atlas_work_modules()`, `atlas_enforce_synthetic_e2e_role()`, and their transitive dependencies.
- The original People migration `20260923201500_atlas_people_core.sql` and Advisory migration `20260918031500_advisory_office_core.sql` must run unchanged after the authentic foundation.

## Security finding requiring independent review

Catalog privileges reported `TRUNCATE` and `TRIGGER` for `anon` and `authenticated` on multiple public foundation tables, and broad `anon` DML privileges. RLS does **not** constrain TRUNCATE. Investigate effective schema USAGE, role inheritance, API exposure, grants and function security before interpreting exploitability. Do not copy these grants blindly into an isolated bootstrap and do not change production without separate authorization.

## Required fail-closed acceptance

1. Obtain complete authorized source DDL or reconstruct exact pg_catalog definitions for tables, defaults, constraints, indexes, policies, roles, ACLs, owners, functions, triggers, extensions, and native Supabase auth.
2. Verify dependency graph and function security-definer ownership/search_path; never create authorization stubs.
3. Assemble a separate disposable PostgreSQL 17 environment; no production DDL, secrets or real user data.
4. Execute original People and Advisory migrations; assert missing prerequisites fail closed.
5. Negative RED/GREEN tests: tenant A/B, unauthenticated access, inactive org, membership revocation, role override deny, concurrent revocation, audit redaction, privileged roles, grants and TRUNCATE exposure.
6. Record tests, exact SHA, logs and check names. Do not certify P0 based on a successful smoke test alone.

**No bootstrap or tests certified by this ledger.** Existing #974 isolated PostgreSQL workflow failure remains authoritative.

## 2026-11-02 bootstrap-build follow-up — catalog evidence

Additional read-only pg_catalog extraction established:

- Private membership functions `atlas_private.is_org_member(uuid)` and `atlas_private.has_org_role(uuid,text[])` are STABLE SECURITY DEFINER, owned by `postgres`, with explicit EXECUTE ACL for `authenticated` and `postgres`; their predicates require `auth.uid()` and membership `status='active'`. `anon` has no schema USAGE for `atlas_private`.
- `public.has_identity_permission(uuid,text)` is SECURITY INVOKER and evaluates organization-specific overrides before default role permissions, with inactive memberships excluded.
- `public.seed_atlas_work_modules()` is SECURITY DEFINER and inserts into **public.organization_modules**; that table is a transitive dependency for organization INSERT. Its columns (org_id, module_code, enabled, launch_status, created_at, updated_at) were inspected; full constraints, indexes and grants remain to be recovered.
- `public.atlas_enforce_synthetic_e2e_role()` is SECURITY DEFINER and inspects `auth.users`; do not substitute a dummy auth table for certification.
- `public.set_updated_at()` updates timestamps; `public.audit_row_change()` uses recursive secret redaction.
- 13 column default expressions and 14 indexes were enumerated across six public foundation tables; all six owners are `postgres`.
- Schema USAGE: `anon` and `authenticated` can use `public`; `authenticated` can use `atlas_private`, `anon` cannot. ACLs for several public foundation tables include `TRUNCATE` for `anon` and `authenticated`. **P0 review: RLS does not restrict TRUNCATE.** This is an observed privilege configuration, not a verified exploit or recommendation to reproduce unsafe grants.
- Function EXECUTE ACLs for private membership functions are restricted to `postgres` and `authenticated`; audit trigger function is restricted to `postgres` and `service_role`.

Proposed dependency order (subject to full DDL verification): native Supabase auth roles/schema/users and `auth.uid` → organizations and organization_modules → organization_members → identity_permissions → identity_role_permissions and organization_role_permissions → private membership functions → public membership wrappers and identity permission function → redaction and audit_logs → audit trigger function → trigger functions and triggers → indexes, constraints, RLS policies, ACL verification → unchanged People/Advisory migrations → negative tests.

**Do not treat this order as runnable or complete.** Remaining P0 blockers: full native Supabase auth initialization, organization_modules constraints/ACL, sequences and audit_logs id default, all transitive trigger dependencies, exact roles/ownership and effective grants, original migration provenance, and disposable PostgreSQL 17 environment. No production changes or tests were performed in this follow-up.
