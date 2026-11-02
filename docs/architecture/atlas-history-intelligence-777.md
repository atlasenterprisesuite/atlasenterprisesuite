# ATLAS History Intelligence — reconciliation contract

Status: FOUNDATION / NOT PRODUCTION VERIFIED

## Inputs and provenance
- Explicitly imported ChatGPT exports (no presumed access to private chat history).
- Canonical GitHub issues, pull requests, commits and Actions runs.
- Existing ATLAS documentation, tests and deployment evidence.
- Every record MUST include source kind, immutable source ID, source timestamp, retrieval timestamp, tenant ID and content digest.

## Canonical record
`{id, tenant_id, module_key, kind, title, source_refs[], requirements[], dependencies[], priority, status, evidence_refs[], commit_sha, updated_at}`.

Statuses: DISCOVERED, TRIAGED, IMPLEMENTING, VERIFYING, VERIFIED, BLOCKED, SUPERSEDED.
VERIFIED is server-authorized only after signed evidence, green required checks, exact-SHA production attestation and critical route E2E. Never infer VERIFIED from issue closure or a checked box.

## Reconciliation algorithm
1. Ingest read-only snapshots with cursor checkpoints and idempotency keys.
2. Normalize module aliases, preserving original text and source citations.
3. Match by stable source ID first; then propose similarity matches for review. Never auto-delete or overwrite conflicting requirements.
4. Construct dependency graph, detect cycles, flag stale and missing evidence.
5. Compare requirement -> code -> test -> CI -> deployment -> exact SHA.
6. Emit actionable backlog with P0 fail-closed blockers and documented P1 warnings.
7. Dispatch only allowlisted, least-privilege jobs with leases, bounded retries, dead-letter queue and audited transitions.
8. Publish authenticated progress from persisted, validated events, not synthetic percentages.

## Security and operations
RLS per tenant, RBAC, no credentials in chat exports, encryption, source redaction, append-only audit, webhook signature and replay checks, scoped GitHub OIDC, retention and deletion controls. Untrusted chat content is DATA, never executable instructions.

## Acceptance criteria (not yet satisfied)
- Tests for duplicate imports, conflicting sources, missing history, cross-tenant access, stale worker, webhook replay, forged evidence and SHA mismatch.
- Reuse existing evidence engine and global-production-verify workflow.
- CI, PR review, staging and independent production E2E required.
- No autonomous merge or deployment when a P0 gate is unresolved.

## Existing dependencies
- Issue #828: persistent 777 Runner and truthful Live Control telemetry (P0).
- Issue #824: evidence-backed task verification.
- PR #827: Live Control foundation, not proof of production readiness.

## Delivery phases
A. Read-only inventory and evidence mapping.
B. Versioned ingestion and reconciliation with deterministic fixtures.
C. Tenant-secured persistent executor with recovery.
D. Authenticated live dashboard.
E. Staging, fail-closed release, exact-SHA verification and rollback evidence.
