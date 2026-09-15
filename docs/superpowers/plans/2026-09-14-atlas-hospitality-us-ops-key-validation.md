# ATLAS Hospitality U.S. Operations + Key Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend current `main` Hospitality into a U.S.-chain-capable operating core while preserving Room Access and advancing the authorized hotel-key path to controlled physical validation.

**Architecture:** Hospitality owns hotel business entities and property-scoped records; Universal Execution owns tasks/steps/approvals/evidence; external hotel systems remain behind server-side adapters. Existing Room Access stays canonical and fail-closed. Historical `feat/hospitality-os-core` and `feat/hospitality-wallet-hotel-key` branches are source material only and must never be merged wholesale because they are stale relative to current `main`.

**Tech Stack:** TypeScript, React, Vitest, Supabase/Postgres/RLS, Supabase Edge Functions, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-14-atlas-hospitality-us-ops-key-validation-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`.
- Canonical base branch: `main`.
- Feature branch: `feat/hospitality-us-ops-key-validation`.
- Reuse current Hospitality, `atlasSession`, Supabase Auth, organization membership, RLS, Universal Execution, Approval Center, and Audit patterns.
- Do not create brand-specific application forks.
- Do not invent hotel operational metrics or provider readiness.
- Do not expose provider secrets or raw credential material.
- Do not implement direct remote unlock.
- A physical key test must use an explicitly authorized property/test lock and the provider's official mechanism.
- No production migration/deploy/merge is implied by implementation completion.

---

### Task 1: Establish Exact-SHA Hospitality Baseline

**Files:**
- Modify: `.github/workflows/hospitality-self-hosted-ci.yml`
- Create: `.github/workflows/hospitality-key-validation-ci.yml`
- Create: `docs/hospitality/KEY_VALIDATION_STATUS.md`
- Modify: `docs/hospitality/IMPLEMENTATION_STATUS.md`
- Modify: `docs/hospitality/ROOM_ACCESS_READINESS.md`

**Interfaces:**
- Consumes: current `main` Room Access implementation and repository package scripts.
- Produces: exact-SHA verification evidence and truthful readiness classification.

- [x] **Step 1: Run a current hosted verification gate**

Required workflow steps:

```yaml
- run: npm ci
- run: npm run typecheck
- run: npx vitest run tests/unit/hospitality-room-access.test.ts tests/unit/hospitality-provider-registry.test.ts tests/unit/hospitality-provider-adapters.test.ts
- run: npx vitest run tests/integration/hospitality-schema-contract.test.ts tests/integration/hospitality-edge-contract.test.ts tests/integration/hospitality-routes.test.tsx tests/integration/hospitality-security-contract.test.ts
- run: npm run test:unit
- run: npm run test:integration
- run: npm run build
```

Expected: all steps PASS on the exact branch SHA.

- [ ] **Step 2: Record the verified SHA and external blocker**

`KEY_VALIDATION_STATUS.md` must distinguish:

```text
implementation_verified
external_gates_pending
provider_validation_ready
physical_key_test_passed
production_ready_for_property
```

- [ ] **Step 3: Correct stale Room Access status documentation**

Record that PR #75 is merged to `main`; do not retain the old claim that it is unmerged. Preserve the fact that no production provider instance becomes ready without property-specific validation.

- [ ] **Step 4: Commit the status reconciliation**

Commit message:

```text
docs: reconcile Hospitality key validation status
```

---

### Task 2: Reconcile Canonical Hospitality Core Contracts

**Files:**
- Modify: `packages/hospitality/types.ts`
- Create: `packages/hospitality/scope.ts`
- Create: `tests/unit/hospitality-core-types.test.ts`
- Create: `tests/unit/hospitality-scope.test.ts`

**Interfaces:**
- Consumes: current Room Access types.
- Produces: `HospitalityBrand`, `HospitalityProperty`, `HospitalityOutlet`, `HospitalitySpace`, `HospitalityOperationalUnit`, property scope helpers.

- [ ] **Step 1: Add failing type/scope tests first**

Tests must prove:

```ts
expect(HOSPITALITY_PROPERTY_TYPES).toContain('hotel');
expect(canAccessHospitalityScope(
  { organizationId: 'org-a', propertyIds: ['p-1'] },
  { organizationId: 'org-a', propertyId: 'p-1' }
)).toBe(true);
expect(canAccessHospitalityScope(
  { organizationId: 'org-a', propertyIds: ['p-1'] },
  { organizationId: 'org-a', propertyId: 'p-2' }
)).toBe(false);
```

- [ ] **Step 2: Run focused tests and confirm RED**

```bash
npx vitest run tests/unit/hospitality-core-types.test.ts tests/unit/hospitality-scope.test.ts
```

- [ ] **Step 3: Implement additive contracts**

Preserve all current `hospitality.access.*` types. Add property/outlet/space/unit types and scope helpers without removing provider/access contracts.

- [ ] **Step 4: Re-run focused tests and typecheck**

```bash
npx vitest run tests/unit/hospitality-core-types.test.ts tests/unit/hospitality-scope.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```text
feat: reconcile Hospitality property scope contracts
```

---

### Task 3: Add Canonical Property Schema and Property-Scoped RLS

**Files:**
- Create: `supabase/migrations/20260914_hospitality_us_property_core.sql`
- Create: `tests/integration/hospitality-property-schema-contract.test.ts`
- Create: `tests/integration/hospitality-property-rls-contract.test.ts`

**Interfaces:**
- Consumes: `organizations`, `organization_members`, existing `hospitality_provider_instances`, `hospitality_room_mappings`, `hospitality_credential_references`.
- Produces: portfolios, properties, business entities/relationships, departments, property memberships, department memberships, canonical rooms.

- [ ] **Step 1: Write schema contract tests**

Assert creation of:

```text
hospitality_portfolios
hospitality_properties
hospitality_business_entities
hospitality_property_relationships
hospitality_departments
hospitality_property_memberships
hospitality_department_memberships
hospitality_rooms
```

Assert unique `(org_id, property_key)` and no destructive alteration of current Room Access `property_id text` columns.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/integration/hospitality-property-schema-contract.test.ts tests/integration/hospitality-property-rls-contract.test.ts
```

- [ ] **Step 3: Implement additive migration**

Backfill canonical properties from distinct current `(org_id, property_id)` using existing `property_id` as `property_key`; leave `display_name` null when unknown.

- [ ] **Step 4: Add staged property RLS**

RLS tests must prove ordinary members cannot read an unauthorized property while authorized corporate/admin scope remains explicit.

- [ ] **Step 5: Run focused integration tests**

- [ ] **Step 6: Commit**

```text
feat: add Hospitality property security model
```

---

### Task 4: Implement Staff Connect / Guest Request Domain

**Files:**
- Create: `packages/hospitality/requests.ts`
- Create: `packages/hospitality/sla.ts`
- Create: `supabase/migrations/20260914_hospitality_requests.sql`
- Create: `tests/unit/hospitality-requests.test.ts`
- Create: `tests/unit/hospitality-sla.test.ts`
- Create: `tests/integration/hospitality-requests-schema-contract.test.ts`

**Interfaces:**
- Produces request state transitions, dispatch policy, SLA calculation, escalation policy, and `execution_workflow_id` linkage.

- [ ] **Step 1: Write failing state-machine tests**

Allowed happy path:

```text
new -> queued -> assigned -> accepted -> in_progress -> completed -> verified
```

Reject illegal transitions such as `new -> verified`.

- [ ] **Step 2: Write SLA tests**

No hotel SLA minutes are hard-coded. Unconfigured policy returns an explicit `unconfigured` decision.

- [ ] **Step 3: Implement minimal pure domain functions**

Expose deterministic functions:

```ts
transitionHospitalityRequest(current, next): HospitalityRequestState
resolveHospitalitySla(input): HospitalitySlaDecision
selectDispatchCandidate(input): HospitalityDispatchDecision
```

- [ ] **Step 4: Add additive schema/RLS contract**

- [ ] **Step 5: Run focused tests/typecheck**

- [ ] **Step 6: Commit**

```text
feat: add Hospitality request dispatch core
```

---

### Task 5: Implement Guest Entitlements Core

**Files:**
- Create: `packages/hospitality/entitlements.ts`
- Create: `supabase/migrations/20260914_hospitality_entitlements.sql`
- Create: `tests/unit/hospitality-entitlements.test.ts`
- Create: `tests/integration/hospitality-entitlements-schema-contract.test.ts`

**Interfaces:**
- Produces definition/rule/decision/redemption contracts and fail-closed evaluation.

- [ ] **Step 1: Write failing rule-resolution tests**

Test brand -> portfolio -> property -> stay override precedence and explicit `source_unavailable` behavior.

- [ ] **Step 2: Implement pure evaluator**

```ts
resolveEntitlement(input): HospitalityEntitlementDecision
```

The evaluator must never infer a chain policy that is not configured.

- [ ] **Step 3: Add versioned rule/decision/redemption schema**

- [ ] **Step 4: Verify no unnecessary guest PII fields exist**

- [ ] **Step 5: Run tests/typecheck**

- [ ] **Step 6: Commit**

```text
feat: add Hospitality guest entitlements core
```

---

### Task 6: Implement Events / BEO Core

**Files:**
- Create: `packages/hospitality/events.ts`
- Create: `supabase/migrations/20260914_hospitality_events.sql`
- Create: `tests/unit/hospitality-events.test.ts`
- Create: `tests/integration/hospitality-events-schema-contract.test.ts`

**Interfaces:**
- Produces event state machine, versioned BEO/order model, material-change impact decisions, timeline items, vendor requirement references, Execution linkage.

- [ ] **Step 1: Write failing event/BEO tests**

Require BEO versions to supersede rather than overwrite prior versions.

- [ ] **Step 2: Implement event state/impact functions**

```ts
transitionHospitalityEvent(current, next): HospitalityEventState
classifyEventChange(change): HospitalityEventImpact
```

- [ ] **Step 3: Add schema/RLS**

- [ ] **Step 4: Run tests/typecheck**

- [ ] **Step 5: Commit**

```text
feat: add Hospitality events and BEO core
```

---

### Task 7: Implement Evidence-Backed Command Center KPI Projections

**Files:**
- Create: `packages/hospitality/kpi.ts`
- Create: `apps/web/src/modules/hospitality/CommandCenterPage.tsx`
- Modify: `apps/web/src/modules/hospitality/HospitalityRoutes.tsx`
- Modify: `apps/web/src/modules/hospitality/HospitalitySubnav.tsx`
- Create: `tests/unit/hospitality-kpi.test.ts`
- Create: `tests/integration/hospitality-command-center-route.test.tsx`

**Interfaces:**
- Consumes persisted request, entitlement, event, integration, and Room Access records.
- Produces transparent KPI projections with drill-down references.

- [ ] **Step 1: Write pure KPI formula tests**

Use deterministic fixtures; no invented production data.

- [ ] **Step 2: Implement KPI functions**

Return `unavailable` when required source fields are missing.

- [ ] **Step 3: Add protected Command Center route/UI**

Empty state must explain missing configuration/data rather than display synthetic metrics.

- [ ] **Step 4: Run route, KPI, accessibility-focused tests**

- [ ] **Step 5: Commit**

```text
feat: add Hospitality evidence command center
```

---

### Task 8: Selectively Recover Wallet/PMS Key Core onto Current Main

**Files to inspect from historical branch `feat/hospitality-wallet-hotel-key`:**
- `packages/hospitality/wallet-policy.ts`
- `supabase/migrations/20260912_hospitality_wallet_hotel_key.sql`
- `supabase/functions/_shared/hospitality/repository.ts`
- `supabase/functions/atlas-hospitality-access/_shared/repository.ts`
- `tests/unit/hospitality-wallet-policy.test.ts`
- `tests/integration/hospitality-wallet-schema-contract.test.ts`
- `tests/integration/hospitality-wallet-repository-contract.test.ts`

**Current files requiring merge, never stale replacement:**
- `packages/hospitality/types.ts`
- `packages/hospitality/permissions.ts`
- current Room Access repository/Edge Function files.

**Interfaces:**
- Produces PMS/stay/assignment/wallet policy/reference contracts compatible with current Room Access.

- [ ] **Step 1: Port tests first and verify RED**

- [ ] **Step 2: Port only additive safe code**

Never replace current `types.ts`, permissions, or repositories wholesale with stale branch versions.

- [ ] **Step 3: Add capability-specific readiness**

Wallet/PMS readiness must remain independent of generic provider state.

- [ ] **Step 4: Verify forbidden fields**

Reject schema/code containing raw credential payload storage, NFC/RFID dumps, BLE frames, master keys, provider tokens in browser state, or generic reusable unlock secrets.

- [ ] **Step 5: Run focused wallet/PMS tests and existing Room Access regression tests**

- [ ] **Step 6: Commit**

```text
feat: recover Hospitality wallet key core on current main
```

---

### Task 9: Recover NFC/BLE Transport Routing Without Remote Unlock

**Files:**
- Modify: `packages/hospitality/types.ts`
- Create: `packages/hospitality/access-routing.ts`
- Create: `tests/unit/hospitality-access-routing.test.ts`
- Add a provider adapter only when an official documented provider contract is available.

**Interfaces:**
- Produces `nfc|ble` transport metadata and explicit platform/provider routing decisions.

- [ ] **Step 1: Write routing tests**

Reject Wallet/BLE mismatch, unavailable transport, unverified mapping, unready provider, inactive stay, or duplicate credential.

- [ ] **Step 2: Implement fail-closed route selector**

```ts
selectHospitalityAccessRoute(input): HospitalityAccessRouteDecision
```

- [ ] **Step 3: Confirm direct remote unlock remains absent**

- [ ] **Step 4: Run tests/typecheck**

- [ ] **Step 5: Commit**

```text
feat: add Hospitality access transport routing
```

---

### Task 10: Exact-SHA Final Repository Gate

**Files:** none unless failures require fixes.

- [ ] **Step 1: Run focused Hospitality suites**

- [ ] **Step 2: Run full gate**

```bash
npm ci
npm audit --audit-level=high
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

- [ ] **Step 3: Record exact verified SHA**

Classification may advance to `implementation_verified`, never directly to `production_ready_for_property`.

---

### Task 11: Provider / Property Onboarding Gate

**External requirements, not source-code substitutions:**

- exact hotel property identifier;
- actual lock/access-control vendor and installed system/version;
- official provider integration contract/API/SDK/bridge for that property;
- authorized provider credentials/certificates in server-side secret storage;
- designated test property/room/lock;
- official property-to-provider mapping;
- official room mapping;
- PMS/stay source or approved staff-test assignment method;
- explicit authorization for controlled issuance and physical test.

- [ ] **Step 1: Run non-destructive readiness**

Provider state may become `ready` only after official interface verification succeeds.

- [ ] **Step 2: Verify exact room mapping**

- [ ] **Step 3: Create a bounded authorized test assignment**

- [ ] **Step 4: Record provider-validation evidence**

Exit classification: `provider_validation_ready`.

---

### Task 12: Controlled Physical Hotel-Key Test

**No source-code shortcut can replace this task.**

- [ ] **Step 1: Issue credential through governed ATLAS operation**

Require provider-confirmed opaque credential reference. Do not persist raw credential material.

- [ ] **Step 2: Complete official Wallet/provider-app provisioning**

- [ ] **Step 3: Test the explicitly designated physical lock**

Pass only on real successful access through the official provider pathway.

- [ ] **Step 4: Test room-change/replacement lifecycle when approved**

- [ ] **Step 5: Test checkout/revocation lifecycle**

Do not report revoked until provider evidence confirms it.

- [ ] **Step 6: Review audit and secret-boundary evidence**

Required final result:

```text
physical_key_test_passed = true|false
provider = <verified provider>
property = <authorized property>
transport/platform = <verified path>
room_mapping_verified = true|false
issue_confirmed = true|false
physical_access_confirmed = true|false
replacement_confirmed = true|false|not_tested
revocation_confirmed = true|false
secret_leakage_detected = false
```

Only after all required property-specific gates pass may ATLAS record `production_ready_for_property` for that exact provider/property/transport combination.
