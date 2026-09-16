# ATLAS Health — Jaque Mate + Sentinel v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing ATLAS Health Disease Reconstruction Lab with a governed Jaque Mate + Sentinel subsystem implementing Seed × State × Niche × Time, Sentinel Fitness, Pathological Memory Depth, Response-Gating, Surveillance Cost, evidence-layer isolation, RBAC contracts, and an explicitly research/simulation-only user surface.

**Architecture:** Reuse the existing `packages/health` research domain and `/health/research/frontiers/disease-reconstruction` route family. New Jaque Mate/Sentinel logic is pure deterministic TypeScript with no automated treatment execution. Persistence is introduced through an idempotent Supabase migration with tenant-scoped RLS; the UI consumes repository/demo research data only and labels hypothesis/simulation output visibly.

**Tech Stack:** TypeScript, React 18, React Router, Vitest, Supabase/PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-09-03-atlas-health-disease-reconstruction-lab-design.md`, augmented by the approved 2026-09-15 Jaque Mate + Sentinel diff in the project conversation.

## Global Constraints

- Keep the existing ATLAS Health module and route graph; do not create a parallel Health app.
- Preserve `atlas.health.jaque-mate-sentinel.v1` as the canonical module identity in metadata.
- Never present hypotheses or simulations as validated clinical evidence.
- Never execute or recommend an automated therapeutic intervention; Response-Gating returns a decision state only.
- Do not fabricate patient, laboratory, sensor, hospital, or clinical metrics.
- Preserve tenant/organization isolation and existing `organization_members`-based authorization patterns.
- Placeholder threshold values from external drafts are not production defaults. Defaults must remain behavior-preserving and explicitly research-only.

---

### Task 1: Evidence boundary and Seed × State × Niche × Time tensor

**Files:**
- Create: `packages/health/jaque-mate/types.ts`
- Create: `packages/health/jaque-mate/tensor.ts`
- Test: `tests/unit/health-jaque-mate-sentinel.test.ts`

**Interfaces:**
- Produces `EvidenceType = 'VALIDATED' | 'HYPOTHESIS' | 'SIMULATION'`.
- Produces `evaluateTensor(input)` returning normalized dimensions plus `evidenceType` and a non-clinical `researchScore`.
- Validated evidence requires a source identifier, confirmation timestamp, and provenance kind; missing provenance rejects validation rather than silently downgrading.

- [ ] Write failing tests for evidence isolation, provenance rejection, clamping, and deterministic tensor scoring.
- [ ] Run `npm run test:unit -- tests/unit/health-jaque-mate-sentinel.test.ts` and confirm RED due to missing module.
- [ ] Implement the minimal domain types and tensor evaluator.
- [ ] Re-run the targeted unit test and confirm GREEN.
- [ ] Commit the task.

### Task 2: Sentinel Fitness, pathological memory, response gate and surveillance cost

**Files:**
- Create: `packages/health/jaque-mate/fitness.ts`
- Create: `packages/health/jaque-mate/memory.ts`
- Create: `packages/health/jaque-mate/gating.ts`
- Create: `packages/health/jaque-mate/cost.ts`
- Create: `packages/health/jaque-mate/index.ts`
- Modify: `tests/unit/health-jaque-mate-sentinel.test.ts`

**Interfaces:**
- `calculateSentinelFitness({ baseline, current, tolerance })` returns 0..1 stability fitness and never infers a diagnosis.
- `calculatePathologicalMemory({ observations, halfLifeMs, now })` returns a 0..1 persistence depth using time decay.
- `evaluateResponseGate({ confidence, validatedEvidenceCount, threshold })` returns `BLOCKED | REVIEW_REQUIRED | ELIGIBLE_FOR_HUMAN_REVIEW`; it never performs treatment.
- `calculateSurveillanceCost({ sampleRateHz, computeMsPerSample, activeNodes, energyMw })` returns transparent compute/energy burden components.

- [ ] Add failing behavior tests, including transient-noise decay and gate blocking without validated evidence.
- [ ] Run the targeted unit test and confirm RED for missing implementations.
- [ ] Implement the four pure functions and barrel export.
- [ ] Re-run the targeted unit test and confirm GREEN.
- [ ] Commit the task.

### Task 3: Persistence and incremental RBAC contract

**Files:**
- Create: `supabase/migrations/20260915233000_health_jaque_mate_sentinel.sql`
- Create: `tests/integration/health-jaque-mate-sentinel-migration.test.ts`

**Interfaces:**
- Tables: `health_evidence_validated`, `health_evidence_hypotheses`, `health_evidence_simulation`, `health_sentinel_config`.
- Every row is organization-scoped; RLS requires active organization membership.
- Permission keys stored as configuration/audit metadata: `atlas.jm.sentinel.read`, `atlas.jm.sentinel.write`, `atlas.jm.sentinel.audit` without deleting or renaming existing roles.
- Config keys: `sentinel.fitness.threshold`, `sentinel.memory.pathological_depth`, `sentinel.cost.surveillance_rate`; defaults are `NULL` until explicitly configured so external placeholder numbers never become production policy.

- [ ] Write the migration contract test first and confirm RED because the migration is absent.
- [ ] Add an idempotent migration with constraints, indexes, RLS policies and comments documenting evidence separation.
- [ ] Re-run the migration contract test and confirm GREEN.
- [ ] Commit the task.

### Task 4: Governed Health UI routes and educational simulation surface

**Files:**
- Create: `apps/web/src/modules/health/JaqueMateSentinelPage.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/LabNav.tsx`
- Modify: `tests/integration/health-routes.test.tsx`

**Interfaces:**
- Primary route: `/health/research/frontiers/disease-reconstruction/jaque-mate-sentinel`.
- Alias: `/health/jaque-mate/sentinel/v2` renders the same governed surface.
- Legacy `/health/jaque-mate/sentinel` redirects to `/health/jaque-mate/sentinel/v2`.
- UI shows the four advanced engines, evidence boundary, simulation watermark, and explicit `research only / no clinical action` copy; no synthetic patient metrics.

- [ ] Add failing route/navigation tests first.
- [ ] Run the Health integration test and confirm RED because the route is absent.
- [ ] Implement the page, primary route, alias, redirect and LabNav entry.
- [ ] Re-run the Health integration test and confirm GREEN.
- [ ] Commit the task.

### Task 5: Repository verification and consensus gate

**Files:**
- Modify only if verification exposes a defect in Tasks 1–4.

- [ ] Run `npm run typecheck`.
- [ ] Run `npm run test:unit`.
- [ ] Run `npm run test:integration`.
- [ ] Run `npm run build`.
- [ ] Open a pull request to `main` without merging it.
- [ ] Require ATLAS Consensus CI to report Product/UX, Architecture/Build and Security/Reliability success before describing the branch as tested.
- [ ] Do not merge or deploy without the repository-owner production checkpoint.
