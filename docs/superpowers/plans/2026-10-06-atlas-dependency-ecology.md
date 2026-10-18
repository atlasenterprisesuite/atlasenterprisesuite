# ATLAS Dependency Ecology Graph Implementation Plan

**Goal:** Add a deterministic dependency/ownership graph contract that reuses the canonical module registry, proves module-to-route ownership, and refuses to invent runtime dependencies.

**Architecture:** One release-domain file plus focused unit tests. No UI, database, provider, route, or new source of truth.

## Task 1 — RED contracts

Create `tests/unit/atlas-dependency-ecology.test.ts`.

Tests must initially fail because the implementation does not exist.

Cover:

- canonical module and route nodes;
- exactly one `exposes` edge per registry module;
- stable deterministic ordering;
- no generated `depends-on` edges in registry-only scope;
- explicit `runtimeDependencyCoverage: 'not-evaluated'`;
- orphan endpoint finding;
- duplicate edge finding;
- conflicting route-owner finding;
- self-dependency finding;
- dependency-cycle finding.

Commit RED tests only.

## Task 2 — GREEN implementation

Create `apps/web/src/modules/release/dependency-ecology.ts`.

Implement immutable types and pure functions:

- `AtlasDependencyNode`
- `AtlasDependencyEdge`
- `AtlasDependencyEcology`
- `buildRegistryDependencyEcology(modules)`
- `validateDependencyEcology(graph)`

Do not infer module runtime dependencies from navigation, area, visual grouping, or Galaxy metadata.

Run focused tests until green and commit implementation.

## Task 3 — Regression boundary

Run:

- dependency ecology tests;
- evolution tests;
- module-registry tests;
- Gestation tests;
- TypeScript contract.

If a regression exists, repair only branch-caused defects.

## Task 4 — Governed PR

Open a PR to `main` documenting:

- reuse of the existing Cloud Live Service Graph;
- distinction among navigation, execution, and runtime dependency semantics;
- RED/GREEN evidence;
- exact graph coverage and remaining unverified dependency classes.

Wait for required CI/security checks. Merge only on green.

## Task 5 — Production verification

After merge:

- verify merged SHA equals `main`;
- verify Cloudflare deployment workflow;
- verify canonical production contract/global deployment gate;
- keep production status incomplete if exact-SHA evidence is absent.

## Next wave

Once this graph contract is production-verified, proceed to the Static Architecture Auditor and use source-import analysis as one evidence producer for explicit dependency edges rather than as a replacement source of truth.
