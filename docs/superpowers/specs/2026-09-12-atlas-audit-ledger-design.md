# ATLAS Audit Ledger — Design Specification

Date: 2026-09-12
Status: Awaiting written-spec approval
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Target branch: `feat/universal-execution-engine`
Owner layer: shared platform infrastructure
Primary consumer: ATLAS Universal Execution Engine

## 1. Purpose

ATLAS Audit Ledger provides a cryptographically chained, append-only forensic record for sensitive Universal Execution Engine events. It complements the existing operational execution audit trail with tamper-evident lineage that can be verified independently.

The approved source document is `atlas_enterprise_technical_report.pdf`, especially its sections describing `@atlas/audit-ledger`, SHA-256 hash chaining, immutable SQL triggers, a TypeScript service contract, Web Crypto, and chain verification. The current repository state is also binding: `packages/execution`, `execution_audit_events`, multi-tenant organization scoping, execution-layer RBAC, fail-closed evidence verification, and approval payload binding must remain intact.

## 2. Scope

This slice will add:

- `packages/audit-ledger` as a runtime-neutral npm workspace package;
- canonical audit ledger types and service contracts;
- deterministic canonicalization and SHA-256 digest generation using Web Crypto;
- Supabase persistence in `audit_ledger_events`;
- immutable database enforcement for update/delete;
- organization/tenant-aware read isolation;
- serialized append semantics per organization/workflow to prevent hash-chain forks;
- integrity verification that checks both link continuity and digest recomputation;
- integration at the existing Universal Execution Engine audit boundary;
- focused unit/integration contract tests.

This slice will not merge, deploy, apply migrations to production, invoke paid providers, or replace domain-module authorization.

## 3. Relationship to the Existing Execution Audit Trail

`execution_audit_events` remains the operational audit table used by the Universal Execution Engine for human-readable state history and correlation queries.

`audit_ledger_events` is a separate cryptographic ledger. It must not become a second source of business truth. It stores only the minimum immutable event material needed to verify provenance and chain integrity.

The Universal Execution Engine audit boundary will emit both:

1. an operational execution audit event; and
2. a cryptographic ledger event referencing the same organization, workflow/task, actor, action, correlation lineage, and relevant evidence IDs.

If the cryptographic append cannot be completed, the audit boundary fails closed. The first implementation does not claim transactional rollback of an already-completed domain mutation across a separate network request; it guarantees atomicity and serialization of the ledger append itself and keeps the existing execution audit behavior truthful. Any future requirement for mutation + audit + ledger in one database transaction must use dedicated SQL/RPC transaction boundaries per mutation type.

## 4. Canonical Ledger Event

The repository representation extends the PDF schema only where required to preserve ATLAS tenancy and permit true digest recomputation.

Required fields:

- `eventId` / `event_id` — UUID generated before hashing;
- `organizationId` / `org_id` — authoritative organization scope;
- `tenantId` / `tenant_id` — persisted tenant scope inherited from the execution record, never trusted from arbitrary client input;
- `workflowId` / `workflow_id` — execution workflow lineage;
- `taskId` / `task_id` — execution task lineage;
- `actorId` / `actor_id` — authenticated actor or authorized system actor;
- `actionType` / `action_type` — bounded action identifier;
- `payloadDigest` / `payload_digest` — SHA-256 digest of the canonical event envelope;
- `previousStateHash` / `previous_state_hash` — previous event digest or `GENESIS_BLOCK`;
- `metadata` — bounded JSON containing non-secret event metadata only;
- `nonce` — UUID nonce used in digest construction;
- `digestVersion` / `digest_version` — initially `1`;
- `createdAt` / `created_at` — timestamp chosen before hashing and persisted unchanged.

`metadata` must be JSON-compatible and must serialize to no more than 16 KiB before persistence. Non-JSON values are rejected instead of coerced.

No API key, password, access token, recovery code, private certificate, raw provider credential, or secret-bearing payload may be written to the ledger.

## 5. Action Types

The initial shared type includes the source document actions:

- `TASK_STARTED`;
- `GATE_EVALUATED`;
- `EVIDENCE_RECORDED`;
- `TASK_FAILED`;
- `TASK_COMPLETED`;
- `WORKFLOW_BLOCKED`.

To integrate safely with the current execution audit boundary without discarding existing action detail, the package also supports a bounded namespaced execution action matching `execution.[a-z0-9_.-]{1,100}`, such as `execution.task.transitioned`, `execution.approval.requested`, or `execution.evidence.recorded`.

The source-document enum is preserved as the minimum guaranteed vocabulary; namespaced execution actions are the repository compatibility extension. Any action outside the source enum or the namespaced execution pattern is rejected.

## 6. Cryptographic Construction

The package must be browser/Deno safe and use global Web Crypto only. It must not import `node:crypto`.

### 6.1 Canonical envelope

Digest version 1 hashes the UTF-8 encoding of a deterministic JSON envelope containing, in this exact semantic set:

- `digestVersion`;
- `eventId`;
- `organizationId`;
- `tenantId`;
- `workflowId`;
- `taskId`;
- `actorId`;
- `actionType`;
- canonicalized `metadata`;
- `previousStateHash`;
- `nonce`;
- `createdAt`.

Object keys are recursively sorted before JSON serialization. Array order is preserved. No transient field that is not persisted may participate in the digest.

### 6.2 Digest

`crypto.subtle.digest('SHA-256', bytes)` produces a 64-character lowercase hexadecimal digest.

### 6.3 Genesis

The first event for an organization/workflow chain uses `GENESIS_BLOCK` as `previousStateHash`.

## 7. Concurrency and Fork Prevention

The illustrative PDF service reads the last event and then inserts a new event. That sequence is not sufficient under concurrent writers because two requests can observe the same head and create divergent children.

The repository implementation must therefore add a server-side append RPC/function that serializes ledger appends for each `(org_id, workflow_id)` chain. The function must:

1. acquire a transaction-scoped advisory lock derived from organization + workflow;
2. load the workflow by `workflow_id + org_id` and require its persisted `tenant_id` to equal the append `tenant_id`;
3. load the task by `task_id + workflow_id + org_id` and require its persisted `tenant_id` to equal the append `tenant_id`;
4. read the current chain head after acquiring the lock;
5. require the caller-provided `previous_state_hash` to match the current head, or `GENESIS_BLOCK` for an empty chain;
6. reject stale heads with a machine-readable conflict;
7. insert exactly one immutable event;
8. commit atomically.

Foreign keys are necessary but not sufficient for tenant isolation; the RPC performs the composite lineage checks above so a valid UUID from another workflow or organization cannot be attached to the chain.

The TypeScript service retries a stale-head conflict by re-reading the new head, rebuilding the envelope, recomputing the digest, and attempting the append again within a maximum of three total append attempts.

## 8. Supabase Schema and Immutability

A new migration will create `public.audit_ledger_events` with the canonical fields above.

Required database constraints:

- UUID primary key on `event_id`;
- non-null organization, tenant, workflow, task, actor, action, digest, previous hash, nonce, digest version, and timestamp;
- digest regex `^[a-f0-9]{64}$`;
- `digest_version = 1` for this slice;
- action type limited to the source enum or `execution.[a-z0-9_.-]{1,100}`;
- non-empty text checks where appropriate;
- metadata serialized-size enforcement consistent with the 16 KiB application limit where practical in PostgreSQL;
- indexes covering `(org_id, workflow_id, created_at, event_id)` and `(org_id, created_at)`;
- foreign keys to `execution_workflows` and `execution_tasks` where compatible with migration order, with RPC-level composite scope validation remaining authoritative.

### 8.1 Strict immutability

A trigger function must reject every `UPDATE` and `DELETE` against `audit_ledger_events`, including service-role writes.

This is stricter than the current `execution_audit_events` application-level append-only convention and is intentional for the forensic ledger.

### 8.2 RLS

RLS is enabled. Authenticated users receive read access only when they are active members of the matching organization. There are no authenticated insert/update/delete grants. Server-side append uses the service boundary/RPC.

## 9. Package Structure

Expected package layout:

```text
packages/audit-ledger/
  package.json
  src/
    types.ts
    canonicalize.ts
    digest.ts
    service.ts
    index.ts
```

### 9.1 Types

`AuditEventPayload` describes the source event before persistence. `AuditLedgerEvent` represents the complete persisted/hashable event. `AuditLedgerService` exposes:

- `recordEvent(event): Promise<{ eventId: string; digest: string }>`;
- `verifyChainIntegrity(input): Promise<AuditChainVerification>`.

`AuditChainVerification` returns at minimum:

- `valid`;
- `eventCount`;
- `firstInvalidEventId` when applicable;
- `reason` when invalid.

A boolean-only compatibility helper may be exposed, but the primary API must retain diagnostic evidence.

## 10. Integrity Verification

`verifyChainIntegrity` must not merely compare each event's `previous_state_hash` to the preceding row.

For each event ordered deterministically by `created_at`, then `event_id`:

1. validate genesis or previous-link continuity;
2. reconstruct the exact digest-version envelope from persisted fields;
3. recompute SHA-256 using Web Crypto;
4. compare recomputed digest with `payload_digest`;
5. stop at the first invalid event and return a diagnostic result.

Default behavior for an empty chain is `{ valid: false, eventCount: 0, reason: 'audit_ledger_no_events' }`. Callers may pass `allowEmpty: true`; only in that case does an empty chain return `{ valid: true, eventCount: 0 }`.

## 11. Universal Execution Engine Integration

The first integration point is the existing server-side audit helper in `supabase/functions/atlas-execution/index.ts`.

The integration must:

- derive organization, tenant, workflow, task, actor, module/action, correlation ID, and evidence references from already-authorized persisted context;
- never accept ledger tenancy or `verified` evidence state directly from untrusted client fields;
- map the operational audit action to a ledger action without weakening domain permission checks;
- append the operational audit event and then the ledger seal through the server-side audit boundary;
- return a generic internal/audit error without exposing provider or service-role secrets if ledger persistence fails.

No domain module may gain authorization merely because it can write an audit event.

## 12. Failure Semantics

Machine-readable failures include at minimum:

- `audit_ledger_read_failed`;
- `audit_ledger_stale_head`;
- `audit_ledger_persistence_failed`;
- `audit_ledger_integrity_failed`;
- `audit_ledger_invalid_digest`;
- `audit_ledger_invalid_scope`;
- `audit_ledger_metadata_too_large`;
- `audit_ledger_invalid_action_type`;
- `audit_ledger_no_events`.

The service must not silently skip ledger writes for sensitive execution events.

## 13. Testing Strategy

Implementation follows TDD.

### Unit tests

- canonicalization is deterministic across object key order;
- arrays preserve order;
- SHA-256 output is stable for an identical envelope;
- changing any persisted hashed field changes the digest;
- genesis event uses `GENESIS_BLOCK`;
- metadata above 16 KiB is rejected;
- invalid/non-JSON metadata is rejected;
- invalid action types are rejected;
- runtime-neutral implementation contains no `node:crypto` dependency;
- chain verifier detects broken previous links;
- chain verifier detects metadata tampering even if links still appear continuous;
- chain verifier reports the first invalid event;
- empty-chain behavior follows `allowEmpty` exactly.

### Integration/contract tests

- migration creates `audit_ledger_events`;
- update/delete trigger raises on any attempted mutation;
- RLS is enabled;
- authenticated access is read-only and organization-scoped;
- append RPC serializes by organization/workflow and rejects a stale head;
- append RPC rejects task/workflow/org/tenant lineage mismatch;
- no direct authenticated mutation grant exists;
- execution audit boundary invokes the ledger service/server append path;
- tenant scope is inherited from persisted execution records;
- no secret material or raw credentials are present in the ledger schema/API contract.

### Repository gates

Before any merge-ready or production-ready claim:

- `npm ci`;
- `npm run typecheck`;
- focused audit-ledger unit/integration tests;
- existing execution unit/integration tests;
- `npm run test:unit`;
- `npm run test:integration`;
- `npm run build`;
- `git diff --check`;
- secret-pattern scan over the feature diff.

If the self-hosted runner is unavailable, that infrastructure condition must be reported as a blocked verification gate rather than converted into a false PASS.

## 14. Reconciliation With the Approved PDF

The implementation preserves the PDF's core architecture:

- package name `@atlas/audit-ledger`;
- SHA-256 hash chaining;
- Web Crypto;
- `GENESIS_BLOCK`;
- immutable SQL trigger;
- Supabase persistence;
- `recordEvent` and chain verification service contracts;
- task/workflow/actor/action/metadata lineage.

Repository hardening adds the following explicitly rather than silently changing the source design:

1. `tenant_id` to satisfy ATLAS tenant scoping;
2. `nonce`, `digest_version`, and persisted pre-hash timestamp so the digest can be recomputed later;
3. deterministic canonicalization rather than raw `JSON.stringify` property insertion order;
4. a serialized append RPC to prevent concurrent chain forks;
5. composite workflow/task/org/tenant validation inside the append RPC;
6. RLS and authenticated read-only grants;
7. diagnostic integrity results rather than only a boolean;
8. digest recomputation during verification, not link checking alone;
9. an explicit 16 KiB metadata ceiling and namespaced action-type constraint.

The PDF contains `create extension if not exists "uuid-ossp";` while the shown table uses `gen_random_uuid()`. The current ATLAS migrations already use `gen_random_uuid()`. The implementation will not introduce `uuid-ossp` solely for this ledger unless repository/database validation proves it is required.

## 15. Definition of Done

This architecture slice is complete when:

- `packages/audit-ledger` exists as a workspace package;
- its Web Crypto digest/canonicalization behavior is covered by tests;
- Supabase schema provides strict update/delete immutability and tenant-aware RLS;
- concurrent append attempts cannot create two valid children from one chain head;
- task/workflow/org/tenant lineage cannot be mixed across chains;
- chain verification detects both broken linkage and altered hashed content;
- Universal Execution Engine audit emission produces a corresponding ledger seal without bypassing RBAC or domain authorization;
- focused local tests/typechecks pass;
- the full repository gate is either PASS with evidence or explicitly BLOCKED by runner/dependency infrastructure;
- no merge or deploy occurs without explicit user approval.
