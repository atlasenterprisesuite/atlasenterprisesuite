# ATLAS Universe UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current flat ATLAS home/module navigation with a real, responsive, permission-aware ATLAS Universe shell and Galaxy Navigator while preserving existing routes, Supabase identity/tenancy, RBAC boundaries, module behavior, and honest data states.

**Architecture:** Add a provider-neutral Universe presentation layer under `apps/web/src/universe` and evolve the existing `AtlasShell` instead of creating a parallel app. A data-driven module registry controls navigation metadata only; authentication and authorization remain in existing ATLAS Identity/backend/RLS boundaries. The Universe home renders real module state, organization context, navigation search, contextual assistant shell, and honest empty/configuration states without fabricated KPIs.

**Tech Stack:** TypeScript 5.7, React 18.3, React Router 7.18, Vite 6.4, Vitest 3.2, Testing Library 16, jsdom, existing Supabase Auth/RLS architecture.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-universe-ui-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`.
- Implementation branch: `feat/atlas-universe-ui`.
- Do not merge to `main` or deploy during implementation without explicit approval.
- Reuse `apps/web`, `AtlasShell`, `atlasSession`, `RequireAtlasIdentity`, existing module routes, Supabase Auth, organization membership, RLS, RBAC, audit, and existing feature-flag patterns.
- The module registry is navigation metadata, never an authorization source.
- Never fabricate metrics, connected states, provider health, approvals, notifications, recent work, or assistant execution state.
- Existing functionality that is more complete than the visual references must be preserved.
- Do not paste blueprint/reference images into the product as UI substitutes.
- Prefer CSS/SVG/GPU-friendly transforms. Do not require a background video or large DOM particle field.
- All animation must have a `prefers-reduced-motion` fallback.
- TDD for every behavior change: failing test -> verify RED -> minimal implementation -> focused PASS -> refactor -> commit.
- Final verification: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`.

## Pre-flight Gate

Confirm the branch starts from a clean `main` baseline and that these existing files remain present:

```bash
test -f apps/web/src/App.tsx
test -f apps/web/src/components/AtlasShell.tsx
test -f apps/web/src/lib/atlasSession.ts
test -f apps/web/src/identity/RequireAtlasIdentity.tsx
npm ci
npm run typecheck
npm test
npm run build
```

Expected: baseline passes before production code changes. If the baseline fails, investigate before attributing failures to Universe work.

---

## File Map

- `apps/web/src/universe/types.ts` — Universe module/status/theme contracts.
- `apps/web/src/universe/moduleRegistry.ts` — canonical navigation metadata for modules.
- `apps/web/src/universe/moduleState.ts` — pure permission/status presentation helpers.
- `apps/web/src/universe/search.ts` — pure navigation-search index/filtering.
- `apps/web/src/universe/UniverseHome.tsx` — authenticated ATLAS Universe portal.
- `apps/web/src/universe/AtlasCoreHero.tsx` — central hero/core visualization without fake telemetry.
- `apps/web/src/universe/GalaxyNavigator.tsx` — responsive module navigator.
- `apps/web/src/universe/GlobalSearch.tsx` — real navigation search over the registry.
- `apps/web/src/universe/AtlasAssistantPanel.tsx` — contextual assistant shell; no privileged mutation authority.
- `apps/web/src/universe/universe.css` — visual tokens, shell/galaxy styles, responsive and reduced-motion rules.
- `apps/web/src/components/AtlasShell.tsx` — evolve global shell/header/sidebar and organization context.
- `apps/web/src/App.tsx` — mount `UniverseHome` at `/` and preserve all existing routes.
- `apps/web/src/main.tsx` — import `universe.css`.
- `tests/unit/atlas-universe-registry.test.ts` — registry contract and honest route/status mapping.
- `tests/unit/atlas-universe-state.test.ts` — presentation-state and permission-display logic.
- `tests/unit/atlas-universe-search.test.ts` — deterministic navigation search.
- `tests/integration/atlas-universe-home.test.tsx` — home/galaxy/search navigation.
- `tests/integration/atlas-universe-shell.test.tsx` — shell organization/context and route preservation.
- `tests/integration/atlas-universe-accessibility.test.tsx` — keyboard/labels/reduced-motion contracts.

---

### Task 1: Introduce the Universe registry as honest navigation metadata

**Files:**
- Create: `apps/web/src/universe/types.ts`
- Create: `apps/web/src/universe/moduleRegistry.ts`
- Test: `tests/unit/atlas-universe-registry.test.ts`

**Interfaces:**
- Produces: `AtlasUniverseModule`, `AtlasModuleVisualTheme`, `atlasUniverseModules`, `getUniverseModule(id)`.
- Does not consume or expose RBAC authorization results.

- [ ] **Step 1: Write the failing registry test**

Create `tests/unit/atlas-universe-registry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { atlasUniverseModules, getUniverseModule } from '../../apps/web/src/universe/moduleRegistry';

const requiredIds = [
  'atlas-os','finance','accounting','payroll','hr','health','ride','crm','sales','inventory',
  'purchasing','accounts-payable','accounts-receivable','tax','pos','projects','analytics','insurance',
  'telecom','creator-studio','learning','security','atlas-pay','cleanscan-3d','atlas-drive','atlas-voice',
  'atlas-connect','gps-4d','hospitality','venezuela'
];

describe('ATLAS Universe registry', () => {
  it('contains every approved universe module exactly once', () => {
    const ids = atlasUniverseModules.map((module) => module.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(requiredIds));
  });

  it('marks only currently implemented canonical routes active', () => {
    expect(getUniverseModule('finance')?.route).toBe('/finance');
    expect(getUniverseModule('finance')?.status).toBe('active');
    expect(getUniverseModule('payroll')?.route).toBe('/payroll');
    expect(getUniverseModule('payroll')?.status).toBe('active');
    expect(getUniverseModule('health')?.route).toBe('/health');
    expect(getUniverseModule('health')?.status).toBe('active');
    expect(getUniverseModule('creator-studio')?.route).toBe('/studio');
    expect(getUniverseModule('creator-studio')?.status).toBe('active');
    expect(getUniverseModule('hospitality')?.route).toBe('/hospitality/access');
    expect(getUniverseModule('hospitality')?.status).toBe('active');
    expect(getUniverseModule('crm')?.status).not.toBe('active');
  });

  it('never encodes authorization as registry state', () => {
    expect(atlasUniverseModules.every((module) => Array.isArray(module.requiredPermissions))).toBe(true);
    expect(atlasUniverseModules.some((module) => Object.prototype.hasOwnProperty.call(module, 'authorized'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/unit/atlas-universe-registry.test.ts
```

Expected: FAIL because `apps/web/src/universe/moduleRegistry.ts` does not exist.

- [ ] **Step 3: Implement the types**

Create `apps/web/src/universe/types.ts` with the exact spec union for `status` and `atmosphere`.

- [ ] **Step 4: Implement the registry**

Create `moduleRegistry.ts` with all required IDs. Existing production routes discovered in the repository may be `active`; modules without a working canonical route must be `configuration_required` or `available`, not falsely `active`. `requiredPermissions` is descriptive metadata only.

- [ ] **Step 5: Verify GREEN**

```bash
npx vitest run tests/unit/atlas-universe-registry.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/universe/types.ts apps/web/src/universe/moduleRegistry.ts tests/unit/atlas-universe-registry.test.ts
git commit -m "feat: add ATLAS Universe module registry"
```

---

### Task 2: Add presentation-state helpers and centralized Universe design tokens

**Files:**
- Create: `apps/web/src/universe/moduleState.ts`
- Create: `apps/web/src/universe/universe.css`
- Test: `tests/unit/atlas-universe-state.test.ts`
- Modify: `apps/web/src/main.tsx`

**Interfaces:**
- Consumes: `AtlasUniverseModule`.
- Produces: `UniverseDisplayState`, `resolveUniverseDisplayState(module, input)`.

- [ ] **Step 1: Write the failing state tests**

```ts
import { describe, expect, it } from 'vitest';
import { resolveUniverseDisplayState } from '../../apps/web/src/universe/moduleState';
import { getUniverseModule } from '../../apps/web/src/universe/moduleRegistry';

it('shows restricted when the caller cannot view a module without rewriting registry truth', () => {
  const finance = getUniverseModule('finance')!;
  expect(resolveUniverseDisplayState(finance, { canView: false }).kind).toBe('restricted');
  expect(finance.status).toBe('active');
});

it('preserves configuration-required modules when permission is otherwise allowed', () => {
  const crm = getUniverseModule('crm')!;
  expect(resolveUniverseDisplayState(crm, { canView: true }).kind).toBe('configuration_required');
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/atlas-universe-state.test.ts
```

- [ ] **Step 3: Implement the pure state mapper**

`resolveUniverseDisplayState` returns `{ kind, interactive, label }`. `restricted` is presentation only; it does not grant or deny backend authority.

- [ ] **Step 4: Add centralized tokens**

`universe.css` must define the spec token families and reuse existing colors where practical. Add `@media (prefers-reduced-motion: reduce)` that disables orbit/float transitions and sets animation durations effectively to zero.

- [ ] **Step 5: Import the stylesheet and verify**

```bash
npx vitest run tests/unit/atlas-universe-state.test.ts
npm run typecheck
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/universe/moduleState.ts apps/web/src/universe/universe.css apps/web/src/main.tsx tests/unit/atlas-universe-state.test.ts
git commit -m "feat: add Universe visual state and design tokens"
```

---

### Task 3: Build the real Galaxy Navigator and Universe home route

**Files:**
- Create: `apps/web/src/universe/AtlasCoreHero.tsx`
- Create: `apps/web/src/universe/GalaxyNavigator.tsx`
- Create: `apps/web/src/universe/UniverseHome.tsx`
- Modify: `apps/web/src/App.tsx`
- Test: `tests/integration/atlas-universe-home.test.tsx`

**Interfaces:**
- Consumes: `atlasUniverseModules`, `resolveUniverseDisplayState`.
- Produces: `UniverseHome`, `GalaxyNavigator`.

- [ ] **Step 1: Write the failing home integration test**

Use `MemoryRouter` and render `UniverseHome` directly so the test does not bypass existing route guards elsewhere.

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { UniverseHome } from '../../apps/web/src/universe/UniverseHome';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

it('navigates from an active galaxy node to its real route', () => {
  render(<MemoryRouter initialEntries={['/']}><UniverseHome /><LocationProbe /></MemoryRouter>);
  fireEvent.click(screen.getByRole('link', { name: /finance/i }));
  expect(screen.getByTestId('location')).toHaveTextContent('/finance');
});

it('does not render configuration-required modules as active links', () => {
  render(<MemoryRouter><UniverseHome /></MemoryRouter>);
  expect(screen.queryByRole('link', { name: /crm/i })).not.toBeInTheDocument();
  expect(screen.getByText(/CRM/i).closest('[data-universe-status]')).toHaveAttribute('data-universe-status', 'configuration_required');
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/integration/atlas-universe-home.test.tsx
```

- [ ] **Step 3: Implement `AtlasCoreHero`**

Render brand, honest organization-independent copy, and a CSS/SVG energy-core visual. Do not show fake system metrics or provider connectivity.

- [ ] **Step 4: Implement `GalaxyNavigator`**

Active modules render `Link`; unavailable/configuration/restricted states render non-link semantic cards with explicit text labels. Use real module names/descriptions from the registry. Desktop uses spatial grid/orbit styling; CSS media queries collapse to tablet and mobile list/orbit hybrid.

- [ ] **Step 5: Implement `UniverseHome` and replace only `/`**

Replace `EnterpriseHome` at `/` with `UniverseHome`; preserve every other existing route unchanged.

- [ ] **Step 6: Verify GREEN and regression build**

```bash
npx vitest run tests/integration/atlas-universe-home.test.tsx
npm run typecheck
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/universe/AtlasCoreHero.tsx apps/web/src/universe/GalaxyNavigator.tsx apps/web/src/universe/UniverseHome.tsx apps/web/src/App.tsx tests/integration/atlas-universe-home.test.tsx
git commit -m "feat: build ATLAS Universe home and galaxy navigation"
```

---

### Task 4: Add real navigation search over known ATLAS modules

**Files:**
- Create: `apps/web/src/universe/search.ts`
- Create: `apps/web/src/universe/GlobalSearch.tsx`
- Modify: `apps/web/src/universe/UniverseHome.tsx`
- Test: `tests/unit/atlas-universe-search.test.ts`
- Test: `tests/integration/atlas-universe-home.test.tsx`

**Interfaces:**
- Produces: `searchUniverseModules(query)`, `GlobalSearch`.

- [ ] **Step 1: Write failing pure search tests**

Assert case-insensitive matching across `name`, `category`, and `description`, empty query returns a stable subset/all modules, and no external record results are fabricated.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/atlas-universe-search.test.ts
```

- [ ] **Step 3: Implement pure search**

No network request. This phase is navigation search only.

- [ ] **Step 4: Implement accessible combobox/listbox UI**

Search results link only to active modules. Configuration/restricted modules remain labeled and non-navigable.

- [ ] **Step 5: Verify search integration**

```bash
npx vitest run tests/unit/atlas-universe-search.test.ts tests/integration/atlas-universe-home.test.tsx
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/universe/search.ts apps/web/src/universe/GlobalSearch.tsx apps/web/src/universe/UniverseHome.tsx tests/unit/atlas-universe-search.test.ts tests/integration/atlas-universe-home.test.tsx
git commit -m "feat: add ATLAS Universe navigation search"
```

---

### Task 5: Evolve AtlasShell and add contextual ATLAS Assistant presentation

**Files:**
- Create: `apps/web/src/universe/AtlasAssistantPanel.tsx`
- Modify: `apps/web/src/components/AtlasShell.tsx`
- Test: `tests/integration/atlas-universe-shell.test.tsx`

**Interfaces:**
- Consumes: current route from React Router and existing cached organization state.
- Produces: responsive Universe shell and assistant context panel. It does not create a privileged execution path.

- [ ] **Step 1: Write failing shell tests**

Assert organization name/role still update from the existing session event, current route is exposed to the assistant panel, and existing sidebar destinations remain navigable.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/integration/atlas-universe-shell.test.tsx
```

- [ ] **Step 3: Implement assistant panel**

Render route/module/organization context and safe navigation/help actions only. Do not add direct finance/payroll/security mutations.

- [ ] **Step 4: Evolve shell markup**

Keep current organization/RLS truth. Add Universe visual classes, global header treatment, compact mobile navigation behavior, and assistant drawer/panel. Preserve `ATLAS_SESSION_EVENT` handling.

- [ ] **Step 5: Verify GREEN**

```bash
npx vitest run tests/integration/atlas-universe-shell.test.tsx
npm run typecheck
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/universe/AtlasAssistantPanel.tsx apps/web/src/components/AtlasShell.tsx tests/integration/atlas-universe-shell.test.tsx
git commit -m "feat: evolve ATLAS shell for Universe navigation"
```

---

### Task 6: Add honest operational sections for Recent Work, Approvals, Favorites, and Signals

**Files:**
- Create: `apps/web/src/universe/UniverseOperationalPanels.tsx`
- Modify: `apps/web/src/universe/UniverseHome.tsx`
- Test: `tests/integration/atlas-universe-home.test.tsx`

**Interfaces:**
- Consumes only existing APIs/state that can be verified in the repository.
- Produces honest populated, empty, loading, or unavailable states.

- [ ] **Step 1: Write failing empty-state tests**

Assert the portal never invents counts when no source is connected and instead shows explicit empty/configuration language.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/integration/atlas-universe-home.test.tsx
```

- [ ] **Step 3: Implement panels with current real sources only**

If an existing approval/work source is available and already authorized, adapt it. Otherwise render a truthful empty/configuration state. Favorites may use local UI preference only if the repository already has a user-preferences persistence boundary; otherwise keep favorites as a non-persistent local interaction and label it accordingly.

- [ ] **Step 4: Verify GREEN**

```bash
npx vitest run tests/integration/atlas-universe-home.test.tsx
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/universe/UniverseOperationalPanels.tsx apps/web/src/universe/UniverseHome.tsx tests/integration/atlas-universe-home.test.tsx
git commit -m "feat: add honest ATLAS Universe operational panels"
```

---

### Task 7: Preserve key-module route depth and add Universe contextual framing

**Files:**
- Modify only where needed: `apps/web/src/App.tsx`, `apps/web/src/modules/payroll/PayrollRoutes.tsx`, existing Finance/Health/Ride/Hospitality/Studio route entry files.
- Test: `tests/integration/atlas-universe-shell.test.tsx`

**Interfaces:**
- Preserves all current module functionality and route depth.
- Adds shared visual/context frame without replacing module-specific components.

- [ ] **Step 1: Write route regression tests**

Cover at minimum `/finance`, `/finance/accounting/accounts-payable`, `/payroll`, `/health`, `/ride`, `/hospitality/access`, `/studio`, and `/voice` as currently implemented by the repository.

- [ ] **Step 2: Verify baseline behavior before visual changes**

```bash
npx vitest run tests/integration/atlas-universe-shell.test.tsx
```

- [ ] **Step 3: Add shared contextual classes/components only where needed**

Do not flatten module-local navigation, data tables, forms, or guarded routes.

- [ ] **Step 4: Verify GREEN**

```bash
npx vitest run tests/integration/atlas-universe-shell.test.tsx
npm run typecheck
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src tests/integration/atlas-universe-shell.test.tsx
git commit -m "feat: preserve module depth in ATLAS Universe shell"
```

---

### Task 8: Accessibility, reduced motion, responsive and final verification

**Files:**
- Modify: `apps/web/src/universe/universe.css`
- Modify as needed: Universe components from Tasks 3-6
- Test: `tests/integration/atlas-universe-accessibility.test.tsx`

**Interfaces:**
- Produces keyboard-operable Galaxy/search/assistant surfaces with semantic status labels and reduced-motion behavior.

- [ ] **Step 1: Write failing accessibility tests**

Cover keyboard focusability of active module links, labeled search input/results, non-link unavailable modules, assistant accessible name, and absence of animation-dependent status text.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/integration/atlas-universe-accessibility.test.tsx
```

- [ ] **Step 3: Implement accessibility/responsive fixes**

Desktop: sidebar + galaxy + assistant.
Tablet: collapsible/condensed navigation + simplified galaxy.
Mobile: compact header + orbit/list navigator + assistant drawer.

- [ ] **Step 4: Verify focused tests**

```bash
npx vitest run tests/unit/atlas-universe-registry.test.ts tests/unit/atlas-universe-state.test.ts tests/unit/atlas-universe-search.test.ts tests/integration/atlas-universe-home.test.tsx tests/integration/atlas-universe-shell.test.tsx tests/integration/atlas-universe-accessibility.test.tsx
```

- [ ] **Step 5: Run canonical full validation**

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Expected: all pass with no fake production state introduced.

- [ ] **Step 6: Whole-branch review**

Review the complete diff against the specification, specifically checking route preservation, authorization boundaries, honest state, keyboard/mobile behavior, reduced motion, and accidental reference-image embedding.

- [ ] **Step 7: Commit final hardening**

```bash
git add apps/web/src tests
git commit -m "test: harden ATLAS Universe accessibility and responsiveness"
```

---

## Execution Handoff

Execute this plan on `feat/atlas-universe-ui` with Subagent-Driven Development where available. Do not pause between tasks except for a genuine security/irreversible/shared-branch boundary. Do not merge or deploy automatically.
