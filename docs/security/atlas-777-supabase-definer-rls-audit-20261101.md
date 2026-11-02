# ATLAS 777 — Supabase privileged RPC audit (RED contract)

Baseline candidate: e84d93d8e6d3a2f17da3fbbbe8c5d6ea8ee30b12 (GitHub search snapshot; revalidate before PR). Target: atlas-core ggmanzcgtlrvqfoccgsh. No production SQL permitted.

## Evidence
Security Advisor reports 22 authenticated-executable SECURITY DEFINER RPCs: 6 Care, 6 Payroll, 10 People. Source migrations: 20261007081500_atlas_care_core.sql; 20260923203000_atlas_payroll_core.sql; 20260923201500_atlas_people_core.sql. All three explicitly revoke PUBLIC/anon and grant authenticated; bodies check auth.uid() and has_identity_permission(p_org_id, permission). This is an intentional RPC surface requiring negative testing, not proof of exploit. Definer bodies use search_path=public,pg_temp, which requires search-path hardening review. Other later migrations may supersede definitions. RLS-without-policy informational findings: atlas_consensus_opinions and atlas_consensus_runs.

## Required RED/ GREEN tests in disposable PostgreSQL only
- Two organizations A/B; members Alice(A only), Bob(B only), Admin(A), removed Alice(A); include unprivileged authenticated and anon.
- For each of 22 RPC signatures: anon denied; unaffiliated authenticated denied; caller from A passing B org denied; cross-tenant foreign keys denied; permitted A operation succeeds only in A; unauthorised transition denied; no mutation after denial.
- Test Care read/write/approve, Payroll write/approve/self and People hr.write/payroll.self separately; ensure own-worker check cannot be forged by supplying another worker ID.
- Concurrent revoke-vs-RPC at READ COMMITTED with two sessions and deterministic barriers; assert no successful write after committed revocation under the selected linearization contract. If a race exists, design ordered row locks with explicit lock order and rerun.
- Check effective EXECUTE via PUBLIC/anon/authenticated, owner BYPASSRLS, security definer search_path and schema-qualified object references; compare current catalog against all migrations and app RPC consumers.
- Verify exposed Data API grants and RLS per operation, no permissive policy cross-tenant, invoker views, no JWT user_metadata authorization; assert tenant A cannot see B on SELECT/INSERT/UPDATE/DELETE.
- Verify consensus tables intentionally private; if so document expected deny and avoid permissive policies.
- Use pgTAP / supabase test db plus API-level authenticated tests; run from isolated test DB, no production credentials or networking.

## Fail-closed gates
P0 remains NO-GO until tests are executable and green on exact candidate SHA, GitHub Actions completes, migration diff reviewed, and no production changes. No blind REVOKE or ALTER FUNCTION: these RPCs are app-consumed. A design-only contract is not a passing test.

## Advisory Office inclusion — cross-module certification contract (2026-11-02)

Revalidated live PR heads (not evidence of security pass):
- People/Payroll/Care gate PR #974: 11545e2f27bbb5b80ae3377d1a1a564dd73af7a4
- Advisory isolated executor PR #961: dcfb06512020cc0369e955992b4e24f6b4921c40
- Advisory revocation RED gate PR #965: 357c8a253cf17b5f91720faaecfd667a1dbaf9dd
- Advisory concurrency preflight PR #966: 46e07f1f2e91ec4c6b93c977ccf94240d0168057
- Advisory two-session fixture PR #967: 738f58c7ad5a595f76ea0403563b213a0b245ad3
- Advisory lock-wait evidence PR #968: 0476d71f166734dc69a4ef2913fa3a924be725a0

These PRs have distinct base branches: do not cherry-pick or merge until dependency ancestry and actual migration contracts are inspected. Advisory is a required consumer of the shared revocation/authorization certification, not a separate bypass.

Reuse inventory:
- `supabase/functions/atlas-execution/work-runtime.ts`: runtime user/org/tenant context and lease handling; inspect revocation at every state transition.
- `supabase/migrations/20260912_atlas_work_runtime.sql`: persistent execution registrations/jobs and connection status; inspect row locks, effective grants, and revocation races.
- `supabase/functions/atlas-copilot/intelligence-gateway.mjs`: existing model routing; never assume it supplies database authorization.
- People migration depends on real `auth.users`, `organizations`, identity permission tables, `auth.uid()`, `has_identity_permission(uuid,text)`, and `audit_row_change()`. The isolated dependency preflight must reject absent definitions; fabricated replacements cannot certify production behavior.

Acceptance tests to implement (currently NOT certified):
1. Real migration bootstrap and catalog signatures; effective EXECUTE grants for anon/authenticated/PUBLIC.
2. Tenant A allowed, tenant B denied, unauthenticated and revoked actor denied for all 10 People RPCs.
3. Advisory RPC transaction vs committed membership revocation in two independent PostgreSQL sessions under READ COMMITTED, with deterministic barriers and lock-order evidence.
4. Work runtime claim/heartbeat/completion/quarantine vs revocation; no successful post-revocation mutation; retry/idempotency and lease expiry.
5. Evidence ledger must bind PR head SHA, Actions merge SHA, exact workflow/job/run, SQL fixtures and negative results. No green certification from a synthetic-only fixture.

P0 remains NO-GO. No production database operations, merge, or deploy.
