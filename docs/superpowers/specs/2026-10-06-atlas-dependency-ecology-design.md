# ATLAS Dependency Ecology Graph

**Date:** 2026-10-06

## Purpose

This subproject is the next verified audit wave after the production-verified Evolution Kernel foundation. It gives ATLAS a deterministic dependency/ownership graph contract without inventing runtime relationships and without creating a parallel source of truth.

## Existing foundations to reuse

- `apps/web/src/modules/registry.ts` remains the canonical module identity and route owner.
- `apps/web/src/modules/cloud/AtlasCloudOperations.tsx` already exposes a Live Service Graph from `atlas_module_registry` and explicitly refuses to invent cross-service edges.
- `apps/web/src/navigation/atlasNavigation.ts` is a navigation graph only; it must not be reclassified as runtime dependency evidence.
- ATLAS Galaxy visual dependencies are presentation/navigation metadata, not proof of runtime coupling.
- `apps/web/src/execution/types.ts` contains task/step dependency records; those are workflow-execution dependencies, not module runtime dependencies.
- `apps/web/src/modules/release/evolution.ts` remains the audit/DNA contract and severity authority.

## Core rule

**A visible relationship is not automatically a runtime dependency.**

The Dependency Ecology Graph separates relationship classes so ATLAS cannot silently turn navigation, spatial layout, or UI grouping into architectural truth.

## Node types

Initial contract:

- `module`
- `route`

Future-compatible types may later include `workflow`, `data-owner`, `provider`, `service`, `event`, and `evidence`, but this first slice does not fabricate them.

## Edge types

Initial verified edge:

- `exposes`: module -> canonical route.

Reserved for later evidence-backed slices:

- `depends-on`
- `reads`
- `writes`
- `supports`
- `triggers`
- `verifies`

The first slice MUST NOT generate `depends-on` edges from route adjacency, menu structure, Galaxy coordinates, shared area labels, or visual grouping.

## Evidence contract

Every edge carries:

- stable ID;
- source node;
- target node;
- relationship;
- evidence kind;
- evidence reference.

Initial registry edges use evidence kind `canonical-registry` and reference the module ID plus route.

Future runtime dependency edges require explicit source evidence such as source import analysis, trace evidence, workflow contract, provider contract, or governed declaration.

## Deterministic validations

The graph validator emits structured findings for:

1. orphan source/target node;
2. duplicate edge identity;
3. conflicting route ownership;
4. self `depends-on` edges;
5. cycles composed only of `depends-on` edges.

Findings use the existing ATLAS audit severity vocabulary and stable IDs.

## First-slice output

`buildRegistryDependencyEcology(ATLAS_MODULES)` produces:

- one module node per canonical registry entry;
- one route node per canonical route;
- one `module -> route` `exposes` edge per entry;
- deterministic ordering;
- zero invented module-to-module runtime dependency edges;
- coverage metadata stating runtime dependency coverage is `not-evaluated`.

## UI boundary

No new top-level UI is created. The existing ATLAS Cloud Live Service Graph is the eventual visualization surface after deeper dependency evidence exists. This slice only stabilizes the underlying contract.

## Success criteria

- canonical module/route ownership is represented exactly once;
- malformed graphs fail closed with deterministic findings;
- route/navigation relationships cannot be misrepresented as runtime coupling;
- no database, provider, route, or shadow registry is added;
- tests prove deterministic ordering and cycle/orphan/conflict detection;
- full CI, security, merge, deployment, and exact-SHA production verification pass before the slice is considered production-verified.
