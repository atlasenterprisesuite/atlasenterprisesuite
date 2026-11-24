# ATLAS 777 — PR #978 authentic schema recovery (P0)

Evidence checkpoint: `1c815c53d10eaf1637d450ecabcf27205c72891e` (2026-11-02).

## Confirmed source contracts

- `packages/atlas-mcp/src/chatgptSupabaseDirectory.ts` queries `public.atlas_chatgpt_oauth_grants` via server-only PostgREST with fields `issuer, subject, token_id, user_id, org_id, expires_at, revoked_at, session_revoked_at`. It requires a trusted issuer session check, active `organization_members` and active `organizations`. This is application code, **not** evidence that the grants table exists in deployed PostgreSQL.
- `supabase/migrations/20260913_harden_atlas_bootstrap_owner_aal2.sql` references and inserts into `public.organizations` and `public.organization_members`; it does **not** define either base table.
- `supabase/migrations/20260918031500_advisory_office_core.sql` and `supabase/migrations/20260918033500_advisory_firm_scope_rls.sql` rely on existing membership, identity and RLS contracts; they are not a standalone bootstrap.
- `tests/integration/chatgpt-oauth-two-organizations.test.ts` exercises signed JWT, organization injection, session revocation and membership revocation against **mocked** PostgREST data; not real PostgreSQL transaction isolation.
- Inspection of the full Git tree at the checkpoint (143 SQL files) did not locate a migration creating `atlas_chatgpt_oauth_grants`, nor a standalone PostgreSQL 17 bootstrap for these base tables. This does not prove that the tables are absent from production or from external infrastructure.

## Fail-closed decisions

1. **P0 SCHEMA-ORIGIN:** Obtain the authoritative, version-controlled DDL for `organizations`, `organization_members`, `atlas_chatgpt_oauth_grants`, and identity functions; verify columns, constraints, RLS, roles, privileges, and migrations against an authorized source. Do not infer schema from TypeScript shapes.
2. **P0 ISSUER-LEDGER:** Identify the real issuer-owned session ledger and revocation transaction contract. Do not substitute a mocked callback for issuer evidence.
3. **P0 PG17-NEGATIVE-TDD:** Only after (1) and (2), run disposable PostgreSQL 17 tests for organization A/B isolation, membership and grant revocation, inactive org, duplicate grants, and concurrent revocation; capture transaction ordering and exact-SHA CI logs.
4. **P0 RELEASE:** No merge, deploy, production access, credentials, or assertion of production compatibility until gates are certified.

This ledger records source inspection only; it does not claim PostgreSQL tests executed or a schema migration created.
