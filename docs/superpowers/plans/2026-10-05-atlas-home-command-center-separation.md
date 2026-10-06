# ATLAS Home + Command Center Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate the ATLAS visual Home from the technical Command Center while preserving canonical navigation, search, readiness data, and existing system capabilities.

**Architecture:** Keep `FuturisticEnterpriseHome` as the composition root and continue deriving module/navigation state from `ATLAS_MODULES`. Promote the existing sunset visual section into the product Home by adding registry-backed category covers and a compact status strip, then make the existing technical dashboard explicitly the dedicated Command Center section. CSS changes stay in the existing Home stylesheets and no new backend/state source is introduced.

**Tech Stack:** React 18, React Router, TypeScript, CSS, Vitest, Testing Library, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-05-atlas-home-command-center-separation-design.md`

## Global Constraints

- Reuse `/assets/atlas-home-sunset.jpeg`; do not generate or replace the approved image.
- `ATLAS_MODULES` remains the canonical module registry.
- Do not fabricate realtime health percentages, action counts, or connectivity claims.
- Preserve canonical module routes and search behavior.
- Preserve keyboard accessibility, focus-visible states, ARIA live search feedback, responsive behavior, and reduced-motion support.
- No placeholder links or `href="#"` interactions.

## Review Focus

- Registry changes that remove a preferred category route must not crash Home; unavailable covers are omitted.
- Duplicate route labels must not create duplicate category covers.
- Empty search remains non-navigating and announces its validation message.
- Narrow mobile widths must keep the status strip and category covers usable without horizontal page overflow.
- The Command Center metrics must still reflect current registry readiness counts, not hard-coded values.

---

### Task 1: Define the Home/Command Center product contract with failing tests

**Files:**
- Modify: `tests/unit/futuristic-enterprise-home.test.tsx`

**Interfaces:**
- Consumes: `FuturisticEnterpriseHome`, canonical React Router destinations.
- Produces: test contract for category covers, compact Home status, and dedicated Command Center semantics.

- [ ] **Step 1: Write failing tests**

Add assertions that:
- Home exposes a navigation region named `ATLAS primary surfaces` with links for AI, Enterprise, Finance, Network, Spatial, Health, Business, Creator, Security, and Cloud when their canonical routes exist.
- Home exposes a status element named `ATLAS system status` whose text includes the registry-derived operational and integration counts.
- The technical section is a region named `ATLAS Command Center` and includes the existing readiness summary.
- The visual Home no longer labels the transition as the generic `Entrar a ATLAS`; it exposes `Abrir Command Center` pointing to `#atlas-command-center`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/unit/futuristic-enterprise-home.test.tsx`

Expected: FAIL because the approved category-cover/status/Command Center contract is not yet implemented.

- [ ] **Step 3: Commit the RED test contract**

Commit message: `test(home): define home and command center separation`

---

### Task 2: Implement the registry-backed Home and explicit Command Center

**Files:**
- Modify: `apps/web/src/components/FuturisticEnterpriseHome.tsx`

**Interfaces:**
- Consumes: `ATLAS_MODULES` fields `id`, `title`, `navLabel`, `area`, `route`, `readiness`, `showInNavigation`.
- Produces: `primarySurfaceModules` derived list; accessible Home surface navigation; compact truthful status; `#atlas-command-center` region.

- [ ] **Step 1: Add registry-backed primary surfaces**

Create presentation metadata only for the preferred surface names/order and resolve those entries against `ATLAS_MODULES` by route/title/nav label. Omit any unavailable surface instead of inventing a destination.

Preferred order: AI, Enterprise, Finance, Network, Spatial, Health, Business, Creator, Security, Cloud.

- [ ] **Step 2: Replace the top quick-link-only emphasis with a primary surfaces cover region**

Expose semantic navigation labelled `ATLAS primary surfaces`. Each cover must route to its resolved canonical module destination and show a compact area/category descriptor.

- [ ] **Step 3: Add compact truthful Home status**

Expose an element labelled `ATLAS system status` using only registry-derived values: implemented modules and external-gated integrations. Do not display a fabricated percentage or action count.

- [ ] **Step 4: Promote the existing technical dashboard to the dedicated Command Center**

Change the technical section id to `atlas-command-center`, label the region `ATLAS Command Center`, and make the Home transition link read `Abrir Command Center` and target `#atlas-command-center`.

- [ ] **Step 5: Run the focused unit test and verify GREEN**

Run: `npm test -- tests/unit/futuristic-enterprise-home.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat(home): separate visual home from command center`

---

### Task 3: Implement responsive visual hierarchy and accessibility polish

**Files:**
- Modify: `apps/web/src/components/atlas-visual-home.css`
- Modify only if required for Command Center heading/region styling: `apps/web/src/components/futuristic-enterprise-home.css`
- Modify: `tests/unit/futuristic-enterprise-home.test.tsx` if additional semantic assertions are required.

**Interfaces:**
- Consumes: class names introduced in Task 2.
- Produces: responsive category-cover grid/rail, readable compact status strip, preserved photo prominence, focus and reduced-motion behavior.

- [ ] **Step 1: Add a regression assertion for semantic status and primary surface navigation**

Ensure tests query the UI by accessible role/name rather than styling classes.

- [ ] **Step 2: Style the Home hierarchy**

Keep the photograph dominant. Add translucent category covers below the command search, a compact status strip, and a clear Command Center affordance without large opaque panels over the sky.

- [ ] **Step 3: Add responsive behavior**

Desktop: balanced multi-column cover grid/rail.
Tablet: reduced columns with touch-friendly sizing.
Mobile: horizontally scrollable or compact two-column navigation contained within viewport; no document-level horizontal overflow.

- [ ] **Step 4: Preserve accessibility states**

Maintain visible `:focus-visible`, sufficient text contrast, reduced-motion behavior, and minimum practical touch targets.

- [ ] **Step 5: Run focused tests, typecheck, design verification, and build**

Run:
- `npm test -- tests/unit/futuristic-enterprise-home.test.tsx`
- `npm run typecheck`
- `npm run verify:design`
- `npm run build`

Expected: all PASS.

- [ ] **Step 6: Commit**

Commit message: `style(home): refine home command center hierarchy`

---

### Task 4: Integration, PR, CI, merge, and production verification

**Files:**
- No source changes unless CI identifies a real defect.

**Interfaces:**
- Consumes: branch commits from Tasks 1-3.
- Produces: reviewed PR, green CI, merged main, and verified production routes.

- [ ] **Step 1: Open PR**

Title: `feat(home): separate visual home from command center`

Describe the approved product hierarchy, reuse of the sunset asset, truthful registry-derived status, and preserved Command Center capabilities.

- [ ] **Step 2: Verify GitHub Actions**

Required checks must pass, including unit/build/production-readiness, accessibility/design validation, and security gates configured by the repository.

- [ ] **Step 3: Review the complete branch diff**

Confirm no duplicate registry, fake telemetry, placeholder routes, or unrelated changes were introduced.

- [ ] **Step 4: Merge only after green CI**

Use the repository-supported merge method with the expected PR head SHA.

- [ ] **Step 5: Verify production fail-closed**

Run/observe the repository production deployment verification and confirm existing P0 public routes pass. The deployment is not considered verified if a P0 route fails.
