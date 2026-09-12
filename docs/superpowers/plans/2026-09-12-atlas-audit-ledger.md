# ATLAS Audit Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cryptographically chained, append-only, tenant-aware ATLAS Audit Ledger that seals Universal Execution Engine audit events without weakening RBAC, tenancy, or domain authorization.

**Architecture:** `packages/audit-ledger` owns runtime-neutral event types, deterministic canonicalization, SHA-256 hashing, verification, and a storage-neutral service. Supabase owns the immutable relational ledger and serialized append RPC. The existing `atlas-execution` server-side audit boundary emits the operational audit row and cryptographic ledger seal from already-authorized persisted context; any ledger failure fails closed.

**Tech Stack:** TypeScript 5.7+, Web Crypto, Vitest 3.2.6, Supabase/PostgreSQL, Deno Edge Functions, npm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-audit-ledger-design.md`

## Global Constraints

- Use global Web Crypto only; never import `node:crypto` in `packages/audit-ledger`.
- `metadata` is non-secret bounded JSON with a maximum serialized UTF-8 size of 16 KiB.
- Tenant and organization scope come from persisted execution records, never arbitrary client fields.
- `execution.admin` never substitutes for Payroll, Accounting, Health, or another domain permission.
- `audit_ledger_events` is strictly immutable: every `UPDATE` and `DELETE` must fail, including service-role attempts.
- Authenticated users receive organization-scoped read access only; no direct authenticated insert/update/delete grants.
- Appends serialize per `(org_id, workflow_id)` and reject stale heads.
- Digest version 1 hashes every persisted hash-participating field, recursively sorts object keys, and preserves array order.
- Empty-chain verification defaults to invalid unless the caller explicitly sets `allowEmpty: true`.
- Every current `atlas-execution` sensitive audit event must have non-null `workflowId` and `taskId`; `appendAudit` throws `audit_ledger_lineage_required` before writing either audit record if lineage is missing.
- Do not merge, deploy, apply migrations to production, or spend provider credits without explicit user approval.

## File Map

- `packages/audit-ledger/package.json` — workspace package metadata.
- `packages/audit-ledger/src/types.ts` — event/result/store contracts.
- `packages/audit-ledger/src/canonicalize.ts` — recursive canonicalization and 16 KiB metadata guard.
- `packages/audit-ledger/src/digest.ts` — Web Crypto SHA-256 hashing.
- `packages/audit-ledger/src/verify.ts` — chain verification and diagnostics.
- `packages/audit-ledger/src/service.ts` — storage-neutral record/retry service.
- `packages/audit-ledger/src/index.ts` — public exports.
- `supabase/migrations/20260912_atlas_audit_ledger.sql` — table, constraints, RLS, immutable trigger, append RPC.
- `supabase/functions/_shared/audit-ledger-store.ts` — Supabase store adapter.
- `supabase/functions/atlas-execution/index.ts` — integration at the existing audit boundary.
- `tests/unit/audit-ledger-canonicalization.test.ts` — canonicalization/hash tests.
- `tests/unit/audit-ledger-verification.test.ts` — tamper/link tests.
- `tests/unit/audit-ledger-service.test.ts` — retry/service tests.
- `tests/integration/audit-ledger-schema-contract.test.ts` — SQL security/append contract.
- `tests/integration/audit-ledger-execution-boundary.test.ts` — Edge integration/security contract.

---

### Task 1: Package scaffold, types, canonicalization, and SHA-256 digest

**Files:**
- Create: `packages/audit-ledger/package.json`
- Create: `packages/audit-ledger/src/types.ts`
- Create: `packages/audit-ledger/src/canonicalize.ts`
- Create: `packages/audit-ledger/src/digest.ts`
- Create: `packages/audit-ledger/src/index.ts`
- Test: `tests/unit/audit-ledger-canonicalization.test.ts`

**Interfaces:**
- Produces: `AuditEventPayload`, `AuditLedgerEvent`, `AuditLedgerHead`, `AuditLedgerStore`, `AuditChainVerification`, `canonicalizeJson(value)`, `assertBoundedMetadata(metadata)`, `buildAuditLedgerDigest(event)`.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { canonicalizeJson, buildAuditLedgerDigest } from '../../packages/audit-ledger/src/index';

it('sorts object keys recursively and preserves array order', () => {
  expect(canonicalizeJson({ b: 2, a: { d: 4, c: 3 }, list: [2, 1] }))
    .toBe('{"a":{"c":3,"d":4},"b":2,"list":[2,1]}');
});

it('produces a stable lowercase SHA-256 digest', async () => {
  const event = fixtureEvent();
  const first = await buildAuditLedgerDigest(event);
  expect(first).toBe(await buildAuditLedgerDigest({ ...event }));
  expect(first).toMatch(/^[a-f0-9]{64}$/);
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/audit-ledger-canonicalization.test.ts
```
Expected: FAIL because the package does not exist.

- [ ] **Step 3: Add package metadata and canonical types**

`package.json`:
```json
{"name":"@atlas/audit-ledger","private":true,"version":"0.1.0","type":"module"}
```

`AuditLedgerEvent` must contain `eventId`, `organizationId`, `tenantId`, `workflowId`, `taskId`, `actorId`, `actionType`, `metadata`, `previousStateHash`, `nonce`, `digestVersion: 1`, `createdAt`, and `payloadDigest`.

`AuditActionType` must include:
```ts
'TASK_STARTED' | 'GATE_EVALUATED' | 'EVIDENCE_RECORDED' |
'TASK_FAILED' | 'TASK_COMPLETED' | 'WORKFLOW_BLOCKED' | `execution.${string}`
```

- [ ] **Step 4: Implement minimal canonicalization and hashing**

`assertBoundedMetadata` measures `new TextEncoder().encode(canonicalizeJson(metadata)).byteLength` and throws `audit_ledger_metadata_too_large` above `16 * 1024` bytes.

`buildAuditLedgerDigest` canonicalizes the complete persisted envelope excluding only `payloadDigest`, then runs:
```ts
const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized));
```

- [ ] **Step 5: Verify GREEN and runtime neutrality**

```bash
npx vitest run tests/unit/audit-ledger-canonicalization.test.ts
! grep -R "node:crypto" packages/audit-ledger
```
Expected: PASS.

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

- [ ] **Step 1: Write failing verification tests**

```ts
it('detects tampered metadata even when links are unchanged', async () => {
  const chain = await makeValidChain(3);
  chain[1] = { ...chain[1], metadata: { changed: true } };
  const result = await verifyAuditChain(chain);
  expect(result.valid).toBe(false);
  expect(result.firstInvalidEventId).toBe(chain[1].eventId);
  expect(result.reason).toBe('audit_ledger_invalid_digest');
});

it('rejects an empty chain unless allowEmpty is true', async () => {
  expect((await verifyAuditChain([])).valid).toBe(false);
  expect((await verifyAuditChain([], { allowEmpty: true })).valid).toBe(true);
});
```

Also test broken `previousStateHash` and first-invalid-event reporting.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/audit-ledger-verification.test.ts
```
Expected: FAIL because verifier is absent.

- [ ] **Step 3: Implement verifier**

Sort by `createdAt`, then `eventId`. Require `GENESIS_BLOCK` on the first row, previous digest thereafter, recompute each digest from persisted fields, and stop at the first invalid event.

Return:
```ts
{ valid: boolean; eventCount: number; firstInvalidEventId?: string; reason?: string }
```

- [ ] **Step 4: Verify GREEN and commit**

```bash
npx vitest run tests/unit/audit-ledger-verification.test.ts
git add packages/audit-ledger/src tests/unit/audit-ledger-verification.test.ts
git commit -m "feat: verify audit ledger chain integrity"
```

---

### Task 3: Immutable Supabase schema and organization-scoped read policy

**Files:**
- Create: `supabase/migrations/20260912_atlas_audit_ledger.sql`
- Test: `tests/integration/audit-ledger-schema-contract.test.ts`

**Interfaces:**
- Produces: `public.audit_ledger_events`, strict update/delete trigger, RLS read policy.

- [ ] **Step 1: Write failing schema test**

```ts
expect(sql).toContain('create table if not exists public.audit_ledger_events');
expect(sql).toContain('tenant_id text not null');
expect(sql).toContain('before update or delete on public.audit_ledger_events');
expect(sql).toContain('enable row level security');
expect(sql).toContain('grant select on public.audit_ledger_events to authenticated');
expect(sql).not.toMatch(/grant\s+(insert|update|delete|all).*audit_ledger_events.*authenticated/i);
expect(sql).toContain('octet_length(metadata::text) <= 16384');
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/integration/audit-ledger-schema-contract.test.ts
```
Expected: FAIL because migration is absent.

- [ ] **Step 3: Implement table, indexes, trigger, and RLS**

Core columns:
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

Create indexes on `(org_id, workflow_id, created_at, event_id)` and `(org_id, created_at)`. Create `enforce_audit_ledger_immutability()` that raises on every `UPDATE` or `DELETE`. Enable RLS; active `organization_members` may select only. Revoke all from `authenticated`, then grant select only.

- [ ] **Step 4: Verify GREEN and commit**

```bash
npx vitest run tests/integration/audit-ledger-schema-contract.test.ts
git add supabase/migrations/20260912_atlas_audit_ledger.sql tests/integration/audit-ledger-schema-contract.test.ts
git commit -m "feat: add immutable audit ledger schema"
```

---

### Task 4: Serialized append RPC and fork prevention

**Files:**
- Modify: `supabase/migrations/20260912_atlas_audit_ledger.sql`
- Modify: `tests/integration/audit-ledger-schema-contract.test.ts`

**Interfaces:**
- Produces: `public.append_audit_ledger_event(...)`.

- [ ] **Step 1: Extend failing SQL contract tests**

```ts
expect(sql).toContain('create or replace function public.append_audit_ledger_event');
expect(sql).toContain('pg_advisory_xact_lock');
expect(sql).toContain('audit_ledger_stale_head');
expect(sql).toContain('audit_ledger_invalid_scope');
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/integration/audit-ledger-schema-contract.test.ts
```
Expected: FAIL because RPC is absent.

- [ ] **Step 3: Implement the RPC**

In one transaction the function must:
1. acquire `pg_advisory_xact_lock(hashtextextended(p_org_id::text || ':' || p_workflow_id::text, 0));`
2. verify workflow matches `org_id` and `tenant_id`;
3. verify task belongs to that workflow and same scope;
4. read head ordered `created_at desc, event_id desc`;
5. require expected previous hash to equal head digest or `GENESIS_BLOCK`;
6. require `p_created_at > head.created_at` when a head exists;
7. insert exactly one row and return it.

Raise `audit_ledger_invalid_scope` for lineage mismatch and `audit_ledger_stale_head` for head/timestamp conflict. Revoke execute from `public` and `authenticated`; service-role invocation remains server-side.

- [ ] **Step 4: Verify GREEN and commit**

```bash
npx vitest run tests/integration/audit-ledger-schema-contract.test.ts
git add supabase/migrations/20260912_atlas_audit_ledger.sql tests/integration/audit-ledger-schema-contract.test.ts
git commit -m "feat: serialize audit ledger appends"
```

---

### Task 5: Storage-neutral recording service with bounded stale-head retry

**Files:**
- Create: `packages/audit-ledger/src/service.ts`
- Modify: `packages/audit-ledger/src/types.ts`
- Modify: `packages/audit-ledger/src/index.ts`
- Test: `tests/unit/audit-ledger-service.test.ts`

**Interfaces:**
- Produces: `AuditLedgerServiceImpl`, `AuditLedgerStore.readHead(scope)`, `AuditLedgerStore.append(event)`, `recordEvent(event)`.

- [ ] **Step 1: Write failing service tests**

Test genesis, metadata rejection, stale-head retry, and regeneration of `previousStateHash`, timestamp, nonce, and digest.

```ts
expect(store.appendAttempts).toBe(2);
expect(result.digest).toMatch(/^[a-f0-9]{64}$/);
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/audit-ledger-service.test.ts
```
Expected: FAIL because service is absent.

- [ ] **Step 3: Implement service**

`recordEvent` must validate metadata, read head, choose `createdAt` strictly later than the head (`Math.max(Date.now(), Date.parse(head.createdAt) + 1)`), generate `eventId` and `nonce` with `crypto.randomUUID()`, compute digest, append, and retry only `audit_ledger_stale_head` up to 3 total attempts.

- [ ] **Step 4: Verify GREEN and commit**

```bash
npx vitest run tests/unit/audit-ledger-service.test.ts
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
- Consumes: `AuditLedgerStore`, `AuditLedgerServiceImpl`, existing `appendAudit` context.
- Produces: `SupabaseAuditLedgerStore` and dual operational/cryptographic audit emission.

- [ ] **Step 1: Write failing Edge boundary test**

```ts
expect(edge).toContain('AuditLedgerServiceImpl');
expect(edge).toContain('append_audit_ledger_event');
expect(edge).toContain('audit_ledger_lineage_required');
expect(edge).toContain('audit_ledger_persistence_failed');
expect(edge).not.toContain('body.tenant_id');
expect(edge).not.toContain('body.verified === true');
```

The test must also prove ledger metadata is constructed only from authorized persisted context plus bounded correlation/evidence references.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/integration/audit-ledger-execution-boundary.test.ts
```
Expected: FAIL because integration is absent.

- [ ] **Step 3: Implement `SupabaseAuditLedgerStore`**

`readHead` queries `audit_ledger_events` scoped by `org_id/workflow_id`, ordered `created_at desc,event_id desc`. `append` invokes `append_audit_ledger_event` with the complete envelope and maps stale-head/scope database errors to package error codes.

- [ ] **Step 4: Integrate `appendAudit` fail-closed**

At the start of `appendAudit`, require non-null `taskId` and `workflowId`; otherwise throw `audit_ledger_lineage_required` before inserting `execution_audit_events`.

Then insert the existing operational audit row. After it succeeds, construct ledger metadata exactly from:
```ts
{
  module: input.module,
  previousState: input.previousState,
  resultingState: input.resultingState,
  evidenceIds: input.evidenceIds || [],
  correlationId: input.correlationId
}
```

Call `AuditLedgerServiceImpl.recordEvent` with `orgId`, persisted `tenantId`, persisted workflow/task IDs, authenticated actor, and the operational action. Any ledger error becomes generic `audit_ledger_persistence_failed`; never expose service-role/Supabase internals.

- [ ] **Step 5: Verify GREEN and Edge type safety**

```bash
npx vitest run tests/integration/audit-ledger-execution-boundary.test.ts tests/integration/execution-edge-contract.test.ts
```
Run the repository's Edge/Deno typecheck if present. If unavailable, run the same local TypeScript+Deno/Supabase stub harness previously used for `atlas-execution` and record that limitation explicitly.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/audit-ledger-store.ts supabase/functions/atlas-execution/index.ts tests/integration/audit-ledger-execution-boundary.test.ts
git commit -m "feat: seal execution audits in cryptographic ledger"
```

---

### Task 7: Security regression suite

**Files:**
- Modify tests and only the implementation file responsible for any failing invariant.

**Interfaces:**
- Produces: regression coverage for scope isolation, immutability, concurrency, fail-closed evidence, and secret exclusion.

- [ ] **Step 1: Add explicit regression assertions**

Required cases:
- workflow/task from another organization is rejected;
- same workflow with mismatched tenant is rejected;
- SQL trigger blocks both update and delete;
- authenticated mutation grants are absent;
- advisory lock/stale-head contract is present;
- metadata tampering fails recomputed digest;
- generic `record_evidence` still rejects client `verified: true`;
- ledger metadata construction contains no secret/provider credential source.

- [ ] **Step 2: Run focused suite**

```bash
npx vitest run \
  tests/unit/audit-ledger-canonicalization.test.ts \
  tests/unit/audit-ledger-verification.test.ts \
  tests/unit/audit-ledger-service.test.ts \
  tests/integration/audit-ledger-schema-contract.test.ts \
  tests/integration/audit-ledger-execution-boundary.test.ts \
  tests/integration/execution-edge-contract.test.ts
```
Expected: PASS after minimal test-first fixes.

- [ ] **Step 3: Commit if changes were required**

```bash
git add packages/audit-ledger supabase tests
git commit -m "test: harden audit ledger security invariants"
```

---

### Task 8: Final verification and review handoff

**Files:**
- No implementation changes unless a failing verification receives its own RED/GREEN fix.

**Interfaces:**
- Produces: evidence-backed merge-readiness status without merge or deploy.

- [ ] **Step 1: Run focused Audit Ledger + Universal Execution tests**

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

- [ ] **Step 2: Run complete repository gates**

```bash
npm ci
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
git diff --check feat/universal-execution-engine...HEAD
```
Expected: PASS. If runner/network/dependency infrastructure prevents a command, report BLOCKED rather than PASS.

- [ ] **Step 3: Run secret/grant scans**

```bash
git diff feat/universal-execution-engine...HEAD -- packages/audit-ledger supabase tests | \
  grep -E '^\+.*(BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,})' && exit 1 || true

git diff feat/universal-execution-engine...HEAD -- supabase/migrations/20260912_atlas_audit_ledger.sql | \
  grep -Ei '^\+.*grant (insert|update|delete|all).*audit_ledger_events.*authenticated' && exit 1 || true
```
Expected: no matches.

- [ ] **Step 4: Perform final branch review**

Review `feat/universal-execution-engine...HEAD` for complete spec coverage, tenancy/RBAC, digest recomputation, serialized append semantics, SQL immutability, fail-closed audit behavior, absence of shadow business truth, and unrelated files. Any Critical/Important finding requires a test-first fix.

- [ ] **Step 5: Record exact final status**

Report HEAD SHA, focused test evidence, full-gate evidence, blocked infrastructure conditions, and review findings. Do not merge, deploy, apply the migration, create production traffic changes, or trigger paid-provider work without explicit user approval.
