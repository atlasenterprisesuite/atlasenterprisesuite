# ATLAS Genesis & Evolution Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first governed Evolution Kernel foundation so ATLAS can express DNA invariants, separate engineering/evidence/evolution states, audit the canonical module registry deterministically, and represent post-Birth evolution without changing existing Gestation truth semantics.

**Architecture:** Add one focused release-domain file for evolution contracts and deterministic registry auditing, reuse `AtlasModuleDefinition` and `summarizeGestation`, and keep persistence/UI out of this slice. Tests establish fail-closed behavior first; implementation follows with no new database, route, provider, or top-level module.

**Tech Stack:** TypeScript, Vitest, existing ATLAS web/release module contracts.

**Spec:** `docs/superpowers/specs/2026-10-06-atlas-genesis-evolution-architecture-design.md`

## Global Constraints

- Reuse `apps/web/src/modules/registry.ts` as the canonical module source.
- Preserve `apps/web/src/modules/release/gestation.ts` and its 12 pre-Birth phases without reinterpreting existing statuses.
- Do not add a database, provider, route, top-level module, or parallel source of truth.
- Missing evidence must never be converted into a green/verified state.
- Engineering readiness, evidence certainty, and evolution lifecycle must remain separate types.
- Registry auditing must be deterministic and side-effect free.
- P0/P1 findings must not be silently suppressed.
- No simulated production success or invented evidence.

## Review Focus

- Duplicate module IDs or routes must produce deterministic P1 findings rather than last-write-wins behavior.
- Blank or non-absolute routes must produce an explicit finding and must never be treated as valid navigation evidence.
- Placeholder language in canonical registry descriptions must be surfaced instead of normalized away.
- An `implemented` module with `active` evolution must remain valid; baseline and evolution are independent axes.
- Post-Birth phases must remain blocked while Gestation Birth is not complete and must not mutate Gestation status.

---

### Task 1: Define RED tests for ATLAS DNA and three-axis state model

**Files:**
- Create: `tests/unit/atlas-evolution.test.ts`

**Interfaces:**
- Consumes: `AtlasModuleDefinition`, `ATLAS_MODULES`, `summarizeGestation`.
- Produces test expectations for `ATLAS_DNA_INVARIANTS`, `ATLAS_POST_BIRTH_PHASES`, `auditAtlasModuleRegistry`, and `summarizeAtlasEvolution`.

- [ ] **Step 1: Write failing tests for DNA invariants and state separation**

Assert that the new module exports 18 stable DNA invariants, that engineering/evidence/evolution states are represented independently, and that an implemented module can simultaneously be in active evolution without an audit error.

- [ ] **Step 2: Write failing tests for registry audit failure modes**

Cover duplicate ID, duplicate route, non-absolute route, blank canonical copy, and placeholder copy. Assert stable finding IDs, target IDs, invariant IDs, and expected P1/P2 severities.

- [ ] **Step 3: Write failing tests for healthy canonical registry behavior**

Audit `ATLAS_MODULES`; assert deterministic summary totals, no duplicate ID/route findings, and explicit coverage values instead of invented full-DNA compliance.

- [ ] **Step 4: Write failing tests for post-Birth gating**

Assert seven post-Birth phases in order: `adaptation`, `specialization`, `cooperation`, `memory`, `intelligence`, `self-correction`, `continuous-evolution`; all must be blocked while current Gestation `birthReady` is false.

- [ ] **Step 5: Commit RED tests**

Commit only the new test file with message `test(evolution): define ATLAS DNA and audit contracts`.

### Task 2: Implement the Evolution Kernel domain model

**Files:**
- Create: `apps/web/src/modules/release/evolution.ts`
- Test: `tests/unit/atlas-evolution.test.ts`

**Interfaces:**
- Consumes: `AtlasModuleDefinition` from `../registry`; gestation summary shape from `./gestation`.
- Produces:
  - `ATLAS_DNA_INVARIANTS`
  - `AtlasEngineeringState`
  - `AtlasEvidenceState`
  - `AtlasEvolutionLifecycle`
  - `AtlasAuditSeverity`
  - `AtlasAuditFinding`
  - `AtlasRegistryAuditResult`
  - `auditAtlasModuleRegistry(modules)`
  - `ATLAS_POST_BIRTH_PHASES`
  - `summarizeAtlasEvolution(modules, gestationSummary)`

- [ ] **Step 1: Implement immutable DNA/state contracts**

Define exact union types from the spec and the 18 invariant IDs with name, description, and audit layer metadata.

- [ ] **Step 2: Implement deterministic registry audit**

The function must validate uniqueness, route shape, required canonical copy, and placeholder language. Findings use stable IDs composed from scope, invariant, target, and code. Non-auditable DNA invariants are reported as coverage metadata, not fabricated pass states.

- [ ] **Step 3: Implement post-Birth evolution phases**

Expose seven immutable phases. Their derived status is blocked until Gestation birth readiness is true; phase definitions do not modify `ATLAS_GESTATION_PHASES`.

- [ ] **Step 4: Implement evolution summary**

Return total modules, operational baseline, active/continuous evolution counts, registry audit summary, Gestation birth readiness, and current post-Birth phase without converting missing evidence into success.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run `npm test -- tests/unit/atlas-evolution.test.ts` or the repository's equivalent focused Vitest invocation. Expected: all new tests pass.

- [ ] **Step 6: Commit implementation**

Commit `evolution.ts` with message `feat(evolution): add ATLAS DNA and registry audit kernel`.

### Task 3: Integrate evolution evidence into Gestation summary without semantic regression

**Files:**
- Modify: `apps/web/src/modules/release/gestation.ts`
- Modify: `tests/unit/atlas-gestation.test.ts`
- Test: `tests/unit/atlas-evolution.test.ts`

**Interfaces:**
- Consumes: existing `summarizeGestation(modules)` behavior.
- Produces: backward-compatible Gestation summary plus optional evolution audit linkage only if it can be added without circular imports; otherwise preserve strict separation and test that separation explicitly.

- [ ] **Step 1: Add a regression test before modifying Gestation**

Assert exactly 12 Gestation phases, `conception` first, `birth` last, current phase `genome`, and `birthReady === false` against the canonical registry.

- [ ] **Step 2: Choose the non-circular integration boundary**

Prefer evolution consuming Gestation, not Gestation importing evolution. Only change `gestation.ts` if a small reusable exported summary type is required. Do not introduce a circular dependency.

- [ ] **Step 3: Run focused Gestation + Evolution tests**

Expected: both suites pass and existing Gestation semantics are unchanged.

- [ ] **Step 4: Commit only if a real integration change was necessary**

Use `refactor(release): expose gestation summary contract` when applicable; otherwise record no-op in the PR description rather than creating an unnecessary commit.

### Task 4: Repository validation and governed PR

**Files:**
- No product-file scope expansion unless validation reveals a defect caused by Tasks 1–3.

**Interfaces:**
- Consumes: completed branch state.
- Produces: CI evidence for review/merge.

- [ ] **Step 1: Run repository validation**

Run the repository-supported equivalents of:

- `npm run typecheck`
- `npm test`
- `npm run build`

- [ ] **Step 2: Inspect failures truthfully**

Repair only failures caused by this branch. Existing unrelated failures are documented, not silently rewritten.

- [ ] **Step 3: Open PR to `main`**

Title: `feat(evolution): add ATLAS Genesis audit foundation`.

PR body must include the encyclopedia-derived architecture intent, first-slice boundaries, RED→GREEN evidence, audit findings, and explicit statement that full repository-wide convergence remains subsequent subprojects.

- [ ] **Step 4: Wait for required CI and security checks**

Do not merge while any required check is pending or failing.

- [ ] **Step 5: Merge only on green evidence**

Use the repository's allowed merge method and preserve commit lineage.

### Task 5: Post-merge production verification

**Files:**
- No source changes unless a verified regression is discovered.

**Interfaces:**
- Consumes: merged exact SHA and existing production verification workflow.
- Produces: verified release evidence or an explicit blocker.

- [ ] **Step 1: Verify exact merged SHA deployment evidence**

Use existing ATLAS release/Cloudflare evidence paths. Do not infer deployment from merge alone.

- [ ] **Step 2: Verify P0 public production routes**

Confirm root and canonical health endpoint using the existing production verification mechanism. P0 failure is fail-closed.

- [ ] **Step 3: Record the result**

If exact-SHA deployment and P0 routes are verified, mark this foundation production-verified. Otherwise keep the task incomplete with the precise missing evidence.

### Task 6: Bootstrap the next audit wave

**Files:**
- Create only governance/audit artifacts needed to hand off verified findings; no speculative product rewrites.

**Interfaces:**
- Consumes: `auditAtlasModuleRegistry(ATLAS_MODULES)` results and current repository evidence.
- Produces: prioritized P0→P3 remediation queue for the next subprojects in the spec.

- [ ] **Step 1: Run the registry audit over all canonical modules**

Capture finding IDs and coverage gaps exactly as emitted.

- [ ] **Step 2: Classify next work by the six-layer audit hierarchy**

Map findings/gaps into L0 contracts, L1 primitives, L2 cores, L3 modules, L4 cross-module journeys, and L5 whole-suite production integrity.

- [ ] **Step 3: Start with the highest-severity independently testable subproject**

Prefer P0/P1 truth/security/data/integration defects over visual or cleanup work. If no P0/P1 exists in registry scope, proceed to Dependency Ecology Graph as the next architectural subproject.
