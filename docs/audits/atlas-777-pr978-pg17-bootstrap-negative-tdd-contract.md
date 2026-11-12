# ATLAS 777 — PR #978 PostgreSQL 17 isolated bootstrap: source-verified contract and negative TDD (P0)

Checkpoint: `6e2ad56bb806ae39013f049df8dc16aff800b5d6`. Source: authorized **read-only** metadata queries to `atlas-core`, PostgreSQL 17.6. No rows, credentials or secrets retrieved. No production mutations.

## Verified live DDL dependencies

- `public.organizations`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `name text NOT NULL`, `legal_name text`, `industry text`, `active boolean DEFAULT true`, `created_by uuid REFERENCES auth.users(id)`, `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()`. RLS enabled; FORCE RLS disabled.
- `public.organization_members`: `org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE`, `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `role text NOT NULL DEFAULT 'staff'`, `status text DEFAULT 'active'`, `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()`. Composite primary key `(org_id,user_id)`. Role CHECK allows `owner,admin,accountant,manager,staff,viewer`. RLS enabled; FORCE RLS disabled.
- `organization_members.member_read`: SELECT TO authenticated USING `is_org_member(org_id)`.
- `organizations.org_read`: SELECT TO authenticated USING `is_org_member(id)`.
- `organizations.org_update`: UPDATE TO authenticated USING `has_org_role(id, ARRAY['owner'::text,'admin'::text])`.
- `public.is_org_member(o uuid)`: SQL STABLE, search_path `atlas_private,pg_temp`, delegates to `atlas_private.is_org_member(o)`.
- `public.has_org_role(o uuid,r text[])`: SQL STABLE, search_path `atlas_private,pg_temp`, delegates to `atlas_private.has_org_role(o,r)`.
- `atlas_private.is_org_member(o uuid)`: SQL STABLE SECURITY DEFINER, search_path `public,pg_temp`; returns EXISTS active membership where `org_id=o AND user_id=auth.uid() AND status='active'`.
- `atlas_private.has_org_role(o uuid,r text[])`: SQL STABLE SECURITY DEFINER, search_path `public,pg_temp`; returns EXISTS active membership with `role=ANY(r)` and `user_id=auth.uid()`.
- `public.has_identity_permission(o uuid,p text)` depends on `organization_role_permissions`, `identity_role_permissions`, `organization_members`, and `auth.uid()`; no standalone DDL for these permission tables was certified in this pass.
- Live `public.atlas_chatgpt_oauth_grants` **does not exist** in inspected PostgreSQL catalog. Existing MCP source proposes its contract but not a verified migration.
- Privilege review found table-level grants to `anon` including DML privileges; RLS is enabled and policy list does not authorize anon access. **Do not equate grants with effective RLS access**; prove with real role tests.

## Negative TDD specification — NOT executed (RED evidence pending)

| Test ID | Fixture / action | Required result |
| --- | --- | --- |
| PG17-NEG-01 | Authenticated user A SELECT organization B | Zero visible B rows |
| PG17-NEG-02 | User A SELECT membership rows of B | Zero visible B rows |
| PG17-NEG-03 | User A UPDATE B organization | Denied or zero modified rows |
| PG17-NEG-04 | Remove A's membership, then SELECT A organization in new transaction | No access |
| PG17-NEG-05 | Set A membership status inactive, then attempt access | No access |
| PG17-NEG-06 | Disable organization, then exercise OAuth catalog authorization | Deny (application grant chain, not merely base RLS) |
| PG17-NEG-07 | Revoke OAuth grant/session and concurrently request catalog access | No authorization after revocation commit; capture transaction ordering |
| PG17-NEG-08 | Duplicate issuer/subject/jti grant and foreign-org token claim | Deny without leaking B metadata |
| PG17-NEG-09 | Role anon attempts SELECT/INSERT/UPDATE/DELETE against both tables | Deny under effective RLS/privileges; test as real role |
| PG17-NEG-10 | Invalid/expired issuer token, unavailable issuer or DB | Deny; no fallback |

## Fail-closed execution gates

1. Retrieve authoritative `auth.uid()` and `auth.users` dependencies, roles/grants, function ownership, policies, and any necessary triggers. A fabricated stub would not prove production parity.
2. Retrieve complete permission-table DDL if testing `has_identity_permission`.
3. Design/review a **new** OAuth grants migration separately; never represent proposed DDL as deployed source. Require issuer session ledger and atomic revocation contract.
4. Run PostgreSQL 17 **only in a verified disposable local/CI environment** with real authenticated role semantics and two synthetic organizations. No production test fixtures or live writes.
5. Capture RED and GREEN results and exact-SHA CI. Until then all PG17 negative tests remain **NOT RUN** and P0 remains **NO-GO**.

No executable bootstrap or tests were committed because their missing dependencies would require inventing non-authentic SQL. This is a source-backed prerequisite and negative-test contract, not a claim of PG17 certification.
