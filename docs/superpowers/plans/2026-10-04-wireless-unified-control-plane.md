# ATLAS Wireless Unified Control Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move MVNO and ATLAS-owned Wireless readiness APIs into the existing `atlas-platform-controls` Edge Function while preventing the UI from asserting provider verification or connected state.

**Architecture:** Reuse the existing authenticated platform control plane and shared Wireless domain helpers. The web keeps current response contracts but changes transport routing. Duplicate MVNO/network Edge Function entrypoints are removed; provider truth becomes server-owned and fail-closed.

**Tech Stack:** TypeScript, Supabase Edge Functions, Supabase Auth/Postgres/RLS, Vitest, React web client.

**Spec:** `docs/superpowers/specs/2026-10-04-wireless-unified-control-plane-design.md`

## Global Constraints

- Only `atlas-platform-controls` serves MVNO and Wireless network readiness/lifecycle APIs.
- `atlas-wireless-commissioning` remains separate in this change.
- Browser input cannot set `provider_verified=true`, `state=connected`, or `activation_enabled=true`.
- Provider secret values must never be returned.
- Activation remains fail-closed until a verified server-side provider adapter and ATLAS authorization evidence exist.
- Preserve existing tenant isolation, permission checks, audit behavior and RLS-backed inventory semantics.

## Review Focus

- Client submits `provider_verified=true` or `state=connected`: platform controls must ignore/reject promotion.
- Existing verified integration is edited: browser configuration must not silently downgrade or overwrite server verification truth.
- Partially configured provider secrets: readiness must stay `configured_unverified`/blocked.
- User belongs to another organization: Wireless operations must not cross organization boundaries.
- Missing Wireless profile/evidence: network readiness must not default to ready.

---

### Task 1: Pin the unified runtime contract with failing tests

**Files:**
- Modify: `tests/integration/atlas-wireless-mvno-server-gate.test.ts`
- Modify: `tests/integration/atlas-wireless-network-control-plane.test.ts`
- Create: `tests/integration/platform-controls-provider-truth.test.ts`

**Interfaces:**
- Produces: repository contract requiring `atlas-platform-controls` operations, client rerouting, duplicate runtime removal and server-owned verification truth.

- [ ] **Step 1:** Change MVNO test expectations to require `supabase/functions/atlas-platform-controls/index.ts`, `wireless-mvno-*` operations, platform-controls JWT config, and absence of `atlas-wireless-mvno/index.ts`.
- [ ] **Step 2:** Change Wireless network test expectations to require platform-controls `wireless-network-readiness` / `wireless-network-inventory`, client rerouting, and absence of `atlas-wireless-network/index.ts`.
- [ ] **Step 3:** Add provider-truth test asserting platform controls does not copy client `provider_verified` into upsert data and cannot accept client `connected` promotion.
- [ ] **Step 4:** Run targeted tests and verify they fail because implementation has not yet moved.

### Task 2: Consolidate MVNO and Wireless network logic into platform controls

**Files:**
- Modify: `supabase/functions/atlas-platform-controls/index.ts`
- Preserve: `supabase/functions/_shared/mvno.ts`
- Preserve: `supabase/functions/_shared/atlas-wireless-network.ts`

**Interfaces:**
- Consumes: existing MVNO permission mapping/readiness behavior and Wireless readiness helper/table schema.
- Produces: `wireless-mvno-*` and `wireless-network-*` operations in the shared control plane.

- [ ] **Step 1:** Add shared imports/types and operation permission map.
- [ ] **Step 2:** Add organization-scoped MVNO readiness, blocked lifecycle audit and fail-closed handlers.
- [ ] **Step 3:** Add organization-scoped Wireless inventory/readiness handlers using existing shared readiness evaluator.
- [ ] **Step 4:** Route methods/operations from the main `Deno.serve` dispatcher.
- [ ] **Step 5:** Run targeted tests and verify the runtime contract is green except client/cleanup expectations owned by Task 3.

### Task 3: Move clients and remove duplicate deployable runtimes

**Files:**
- Modify: `apps/web/src/lib/wirelessMvnoApi.ts`
- Modify: `apps/web/src/lib/wirelessNetworkApi.ts`
- Modify: `supabase/config.toml`
- Delete: `supabase/functions/atlas-wireless-mvno/index.ts`
- Delete: `supabase/functions/atlas-wireless-network/index.ts`

**Interfaces:**
- Consumes: Task 2 platform-control operation names.
- Produces: one deployed Edge Function surface for MVNO/Wireless network APIs.

- [ ] **Step 1:** Route MVNO readiness to `atlas-platform-controls?api=wireless-mvno-readiness`.
- [ ] **Step 2:** Route network calls to `atlas-platform-controls?api=wireless-network-{readiness|inventory}`.
- [ ] **Step 3:** Remove duplicate function config entries and source files.
- [ ] **Step 4:** Run targeted tests and verify green.

### Task 4: Make provider verification server-owned

**Files:**
- Modify: `supabase/functions/atlas-platform-controls/index.ts`
- Test: `tests/integration/platform-controls-provider-truth.test.ts`

**Interfaces:**
- Produces: configuration write path where browser cannot promote provider verification/connected state.

- [ ] **Step 1:** Read existing connection before upsert when one exists.
- [ ] **Step 2:** Preserve server-owned `provider_verified` and verification timestamps for existing rows; default false for new rows.
- [ ] **Step 3:** Derive state so browser input cannot set `connected`; preserve an already server-verified connected state unless configuration invalidates it, otherwise use `unconfigured`/`authorizing`/`degraded` as appropriate.
- [ ] **Step 4:** Ensure audits record resulting truth, not requested client truth.
- [ ] **Step 5:** Run provider-truth and Wireless tests; verify green.

### Task 5: Full verification, PR and deployment gate

**Files:** no product-code changes unless verification reveals a defect.

- [ ] **Step 1:** Run full repository test/build workflows through GitHub CI.
- [ ] **Step 2:** Review diff for secret exposure, stale routes and unintended runtime deletion.
- [ ] **Step 3:** Merge only if required checks are green against current `main`.
- [ ] **Step 4:** Deploy/update `atlas-platform-controls` in the active Supabase project only after merged code is verified.
- [ ] **Step 5:** Verify live function metadata/readiness; confirm no claim of carrier activation or `provider_verified` without provider evidence.