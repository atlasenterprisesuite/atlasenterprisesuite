# ATLAS Self-Healing 777 — Atomic completion design (P0 OPEN)

Evidence: read-only inspection of atlas-core PostgreSQL on 2026-10-26. No production DDL or DML executed.

## Existing contract
- public.atlas_ai_repair_jobs: id, org_id, requested_by, status, attempts, claimed_by, claimed_at, plan, result, source_commit, timestamps.
- public.audit_logs: bigint id, org_id, user_id, action, table_name, record_id, new_data.
- public.organization_members: org_id, user_id, role, status.
- public.atlas_claim_repair_job(p_runner text): service-role only; FOR UPDATE SKIP LOCKED pending jobs, increments attempts; no lease expiry.
- public.atlas_finish_repair_job(...): service-role only; updates by id, accepts completed without evidence; no tenant predicate or row count.

## Required atomic RPC before success is enabled
1. Add a separate, uniquely named completion RPC; do NOT silently replace the legacy signature. Revoke EXECUTE from PUBLIC/anon/authenticated; restrict to service_role and validate caller's signed actor context via a trusted server boundary.
2. Accept explicit job ID, organization ID, actor ID, expected lease token, idempotency key, target and observed exact 40-character commit SHAs, verification receipt references, and expected prior status.
3. In one PostgreSQL transaction lock job FOR UPDATE, assert tenant and active owner/admin membership, matching lease/claim, permitted status transition, fresh verification and non-empty immutable evidence receipts. Require exact SHA equality. Never trust client boolean success.
4. Enforce UNIQUE(org_id, job_id, idempotency_key) for durable replay protection; use one stable receipt per successful request. Concurrent duplicate must return the same committed receipt or a deterministic conflict, never two writes.
5. Insert an append-only audit record and capture its RETURNING id before changing status to completed; both must commit or rollback together. If audit insert fails, completion must remain uncommitted.
6. Use fixed search_path, fully qualified objects, strict EXECUTE grants and RLS review; do not log secrets or unredacted AI prompts.
7. Lease issuance/recovery must be tenant-scoped, time-bounded, compare-and-swap and fenced by a monotonically increasing claim epoch. A stale worker cannot complete after reassignment.
8. Deprecate or explicitly block legacy completed transitions before enabling the new endpoint. The current Edge Function deliberately rejects success:true with HTTP 409.

## Isolated PostgreSQL test matrix (not yet run)
- Two workers race for one job: exactly one claim and one completion receipt.
- Replayed idempotency key returns same receipt; conflicting payload fails.
- Wrong tenant, revoked member, stale lease, wrong actor, malformed/mismatched SHA and absent verification each fail with no state mutation.
- Audit INSERT failure triggers rollback of job completion.
- Worker timeout and lease reclaim fence old worker.
- Missing job, invalid status transition and fake success cannot complete.
- RLS and grants prevent direct authenticated/anonymous invocation.
- Confirm no production connection strings, secrets, deploy hooks or network calls in the test environment.

## Current status
Design only. No schema migration, runtime completion activation, production changes, isolated Postgres tests, or exact-SHA green CI evidence. P0 OPEN.
