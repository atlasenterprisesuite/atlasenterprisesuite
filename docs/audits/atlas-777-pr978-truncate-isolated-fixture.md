# ATLAS 777 / PR #978 — PostgreSQL 17 ACL-only RED/GREEN scope

## Objective and provenance
The review-only remediator in `docs/audits/atlas-777-pr978-truncate-remediation-candidate.md` targets **direct** `TRUNCATE` grants to `anon` and `authenticated` on `public.identity_permissions` and `public.organization_modules`. Prior catalog-only checks reported those effective grants. No public SQL execution route is established.

## Non-production proof added
`tests/security/atlas-777-truncate-privilege-fixture.sql` creates **synthetic, empty, standalone tables** in a named fixture schema within a disposable PostgreSQL 17 GitHub Actions service. It explicitly refuses other database names or major versions. The negative RED condition asserts four direct grants are effective even with RLS enabled. A targeted REVOKE then checks that all four are denied, schema USAGE survives, `service_role` and table-owner privileges survive, RLS remains enabled, no PUBLIC TRUNCATE entry exists, and switching through `authenticator` does not regrant access. The transaction is rolled back. No `TRUNCATE` statement or real user data is used.

`.github/workflows/atlas-mcp-truncate-acl-fixture.yml` runs the test without production credentials, Supabase connections or deployment permissions.

## Certainty boundary
**Mechanics proof only.** The fixture does **not** reproduce authentic `auth.users`, `auth.uid()`, `organizations`, `organization_members`, complete triggers, `atlas_private` functions, OAuth issuer/session storage, or real A/B RLS policies. A passing workflow must **never** be described as authentic Supabase schema certification, exploitable public API proof, concurrent revocation certification, or authorization to deploy.

## Required P0 gates before closure
1. Authoritatively verify production ACLs remain as recorded, using catalog-only reads when permission is available.
2. Obtain authentic PostgreSQL 17 + Supabase Auth isolated bootstrap and run original migrations and negative A/B/revocation tests; fail closed if missing.
3. Confirm OAuth grant schema provenance and issuer revocation ledger.
4. Review/deploy an approved targeted migration separately and verify post-deploy ACLs, with specific authorization.
5. Confirm exact-SHA required CI; no merge/deploy on this branch without separate approval.

**State:** P0 NO-GO. This commit modifies GitHub branch files only; it does not modify atlas-core, merge, deploy or activate paid resources.
