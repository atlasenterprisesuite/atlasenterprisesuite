# ATLAS Animal Kingdom Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first functional ATLAS Knowledge Atlas → Animal Kingdom experience with evidence-backed animal records, search/filtering, species details, Supabase schema, tests, navigation and truthful source-state reporting.

**Architecture:** Keep scientific filtering/domain logic in a focused pure TypeScript package, keep curated seed data separate from UI, add a Knowledge/Animals React module that can read Supabase through the existing ATLAS session boundary and fall back to repository-curated records without pretending that fallback is live. Add a read-only RLS-backed Supabase schema and integrate routes into the existing Vite/React ATLAS shell.

**Tech Stack:** React 18, React Router, TypeScript, Vite, Vitest, Supabase PostgreSQL/PostgREST, existing ATLAS session utilities.

**Spec:** `docs/superpowers/specs/2026-09-08-atlas-animal-kingdom-design.md`

## Global Constraints

- Canonical repository is `atlasenterprisesuite/atlasenterprisesuite`.
- Production backend authority is Supabase `atlas-core` (`ggmanzcgtlrvqfoccgsh`).
- Do not claim all animal species are loaded; report only records actually present.
- Scientific ecological roles and evidence-backed facts must remain separate from religious/philosophical interpretation.
- No service-role keys, secrets or privileged credentials in browser/source code.
- New Supabase tables must have RLS and browser writes denied.
- No dead routes, empty controls, fake metrics or fabricated conservation data.
- Existing Finance, Health, Identity and Voice functionality must remain intact.

---

### Task 1: Domain model and filtering

**Files:**
- Create: `packages/knowledge/animal-atlas.ts`
- Create: `tests/unit/knowledge-animal-atlas.test.ts`

**Interfaces:**
- Produces: `AnimalTaxon`, `AnimalAtlasFilter`, `filterAnimalTaxa(records, filter)`, `animalRoleOptions(records)`, `animalGroupOptions(records)`.

- [ ] **Step 1: Write failing unit tests** for case-insensitive text search across common/scientific names, role filtering, group filtering, composed filters and empty results.
- [ ] **Step 2: Run the focused test** and verify failure is caused by the missing module.
- [ ] **Step 3: Implement minimal pure filtering/model code.** Normalize search text with trim/lowercase, compose every active filter, never substitute fallback rows.
- [ ] **Step 4: Run the focused test and verify pass.**
- [ ] **Step 5: Commit the task.**

### Task 2: Curated evidence seed

**Files:**
- Create: `data/knowledge/animalAtlasSeed.ts`
- Modify: `tests/unit/knowledge-animal-atlas.test.ts`

**Interfaces:**
- Produces: `animalAtlasSeed: AnimalTaxon[]`.

- [ ] **Step 1: Add failing seed assertions** for `Plecia nearctica`, its full taxonomy, decomposer/nutrient-recycling role and UF/IFAS + GBIF source metadata.
- [ ] **Step 2: Run the focused test and verify the new assertions fail.**
- [ ] **Step 3: Add the evidence-backed initial dataset** across the approved representative animal groups. Every record must include at least one real source and a review date.
- [ ] **Step 4: Run unit tests and verify pass.**
- [ ] **Step 5: Commit the task.**

### Task 3: Supabase read-only knowledge schema

**Files:**
- Create: `supabase/migrations/20260908_knowledge_animal_atlas.sql`
- Create: `tests/integration/knowledge-animal-supabase-contract.test.ts`

**Interfaces:**
- Produces tables `knowledge_animal_taxa`, `knowledge_animal_roles`, `knowledge_animal_sources`.

- [ ] **Step 1: Add a migration contract test** that asserts the SQL enables RLS on all three tables, defines authenticated SELECT policies and does not grant ordinary browser INSERT/UPDATE/DELETE policies.
- [ ] **Step 2: Run the focused contract test and verify failure before the migration exists.**
- [ ] **Step 3: Write idempotent-safe DDL** with UUID primary keys, timestamps, structured taxonomy JSON, arrays/JSON fields only where appropriate, foreign keys, indexes and RLS.
- [ ] **Step 4: Run the contract test and verify pass.**
- [ ] **Step 5: Apply the migration to authoritative `atlas-core` only after the SQL contract is verified.**
- [ ] **Step 6: Run Supabase security/performance advisors and record any actionable findings.**
- [ ] **Step 7: Commit the task.**

### Task 4: Live/fallback data adapter

**Files:**
- Modify: `apps/web/src/lib/atlasSession.ts`
- Create: `apps/web/src/modules/knowledge/animals/animalAtlasData.ts`
- Create: `tests/unit/knowledge-animal-data.test.ts`

**Interfaces:**
- Produces: `getAnimalAtlasRecords(): Promise<{source: 'supabase_live' | 'repository_curated'; records: AnimalTaxon[]; loadedAt: string}>`.

- [ ] **Step 1: Add failing tests** for truthful `repository_curated` fallback and normalized live rows.
- [ ] **Step 2: Verify failure before adapter implementation.**
- [ ] **Step 3: Reuse the existing publishable-key/session boundary** for authenticated reads. Do not expose service credentials.
- [ ] **Step 4: Implement the fallback path** so missing authentication/network/database data yields the curated evidence dataset and a truthful source label.
- [ ] **Step 5: Run focused tests and verify pass.**
- [ ] **Step 6: Commit the task.**

### Task 5: Functional Animal Kingdom UI

**Files:**
- Create: `apps/web/src/modules/knowledge/animals/AnimalAtlasPage.tsx`
- Create: `apps/web/src/modules/knowledge/animals/animal-atlas.css`
- Create: `tests/integration/animal-atlas-route.test.tsx`

**Interfaces:**
- Produces: `AnimalAtlasPage`, `AnimalDetailPage`.

- [ ] **Step 1: Add failing route/component tests** for loaded records, text search, group filtering, role filtering, empty state and lovebug detail/source display.
- [ ] **Step 2: Verify failure before the pages exist.**
- [ ] **Step 3: Build the list page** with search, filters, deterministic count, source-state notice, responsive cards and actual navigation.
- [ ] **Step 4: Build the detail page** with taxonomy breadcrumb/list, ecology, habitat, diet, reproduction, human relevance, risks and evidence links.
- [ ] **Step 5: Add loading/error/empty states.**
- [ ] **Step 6: Run focused integration tests and verify pass.**
- [ ] **Step 7: Commit the task.**

### Task 6: ATLAS navigation and routing

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/AtlasShell.tsx`
- Modify: `apps/web/src/main.tsx` only if stylesheet import wiring requires it.
- Modify: `tests/integration/animal-atlas-route.test.tsx`

**Interfaces:**
- Routes: `/knowledge/animals`, `/knowledge/animals/:slug`.

- [ ] **Step 1: Extend failing integration tests** to exercise the real `App` router and sidebar navigation.
- [ ] **Step 2: Verify the route is absent/failing before wiring.**
- [ ] **Step 3: Add Knowledge Atlas card on Enterprise home.**
- [ ] **Step 4: Add `Knowledge` to the shell navigation.**
- [ ] **Step 5: Register both Animal Kingdom routes without disturbing existing routes.**
- [ ] **Step 6: Run integration tests and verify pass.**
- [ ] **Step 7: Commit the task.**

### Task 7: Verification and production evidence

**Files:**
- Modify only if verification uncovers defects.

- [ ] **Step 1: Run `npm test`.** Expected: all test suites pass.
- [ ] **Step 2: Run `npm run typecheck`.** Expected: no TypeScript errors.
- [ ] **Step 3: Run `npm run build`.** Expected: successful Vite production build.
- [ ] **Step 4: Inspect changed files for secrets, dead routes and misleading live/production labels.**
- [ ] **Step 5: Open a PR from `feat/animal-kingdom-atlas-foundation` to `main`.**
- [ ] **Step 6: Inspect PR checks and diff.** If GitHub-hosted runners remain unavailable, record that limitation separately rather than treating it as a code failure.
- [ ] **Step 7: Merge only after source-level verification is satisfactory and no unresolved code/security blocker remains.**
- [ ] **Step 8: Verify the merged commit through the configured Cloudflare production path and public `/knowledge/animals` route before calling the module production-live.**
