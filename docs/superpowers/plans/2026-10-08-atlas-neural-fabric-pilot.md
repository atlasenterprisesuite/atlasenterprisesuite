# ATLAS Neural Fabric Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a verified, tenant-safe, reusable module-contract foundation and a low-risk pilot without altering production.

**Architecture:** Reuse the canonical module registry, orchestrator persistence and ATLAS Manager evidence controls. Begin with a read-only inventory, then add a pure contract validator and pilot conformance tests; external delivery and rollout remain gated.

**Tech Stack:** TypeScript, Vitest, Node.js, Supabase/PostgreSQL, Cloudflare Workers.

**Spec:** `docs/superpowers/specs/2026-10-08-atlas-neural-fabric-design.md`

## Global Constraints

- No new independent identity, evidence, approval or bus subsystem without audited gap.
- Preserve `main`; use feature branch, PR and CI.
- P0 failures block promotion; production state is independent of source/build state.
- Never trust client-supplied tenant identity; no secrets in logs, commits or event payloads.
- `atlas-core-v2` is not production authority without audited cutover.
- No production migrations, provider actions or irreversible operations in the pilot.

## Review Focus

1. Tenant spoofing must fail validation (Task 2).
2. Duplicate event IDs must not repeat side effects (Task 3).
3. Unknown contract versions must fail closed (Task 2).
4. Missing evidence or failing P0 must not produce VERIFIED (Task 4).
5. Non-durable/unreachable persistence must fail readiness (Task 4).

---

### Task 1: Inventory and traceability baseline

**Files:**
- Read: `apps/web/src/modules/registry.ts`, `scripts/verify-neural-integrity.mjs`, `apps/atlas-orchestrator/src/runtime/readiness.ts`, `docs/architecture/ATLAS_MANAGER_SPEC.md`
- Create: `docs/architecture/atlas-neural-inventory.md`
- Test: `tests/unit/neural-inventory.test.ts`

**Interfaces:**
- Consumes: `ATLAS_MODULES` and existing static readiness terminology.
- Produces: documented matrix of module IDs, routes, auth requirements, current integration owners and unknowns.

- [ ] **Step 1:** Write `neural-inventory.test.ts` asserting every `ATLAS_MODULES` ID appears exactly once in inventory and that inventory labels are not production verdicts.
- [ ] **Step 2:** Run `npx vitest run tests/unit/neural-inventory.test.ts`; expect FAIL before inventory exists.
- [ ] **Step 3:** Generate/review the inventory from the canonical registry; distinguish observed source from unverified provider state.
- [ ] **Step 4:** Rerun the focused test; expect PASS and commit.

### Task 2: Versioned envelope validation (pure function)

**Files:**
- Create: `packages/neural-fabric/src/contracts.ts`
- Create: `packages/neural-fabric/src/index.ts`
- Test: `tests/unit/neural-contracts.test.ts`

**Interfaces:**
- Produces: `type NeuralEventEnvelope = { event_id: string; schema_version: 1; module_id: string; tenant_id: string; actor_id: string; correlation_id: string; causation_id: string | null; occurred_at: string; sensitivity: 'internal' | 'restricted'; retention_class: string; payload_hash: string; evidence_ref: string | null }`.
- Produces: `validateNeuralEnvelope(input: unknown, trustedTenantId: string): { ok: true; value: NeuralEventEnvelope } | { ok: false; reason: string }`.

- [ ] **Step 1:** Write tests for valid envelope, tenant mismatch, unknown version, missing actor, invalid timestamp, malformed hash and unknown sensitivity.
- [ ] **Step 2:** Run `npx vitest run tests/unit/neural-contracts.test.ts`; expect FAIL.
- [ ] **Step 3:** Implement minimal pure validation, no network calls, no event dispatch, no persistence.
- [ ] **Step 4:** Run focused test; expect PASS and commit.

### Task 3: Read-only idempotency pilot

**Files:**
- Create: `packages/neural-fabric/src/pilot.ts`
- Test: `tests/unit/neural-pilot.test.ts`

**Interfaces:**
- Consumes: `validateNeuralEnvelope` from Task 2.
- Produces: `evaluateReadOnlyPilot(input: unknown, trustedTenantId: string, seenEventIds: ReadonlySet<string>): { accepted: boolean; reason: string; eventId?: string }`.

- [ ] **Step 1:** Write tests for accepted valid event, duplicate ID, cross-tenant event and unsupported version. Assert no external I/O.
- [ ] **Step 2:** Run `npx vitest run tests/unit/neural-pilot.test.ts`; expect FAIL.
- [ ] **Step 3:** Implement only the pure evaluation logic. Document that a Set is not a durable deduplication guarantee and cannot be used for real financial/external side effects.
- [ ] **Step 4:** Run focused test; expect PASS and commit.

### Task 4: Evidence-based readiness projection

**Files:**
- Create: `packages/neural-fabric/src/readiness.ts`
- Test: `tests/unit/neural-readiness.test.ts`
- Reference: `apps/atlas-orchestrator/src/runtime/readiness.ts`

**Interfaces:**
- Produces: `type NeuralGateEvidence = { sourceSha: string | null; ciPassed: boolean; tenantIsolationPassed: boolean; integrationPassed: boolean; deployedSha: string | null; runtimePassed: boolean; evidenceRef: string | null; persistenceDurable: boolean; p0Failures: number }`.
- Produces: `projectNeuralReadiness(evidence: NeuralGateEvidence): 'BLOCKED' | 'TESTED' | 'VERIFIED'`.

- [ ] **Step 1:** Write tests for full evidence → VERIFIED; missing evidence, mismatched SHA, P0 failure, non-durable persistence or runtime failure → never VERIFIED.
- [ ] **Step 2:** Run `npx vitest run tests/unit/neural-readiness.test.ts`; expect FAIL.
- [ ] **Step 3:** Implement conservative pure readiness projection; BLOCKED for P0/non-durable, TESTED for partial evidence. Do not replace existing global release gates.
- [ ] **Step 4:** Run focused test; expect PASS and commit.

### Task 5: Integration gate and handoff

**Files:**
- Modify only after inspecting: `scripts/verify-neural-integrity.mjs` (if compatible)
- Create: `docs/architecture/atlas-neural-pilot-evidence.md`
- Test: existing `tests/unit`, `tests/integration`

**Interfaces:**
- Consumes: outputs of Tasks 1–4.
- Produces: evidence manifest listing exact commit SHA, commands, results, remaining gaps and reviewer gate.

- [ ] **Step 1:** Write regression test that missing pilot evidence cannot satisfy any new gate.
- [ ] **Step 2:** Run regression test; expect FAIL before minimal gate wiring.
- [ ] **Step 3:** Add smallest compatible gate integration, avoiding source-string-only readiness assertions.
- [ ] **Step 4:** Run `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run verify:neural`, `npm run build`; record exact outputs. If unavailable, mark blocked, not passed.
- [ ] **Step 5:** Commit, open PR, request review; no merge/deploy until gates and authorization.

## Later independently reviewed plans (not included in this pilot)

Supabase migration lineage and RLS recovery; durable event transport and replay; module-by-module adoption; Cloudflare exact-SHA production verification; restricted-sector approvals. Each requires its own scoped plan, tests, and release gates.
