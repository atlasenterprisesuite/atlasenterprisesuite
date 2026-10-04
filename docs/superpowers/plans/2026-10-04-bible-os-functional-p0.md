# ATLAS Bible OS Functional P0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first functional, evidence-first ATLAS Bible OS surface at `/knowledge/bible`, backed by canonical seed metadata, explicit uncertainty labels, and fail-closed production verification.

**Architecture:** Bible OS remains a specialized surface under Knowledge Atlas, not a separate knowledge silo. A focused `BibleOSPage` renders immutable seed metadata for canon profiles, manuscript/source registry, textual-variant examples, and relationship-graph edges; the main resolver routes `/knowledge/bible` through the existing identity boundary. The production verification contract treats `/knowledge/bible` as a required public module route while the UI clearly labels seed/demo evidence as curated reference data rather than a complete reconstructed Bible.

**Tech Stack:** React + TypeScript + Vite + Vitest; existing ATLAS extension resolver and CSS utility classes; JSON/TypeScript seed data; GitHub Actions production verification + Cloudflare Worker deployment.

**Spec:** `docs/knowledge/bible-os/ATLAS_BIBLE_OS_CRITICAL_TEXT_SPEC.md`

## Global Constraints

- Source first: every textual claim must resolve to one or more sources.
- No invented certainty: disputed readings remain disputed.
- Canon-neutral storage: no single hard-coded canon may be presented as universally authoritative.
- Faith/history separation: theological claims, historical claims, and textual-critical conclusions remain distinguishable.
- Copyright-safe: only metadata and short public-domain/reference snippets belong in the initial seed.
- Existing ATLAS identity, provenance, audit and production verification boundaries must be reused rather than duplicated.
- The initial surface must not claim that manuscript ingestion or a complete critical edition exists.

## Review Focus

- Unknown/unsupported Bible OS subpaths must not silently masquerade as implemented features.
- Canon counts and labels must not imply one tradition is universally authoritative.
- Manuscript metadata must include source URLs and explicit confidence/status fields.
- Variant examples must not be labelled as autographs or definitive original text.
- Production verification must include `/knowledge/bible` and fail if that route is not served by the deployed SHA.

---

### Task 1: Functional Bible OS contract test

**Files:**
- Create: `tests/integration/bible-os-functional-p0.test.ts`

**Interfaces:**
- Consumes: current Knowledge Atlas resolver, module registry, production route contract, and Bible OS spec.
- Produces: regression contract requiring `/knowledge/bible`, `BibleOSPage`, five visible P0 surfaces, evidence labels, source registry links, and production verification coverage.

- [ ] **Step 1: Write the failing test** asserting the route, page, canonical tabs/surfaces, source registry, uncertainty language, and production verification contract.
- [ ] **Step 2: Run the test in CI and verify RED** because `BibleOSPage` and `/knowledge/bible` do not exist yet.
- [ ] **Step 3: Commit the test only.**

### Task 2: Bible OS evidence seed and UI

**Files:**
- Create: `apps/web/src/modules/knowledge/bible/bibleOsData.ts`
- Create: `apps/web/src/modules/knowledge/bible/BibleOSPage.tsx`

**Interfaces:**
- Consumes: React and existing ATLAS page/card CSS classes.
- Produces: `BibleOSPage` and typed seed exports for canon profiles, manuscripts, variants, graph edges, and source registry.

- [ ] **Step 1: Implement the minimal typed evidence seed** with source URLs, confidence/status labels, and no unsupported completeness claims.
- [ ] **Step 2: Implement `BibleOSPage`** with Overview, Canon Matrix, Manuscripts, Variant Explorer, Relationship Graph, and a visible provenance/limitations panel.
- [ ] **Step 3: Keep all graph information accessible as text/table-like cards; do not rely on color alone.**
- [ ] **Step 4: Run the focused CI test and verify GREEN for the page/data contract.**

### Task 3: Route and module integration

**Files:**
- Modify: `apps/web/src/extensions/resolveAtlasExtension.tsx`
- Modify: `apps/web/src/modules/registry.ts`

**Interfaces:**
- Consumes: `BibleOSPage` from Task 2.
- Produces: authenticated `/knowledge/bible` route and a hidden child module registry entry that identifies Bible OS as part of Intelligence/Knowledge.

- [ ] **Step 1: Route `/knowledge/bible` before the exact `/knowledge` branch through `RequireAtlasIdentity`.**
- [ ] **Step 2: Add `bible-os` registry metadata without creating a second top-level navigation item.**
- [ ] **Step 3: Run the focused test and relevant Knowledge Atlas integration tests.**

### Task 4: Fail-closed production route coverage

**Files:**
- Modify: `data/ops/global-production-verification.json`
- Modify: `tests/integration/global-production-verification.test.ts`
- Modify: `supabase/functions/atlas-cloudflare-production-http-verify/index.ts`
- Modify: `.github/workflows/global-production-verify.yml` only if the authorized check needs an explicit Bible OS boolean.

**Interfaces:**
- Consumes: deployed `/knowledge/bible` route from Task 3.
- Produces: required production verification for `/knowledge/bible`, including authorized runtime verification when Cloudflare challenge fallback is used.

- [ ] **Step 1: Add `/knowledge/bible` to the canonical public route contract and test expectation.**
- [ ] **Step 2: Ensure the authorized verifier probes `/knowledge/bible` and exposes `bible_os_route_reachable`.**
- [ ] **Step 3: Require that boolean in fail-closed global verification.**
- [ ] **Step 4: Run production-verification integration tests and focused Bible OS test.**

### Task 5: Full verification and production evidence

**Files:**
- No new production files expected.

**Interfaces:**
- Consumes: Tasks 1-4.
- Produces: CI, merge and exact-SHA production evidence.

- [ ] **Step 1: Run/observe full repository readiness CI and CodeQL on the PR.**
- [ ] **Step 2: Fix any failures using RED→GREEN discipline.**
- [ ] **Step 3: Merge only after required checks are green.**
- [ ] **Step 4: Verify the resulting main SHA through Cloudflare deployment, authorized runtime fallback if challenged, and `/knowledge/bible` exact-SHA production evidence.**
- [ ] **Step 5: Report remaining scope honestly: this P0 is a functional research shell with curated seed evidence, not a complete reconstructed Bible or manuscript corpus.**
