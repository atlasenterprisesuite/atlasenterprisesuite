# Supabase v2 Runtime Identity Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the ATLAS web runtime to the canonical `atlas-core-v2` identity contract so every ready identity carries a verified `tenantId + organizationId`, then prove cross-tenant isolation and accounting authorization with authenticated end-to-end tests.

**Architecture:** The browser authenticates with Supabase Auth, then resolves tenancy and permissions only through the `atlas_identity_context()` RPC. The frontend no longer reconstructs memberships/roles/overrides with multiple direct queries. A pure mapping function validates the RPC row before producing `AtlasIdentityState.ready`, and all domain calls carry the returned tenant + organization scope.

**Tech Stack:** React 19, TypeScript, Supabase JS, Supabase Postgres/RLS/RPC, Vitest, Node built-in test runner for dependency-free contract verification.

**Spec:** `docs/superpowers/specs/2026-09-07-atlas-accounting-v1-design.md` plus canonical Supabase v2 state in `docs/integration/supabase-v2-accounting-status.md`.

## Global Constraints

- Do not modify `main`.
- `tenantId` is never inferred from `organizationId`.
- `atlas_identity_context()` is the canonical runtime identity source.
- No client-side reconstruction of effective permissions for the ready state.
- Fail closed on malformed/empty identity context.
- Preserve authentication-required and organization-required states.
- Do not claim production readiness until authenticated E2E and application build/typecheck are verified.

---

### Task 1: Identity contract mapper

**Files:**
- Create: `apps/web/src/lib/supabase/atlasIdentityContract.ts`
- Create: `tests/self/atlas-identity-contract.test.mjs`
- Modify: `tests/unit/atlas-identity-permissions.test.ts`

**Interfaces:**
- Consumes: one RPC row with `tenant_id`, `tenant_name`, `organization_id`, `organization_name`, `role`, `permissions` and an authenticated `userId`.
- Produces: `mapAtlasIdentityContextRow(userId, row): AtlasIdentityState`.

- [ ] Write a failing dependency-free test proving tenant/org mapping, permission normalization, and fail-closed malformed rows.
- [ ] Run it with Node and verify RED because the mapper does not exist.
- [ ] Implement the pure mapper.
- [ ] Run the Node test and verify GREEN.
- [ ] Update the Vitest unit test to cover the same contract.

### Task 2: Runtime identity source

**Files:**
- Modify: `apps/web/src/app/AtlasContext.tsx`
- Modify: `apps/web/src/lib/supabase/atlasIdentitySource.ts`

**Interfaces:**
- `AtlasIdentityState.ready` must expose `tenantId`, `tenantName`, `organizationId`, `organizationName`, `role`, and `permissions`.
- `createAtlasIdentitySource(client).resolve()` must authenticate first, then call `client.rpc('atlas_identity_context')` exactly as the canonical identity lookup.

- [ ] Replace direct membership/organization/permission queries with the RPC.
- [ ] Return `organization_required` for an authenticated user with no context row.
- [ ] Return an error state for RPC failure or malformed context.
- [ ] Keep auth-state subscription behavior unchanged.

### Task 3: Supabase v2 environment contract

**Files:**
- Modify only documentation/config contracts needed to point development runtime to Supabase v2; never commit private keys.

**Interfaces:**
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` remain the only browser configuration inputs.
- Publishable key may be documented; service-role keys never enter the browser or repository.

- [ ] Verify the project URL and enabled publishable key from Supabase.
- [ ] Document the target project ref and required env variable names without committing secrets.

### Task 4: Authenticated E2E isolation

**Database checks:**
- Create temporary E2E auth users and two separate tenant/org scopes only through service-side/bootstrap paths.
- Prove each user can resolve only its own context and cannot read the other tenant's accounting data.
- Prove an authorized owner can create/post a balanced journal through governed RPCs.
- Prove a cross-tenant journal/account reference fails.
- Delete temporary E2E records/users when the test harness supports safe cleanup; otherwise mark and isolate them as test-only data and report the cleanup gap.

### Task 5: Verification and integration

- [ ] Run dependency-free Identity contract tests.
- [ ] Run Supabase Foundation + Identity + Accounting self-check aggregate.
- [ ] Run Security Advisor.
- [ ] Attempt repo-local Forge CI/typecheck/test/build if executable outside GitHub Actions; otherwise record the exact blocker.
- [ ] Open a PR from `feat/supabase-v2-runtime` to `release/atlas-a-z` with evidence and remaining gates.
- [ ] Do not merge into `release/atlas-a-z` until the available verification gates are green and no concurrent regression is detected.
