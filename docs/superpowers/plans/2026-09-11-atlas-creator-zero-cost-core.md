# ATLAS Creator Zero-Cost Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working sovereign ATLAS Creator slice with a zero-cost provider registry, ATLAS Auto routing, truthful Creator UI, and a self-hosted FLUX generation bridge.

**Architecture:** Keep the existing React Creator surfaces. Put provider policy in a focused TypeScript module shared by UI/tests. Add a Supabase Edge Function that enforces zero-cost policy server-side and forwards only to an explicitly configured local FLUX endpoint.

**Tech Stack:** React 18, TypeScript 5.7, Vitest 3, Supabase Edge Functions (Deno), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-11-atlas-creator-zero-cost-core-design.md`

## Global Constraints

- Do not write directly to `main`.
- Zero-cost mode must never silently invoke a metered or subscription provider.
- Do not fabricate provider readiness or generated assets.
- Reuse existing `/studio` routes and ATLAS Identity boundaries.
- Paid providers remain disabled by default.
- A missing local runtime returns `configuration-required` or `resource-blocked`.

---

### Task 1: Provider policy core

**Files:**
- Create: `apps/web/src/modules/creator/providerRegistry.ts`
- Test: `tests/unit/creator-provider-registry.test.ts`

**Interfaces:**
- Produces: `creatorProviders`, `eligibleProviders(capability, zeroCostMode)`, `selectAtlasAutoProvider(capability, zeroCostMode)`.

- [ ] Step 1: Write unit tests proving zero-cost filtering excludes metered providers and selects `flux-schnell-local` only when ready.
- [ ] Step 2: Run `npm run test:unit -- tests/unit/creator-provider-registry.test.ts` and confirm RED because the module does not exist.
- [ ] Step 3: Implement the minimal provider registry and selector.
- [ ] Step 4: Run the same test and confirm GREEN.
- [ ] Step 5: Commit.

### Task 2: Creator UI integration

**Files:**
- Modify: `apps/web/src/modules/creator/CreatorStudioPage.tsx`
- Modify: `tests/integration/atlas-creator-route.test.tsx`

**Interfaces:**
- Consumes: provider registry from Task 1.
- Produces: truthful Zero-Cost Mode and self-hosted provider state in Studio UI.

- [ ] Step 1: Add integration assertions for Zero-Cost Mode, FLUX local provider, and generation availability based on registry state.
- [ ] Step 2: Run Creator integration test and confirm RED.
- [ ] Step 3: Update Creator page to render registry data and generation policy.
- [ ] Step 4: Run Creator integration test and confirm GREEN.
- [ ] Step 5: Commit.

### Task 3: Server-side generation bridge

**Files:**
- Create: `supabase/functions/atlas-creator-generate/index.ts`
- Create: `tests/unit/creator-generation-policy.test.ts`

**Interfaces:**
- Consumes: POST body `{kind,prompt,format,visibility,zeroCostMode}` and headers `Authorization`, `x-atlas-organization-id`.
- Produces: structured JSON status with `providerId`, `state`, `message`, and optional `asset`.

- [ ] Step 1: Add policy tests for prompt validation, missing local endpoint, and zero-cost provider enforcement using extracted pure helpers.
- [ ] Step 2: Run unit tests and confirm RED.
- [ ] Step 3: Implement helpers plus Edge Function forwarding only to `ATLAS_FLUX_LOCAL_URL`.
- [ ] Step 4: Run unit tests and confirm GREEN.
- [ ] Step 5: Commit.

### Task 4: CI and full verification

**Files:**
- Create: `.github/workflows/atlas-creator-ci.yml`

- [ ] Step 1: Configure CI for pushes to `feat/atlas-creator-zero-cost-core` and PRs to `main`.
- [ ] Step 2: Run `npm run typecheck`.
- [ ] Step 3: Run `npm run test:unit`.
- [ ] Step 4: Run `npm run test:integration`.
- [ ] Step 5: Run `npm run build`.
- [ ] Step 6: Review diff against the spec; do not claim production readiness without a real FLUX runtime probe.
