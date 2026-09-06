# ATLAS Accounting + Google Arbitration Wave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Absorb the verified new Accounting work from PR #8 and then reconcile the Google Workspace gateway from PR #18 into `release/atlas-a-z` without weakening tenant isolation, RBAC, audit, truthfulness, or release gates.

**Architecture:** `release/atlas-a-z` remains the integration branch and `main` remains untouched. Accounting additions are ported selectively onto the surviving repository and Core contracts rather than merging PR #8 wholesale. Google integration is admitted only after its OAuth state and permission contracts are aligned with canonical ATLAS tenancy and RBAC.

**Tech Stack:** TypeScript, React, Vitest, Supabase/Postgres, Supabase Edge Functions, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-04-atlas-a-z-closure-design.md`

## Global Constraints

- Never merge or deploy to `main` during this wave.
- No fake provider, live, financial, or clinical state.
- Preserve existing `TenantScope` semantics: `tenantId` + `organizationId`.
- Preserve canonical audit and permission enforcement.
- Do not replace the consolidated Accounting repository wholesale with the divergent PR #8 version.
- Every admitted sub-wave must pass its own tests plus the complete existing A-Z matrix before acceptance.

---

### Task 1: Selectively port Accounting Task 8 domain logic

**Files:**
- Create: `packages/accounting/src/assets.ts`
- Create: `packages/accounting/src/periodClose.ts`
- Create: `packages/accounting/src/reports.ts`
- Create: `packages/accounting/src/accountingGovernanceWrites.ts`
- Modify: `packages/accounting/src/index.ts`
- Modify: `packages/accounting/src/types.ts`
- Modify: `packages/accounting/src/repository.ts`
- Modify: `packages/accounting/src/supabaseRepository.ts`
- Test: `tests/unit/accounting-assets.test.ts`
- Test: `tests/unit/accounting-close.test.ts`
- Test: `tests/unit/accounting-reports.test.ts`
- Test: `tests/unit/accounting-task8-writes.test.ts`
- Test: `tests/integration/accounting-task8-repository.test.ts`
- Test: `tests/integration/accounting-task8-rpc-gateway.test.ts`

**Interfaces:**
- Consumes: existing Accounting records and the canonical organization-scoped repository/RPC patterns already accepted in A-Z.
- Produces: fixed-asset depreciation helpers, period-close readiness, Trial Balance/P&L/Balance Sheet derivations, governance write service, and repository access for assets/period/settings/audit.

- [ ] **Step 1:** Port the six PR #8 tests unchanged where they remain compatible with the consolidated contracts.
- [ ] **Step 2:** Confirm the new tests fail against the current A-Z head because the Task 8 exports do not yet exist.
- [ ] **Step 3:** Add `assets.ts`, `periodClose.ts`, `reports.ts`, and `accountingGovernanceWrites.ts` from the verified PR #8 implementation.
- [ ] **Step 4:** Extend existing Accounting types/repository/Supabase gateway additively; do not replace existing Bank Cash, AR/AP, GL, or journal behavior.
- [ ] **Step 5:** Export the new modules from `packages/accounting/src/index.ts`.
- [ ] **Step 6:** Run Task 8 unit/integration tests and the complete A-Z workflow matrix.
- [ ] **Step 7:** Commit the accepted Accounting sub-wave atomically.

### Task 2: Reconcile Google Workspace tenancy and permission contracts

**Files:**
- Modify or create a dedicated integration module rather than appending provider logic indefinitely to `packages/core/src/index.ts`.
- Create/modify: Supabase Google OAuth shared helper and connect Edge Function.
- Modify: Google Workspace migration.
- Test: OAuth state, permission normalization, integration gateway, tenant isolation, replay resistance, and unconfigured-provider behavior.

**Interfaces:**
- Consumes: canonical `TenantScope`, ATLAS identity permission checks, Supabase authenticated session, HMAC-SHA256 signed OAuth state.
- Produces: provider-neutral integration connection contract and a Google OAuth start flow that is tenant + organization scoped.

- [ ] **Step 1:** Write failing tests requiring `tenantId` and `organizationId` in the OAuth state and connection key.
- [ ] **Step 2:** Standardize the management capability to one canonical permission name across TypeScript, SQL, and Edge Function.
- [ ] **Step 3:** Port the HMAC state signing, Google scope mapping, nonce hashing, origin allowlist, authenticated session checks, and one-time state persistence.
- [ ] **Step 4:** Ensure missing Google/Supabase configuration returns an explicit unavailable/configuration error and never claims a connection.
- [ ] **Step 5:** Run Google-specific tests plus the complete A-Z workflow matrix.
- [ ] **Step 6:** Commit the accepted Google sub-wave atomically.

### Task 3: Re-arbitrate active branches

**Files:**
- Update: `docs/integration/atlas-a-z-wave-status.md`
- Update PR #13 arbitration/status comment.

- [ ] **Step 1:** Compare active PR heads against the new A-Z head.
- [ ] **Step 2:** Confirm superseded branches contain no new unique implementation.
- [ ] **Step 3:** Record remaining blockers such as MiFi physical adapter/tenant identity and production branch protection.
- [ ] **Step 4:** Do not merge `main`; leave final merge/deploy to the full closure gate.
