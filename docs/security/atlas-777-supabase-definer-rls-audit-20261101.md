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
