# ATLAS 777 Infere negative-test validation evidence — 2026-10-27

Status: P0 OPEN / STATIC ONLY / NO RUNTIME CERTIFICATION

Branch: `test/infere-routing-security-tdd-777-20261027`
Inspected HEAD: `f848888a0f23e9ec4ac46d348c3d59fb10ac6c2c`
GitHub compare HEAD vs inspected SHA: identical (ahead 0, behind 0).

## File blob evidence

- `supabase/functions/atlas-copilot/intelligence-gateway.mjs`: `bb250f5340f77019e3aa987e216ee4453ac9b251`.
- `supabase/migrations/20260920160000_atlas_ai_emergency_fallback_budget.sql`: `3551aba2fa72ee19e10d1bdb82d7555247f0d3b7`.
- `tests/unit/atlas-infere-routing-security-777.test.ts`: `1cb41effd2c9ba7c7c34687e0894e74851d82d49`.
- `tests/unit/atlas-infere-privacy-budget-negative-777.test.ts`: `1a1b47058306ba103afe415f5a95a0598b1b05c6`.

## Static findings (NOT Vitest results)

1. `createIntelligenceRouter` does not inspect a tenant-scoped privacy classification when creating fallback candidates. Gateway dispatch may have additional controls elsewhere; complete call-chain review required.
2. SQL advisory lock uses `current_date::text` while authorization window uses UTC date. Timezone and UTC-midnight race tests needed.
3. Existing same-trace reservation is returned without comparing requested `reserve_usd` or `daily_budget_usd` to stored terms. Need explicit idempotency contract and negative replay test.
4. SECURITY DEFINER function accepts supplied `p_org_id` and `p_actor_id` without an explicit membership predicate in this function; service-role-only EXECUTE remains a defense, but caller identity binding and revocation must be validated end to end.

## Test-review constraints

The four new RED checks are source/behavior contract tests; their regexes may fail on semantically safe alternative SQL implementations. They do NOT prove Postgres concurrency, RLS, consent enforcement or end-to-end secret redaction.

A safe correction to an existing applied migration must be a new forward migration, not an edit in place, and requires verified schema/roles and disposable PostgreSQL tests. Do not patch production schema on static findings alone.

## Runner gate

No full checkout with verified Git blob integrity; no certified offline dependencies; no runner-level egress attestation; no proven absence of production secrets. Do not create/trigger actions yet. `npm ci` may invoke root `postinstall`; Render path downloads binaries.

## No execution claims

No Vitest, TypeScript typecheck, PostgreSQL, CI runner, vendor call, merge or deploy was performed. Branch P0 remains open.
