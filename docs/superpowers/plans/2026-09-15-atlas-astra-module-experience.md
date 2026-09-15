# ATLAS ASTRA Module Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one reusable ASTRA-inspired module landing experience to the existing ATLAS web shell and migrate the Enterprise, Finance, Accounting and CRM home surfaces without changing their underlying operational workflows.

**Architecture:** Add a presentational `ModuleExperiencePage` component driven by typed section/card data. Existing routes continue to own business logic; the shared component only renders truthful navigation, gated capabilities and visual hierarchy. CRM retains its existing provider-status fetch and banner logic around the new experience surface.

**Tech Stack:** React 18, React Router, TypeScript, CSS, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-15-atlas-astra-module-experience-design.md`

## Global Constraints

- Do not create a parallel application.
- Do not touch Floot CI endpoints or recreate Floot work.
- Do not fabricate metrics, provider readiness, connection state or operational data.
- Preserve existing identity, organization, RBAC, audit and deep-route behavior.
- Only active routes may be rendered as clickable destinations.

---

### Task 1: Shared Module Experience Contract

**Files:**
- Create: `apps/web/src/components/ModuleExperiencePage.tsx`
- Test: `tests/integration/atlas-module-experience.test.tsx`

**Interfaces:**
- Produces `ModuleExperiencePage`, `ModuleExperienceSection`, and `ModuleExperienceCard`.
- Cards accept `to?: string`; cards without `to` render gated and non-clickable.

- [ ] **Step 1: Write the failing integration test**

Render a minimal `ModuleExperiencePage` in a `MemoryRouter`. Assert that the page title renders, an active card is a link to its route, and a gated card is not a link and exposes `aria-disabled=true`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run tests/integration/atlas-module-experience.test.tsx`
Expected: FAIL because `ModuleExperiencePage` does not exist.

- [ ] **Step 3: Implement the minimal typed component**

Render semantic hero, action links, section headings, active `Link` cards and gated `article` cards.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npx vitest run tests/integration/atlas-module-experience.test.tsx`
Expected: PASS.

### Task 2: ASTRA Visual System

**Files:**
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Consumes class names from `ModuleExperiencePage`.
- Produces responsive `.module-experience-*` styles.

- [ ] **Step 1: Add visual contract assertions to the integration test**

Assert the hero, section and card class names are present so accidental markup regressions are caught.

- [ ] **Step 2: Verify RED**

Run the focused test and confirm the new class assertion fails before styles/markup are finalized.

- [ ] **Step 3: Add dark cinematic layout styles**

Use the existing ATLAS palette with cyan accents, restrained orange highlights, large responsive typography, wide vertical rhythm and responsive card grids. Add `:focus-visible` and reduced-motion-safe behavior.

- [ ] **Step 4: Verify GREEN**

Run the focused test and typecheck.

### Task 3: Enterprise, Finance and Accounting Homes

**Files:**
- Modify: `apps/web/src/App.tsx`
- Test: `tests/integration/atlas-module-experience.test.tsx`

**Interfaces:**
- Enterprise home links only to implemented top-level destinations.
- Finance and Accounting preserve `/finance/accounting/accounts-payable` and `/finance/accounting/reports/automotive-sales`.

- [ ] **Step 1: Add route-level failing assertions**

Assert `/`, `/finance`, and `/finance/accounting` render their new ASTRA-style headings and still expose existing destination links.

- [ ] **Step 2: Verify RED**

Run the focused test.

- [ ] **Step 3: Replace only the landing-page presentation**

Use `ModuleExperiencePage`; leave Payables and Automotive Sales pages untouched.

- [ ] **Step 4: Verify GREEN**

Run focused integration test plus `npm run test:integration`.

### Task 4: CRM Home Presentation Without Provider Regression

**Files:**
- Modify: `apps/web/src/modules/business/crm/CrmHomePage.tsx`
- Test: `tests/integration/atlas-module-experience.test.tsx`

**Interfaces:**
- Preserve `crmApi('connection.status')`, state labels, connection banners and truthful notice.
- Preserve links to contacts, companies, deals, service, activities and integrations.

- [ ] **Step 1: Add CRM route assertions**

Mock only the existing CRM API boundary and assert `/crm` exposes the same six workspace destinations inside the new visual system.

- [ ] **Step 2: Verify RED**

Run focused test.

- [ ] **Step 3: Migrate CRM home markup**

Keep all status logic intact and use the shared experience component for hero/workspace presentation.

- [ ] **Step 4: Verify GREEN**

Run CRM-focused and full integration tests.

### Task 5: Verification and Review

**Files:** no new production files.

- [ ] **Step 1:** `npm ci`
- [ ] **Step 2:** `npm run typecheck`
- [ ] **Step 3:** `npm run test:unit`
- [ ] **Step 4:** `npm run test:integration`
- [ ] **Step 5:** `npm run build`
- [ ] **Step 6:** open a PR to `main` so ATLAS Consensus CI provides independent product/UX, architecture/build, and security/reliability evidence.
- [ ] **Step 7:** do not merge or deploy until review evidence is green and the user authorizes the production transition.
