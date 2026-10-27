# ATLAS 777 — Emergency AI budget forward-migration design (NOT EXECUTABLE)

Baseline: `4386d51d53e3d563620e7ed1a05658a47450e1df`.
Status: P0 OPEN. Design and test plan only. Not a SQL migration, not deployed.

## Inspected source
- `supabase/migrations/20260920160000_atlas_ai_emergency_fallback_budget.sql`: original SECURITY DEFINER RPC, RLS, service_role EXECUTE, unique (org_id,trace_id,provider).
- `supabase/functions/atlas-copilot/atlas-intelligence-store.mjs`: `reserveEmergencyBudget` posts to `rpc/atlas_reserve_ai_emergency_budget` with `p_org_id,p_actor_id,p_trace_id,p_provider,p_reserve_usd,p_daily_budget_usd`; REST uses a service role key.
- `supabase/functions/atlas-copilot/intelligence-gateway.mjs`: only emergency fallback calls store reservation; generated trace_id and runtime cost policy.
- `tests/integration/atlas-ai-emergency-budget-migration.test.ts`: static checks only (no actual PostgreSQL race/rollback).

## Candidate *new* migration plan
Never modify the historical migration. In a new timestamped SQL migration:
1. Keep the RPC name, parameter types, return type, service_role-only GRANT, and ledger schema for backwards compatibility. Make every change transactional and idempotent for deployment rollback.
2. Evaluate current UTC day once from a single `v_now := transaction_timestamp()` and `v_day_start := date_trunc('day', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`; lock by `p_org_id`, provider and `v_day_start::date`, and sum where `created_at >= v_day_start AND created_at < v_day_start + interval '1 day'`. Ensure concurrency at midnight does not permit over-budget; consider org/provider invariant separate from day key with an advisory lock independent of midnight, then recompute UTC day under lock. Verify behavior with suspended sessions.
3. Explicitly require an active membership row matching `p_org_id,p_actor_id` using `public.organization_members`; check original caller's authenticated identity server-side before invoking the service-role RPC. Because service_role bypasses RLS, membership validation inside SECURITY DEFINER does NOT itself prove the parameter actor is the caller. Close this trust boundary in the Edge Function (revalidation before dispatch), and reject revoked/changed scope.
4. If existing row found for `org_id,trace_id,provider`, deny when `actor_id`, `reserve_usd` or `daily_budget_usd` differ from request. Never silently accept a smaller current budget; define daily budget changes at org/provider scope, preferably persisted config rather than caller-supplied ceiling.
5. Ensure all invalid amounts are finite, positive and bounded by NUMERIC(12,6), disallow budget downsizing/races that bypass tenant daily cap; return stable deny reason with no customer/secret payload.
6. Preserve RLS + restricted EXECUTE, search_path, constraint and existing grant, and record audit without leaking personally identifying prompt content. Design audit transaction and rollback behavior first.
7. No actual Infere provider or paid fallback is enabled by this work.

## Negative PostgreSQL tests (disposable DB only)
- Two sessions reserve $0.70 each against daily $1; at most one allowed.
- Same trace+provider+org+actor+amount repeated => same reservation ID and no extra charge.
- Same trace with changed actor, amount or ceiling => denied without mutation.
- UTC boundary at 23:59:59.999 and 00:00:00, sessions in America/New_York, UTC and Pacific/Auckland; consistent period and lock.
- Revoked membership, actor mismatch, unknown organization => denied.
- Authenticated/anon direct RPC invocation => permission denied; tenant-crossing table read/write => denied.
- Exception after reservation insert => rollback all rows and audit together.
- Failed upstream inference => reservation remains conservative; no duplicate authorized retry.
- Ledger/concurrent transactions maintain per-organization isolation.
- Revalidate caller identity in Edge route before reservation and provider dispatch.

## Stop conditions
Full original organization_members DDL and authorization policy not yet certified. A service_role key is deliberately high privilege. PostgreSQL sandbox/network/process/filesystem isolation not attested. Never apply a proposed migration or execute npm/CI until these gates are passed.
