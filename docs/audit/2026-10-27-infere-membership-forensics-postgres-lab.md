# ATLAS 777 — Organization membership provenance & atomic budget lab

Status: BLOCKED / P0 OPEN / STATIC ONLY
Baseline exact SHA: 6a5988bd5df1669c945d280ea133ef336c12ffdc
Branch: test/infere-routing-security-tdd-777-20261027

## Proven source
1. `supabase/functions/atlas-copilot/atlas-intelligence-auth.mjs`: bearer resolves /auth/v1/user, user token queries active organization_members and identity_role_permissions; context includes membership.org_id and user.id.
2. `supabase/functions/atlas-copilot/intelligence-gateway.mjs`: checks intelligence.use; routes; only optional emergency fallback calls store.reserveEmergencyBudget.
3. `supabase/functions/atlas-copilot/atlas-intelligence-store.mjs`: privileged service-role REST RPC forwards p_org_id and p_actor_id from context. Caller must not accept arbitrary forged context.
4. `supabase/migrations/20260920160000_atlas_ai_emergency_fallback_budget.sql`: SECURITY DEFINER RPC, RLS ledger, revoke public/anon/authenticated, grant execute service_role, per-tenant unique trace; current_date advisory lock is not UTC-based; existing reservation does not compare actor/amount/ceiling.
5. `supabase/migrations/20260913_harden_atlas_bootstrap_owner_aal2.sql`: confirmed use of organization_members(org_id,user_id,role,status,created_at) and status active. NOT the CREATE TABLE definition.
6. `tests/integration/atlas-ai-emergency-budget-migration.test.ts`: static contract assertions only.

## Incomplete provenance

Search of indexed repository code did not locate original CREATE TABLE DDL, complete ALTER TABLE history, triggers, grants, or own-table RLS policies for public.organization_members. Search results mentioning the table or RLS policies on OTHER tables are not proof of its schema. Do not assume undocumented constraints or create migration until recovered from authoritative schema migrations or authorized read-only pg_catalog snapshot.

## Proposed read-only catalog forensic queries (DO NOT run against production automatically)

- pg_class / pg_namespace: relkind, relrowsecurity, relforcerowsecurity
- pg_attribute / pg_attrdef: columns, types, defaults, nullability
- pg_constraint / pg_get_constraintdef: PK, FK, CHECK, UNIQUE
- pg_index / pg_get_indexdef: indexes
- pg_trigger / pg_get_triggerdef: enabled triggers excluding internal
- pg_policy / pg_get_expr: RLS WITH CHECK and USING
- pg_class.relacl, information_schema.role_table_grants, pg_proc.proacl
- pg_depend and migration metadata: provenance of changes and function dependencies

## Required RED PostgreSQL tests

A. Concurrent sessions: two $0.70 reservations against $1/day => at most one commits. Verify after transactions.
B. Session timezone midnight (UTC-11, UTC, UTC+13), separate transactions spanning midnight => same UTC day boundaries and no double authorization.
C. Same trace retries identical actor+amount+ceiling => same reservation_id; changed actor, reserve, ceiling => deny, no new row.
D. Revoked/inactive member and forged actor or org => deny. Validate context authenticity at edge and member status again within RPC under service role.
E. service_role-only EXECUTE; anon/authenticated direct RPC denied; tenant B cannot read or mutate tenant A's ledger through RLS.
F. Forced transaction exception after insert => no ledger/audit side effects; rollback.
G. Concurrency across orgs: separate budgets, no cross-tenant coupling.
H. Error responses/logs: no bearer, service_role key, prompt, or user content.

## Important design cautions

A SECURITY DEFINER RPC cannot prove a service-role caller's claimed user simply by matching a supplied UUID to organization_members; edge-to-RPC trust binding or server-generated signed invocation context is necessary. Adding active membership check inside RPC is defense-in-depth but not authentication.
For UTC advisory locking, use a stable org/provider lock and recompute UTC day and current timestamp under lock to prevent boundary races. Do not patch historical applied migration. Prefer forward-only replacement after compatibility validation.
Existing older tests search only historical migration source; new forward migration should have new tests rather than rewriting historical tests to falsely assert it was hardened.

## Execution gates

Isolated ephemeral PostgreSQL with nonprivileged roles, no network egress, no production env, verified dependency source, transaction rollback evidence, exact commit SHA, repeatable CI reports. None certified yet.
No SQL migration executed, no Vitest, no CI run, no Infere traffic, no merge or deploy. P0 remains open.
