# ATLAS Module Visual Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four generic rotating `/suite` images with a production-grade, module-ID-driven visual collection in which every canonical ATLAS module has a unique, semantically appropriate, responsive and quality-gated cover.

**Architecture:** Add one canonical visual manifest keyed by `AtlasModuleDefinition['id']`, generate responsive AVIF/WebP derivatives from high-resolution masters, render all Suite cards through one responsive visual component, and extend the existing design gate with deterministic asset-quality verification. Keep routing, readiness/evolution semantics and module functionality unchanged.

**Tech Stack:** React 18, TypeScript 5.7, Vite 6, Vitest 5, Node.js ESM scripts, `sharp` for image derivative generation/metadata inspection, CSS responsive images, GitHub Actions/ATLAS existing fail-closed verification.

**Spec:** `docs/superpowers/specs/2026-10-05-atlas-module-visual-collection-design.md`

## Global Constraints

- Every canonical `module.id` must have exactly one visual contract.
- Primary Systems and A-Z module cards must resolve visuals from the same module-ID keyed source of truth.
- No production `/suite` card may use index-based image rotation.
- Master sources must be large enough to preserve sharpness at 1× and 2× DPR for the intended card envelope; target committed masters at `>= 2048px` wide unless a portrait/crop exception is explicitly documented.
- Production variants: `640`, `1280`, and `1920` pixel widths in AVIF and WebP.
- Preserve aspect ratio; cropping may use `object-fit: cover`; stretching is forbidden.
- Decorative cover imagery uses empty `alt`; operational/readiness/evolution state remains textual.
- Missing metadata, missing asset files, duplicate unrelated module assignment, undersized master or tiny placeholder output fails the image-quality gate.
- Existing public production health/security/route gates remain fail-closed and may not be bypassed.
- `IMAGE QUALITY GATE: PASS únicamente si no hay pixelación visible a 1×/2× DPR, deformación, compresión perceptible ni pérdida de detalle.`

## File Structure

- Create `apps/web/src/modules/integration/moduleVisuals.ts` — typed visual families, per-module metadata, focal positions and responsive source helpers.
- Create `apps/web/src/modules/integration/ModuleVisual.tsx` — one reusable `<picture>` renderer for Primary Systems and A-Z cards.
- Modify `apps/web/src/modules/integration/AtlasSuitePage.tsx` — remove `COVER_ASSETS` rotation and resolve visuals by module ID.
- Modify `apps/web/src/modules/integration/atlas-suite.css` — focal-position CSS variables, responsive crop treatment and contrast-safe overlays.
- Create `scripts/generate-module-visuals.mjs` — deterministic AVIF/WebP derivative generator using `sharp`.
- Create `scripts/verify-module-visuals.mjs` — completeness, existence, dimensions, sizes, uniqueness and placeholder checks.
- Modify `scripts/verify-atlas-design.mjs` — invoke/compose the module visual quality gate under existing `verify:design`.
- Modify `package.json` / `package-lock.json` — add `sharp` dev dependency and optional visual-generation helper script.
- Modify `tests/unit/atlas-suite-registry.test.ts` — replace legacy cover expectations with module-ID driven contract assertions.
- Create `tests/unit/module-visuals.test.ts` — manifest completeness, path, responsive source, focal and uniqueness contract tests.
- Create `apps/web/public/atlas/visuals/modules/<module-id>/...` — master plus responsive AVIF/WebP derivatives for all canonical modules.

## Review Focus

- Registry drift: adding a new module without a visual must fail CI rather than silently show a fallback.
- Narrow-screen crops: focal subjects must stay visible at mobile card widths without stretched imagery.
- Tiny/failed generations: a technically valid but undersized or suspiciously tiny asset must fail the gate.
- Duplicate art: unrelated modules may not accidentally share the same master/derivatives.
- Legacy dependency cleanup: generic `/atlas/design/*` files must not be deleted while another route still references them.

---

### Task 1: Canonical Module Visual Contract

**Files:**
- Create: `apps/web/src/modules/integration/moduleVisuals.ts`
- Create: `tests/unit/module-visuals.test.ts`
- Modify: `tests/unit/atlas-suite-registry.test.ts`

**Interfaces:**
- Consumes: `ATLAS_MODULES`, `AtlasModuleDefinition` from `apps/web/src/modules/registry.ts`.
- Produces: `AtlasModuleVisual`, `MODULE_VISUALS`, `getModuleVisual(moduleId)`, and responsive path metadata used by later tasks.

- [ ] **Step 1: Write failing manifest completeness tests.** Assert every `ATLAS_MODULES` ID exists exactly once in `MODULE_VISUALS`, every entry has `family`, `focalPoint`, `master`, `avif[640|1280|1920]`, `webp[640|1280|1920]`, and no unrelated IDs resolve to one shared master.
- [ ] **Step 2: Run `npm test -- --run tests/unit/module-visuals.test.ts tests/unit/atlas-suite-registry.test.ts`.** Expected: FAIL because `moduleVisuals.ts` does not exist and Suite still expects `COVER_ASSETS`.
- [ ] **Step 3: Implement the typed visual manifest.** Use exact signatures `getModuleVisual(moduleId: AtlasModuleDefinition['id']): AtlasModuleVisual` and explicit module-ID entries; no index or hash fallback.
- [ ] **Step 4: Update the Suite registry test to forbid `COVER_ASSETS` and `% COVER_ASSETS.length`, and require `getModuleVisual`/`MODULE_VISUALS` usage.**
- [ ] **Step 5: Re-run the focused tests.** Expected: manifest contract passes except asset-file existence checks, which belong to Task 2.
- [ ] **Step 6: Commit:** `test(visuals): define module visual contract`.

### Task 2: Automated Image Quality Pipeline

**Files:**
- Create: `scripts/generate-module-visuals.mjs`
- Create: `scripts/verify-module-visuals.mjs`
- Modify: `scripts/verify-atlas-design.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tests/unit/module-visuals.test.ts`

**Interfaces:**
- Consumes: manifest asset paths from Task 1 and source masters under each module directory.
- Produces: deterministic `cover-640|1280|1920.avif|webp` files and a fail-closed verifier used by `npm run verify:design`.

- [ ] **Step 1: Add failing tests/fixtures for missing files, an undersized master, duplicate master paths and an invalid focal point.** Each case must produce a non-zero verifier result or rejected validation function.
- [ ] **Step 2: Run focused tests.** Expected: FAIL because no verifier exists.
- [ ] **Step 3: Add `sharp` as a root dev dependency and implement `scripts/generate-module-visuals.mjs`.** Input: module ID and high-resolution source path; output: normalized master WebP plus AVIF/WebP widths 640/1280/1920 without aspect-ratio distortion.
- [ ] **Step 4: Implement `scripts/verify-module-visuals.mjs`.** Validate manifest coverage against the canonical registry, path existence, master metadata `width >= 2048` by default, derivative dimensions, non-zero/sane file-size floor, focal syntax and duplicate assignments.
- [ ] **Step 5: Compose the visual verifier into `scripts/verify-atlas-design.mjs`.** A module visual failure must make `npm run verify:design` exit non-zero.
- [ ] **Step 6: Run verifier-focused unit tests and `npm run verify:design`.** Expected: quality fixtures behave correctly; real collection still fails until Task 3 supplies assets.
- [ ] **Step 7: Commit:** `feat(visuals): add fail-closed image quality gate`.

### Task 3: Produce the 38-Module ATLAS Visual Collection

**Files:**
- Create/replace: `apps/web/public/atlas/visuals/modules/<module-id>/master.webp`
- Create: matching `cover-640|1280|1920.avif|webp` derivatives for every canonical module.
- Modify only if required: `apps/web/src/modules/integration/moduleVisuals.ts` focal points and family metadata.

**Interfaces:**
- Consumes: Task 1 manifest and Task 2 generator/verifier.
- Produces: complete visual asset set consumed by UI tasks.

- [ ] **Step 1: Generate masters in controlled family batches using the approved ATLAS art direction.** Families: Intelligence/Platform; Business/Finance/Operations; People/Health/Protection/Creative; Communications/Entertainment/Hospitality/Mobility/Spatial. Every module receives unique art tied to its function; no stock-brand marks or third-party UI copies.
- [ ] **Step 2: For each generated master, run `node scripts/generate-module-visuals.mjs <module-id> <source-file>` and inspect the generated master/derivatives.** Reject blur, malformed geometry, unreadable focal hierarchy, obvious generation defects or subject mismatch before keeping the asset.
- [ ] **Step 3: Run `node scripts/verify-module-visuals.mjs`.** Expected: PASS for all canonical module IDs and all responsive derivatives.
- [ ] **Step 4: Review representative desktop/mobile crops from every visual family and adjust `focalPoint` values where the subject is clipped.**
- [ ] **Step 5: Commit assets in reviewable family batches rather than one opaque binary dump.** Commit messages use `feat(visuals): add <family> module covers`.

### Task 4: Responsive Module Visual Renderer

**Files:**
- Create: `apps/web/src/modules/integration/ModuleVisual.tsx`
- Modify: `apps/web/src/modules/integration/AtlasSuitePage.tsx`
- Modify: `tests/unit/atlas-suite-registry.test.ts`
- Create or modify: component-level Suite visual test under `tests/unit/` if an existing DOM-render test pattern is available.

**Interfaces:**
- Consumes: `getModuleVisual(moduleId)` from Task 1.
- Produces: `ModuleVisual({ moduleId, className?, priority? })` rendering `<picture>` with AVIF source, WebP source and deterministic fallback image.

- [ ] **Step 1: Write failing assertions that AI/Finance/Ride cards resolve their own module IDs, render AVIF/WebP `srcSet` with `640w, 1280w, 1920w`, and do not use `index` to select covers.**
- [ ] **Step 2: Run focused tests.** Expected: FAIL because `ModuleVisual` is absent and Suite still renders generic `<img>` paths.
- [ ] **Step 3: Implement `ModuleVisual`.** Use `sizes` appropriate to primary/A-Z cards, `loading="lazy"` below fold, `decoding="async"`, width/height or aspect-ratio reservation, and focal-point CSS variable from metadata.
- [ ] **Step 4: Replace Primary Systems and A-Z direct image logic with `ModuleVisual`.** Primary entries with canonical module IDs use the same resolver; the Enterprise aggregate card gets an explicit aggregate visual contract rather than index rotation.
- [ ] **Step 5: Run focused tests.** Expected: PASS.
- [ ] **Step 6: Commit:** `feat(suite): render module visuals by identity`.

### Task 5: Art-Directed Responsive Styling

**Files:**
- Modify: `apps/web/src/modules/integration/atlas-suite.css`
- Modify: `tests/unit/atlas-suite-registry.test.ts` or visual-contract test as appropriate.

**Interfaces:**
- Consumes: focal CSS custom property emitted by `ModuleVisual`.
- Produces: stable desktop/tablet/mobile crop behavior without distortion or unreadable overlays.

- [ ] **Step 1: Add failing source assertions for `object-position: var(--atlas-visual-focal-point`, aspect-ratio reservation and removal of Suite hero/card dependencies on generic rotated covers where migrated.**
- [ ] **Step 2: Implement focal positioning, localized gradients, responsive aspect ratios and mobile crop rules.** Keep `object-fit: cover`; never assign unequal forced image width/height scaling that stretches source pixels.
- [ ] **Step 3: Verify reduced-motion behavior remains intact and hover scaling does not reveal low-resolution upscaling artifacts.**
- [ ] **Step 4: Run focused unit tests plus `npm run verify:design`.** Expected: PASS.
- [ ] **Step 5: Commit:** `style(suite): art-direct responsive module covers`.

### Task 6: Legacy Cover Dependency Cleanup

**Files:**
- Modify only proven references discovered by repository search.
- Delete from `apps/web/public/atlas/design/` only files with zero remaining consumers after migration.
- Test: `tests/unit/atlas-suite-registry.test.ts`.

**Interfaces:**
- Consumes: completed module visual renderer and repository-wide reference search.
- Produces: `/suite` fully independent from old rotating cover assets without breaking other routes.

- [ ] **Step 1: Search repository-wide for `/atlas/design/atlas-module-gallery.webp`, `atlas-universe.webp`, `atlas-main-dashboard.webp`, and `atlas-voice.webp`.** Record every live consumer.
- [ ] **Step 2: Add/retain a test that `/suite` contains none of the four legacy cover references.** Expected: PASS only after migration.
- [ ] **Step 3: Delete a legacy file only if repository search proves zero consumers; otherwise retain it and document the remaining owner.**
- [ ] **Step 4: Run focused tests and production build.** Expected: PASS with no missing static asset references.
- [ ] **Step 5: Commit:** `chore(visuals): retire obsolete suite cover assets`.

### Task 7: Full Verification, PR, Deployment and E2E Visual QA

**Files:**
- No product changes unless verification finds a real defect.
- PR description records TDD evidence, image-quality evidence and retained legacy dependencies if any.

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: reviewed branch, green CI, production deployment and verified `/suite` experience.

- [ ] **Step 1: Run `npm run typecheck`, focused visual tests, `npm run test:unit`, `npm run test:integration`, `npm run verify:design`, and `npm run build`.** All must PASS.
- [ ] **Step 2: Run `npm run verify:all`.** Existing audit, design, type, unit, integration, edge, Python, neural, navigation and build gates must PASS without bypass.
- [ ] **Step 3: Perform visual QA at representative desktop, tablet and mobile widths, including equivalent 1× and 2× DPR review.** Confirm no blur/pixelation, deformation, subject loss or unreadable overlays across representative family samples and specifically AI, Finance, Health, Studio, Ride, GPS 4D, Aviation, Cloud and Business.
- [ ] **Step 4: Open PR and require CI to pass.** Do not mark complete from local success alone.
- [ ] **Step 5: After approved integration, deploy through the canonical ATLAS production workflow.**
- [ ] **Step 6: Verify `https://www.atlasenterprisesuite.com/suite` plus the existing fail-closed production health/security/route contract.** `/suite` must visibly serve module-specific covers and no generic index rotation.
- [ ] **Step 7: Only after fresh production evidence passes, mark the visual migration complete.**

## Self-Review Result

- Spec coverage: all design-spec sections map to Tasks 1–7; no uncovered requirement found.
- Step scan: each task has an explicit RED/GREEN or quality-verification boundary and a reviewable deliverable.
- Type consistency: `AtlasModuleVisual`, `MODULE_VISUALS`, `getModuleVisual` and `ModuleVisual` names are consistent across tasks.
- Review Focus: registry drift, mobile crop loss, tiny generations, duplicate art and unsafe legacy deletion are each exercised by Tasks 1, 2, 3/5 and 6.
- Proportion: plan stays implementation-oriented and delegates visual content production to the approved art direction rather than embedding 38 long image prompts in the plan.
