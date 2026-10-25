# ATLAS 777 — Multiexecution Command Center: evidence-first implementation plan

Status: DESIGN / AUDIT ONLY — no runtime deployment certified.
Baseline main SHA at review: `21e7b27a87fb7c1e2f52e320dcfdac97b8798e0a`.
Google Docs master: https://docs.google.com/document/d/10MThFzaY4tMYSKc7il3LwI3WTorg8KMn2GMCOg043DU/edit

## Confirmed repository authority
- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`, default branch `main`.
- Governance: `docs/governance/ATLAS_CANONICAL_REPOSITORY.md`; former `winderaranguren-gif/Atlas-enterprise-suite` is historical.
- Reuse existing `supabase/functions/atlas-execution/work-runtime.ts`, `execution_runtime_jobs`, `supabase/functions/atlas-repair-bridge/index.ts`, and the existing `ATLAS_MASTER_AUTONOMOUS_EXECUTION_PROTOCOL.md`.
- Existing Commerce delivery queue migration uses `FOR UPDATE SKIP LOCKED`; adapt its proven atomic-claim pattern only after checking scope, grants and idempotency.
- The current GitHub PR #913 is titled **ATLAS Copy & Paste 777 workspace**. Do not confuse it with Operations Sentinel.

## Target model
Each work item records: execution_id, tenant_id, org_id, module_id, source_type, source_ref, issue, PR, branch, head_sha, workflow_run_id, priority, state, lease_owner, lease_expiry, attempt_count, idempotency_key, correlation_id, blocker, audit_ref, evidence_refs, created_at, updated_at.
States: QUEUED -> CLAIMED -> RUNNING -> VALIDATING -> SUCCEEDED | FAILED_RETRYABLE | BLOCKED_P0 | AWAITING_AUTHORIZATION | CANCELLED. A stale lease is recoverable only after a transactionally safe reclaim.
No one task's failure may block unrelated tenant-isolated tasks; dependent tasks remain blocked.

## Non-negotiable controls
1. Atomic claim (transaction / `FOR UPDATE SKIP LOCKED` or equivalent) and lease heartbeat.
2. Unique idempotency keys per external effect, durable result reconciliation before retry.
3. RLS and org/tenant validation on every read, claim, action, and audit event; service-role use strictly server-side.
4. Bounded retries with backoff and dead-letter handling; never retry irreversible actions blindly.
5. P0 fail-closed; no merge, deployment or external effects without approved gates.
6. Evidence fields differentiate source commit, CI, deploy artifact, production SHA and live E2E.
7. Read-only dashboard until its authenticated data contracts and security tests pass.

## Acceptance tests before enabling execution
- Two concurrent workers cannot claim the same queued job.
- Expired lease reclaim cannot duplicate a confirmed external effect.
- Tenant A cannot list, claim, mutate, or inspect tenant B jobs.
- A P0 blocks only its dependency graph, not unrelated jobs.
- Failed retries exhaust to a durable terminal or review state.
- CI green without deploy evidence does not mark production verified.
- Every state transition is auditable and linked to exact SHA where applicable.

## Open verification gates
- Identify actual Operations Sentinel issue/PR from GitHub; do not use #913 by assumption.
- Inventory deployed Supabase functions, worker schedules, runtime heartbeat, Cloudflare routes and credentials using authorized provider evidence.
- Inspect migration grants and existing queue state before schema changes.
- Capture GitHub Actions exact-head runs for any implementation PR.
- Test staging first; leave production untouched until explicit release authorization and exact-SHA evidence.

## Execution sequence
1. Inventory existing execution broker, repair bridge, database migrations, routes and workflows.
2. Reconcile architecture with the master document and record verified refs.
3. Write failing contract tests for claim/lease/idempotency/RLS.
4. Make minimal reusable changes on isolated feature branch.
5. CI + security + E2E evidence; PR review; production is a separate gate.

## P0 — Durable external-effect idempotency design (not deployed)

The isolated PostgreSQL test covers an interrupted worker, a durable simulated
provider-effect counter, and concurrent quarantine. It **does not** prove
exactly-once execution against a real external provider. Until reconciliation
exists, expired `claimed`/`running` jobs remain `waiting_human`; never
automatically requeue them.

Proposed schema, subject to separate review and tests:
- `external_effect_ledger`: `org_id`, `tenant_id`, `job_id`,
  `effect_key`, `provider`, `provider_idempotency_key`, `status`
  (`reserved`, `unknown`, `confirmed`, `rejected`), provider
  receipt/reference, timestamps, and immutable audit reference.
- Unique constraint on (`org_id`, `tenant_id`, `effect_key`) to prevent
  concurrent reservation of the same logical effect. The provider must support
  a stable idempotency key or a reliable read-only status lookup.
- Before an outbound call, atomically reserve the effect key and persist an
  outbox intent; do not rely on an in-memory lock. A crash after sending but
  before recording a receipt produces `unknown`, not `rejected`.
- On recovery, reconcile `unknown` with the provider using the **same**
  idempotency key or authoritative status API. If reconciliation is impossible,
  quarantine for human review. Never infer `not executed` from a timeout.
- Retry is a separate authorized, transactionally fenced transition only
  after provider-confirmed absence of side effects and bounded attempt checks.
  Neither a new lease nor an expired lease authorizes an outbound replay.

Acceptance gate: tests must simulate a crash both before and after provider
commit, simultaneous recovery workers, duplicate webhook delivery, tenant
isolation, and a provider timeout with unknown outcome. Verify provider-side
effect count stays at one. Production remains blocked until provider-specific
E2E evidence and exact-SHA deployment checks exist.
