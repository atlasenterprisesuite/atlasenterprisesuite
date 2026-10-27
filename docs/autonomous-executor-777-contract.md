# ATLAS Autonomous Executor 777

Status: specification, not a deployed worker.

## State machine
QUEUED -> DISCOVER -> PLAN -> IMPLEMENT -> TEST -> CI -> SECURITY -> REVIEW -> READY_FOR_RELEASE -> RELEASE -> VERIFY -> COMPLETE.

Recoverable errors enter RETRY_WAIT, then REPAIR and TEST. Missing permissions, failed security gates, stale SHAs, or exhausted retry budgets enter BLOCKED. Cancellation enters CANCELLED.

## Durable execution
Use tenant-isolated persisted jobs with unique IDs, scoped permissions, dependency IDs, idempotency keys, exact SHAs, lease owners, heartbeat expiry, bounded retries, immutable evidence references, and audit events. Reclaim expired leases atomically. Prevent duplicate execution.

## Safety gates
No merge or deployment solely because CI is green. Require separately validated review, security, approvals, and exact SHA. No bypass of branch protection. No production actions without release authorization. Never auto-submit external forms, payments, signatures, or government filings.

## Completion
Require passing tests, CI evidence, security verification, authorized release, and production SHA verification. Otherwise report BLOCKED or IN_VALIDATION with explicit reasons.

## Delivery backlog
1. Supabase schema, RLS, and audited transition functions.
2. Persistent worker with leases, retries, and recovery.
3. GitHub read/write adapter with least privilege.
4. CI and security evidence ingestion.
5. Approval gateway and revocation.
6. Cloudflare release adapter and post-release SHA checks.
7. Operations dashboard and end-to-end fault-injection tests.

PR #913 Smart Autofill demo is not a deployed autonomous executor. Keep its P0 controls in force.
