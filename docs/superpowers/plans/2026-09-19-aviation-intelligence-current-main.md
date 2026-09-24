# ATLAS Aviation Intelligence — Current Main Execution Plan

**Goal:** Integrate the approved Aviation Intelligence experience into current ATLAS without duplicating architecture.

**Spec:** `docs/superpowers/specs/2026-09-19-aviation-intelligence-current-main-design.md`

## Task 1 — Canonical registration and protected route family

RED: `tests/integration/aviation-routing.test.tsx` requires the Aviation module in the canonical registry and the full route family behind `RequireAtlasIdentity`.

GREEN:
- add registry entry
- add `apps/web/src/modules/aviation/AviationRoutes.tsx`
- add minimal Aviation home
- wire `resolveAtlasExtension`

Verification:
- targeted routing/registry tests
- typecheck
- build

## Task 2 — Truthful ten-model concept catalog

RED:
- unit tests require exactly ten internal concept models
- engineering metrics are nullable
- no concept can report certified/operational/investable as fact
- search and category filters are deterministic

GREEN:
- `aviation-model.ts`
- `aviation-concepts.ts`
- `aviation-catalog.ts`
- aircraft catalog page

## Task 3 — Aircraft detail and evidence-aware states

RED:
- unknown aircraft yields controlled not-found state
- detail exposes concept status and unvalidated metrics
- evidence data renders provenance/stale/conflict states
- tabs are accessible

GREEN:
- detail page
- evidence/status utilities
- responsive Aviation CSS

## Task 4 — Certification and investment intelligence boundaries

RED:
- certification timeline never upgrades beyond evidence
- investment values may be null/stale
- no transaction CTA
- official-source action appears only with validated URL

GREEN:
- certification page/model
- read-only investment tab
- risk disclosure

## Task 5 — Saved/alerts durable boundary and final verification

RED:
- saved/alerts cannot claim persistence if backend is not configured
- restricted/not-configured states are explicit

GREEN:
- use existing durable ATLAS/Supabase pattern if a compatible scoped store exists
- otherwise ship truthful not-configured boundary, with no fake save success

Final:
- typecheck
- unit/integration tests
- build
- CodeQL/feature CI
- PR review
- no merge/deploy until final branch verification is green
