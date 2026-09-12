# ATLAS Audit Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cryptographically chained, append-only, tenant-aware ATLAS Audit Ledger that seals Universal Execution Engine audit events without weakening RBAC, tenancy, or domain authorization.

**Architecture:** `packages/audit-ledger` owns runtime-neutral event types, deterministic canonicalization, SHA-256 hashing, verification, and a storage-neutral service. Supabase owns the immutable relational ledger and serialized append RPC. The existing `atlas-execution` server-side audit boundary emits the operational audit row first and then a cryptographic ledger seal from already-authorized persisted context; ledger failures fail closed.

**Tech Stack:** TypeScript 5.7+, Web Crypto, Vitest 3.2.6, Supabase/PostgreSQL, Deno Edge Functions, npm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-audit-ledger-design.md`

## Global Constraints

- Use global Web Crypto only; do not import `node:crypto` in `packages/audit-ledger`.
- `metadata` is non-secret bounded JSON with a maximum serialized size of 16 KiB.
- Tenant and organization scope come from persisted execution records, never arbitrary client fields.
- `execution.admin` never substitutes for Payroll, Accounting, Health, or other domain permissions.
- `audit_ledger_events` is strictly immutable: every `UPDATE` and `DELETE` must fail, including service-role attempts.
- Authenticated users receive organization-scoped read access only; no direct authenticated insert/update/delete grants.
- Append operations serialize per `(org_id, workflow_id)` and reject stale heads.
- Digest version 1 includes every persisted hash-participating field and uses recursively sorted object keys while preserving array order.
- Empty-chain verification defaults to invalid unless the caller explicitly sets `allowEmpty: true`.
- Do not merge, deploy, apply migrations to production, or spend provider credits without explicit user approval.

---

## File Map

- `packages/audit-ledger/package.json` — workspace package metadata.
- `packages/audit-ledger/src/types.ts` — ledger contracts, error/result types, storage interface.
- `packages/audit-ledger/src/canonicalize.ts` — deterministic recursive JSON canonicalization and metadata-size enforcement.
- `packages/audit-ledger/src/digest.ts` — Web Crypto SHA-256 envelope hashing.
- `packages/audit-ledger/src/verify.ts` — chain integrity verification and first-invalid-event diagnostics.
- `packages/audit-ledger/src/service.ts` — storage-neutral record/retry service.
- `packages/audit-ledger/src/index.ts` — public exports.
- `supabase/migrations/20260912_atlas_audit_ledger.sql` — table, constraints, RLS, immutability trigger, serialized append RPC.
- `supabase/functions/_shared/audit-ledger-store.ts` — Supabase adapter implementing the package storage contract.
- `supabase/functions/atlas-execution/index.ts` — existing operational audit boundary integration.
- `tests/unit/audit-ledger-canonicalization.test.ts` — canonicalization, metadata bounds, hashing.
- `tests/unit/audit-ledger-verification.test.ts` — chain verification and tamper detection.
- `tests/unit/audit-ledger-service.test.ts` — append/retry behavior against an in-memory store.
- `tests/integration/audit-ledger-schema-contract.test.ts` — SQL schema, RLS, immutable trigger, grants, append RPC contract.
- `tests/integration/audit-ledger-execution-boundary.test.ts` — Edge integration/security contract.

---

### Task 1: Package scaffold, canonical event types, and deterministic digest

**Files:**
- Create: `packages/audit-ledger/package.json`
- Create: `packages/audit-ledger/src/types.ts`
- Create: `packages/audit-ledger/src/canonicalize.ts`
- Create: `packages/audit-ledger/src/digest.ts`
- Create: `packages/audit-ledger/src/index.ts`
- Test: `tests/unit/audit-ledger-canonicalization.test.ts`

**Interfaces:**
- Produces: `AuditEventPayload`, `AuditLedgerEvent`, `AuditLedgerHead`, `AuditLedgerStore`, `AuditChainVerification`, `canonicalizeJson(value)`, `assertBoundedMetadata(metadata)`, `buildAuditLedgerDigest(event)`.

- [ ] **Step 1: Write the failing canonicalization/hash test**

```ts
import { describe, expect, it } from 'vitest';
import { canonicalizeJson, buildAuditLedgerDigest } from '../../packages/audit-ledger/src/index';

it('canonicalizes object keys but preserves array order', () => {
  expect(canonicalizeJson({ b: 2, a: { d: 4, c: 3 }, list: [2, 1] }))
    .toBe('{"a":{"c":3,"d":4},"b":2,"list":[2,1]}');
});

it('produces a stable 64-char SHA-256 digest for the same persisted envelope', async () => {
  const event = fixtureEvent();
  expect(await buildAuditLedgerDigest(event)).toBe(await buildAuditLedgerDigest({ ...event }));
  expect(await buildAuditLedgerDigest(event)).toMatch(/^[a-f0-9]{64}$/);
});
```

- [ ] **Step 2: Run RED**

Run:
```bash
npx vitest run tests/unit/audit-ledger-canonicalization.test.ts
```
Expected: FAIL because `packages/audit-ledger` does not yet exist.

- [ ] **Step 3: Add the package and canonical types**

`packages/audit-ledger/package.json`:
```json
{
  "name": "@atlas/audit-ledger",
  "private": true,
  "version": "0.1.0",
  "type": "module"
}
```

`types.ts` must define at minimum:
```ts
export type AuditActionType =
  | 'TASK_STARTED'
  | 'GATE_EVALUATED'
  | 'EVIDENCE_RECORDED'
  | 'TASK_FAILED'
  | 'TASK_COMPLETED'
  | 'WORKFLOW_BLOCKED'
  | `execution.${string}`;

export interface AuditLedgerEvent {
  eventId: string;
  organizationId: string;
  tenantId: string;
  workflowId: string;
  taskId: string;
  actorId: string;
  actionType: AuditActionType;
  metadata: Record<string, unknown>;
  previousStateHash: string;
  nonce: string;
  digestVersion: 1;
  createdAt: string;
  payloadDigest: string;
}
```

- [ ] **Step 4: Implement deterministic canonicalization and Web Crypto hashing**

`canonicalizeJson` recursively sorts object keys, preserves array order, and serializes with `JSON.stringify`. `assertBoundedMetadata` rejects serialized UTF-8 metadata larger than `16 * 1024` bytes with `audit_ledger_metadata_too_large`.

`buildAuditLedgerDigest` must hash the canonical envelope excluding only `payloadDigest`:
```ts
const bytes = new TextEncoder().encode(canonicalizeJson(envelope));
const digest = await crypto.subtle.digest('SHA-256', bytes);
```

- [ ] **Step 5: Run GREEN and runtime-neutral scan**

Run:
```bash
npx vitest run tests/unit/audit-ledger-canonicalization.test.ts
grep -R "node:crypto" packages/audit-ledger && exit 1 || true
```
Expected: PASS; grep returns no package match.

- [ ] **Step 6: Commit**

```bash
git add packages/audit-ledger tests/unit/audit-ledger-canonicalization.test.ts
git commit -m "feat: add audit ledger canonical hashing"
```

---

### Task 2: Chain integrity verifier

**Files:**
- Create: `packages/audit-ledger/src/verify.ts`
- Modify: `packages/audit-ledger/src/index.ts`
- Test: `tests/unit/audit-ledger-verification.test.ts`

**Interfaces:**
- Consumes: `AuditLedgerEvent`, `buildAuditLedgerDigest`.
- Produces: `verifyAuditChain(events, options?): Promise<AuditChainVerification>`.

- [ ] **Step 1: Write failing tests for valid, broken-link, and tampered-content chains**

```ts
it('rejects metadata tampering even when previous links still match', async () => {
  const chain = await makeValidChain(3);
  chain[1] = { ...chain[1], metadata: { changed: true } };
  const result = await verifyAuditChain(chain);
  expect(result.valid).toBe(false);
  expect(result.firstInvalidEventId).toBe(chain[1].eventId);
  expect(result.reason).toBe('audit_ledger_invalid_digest');
});

it('treats empty chains as invalid unless explicitly allowed', async () => {
  expect((await verifyAuditChain([])).valid).toBe(false);
  expect((await verifyAuditChain([], { allowEmpty: true })).valid).toBe(true);
});
```

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/unit/audit-ledger-verification.test.ts
```
Expected: FAIL because verifier is absent.

- [ ] **Step 3: Implement verifier**

Order events by `createdAt`, then `eventId`. For each event:
1. require `GENESIS_BLOCK` for the first event, otherwise require previous row digest;
2. recompute the event digest from persisted fields;
3. compare with `payloadDigest`;
4. return immediately at first failure.

Return shape:
```ts
{ valid: boolean; eventCount: number; firstInvalidEventId?: string; reason?: string }
```

- [ ] **Step 4: Run GREEN**

```bash
npx vitest run tests/unit/audit-ledger-verification.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/audit-ledger/src/verify.ts packages/audit-ledger/src/index.ts tests/unit/audit-ledger-verification.test.ts
git commit -m "feat: verify audit ledger chain integrity"
```

---

### Task 3: Supabase immutable ledger schema and tenant-aware RLS

**Files:**
- Create: `supabase/migrations/20260912_atlas_audit_ledger.sql`
- Test: `tests/integration/audit-ledger-schema-contract.test.ts`

**Interfaces:**
- Produces: `public.audit_ledger_events`, immutability trigger, read-only authenticated RLS policies.

- [ ] **Step 1: Write the failing schema contract test**

The test must assert the migration contains:
```ts
expect(sql).toContain('create table if not exists public.audit_ledger_events');
expect(sql).toContain('tenant_id text not null');
expect(sql).toContain('before update or delete on public.audit_ledger_events');
expect(sql).toContain('enable row level security');
expect(sql).toContain('grant select on public.audit_ledger_events to authenticated');
expect(sql).not.toMatch(/grant\s+(insert|update|delete|all).*audit_ledger_events.*authenticated/i);
expect(sql).toContain("octet_length(metadata::text) <= 16384");
```

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/integration/audit-ledger-schema-contract.test.ts
```
Expected: FAIL because migration is absent.

- [ ] **Step 3: Implement table, indexes, strict trigger, and RLS**

Required table columns:
```sql
event_id uuid primary key,
org_id uuid not null references public.organizations(id) on delete restrict,
tenant_id text not null,
workflow_id uuid not null references public.execution_workflows(id) on delete restrict,
task_id uuid not null references public.execution_tasks(id) on delete restrict,
actor_id uuid not null,
action_type text not null,
payload_digest text not null check (payload_digest ~ '^[a-f0-9]{64}$'),
previous_state_hash text not null,
metadata jsonb not null default '{}'::jsonb,
nonce uuid not null,
digest_version integer not null check (digest_version = 1),
created_at timestamptz not null,
check (octet_length(metadata::text) <= 16384)
```

Create indexes on `(org_id, workflow_id, created_at, event_id)` and `(org_id, created_at)`.

Create `enforce_audit_ledger_immutability()` that always raises on `UPDATE` or `DELETE`, then bind it as a `BEFORE UPDATE OR DELETE` trigger.

RLS select policy must require active `organization_members` membership for `org_id`. Revoke all from `authenticated`, then grant only select.

- [ ] **Step 4: Run GREEN**

```bash
npx vitest run tests/integration/audit-ledger-schema-contract.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260912_atlas_audit_ledger.sql tests/integration/audit-ledger-schema-contract.test.ts
git commit -m "feat: add immutable audit ledger schema"
```

---

### Task 4: Serialized append RPC and fork prevention

**Files:**
- Modify: `supabase/migrations/20260912_atlas_audit_ledger.sql`
- Modify: `tests/integration/audit-ledger-schema-contract.test.ts`

**Interfaces:**
- Produces: `public.append_audit_ledger_event(...)` RPC returning the inserted ledger row.

- [ ] **Step 1: Extend the failing contract test**

Assert SQL contains:
```ts
expect(sql).toContain('create or replace function public.append_audit_ledger_event');
expect(sql).toContain('pg_advisory_xact_lock');
expect(sql).toContain('audit_ledger_stale_head');
expect(sql).toContain('audit_ledger_invalid_scope');
```

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/integration/audit-ledger-schema-contract.test.ts
```
Expected: FAIL because RPC is absent.

- [ ] **Step 3: Implement append RPC**

RPC behavior, in one transaction:
1. acquire `pg_advisory_xact_lock(hashtextextended(p_org_id::text || ':' || p_workflow_id::text, 0));`
2. verify the workflow exists with the same `org_id` and `tenant_id`;
3. verify the task exists under that workflow with the same `org_id` and `tenant_id`;
4. read the current head ordered by `created_at desc, event_id desc`;
5. require `p_previous_state_hash = coalesce(head.payload_digest, 'GENESIS_BLOCK')`;
6. require `p_created_at > head.created_at` when a head exists;
7. insert exactly one row;
8. return it.

Raise machine-readable exception text `audit_ledger_invalid_scope` for lineage mismatch and `audit_ledger_stale_head` for head/timestamp conflicts.

Do not grant execute to `authenticated`; server-side service-role use only.

- [ ] **Step 4: Run GREEN**

```bash
npx vitest run tests/integration/audit-ledger-schema-contract.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260912_atlas_audit_ledger.sql tests/integration/audit-ledger-schema-contract.test.ts
git commit -m "feat: serialize audit ledger appends"
```

---

### Task 5: Storage-neutral service and bounded stale-head retry

**Files:**
- Create: `packages/audit-ledger/src/service.ts`
- Modify: `packages/audit-ledger/src/types.ts`
- Modify: `packages/audit-ledger/src/index.ts`
- Test: `tests/unit/audit-ledger-service.test.ts`

**Interfaces:**
- Consumes: canonicalization/digest from Tasks 1-2.
- Produces: `AuditLedgerServiceImpl`, `AuditLedgerStore.readHead(scope)`, `AuditLedgerStore.append(event)`, `recordEvent(event)`.

- [ ] **Step 1: Write the failing service tests**

Cover:
- first event uses `GENESIS_BLOCK`;
- stale head causes a bounded retry;
- metadata >16 KiB is rejected before persistence;
- retry rebuilds `previousStateHash`, `createdAt`, nonce, and digest.

Example assertion:
```ts
expect(store.appendAttempts).toBe(2);
expect(result.digest).toMatch(/^[a-f0-9]{64}$/);
```

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/unit/audit-ledger-service.test.ts
```
Expected: FAIL because service is absent.

- [ ] **Step 3: Implement the service**

`recordEvent` must:
1. validate metadata size;
2. read the chain head;
3. choose `createdAt = max(now, head.createdAt + 1ms)`;
4. generate `eventId` and `nonce` with `crypto.randomUUID()`;
5. compute digest;
6. call store append;
7. on `audit_ledger_stale_head`, retry up to 3 total attempts with a fresh head/envelope;
8. surface all other failures unchanged as audit-ledger errors.

- [ ] **Step 4: Run GREEN**

```bash
npx vitest run tests/unit/audit-ledger-service.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/audit-ledger/src tests/unit/audit-ledger-service.test.ts
git commit -m "feat: add audit ledger recording service"
```

---

### Task 6: Supabase store adapter and Universal Execution audit integration

**Files:**
- Create: `supabase/functions/_shared/audit-ledger-store.ts`
- Modify: `supabase/functions/atlas-execution/index.ts`
- Create: `tests/integration/audit-ledger-execution-boundary.test.ts`

**Interfaces:**
- Consumes: `AuditLedgerStore`, `AuditLedgerServiceImpl`, existing `appendAudit` authorized context.
- Produces: server-side Supabase adapter and dual operational+cryptographic audit emission.

- [ ] **Step 1: Write the failing Edge boundary contract test**

Assert the Edge source/shared adapter:
```ts
expect(edge).toContain('AuditLedgerServiceImpl');
expect(edge).toContain('append_audit_ledger_event');
expect(edge).toContain('audit_ledger_persistence_failed');
expect(edge).not.toContain('body.tenant_id');
expect(edge).not.toContain('body.verified === true');
```

Also assert ledger metadata is built from persisted/authorized task context plus bounded correlation/evidence references.

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/integration/audit-ledger-execution-boundary.test.ts
```
Expected: FAIL because the ledger adapter is not integrated.

- [ ] **Step 3: Implement `SupabaseAuditLedgerStore`**

The adapter uses the already-created server-side Supabase admin client. `readHead` queries `audit_ledger_events` by `org_id/workflow_id`, ordered `created_at desc,event_id desc`, selecting only head fields. `append` calls RPC `append_audit_ledger_event` with all persisted envelope fields and maps stale-head/scope database errors to package error codes.

- [ ] **Step 4: Integrate the existing `appendAudit` boundary**

After the operational `execution_audit_events` insert succeeds, construct ledger metadata from:
```ts
{
  module: input.module,
  previousState: input.previousState,
  resultingState: input.resultingState,
  evidenceIds: input.evidenceIds || [],
  correlationId: input.correlationId
}
```

Call `AuditLedgerServiceImpl.recordEvent` with `orgId`, persisted `tenantId`, `workflowId`, `taskId`, authenticated actor, and the operational action. Do not use arbitrary request body tenancy. If the ledger append fails, throw generic `audit_ledger_persistence_failed` without exposing Supabase/service-role internals.

For audit events with a null workflow or task, keep the existing operational audit row but do not fabricate UUID lineage; either require both IDs for cryptographic sealing or reject the sensitive mutation before calling the ledger path. Lock this behavior in the test.

- [ ] **Step 5: Run GREEN and Edge typecheck**

```bash
npx vitest run tests/integration/audit-ledger-execution-boundary.test.ts tests/integration/execution-edge-contract.test.ts
```
Then run the repository's existing Deno/TypeScript Edge check if available; otherwise use the established local stub TypeScript harness for `supabase/functions/atlas-execution/index.ts` and report that limitation explicitly.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/audit-ledger-store.ts supabase/functions/atlas-execution/index.ts tests/integration/audit-ledger-execution-boundary.test.ts
git commit -m "feat: seal execution audits in cryptographic ledger"
```

---

### Task 7: Cross-check security invariants and regression coverage

**Files:**
- Modify as needed only when a failing regression proves a defect:
  - `tests/integration/audit-ledger-schema-contract.test.ts`
  - `tests/integration/audit-ledger-execution-boundary.test.ts`
  - `tests/integration/execution-edge-contract.test.ts`
  - `tests/unit/audit-ledger-*.test.ts`
  - implementation files directly responsible for a failing invariant

**Interfaces:**
- Produces: locked regression evidence for tenancy, immutability, stale-head handling, fail-closed verification, and secret exclusion.

- [ ] **Step 1: Add regression assertions**

Required invariants:
- another organization's workflow/task pair is rejected;
- same workflow with mismatched tenant is rejected;
- `UPDATE` and `DELETE` are blocked by trigger text contract;
- direct authenticated mutation grants are absent;
- same-head concurrent append contract is serialized by advisory lock;
- tampered metadata fails digest verification;
- generic `record_evidence` still rejects `verified: true`;
- no `SUPABASE_SERVICE_ROLE_KEY`, access token, API key, password, recovery code, or private-key value is persisted in ledger metadata construction.

- [ ] **Step 2: Run focused RED/GREEN loop for each discovered defect**

Run:
```bash
npx vitest run \
  tests/unit/audit-ledger-canonicalization.test.ts \
  tests/unit/audit-ledger-verification.test.ts \
  tests/unit/audit-ledger-service.test.ts \
  tests/integration/audit-ledger-schema-contract.test.ts \
  tests/integration/audit-ledger-execution-boundary.test.ts \
  tests/integration/execution-edge-contract.test.ts
```
Expected: PASS after any required minimal fixes.

- [ ] **Step 3: Commit only if code/tests changed**

```bash
git add packages/audit-ledger supabase tests
git commit -m "test: harden audit ledger security invariants"
```

---

### Task 8: Final repository verification and review handoff

**Files:**
- No implementation files unless a verification failure requires a minimal fix with its own RED/GREEN cycle.

**Interfaces:**
- Produces: evidence-backed merge-readiness status; does not merge or deploy.

- [ ] **Step 1: Run focused package and integration tests**

```bash
npx vitest run \
  tests/unit/audit-ledger-canonicalization.test.ts \
  tests/unit/audit-ledger-verification.test.ts \
  tests/unit/audit-ledger-service.test.ts \
  tests/integration/audit-ledger-schema-contract.test.ts \
  tests/integration/audit-ledger-execution-boundary.test.ts \
  tests/unit/execution-types.test.ts \
  tests/unit/execution-state-machine.test.ts \
  tests/unit/execution-progress.test.ts \
  tests/unit/execution-approval-evidence.test.ts \
  tests/unit/execution-engine.test.ts \
  tests/integration/execution-schema-contract.test.ts \
  tests/integration/execution-edge-contract.test.ts \
  tests/integration/execution-cross-module-workflow.test.ts
```
Expected: PASS.

- [ ] **Step 2: Run full repository gates**

```bash
npm ci
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
git diff --check feat/universal-execution-engine...HEAD
```
Expected: all commands PASS. If runner/network/dependency infrastructure prevents a command, record it as BLOCKED; never convert it to PASS.

- [ ] **Step 3: Run secret and grant scans**

```bash
git diff feat/universal-execution-engine...HEAD -- packages/audit-ledger supabase tests | \
  grep -E '^\+.*(BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,})' && exit 1 || true

git diff feat/universal-execution-engine...HEAD -- supabase/migrations/20260912_atlas_audit_ledger.sql | \
  grep -Ei '^\+.*grant (insert|update|delete|all).*audit_ledger_events.*authenticated' && exit 1 || true
```
Expected: no matches.

- [ ] **Step 4: Perform final branch review**

Review `feat/universal-execution-engine...HEAD` against the spec for:
- spec coverage;
- tenancy/RBAC boundaries;
- true digest recomputation;
- serialized append semantics;
- strict SQL immutability;
- fail-closed audit behavior;
- absence of shadow business truth;
- no unrelated files.

Any Critical/Important finding requires a test-first fix before completion.

- [ ] **Step 5: Record final status without merge/deploy**

Report exact HEAD SHA, focused test evidence, full-gate results, any blocked infrastructure condition, and outstanding review findings. Do not create a production deployment, apply the migration, merge branches, or trigger paid-provider work without explicit user approval.
