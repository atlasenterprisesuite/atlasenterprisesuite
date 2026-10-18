# ATLAS Payroll Control Plane Wave 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an evidence-driven payroll control plane that version-controls rule readiness, provider capabilities and external execution evidence without claiming tax filing or money movement.

**Architecture:** Extend the existing governed Payroll core with additive Supabase tables and one server-side readiness RPC. The web Payroll workspace consumes the RPC and renders actual rule/provider capability state; external execution remains fail-closed until verified provider/evidence records exist.

**Tech Stack:** PostgreSQL/Supabase migrations and RLS, React + TypeScript, Vitest, existing ATLAS Identity/RBAC/audit primitives.

**Spec:** `docs/superpowers/specs/2026-10-04-atlas-payroll-beyond-adp-design.md`

## Global Constraints

- Preserve the canonical existing Payroll module; do not create a parallel payroll application.
- Never represent filing, remittance, direct deposit, provider connection, tax coverage or settlement as complete without authenticated evidence.
- All organization-varying control-plane records are scoped by `org_id`.
- Payroll-sensitive writes stay server-side; authenticated clients receive only explicit read/RPC access required by the UI.
- Historical evidence is immutable; `settled` requires provider evidence.
- No production tax formulas are introduced in Wave 1.
- No new external dependency is required.

## Review Focus

- A provider row marked `verified` without verification timestamp/hash must be rejected by database constraints.
- A rule pack marked `active` without verified provenance/effective dates must be rejected.
- An execution intent must not transition to `settled` unless matching immutable evidence exists.
- An organization with no rule/provider configuration must receive explicit blockers, never zero-tax or fake-connected success.
- Cross-organization reads must remain protected by RLS and the readiness RPC must verify Payroll permission for the requested organization.

---

### Task 1: Control-plane schema and invariants

**Files:**
- Create: `tests/integration/payroll-control-plane.test.ts`
- Create: `supabase/migrations/20261004190000_atlas_payroll_control_plane.sql`

**Interfaces:**
- Consumes: existing `organizations`, `payroll_runs`, `audit_row_change()` and `has_identity_permission(org_id, permission)` primitives.
- Produces: tables `payroll_rule_packs`, `payroll_provider_connections`, `payroll_execution_intents`, `payroll_execution_evidence`; function `public.payroll_get_capability_readiness(p_org_id uuid) returns jsonb`.

- [ ] **Step 1: Write the failing integration/source-contract test**

Add `payroll-control-plane.test.ts` with assertions that the migration defines all four tables, enables RLS, attaches audit where mutable, constrains verified provider state, constrains active rule state, makes evidence immutable, guards `settled` behind evidence, and defines `payroll_get_capability_readiness` with `P0_BLOCKER`/blocked states.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npx vitest run tests/integration/payroll-control-plane.test.ts`
Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement the migration**

Create `20261004190000_atlas_payroll_control_plane.sql` with:

- `payroll_rule_packs(id, org_id nullable, scope, jurisdiction_country, jurisdiction_region, jurisdiction_local, rule_version, source_uri, source_published_at, effective_from, effective_to, verified_at, checksum, status, parameters, created_at)`; `active` requires `verified_at`, non-empty `checksum/source_uri`, and valid effective window.
- `payroll_provider_connections(id, org_id, provider_key, environment, status, capabilities text[], last_verified_at, verification_evidence_hash, credentials_ref, created_at, updated_at)`; `verified` requires verification timestamp/hash and capabilities must be within the Wave-1 allowlist.
- `payroll_execution_intents(id, org_id, run_id, provider_connection_id, execution_kind, idempotency_key, state, amount, currency, correlation_id, created_at, updated_at)` with unique `(org_id,idempotency_key)`.
- `payroll_execution_evidence(id, org_id, intent_id, normalized_state, provider_request_ref, provider_response_ref, payload_hash, observed_at, created_at)`.
- RLS read policies using `payroll.read`/`payroll.write`; revoke client insert/update/delete on all four tables.
- immutable evidence trigger that rejects `UPDATE`/`DELETE` on evidence.
- execution transition trigger that rejects `state='settled'` unless an evidence row for the same org/intent has `normalized_state='settled'` and non-empty `payload_hash`.
- audit triggers for mutable control-plane tables.
- `payroll_get_capability_readiness(p_org_id uuid)` requiring authentication and payroll read/write permission, resolving an open run pay date (or current date), active rule coverage, and only `verified` provider capabilities. Return JSON with `tax_determination`, `tax_filing`, `tax_remittance`, and `direct_deposit` each containing `status`, `severity`, and `reason` plus evidence identifiers when ready.

- [ ] **Step 4: Run the focused test**

Run: `npx vitest run tests/integration/payroll-control-plane.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat(payroll): add evidence-driven control plane`

### Task 2: Payroll API consumes server readiness

**Files:**
- Modify: `apps/web/src/modules/payroll/payrollApi.ts`
- Modify: `tests/integration/payroll-control-plane.test.ts`

**Interfaces:**
- Consumes: `public.payroll_get_capability_readiness(p_org_id uuid)`.
- Produces: `PayrollCapabilityState`, `PayrollCapabilityReadiness`, and `PayrollWorkspace.readiness`.

- [ ] **Step 1: Extend the failing test**

Assert that `payrollApi.ts` contains `PayrollCapabilityReadiness`, calls `'payroll_get_capability_readiness'`, and exposes `readiness` on `PayrollWorkspace`.

- [ ] **Step 2: Run focused test and verify failure**

Run: `npx vitest run tests/integration/payroll-control-plane.test.ts`
Expected: FAIL on missing API contract.

- [ ] **Step 3: Implement the API contract**

Add types:

`PayrollCapabilityState = { status: 'ready' | 'blocked'; severity: 'P0_BLOCKER' | 'INFO'; reason: string; evidence_id?: string | null; provider_key?: string | null; rule_pack_id?: string | null }`

`PayrollCapabilityReadiness = { as_of: string; pay_date: string; capabilities: { tax_determination: PayrollCapabilityState; tax_filing: PayrollCapabilityState; tax_remittance: PayrollCapabilityState; direct_deposit: PayrollCapabilityState } }`

Add `readiness` to `PayrollWorkspace` and POST to `/rest/v1/rpc/payroll_get_capability_readiness` with the active `p_org_id` during workspace load. A failed readiness request fails the workspace; do not substitute a success/default object.

- [ ] **Step 4: Run focused test**

Run: `npx vitest run tests/integration/payroll-control-plane.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat(payroll): load capability readiness`

### Task 3: Evidence-driven Payroll overview

**Files:**
- Modify: `apps/web/src/modules/payroll/PayrollRoutes.tsx`
- Modify: `tests/integration/payroll-route.test.tsx`
- Modify: `tests/integration/payroll-governed-core.test.ts`
- Modify: `tests/integration/payroll-control-plane.test.ts`

**Interfaces:**
- Consumes: `PayrollWorkspace.readiness.capabilities`.
- Produces: four readiness cards whose status/reason come from the backend contract.

- [ ] **Step 1: Update route tests first**

Make the test fetch stub return a structured blocked readiness payload for the readiness RPC. Assert the Overview renders `Tax determination`, `Tax filing`, `Tax remittance`, and `Direct deposit`, each showing backend-provided blocked reason text. Assert no text claims paid/filed/connected.

Update the governed-core source test so it requires the readiness RPC/evidence-driven copy instead of the previous hard-coded `Not configured` sentences.

- [ ] **Step 2: Run route/core tests and verify failure**

Run: `npx vitest run tests/integration/payroll-route.test.tsx tests/integration/payroll-governed-core.test.ts tests/integration/payroll-control-plane.test.ts`
Expected: FAIL because the UI still renders hard-coded gating cards.

- [ ] **Step 3: Implement readiness cards**

Replace the two hard-coded external-gate cards with a small renderer over the four readiness capabilities. Display `Ready` only when `status==='ready'`; otherwise display `Blocked`. Always show the backend reason. Preserve the existing `Execution: Gated / No money movement` metric until real execution evidence exists.

- [ ] **Step 4: Run focused integration tests**

Run: `npx vitest run tests/integration/payroll-route.test.tsx tests/integration/payroll-governed-core.test.ts tests/integration/payroll-control-plane.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat(payroll): render evidence-driven readiness`

### Task 4: Regression and delivery gates

**Files:**
- No new product files unless tests identify a real regression.

**Interfaces:**
- Consumes: completed Wave-1 branch.
- Produces: CI evidence suitable for PR/merge decision.

- [ ] **Step 1: Run Payroll-focused suite**

Run: `npx vitest run tests/integration/payroll-route.test.tsx tests/integration/payroll-governed-core.test.ts tests/integration/payroll-control-plane.test.ts tests/integration/people-final-core.test.ts`
Expected: PASS.

- [ ] **Step 2: Run repository type/build/test gates available in package scripts**

Run the canonical repository verification scripts discovered from `package.json`/CI rather than inventing new commands.
Expected: all required gates PASS.

- [ ] **Step 3: Open PR**

PR title: `feat(payroll): add sovereign payroll control plane`

PR body must state explicitly: Wave 1 adds readiness/evidence infrastructure only; it does not enable automatic tax calculation, filing, remittance, or direct deposit.

- [ ] **Step 4: Verify CI**

Required checks must be green before merge. Repair real failures on the feature branch and rerun.

- [ ] **Step 5: Merge and production verification**

Merge only after green required checks. Use the canonical deployment workflow, then verify `https://www.atlasenterprisesuite.com/` and the production health endpoint plus the authenticated Payroll route where available. P0 production failures are fail-closed.
