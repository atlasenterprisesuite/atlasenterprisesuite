# ATLAS Dependency Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first production-capable ATLAS Dependency Intelligence vertical slice so ATLAS can compute a provenance-backed blast radius for Telephony changes, select mandatory verification, and expose the result under Release Control.

**Architecture:** Add one shared repository-derived graph engine under `packages/architecture-intelligence`, keep Telephony dependency declarations colocated with the canonical communication capability, and compose the graph in Release Control without replacing module, readiness, evidence, or deployment authorities. The first release is static/reproducible from repository sources; runtime/provider truth remains referenced from existing ATLAS Manager/readiness/evidence boundaries.

**Tech Stack:** TypeScript, React 18, Vite 6, Vitest 5, existing ATLAS design system, GitHub Actions/global production verification.

**Spec:** `docs/superpowers/specs/2026-10-04-atlas-dependency-intelligence-design.md`

## Global Constraints

- Preserve `apps/web/src/modules/registry.ts`, Master Evidence Registry, ATLAS Manager, Release Control, and domain readiness contracts as existing authorities.
- No secret values, private provider payloads, or browser-authoritative privileged writes.
- Unknown production-critical dependencies fail closed into a hold/unknown state; they never reduce verification scope.
- P0/P1/P2 risk comes from impacted capabilities and unresolved relationships, never diff line count alone.
- Repository-wide mandatory gates remain mandatory; Dependency Intelligence only adds focused verification.
- Every impact conclusion must expose an explanation path from changed source to required gate.
- `/release/dependencies` must remain identity-protected and use existing ATLAS tokens/shell/accessibility patterns.
- The first vertical slice is Telephony: source/package/module/provider/permission/readiness/test/production-route relationships.
- Do not introduce a second provider registry, permission model, evidence store, deployment path, or runtime control plane.

## Review Focus

- Cycles in dependency edges must terminate deterministically without duplicate affected nodes.
- An unknown P0 relationship must produce `HOLD_UNKNOWN_DEPENDENCY`, never `CLEAR`.
- A changed Telephony source must pull Connect, provider readiness, RBAC, E2E and production-route checks into the report.
- A documentation-only path with no runtime edge must remain P2 while still preserving global repository gates.
- Secret requirements may expose names such as `TELNYX_API_KEY` but any value-like material must be rejected from graph metadata.

---

### Task 1: Shared graph model, traversal and risk engine

**Files:**
- Create: `packages/architecture-intelligence/src/types.ts`
- Create: `packages/architecture-intelligence/src/graph.ts`
- Create: `packages/architecture-intelligence/src/impact.ts`
- Create: `packages/architecture-intelligence/src/index.ts`
- Create: `tests/unit/dependency-intelligence-graph.test.ts`

**Interfaces:**
- Consumes: no new runtime dependencies.
- Produces: `DependencyNode`, `DependencyEdge`, `DependencyGraph`, `ImpactReport`, `buildDependencyGraph()`, `analyzeDependencyImpact()` and `validateSafeMetadata()`.

- [ ] **Step 1: Write failing graph tests**

Add tests that assert stable node/edge normalization, duplicate removal, cycle-safe traversal, explanation paths, P0/P1/P2 classification, unknown-P0 hold behavior, and secret-value rejection.

- [ ] **Step 2: Run focused unit test and verify RED**

Run: `npx vitest run tests/unit/dependency-intelligence-graph.test.ts`
Expected: FAIL because `packages/architecture-intelligence/src` does not exist.

- [ ] **Step 3: Implement the minimal shared graph contracts and engine**

Required signatures:

```ts
export function buildDependencyGraph(input: {
  nodes: readonly DependencyNode[];
  edges: readonly DependencyEdge[];
}): DependencyGraph;

export function analyzeDependencyImpact(input: {
  graph: DependencyGraph;
  changedNodeIds: readonly string[];
  unresolved?: readonly UnresolvedDependency[];
  globalVerification?: readonly VerificationRequirement[];
}): ImpactReport;

export function validateSafeMetadata(metadata: Record<string, unknown>): void;
```

`ImpactReport` must include `risk: 'P0' | 'P1' | 'P2'`, direct/transitive IDs, required verification, unresolved findings, explanation paths, and recommendation state `CLEAR | CLEAR_WITH_WARNINGS | HOLD_MISSING_VERIFICATION | HOLD_UNKNOWN_DEPENDENCY | BLOCKED_HARD_GATE_FAILURE`.

- [ ] **Step 4: Run focused test and verify GREEN**

Run: `npx vitest run tests/unit/dependency-intelligence-graph.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat(architecture): add dependency impact graph engine`

---

### Task 2: Telephony vertical-slice dependency manifest

**Files:**
- Create: `packages/communication/src/telephony/dependency-manifest.ts`
- Modify: `packages/communication/src/telephony/index.ts` if an index already exists; otherwise do not create a redundant barrel solely for this task.
- Create: `tests/integration/telephony-dependency-intelligence.test.ts`

**Interfaces:**
- Consumes: `DependencyNode`/`DependencyEdge` contracts from Task 1 and canonical Telephony provider/readiness semantics in `packages/communication/src/telephony/core.ts`.
- Produces: `ATLAS_TELEPHONY_DEPENDENCY_MANIFEST` with source/package/module/provider/permission/readiness/test/route relationships and no readiness truth of its own.

- [ ] **Step 1: Write failing Telephony manifest test**

Assert that the manifest includes `package:communication`, `module:connect`, a provider capability/readiness boundary, a Telephony permission node, tests, `/connect`, and source-file provenance; assert no provider is marked connected/verified by the manifest.

- [ ] **Step 2: Run focused integration test and verify RED**

Run: `npx vitest run tests/integration/telephony-dependency-intelligence.test.ts`
Expected: FAIL because the manifest does not exist.

- [ ] **Step 3: Implement the colocated Telephony manifest**

Use only declarative topology/provenance. Provider readiness remains resolved by the existing `AtlasTelephonyProvider.readiness()` boundary.

- [ ] **Step 4: Run focused integration test and verify GREEN**

Run: `npx vitest run tests/integration/telephony-dependency-intelligence.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat(telephony): declare dependency intelligence topology`

---

### Task 3: Repository impact report for the Telephony slice

**Files:**
- Create: `apps/web/src/modules/release/dependencyIntelligence.ts`
- Create: `tests/integration/dependency-intelligence-report.test.ts`

**Interfaces:**
- Consumes: Task 1 graph engine, Task 2 Telephony manifest, `ATLAS_MODULES` from `apps/web/src/modules/registry.ts`.
- Produces: `buildAtlasDependencySnapshot()` and `analyzeAtlasChangeSet(changedPaths: readonly string[]): ImpactReport`.

- [ ] **Step 1: Write failing report test**

Assert that changing `packages/communication/src/telephony/core.ts` yields P1 or stronger risk and includes Connect, Telephony provider readiness, permission verification, Telephony E2E and `/connect` production verification. Assert a docs-only Dependency Intelligence spec change remains P2 with global gates preserved.

- [ ] **Step 2: Run focused integration test and verify RED**

Run: `npx vitest run tests/integration/dependency-intelligence-report.test.ts`
Expected: FAIL because the snapshot/report composer does not exist.

- [ ] **Step 3: Implement deterministic ATLAS snapshot/report composition**

Map canonical module identity from `ATLAS_MODULES`; do not duplicate module title/route/readiness values inside the graph composer.

- [ ] **Step 4: Run focused integration test and verify GREEN**

Run: `npx vitest run tests/integration/dependency-intelligence-report.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat(release): compute ATLAS change impact reports`

---

### Task 4: Release Control UI and protected route

**Files:**
- Create: `apps/web/src/modules/release/AtlasDependencyIntelligencePage.tsx`
- Create: `apps/web/src/modules/release/dependency-intelligence.css`
- Modify: `apps/web/src/extensions/resolveAtlasExtension.tsx`
- Modify: `apps/web/src/modules/integration/AtlasIntegrationHubs.tsx`
- Create: `tests/integration/atlas-dependency-intelligence-route.test.tsx`

**Interfaces:**
- Consumes: `buildAtlasDependencySnapshot()`/`analyzeAtlasChangeSet()` from Task 3 and existing `RequireAtlasIdentity`/Release Control patterns.
- Produces: identity-protected `/release/dependencies` with Architecture Graph summary, Change Impact, Dependency Detail and Drift/Unknowns sections.

- [ ] **Step 1: Write failing route/UI test**

Assert the route is identity-protected, Release Control links to it, the page renders exact analyzed source path/SHA-boundary language, risk, required verification, provenance and unknown state without fake runtime connectivity.

- [ ] **Step 2: Run focused UI test and verify RED**

Run: `npx vitest run tests/integration/atlas-dependency-intelligence-route.test.tsx`
Expected: FAIL because page/route do not exist.

- [ ] **Step 3: Implement the page, route and Release Control card**

Use existing ATLAS design tokens/classes where possible. New CSS must remain responsive at 320/768/1024/1440 widths and support focus-visible/reduced-motion behavior.

- [ ] **Step 4: Run focused UI test and verify GREEN**

Run: `npx vitest run tests/integration/atlas-dependency-intelligence-route.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat(release): add Dependency Intelligence control surface`

---

### Task 5: CI/production verification integration and full gates

**Files:**
- Modify: `data/ops/global-production-verification.json`
- Modify: `tests/integration/global-production-verification.test.ts`
- Create: `tests/integration/dependency-intelligence-contract.test.ts`
- Modify: `package.json` only if a focused dependency-intelligence verification script adds value without duplicating existing `verify:all`.

**Interfaces:**
- Consumes: Tasks 1-4 and existing global production verification contract.
- Produces: fail-closed production route verification for `/release/dependencies` and a machine-readable JSON-serializable `ImpactReport` contract suitable for CI artifacts/comments.

- [ ] **Step 1: Write failing contract/production tests**

Assert `/release/dependencies` is in the global production route matrix, contract version increments by exactly one, `ImpactReport` serializes deterministically, and unresolved P0 findings cannot serialize as `CLEAR`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run tests/integration/dependency-intelligence-contract.test.ts tests/integration/global-production-verification.test.ts`
Expected: FAIL until production contract is updated.

- [ ] **Step 3: Update production verification contract**

Add `/release/dependencies` to `public_routes` and increment the contract version from 32 to 33. Do not weaken any existing required route, header, health or fail-closed behavior.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npx vitest run tests/integration/dependency-intelligence-contract.test.ts tests/integration/global-production-verification.test.ts`
Expected: PASS.

- [ ] **Step 5: Run repository validation**

Run in order:

```bash
npm run typecheck
npm test
npm run build
npm run verify:all
```

Expected: all applicable commands PASS. If `npm audit` or an external check blocks `verify:all`, record the exact independent blocker and do not mislabel the implementation as fully verified.

- [ ] **Step 6: Commit**

Commit message: `test(release): gate Dependency Intelligence in production verification`

---

## Final branch review and delivery

- [ ] Compare the branch against current `main`; reconcile any concurrent Release Control changes without dropping stronger upstream behavior.
- [ ] Verify no secrets or provider values were introduced.
- [ ] Verify the spec and plan remain consistent with the implementation.
- [ ] Open a PR targeting `main` with exact test/build evidence.
- [ ] Require CI/CodeQL/ATLAS gates to pass before merge.
- [ ] Merge only the verified head SHA.
- [ ] Verify the merged SHA deployment and `https://www.atlasenterprisesuite.com/release/dependencies` through the existing fail-closed production-verification path before claiming production completion.
