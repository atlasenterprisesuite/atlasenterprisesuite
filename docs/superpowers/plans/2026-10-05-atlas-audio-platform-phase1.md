# ATLAS Audio Platform Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the provider-neutral, rights-aware Phase 1 foundation for ATLAS Music Lab while keeping real generation fail-closed until a verified executable adapter exists.

**Architecture:** Extend the existing Creator domain and `/studio/create?type=music` path. Add focused audio-domain types, Audio DNA/provenance services, an audio eligibility/router layer over existing creative-engine readiness, and a dedicated Music Lab workspace. Reuse Creator API, Creator Library, tenant/RBAC, audit, and zero-cost-first semantics.

**Tech Stack:** TypeScript, React, existing ATLAS Creator packages/API conventions and repository test runner.

**Spec:** `docs/superpowers/specs/2026-10-05-atlas-audio-platform-design.md`

## Global Constraints

- Reuse existing `CreativeMediaKind`, `CreativeEngineReadiness`, `CREATIVE_EXECUTION_ORDER`, CreativePlan, Creator Library, audit, and provider-readiness infrastructure.
- Provider secrets are server-side only.
- Generation is fail-closed: no request is queued without verified readiness, authorization, rights approval, and capability match.
- No fabricated waveform, output, provider, price, rights status, or completion state.
- Every audio record is tenant-scoped by `organizationId`.
- Paid fallback may not occur without authorized tenant budget/policy.
- `DJ.m4a` is only a candidate validation reference after normal Creator ingestion and rights evidence; do not hard-code or ship the chat attachment.

## Review Focus

- A reference asset from another tenant must be rejected before any provider call.
- A provider that reports `ready=false` must never become eligible because of ranking or UI state.
- A request requiring reference audio must reject an engine without `reference_audio` capability.
- Missing/unknown commercial-rights evidence must block reference-based generation rather than silently downgrade.
- Music Lab must truthfully remain usable for planning when no executable audio provider is ready.

---

### Task 1: Audio domain contracts

**Files:**
- Create: `packages/creator/audio/types.ts`
- Create: `packages/creator/audio/defaults.ts`
- Test: `tests/unit/creator-audio-types.test.ts`

**Interfaces:**
- Produces: `AudioDNA`, `AudioSection`, `AudioFeatureSet`, `AudioRightsEvidence`, `AudioProvenanceEvent`, `AudioGenerationRequest`, `AudioGenerationJob`, `AudioGenerationState`, `AudioDerivativeRole`, `AudioRoutingPolicy`, `AudioProviderCapabilities`.

- [ ] **Step 1: Write failing type/default tests** proving a default generation request is tenant-scoped, starts in a non-submitted state, and does not infer rights or provider readiness.
- [ ] **Step 2: Run** the focused test and verify failure because the audio domain does not exist.
- [ ] **Step 3: Implement** the exact domain types from the spec plus minimal default factories; keep provider-specific fields out of shared contracts.
- [ ] **Step 4: Run** the focused test and existing Creator unit tests; expect PASS.
- [ ] **Step 5: Commit** `feat(creator): add audio domain contracts`.

### Task 2: Rights and reference eligibility gate

**Files:**
- Create: `packages/creator/audio/rights.ts`
- Test: `tests/unit/creator-audio-rights.test.ts`

**Interfaces:**
- Consumes: `AudioGenerationRequest`, `AudioRightsEvidence` from Task 1.
- Produces: `evaluateAudioRights(request, evidence, context): AudioRightsDecision` where decision is explicitly `allowed | blocked` with machine-readable reasons.

- [ ] **Step 1: Write failing tests** for allowed owned reference, unknown rights, cross-tenant reference, missing reference evidence, and no-reference generation.
- [ ] **Step 2: Run** focused tests; expect FAIL because `evaluateAudioRights` is absent.
- [ ] **Step 3: Implement** the minimal pure gate; fail closed for ambiguous reference rights and tenant mismatch.
- [ ] **Step 4: Run** focused tests; expect PASS.
- [ ] **Step 5: Commit** `feat(creator): add audio rights gate`.

### Task 3: Audio provider eligibility and routing

**Files:**
- Create: `packages/creator/audio/router.ts`
- Modify: `packages/creator/creative_engine.ts`
- Test: `tests/unit/creator-audio-router.test.ts`

**Interfaces:**
- Consumes: existing `CreativeEngineReadiness`, `CREATIVE_EXECUTION_ORDER`; Task 1 capabilities/request; Task 2 rights decision.
- Produces: `rankAudioEngines(request, engines, capabilities, rightsDecision): AudioRouteDecision`.

- [ ] **Step 1: Write failing tests** for unready engine rejection, capability mismatch, rights-blocked request, zero-cost-first ordering, and planning-only fallback when nothing executable qualifies.
- [ ] **Step 2: Run** focused tests; expect FAIL.
- [ ] **Step 3: Extend** creative-engine capability notes/types only as required without changing existing image/video behavior.
- [ ] **Step 4: Implement** deterministic audio eligibility and ranking; never convert `ready=false` to ready and never weaken a rights decision.
- [ ] **Step 5: Run** focused + existing creative-engine tests; expect PASS.
- [ ] **Step 6: Commit** `feat(creator): route audio engines fail closed`.

### Task 4: Audio DNA and append-only provenance service boundary

**Files:**
- Create: `packages/creator/audio/provenance.ts`
- Modify: the existing Creator server persistence module selected by repository convention after code inspection
- Test: `tests/unit/creator-audio-provenance.test.ts`
- Test: the matching Creator API integration test file selected by existing route convention

**Interfaces:**
- Consumes: Task 1 `AudioDNA`, `AudioProvenanceEvent`.
- Produces: `createAudioDNA`, `getAudioDNA`, `appendAudioProvenance`, `listAudioProvenance` through the existing Creator service/API boundary.

- [ ] **Step 1: Inspect** existing Creator asset/audit persistence and lock exact server files before editing; do not create a parallel persistence framework.
- [ ] **Step 2: Write failing tests** for tenant isolation, content-hash persistence, append-only event history, and correction-as-new-event behavior.
- [ ] **Step 3: Run** focused tests; expect FAIL.
- [ ] **Step 4: Implement** storage/service methods using existing tenant/audit conventions.
- [ ] **Step 5: Run** focused integration tests; expect PASS.
- [ ] **Step 6: Commit** `feat(creator): persist audio DNA provenance`.

### Task 5: Creator API client boundary for Music Lab

**Files:**
- Modify: `apps/web/src/lib/creatorApi.ts`
- Test: existing Creator API client test file or create `tests/unit/creator-audio-api.test.ts` if none exists

**Interfaces:**
- Consumes: Tasks 1-4 server contracts.
- Produces: typed client functions for audio engine readiness, Audio DNA read/create, rights summary, and planning/estimate calls; no generation submission in Phase 1.

- [ ] **Step 1: Write failing client tests** asserting tenant-safe request shapes and truthful handling of unavailable audio execution.
- [ ] **Step 2: Run** focused tests; expect FAIL.
- [ ] **Step 3: Implement** typed client functions following existing `creatorApi.ts` error/auth conventions.
- [ ] **Step 4: Run** focused tests; expect PASS.
- [ ] **Step 5: Commit** `feat(studio): expose audio planning api`.

### Task 6: Dedicated Music Lab workspace

**Files:**
- Create: `apps/web/src/modules/creator/music/MusicLabWorkspace.tsx`
- Create or modify: focused music styles under the existing Creator CSS convention
- Modify: `apps/web/src/modules/creator/CreatorStudioPage.tsx`
- Test: `tests/integration/atlas-creator-route.test.tsx`
- Test: `tests/integration/atlas-music-lab.test.tsx`

**Interfaces:**
- Consumes: Tasks 1, 3, 5.
- Produces: dedicated Music Lab UI at `/studio/create?type=music`.

- [ ] **Step 1: Write failing route test** proving `type=music` renders `MusicLabWorkspace` instead of the generic planning composer.
- [ ] **Step 2: Write failing state tests** for planning-without-provider, blocked rights, ready estimate, loading, error, and disabled generation when no verified executable engine exists.
- [ ] **Step 3: Run** focused tests; expect FAIL.
- [ ] **Step 4: Implement** Music Lab controls for brief, instrumental/vocal, duration, BPM, key/mode, energy, instrumentation, sections, language/lyrics, authorized reference selection, negative constraints, routing policy, and visible estimate state.
- [ ] **Step 5: Wire** `CreatorWorkspace` to return `<MusicLabWorkspace engines={engines} />` for `kind === 'music'`; preserve image/video behavior.
- [ ] **Step 6: Run** focused Creator/Music Lab tests; expect PASS.
- [ ] **Step 7: Commit** `feat(studio): add ATLAS Music Lab workspace`.

### Task 7: Security, regression, and Phase 1 verification

**Files:**
- Modify: only tests/docs revealed necessary by verification
- Test: Creator unit/integration suites plus repository lint/typecheck/build commands

**Interfaces:**
- Consumes: all previous tasks.
- Produces: evidence that Phase 1 is planning/rights/router ready while executable generation remains gated.

- [ ] **Step 1: Run** repository formatting/lint checks for changed files; expect PASS.
- [ ] **Step 2: Run** TypeScript/typecheck; expect PASS.
- [ ] **Step 3: Run** Creator/audio unit tests; expect PASS.
- [ ] **Step 4: Run** Creator/Music Lab integration tests; expect PASS.
- [ ] **Step 5: Run** production build; expect PASS.
- [ ] **Step 6: Verify** no client bundle contains provider secrets and no UI path can report generated media without a persisted real asset.
- [ ] **Step 7: Commit** any verification-only repairs as `fix(creator): harden audio platform phase 1`.

## Phase 1 completion gate

Phase 1 is complete only when all tests/build gates pass and evidence shows Music Lab is a real dedicated workspace with tenant-safe Audio DNA/provenance and fail-closed routing. It must still say generation is unavailable when no executable audio adapter is server-verified. Provider integration, real generation, deploy, and production E2E belong to Phase 2 and must not be claimed by this plan.
