# ATLAS 777 PR #978 — Transitive DDL recovery (metadata-only)

Verified checkpoint: `d5cc42411113565b862afcda21819e8b41836a54`; all seven GitHub workflows concluded success at this exact SHA. PR remains Draft, unmerged. Live source: authorized **read-only** PostgreSQL 17.6 catalog queries to atlas-core. No production rows, credentials, or secrets retrieved.

## Authenticated DDL metadata

### public.identity_permissions
- Owner: `postgres`; RLS enabled, FORCE RLS false.
- Columns: `code text NOT NULL`, `description text NOT NULL`, `created_at timestamptz NOT NULL DEFAULT now()`.
- Constraint: `PRIMARY KEY (code)`.
- Policy: `identity_permissions_read` SELECT TO `authenticated` USING `true`.
- No non-internal triggers returned.
- Table grants: `anon` DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE; `authenticated` REFERENCES, SELECT, TRIGGER, TRUNCATE; `service_role` DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE.

### public.organization_modules
- Owner: `postgres`; RLS enabled, FORCE RLS false.
- Columns: `org_id uuid NOT NULL`, `module_code text NOT NULL`, `enabled boolean DEFAULT false`, `launch_status text DEFAULT 'coming_soon'`, `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()`.
- Constraints: `PRIMARY KEY (org_id,module_code)`; `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`.
- Trigger: `atlas_updated_organization_modules` BEFORE UPDATE calls `set_updated_at()`.
- Policies to authenticated: SELECT USING `is_org_member(org_id)`; INSERT WITH CHECK `has_org_role(org_id,ARRAY['owner','admin'])`; UPDATE USING and WITH CHECK same; DELETE USING same.
- Grants: `anon`, `authenticated`, and `service_role` each have DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE.

## P0 security observations
- RLS does not apply to TRUNCATE. The catalog reports TRUNCATE privileges for `authenticated` on both tables and `anon` on both. This is a potential high-severity exposure requiring validation and a separately reviewed revocation plan. Do **not** execute TRUNCATE on atlas-core or infer practical exposure without verifying schema USAGE, role inheritance, and runtime access paths.
- `identity_permissions` has no anonymous SELECT policy; privileges and RLS must be evaluated together. Do not equate table GRANT with row access.
- A faithful PG17 bootstrap additionally requires the authentic Supabase Auth role/ownership environment, auth.users schema, function grants, policies, all triggers, and issuer/session ledger. `atlas_chatgpt_oauth_grants` remains absent from inspected public schema.

## Negative TDD additions (NOT RUN)
- PG17-NEG-11: In disposable PostgreSQL 17 as authenticated role, attempt TRUNCATE on isolated `identity_permissions` and `organization_modules`; expected secure posture: deny, independent of RLS. If permitted, mark P0 and recommend privilege remediation, never run against production.
- PG17-NEG-12: As anon, attempt TRUNCATE on isolated copies; deny. Verify schema USAGE and actual role switching rather than assuming exposed access.
- PG17-NEG-13: With member A and organization B, attempt module INSERT/UPDATE/DELETE on B; deny or zero affected rows.
- PG17-NEG-14: After member A revocation, attempt module SELECT; zero rows. Verify independent transaction and concurrency ordering.

## Decision
Documented authentic transitive DDL metadata; **no executable bootstrap or tests created** because Auth-managed parity and OAuth grant/session schema remain unresolved. P0 NO-GO. No merge, deploy, costs, secrets, or production writes.
