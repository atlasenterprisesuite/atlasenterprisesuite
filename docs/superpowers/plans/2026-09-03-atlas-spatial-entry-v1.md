# ATLAS Spatial Entry v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore an executable ATLAS web application and deliver a generated, accessible, responsive spatial landing experience on `/` that routes into the real ATLAS Health flow.

**Architecture:** Keep the existing React + React Router route ownership in `App.tsx`, restore only the missing Health domain/data contracts required by those routes, and isolate the new spatial experience under `apps/web/src/spatial`. Three.js is progressive enhancement; semantic DOM navigation remains authoritative.

**Tech Stack:** React, TypeScript, React Router, Vite, Vitest, Testing Library, Three.js, React Three Fiber, React Three Drei.

**Spec:** `docs/superpowers/specs/2026-09-03-atlas-spatial-entry-v1-design.md`

## Global Constraints

- Work only on branch `atlas/spatial-entry-v1` until verification is complete.
- Preserve the existing Health route hierarchy in `apps/web/src/App.tsx`.
- No fake live modules, metrics, integrations, or production states.
- Demo Health data must be deterministic, non-identifiable, and visibly labeled research/demo content.
- WebGL must never be the only navigation mechanism.
- Respect `prefers-reduced-motion` and provide a non-WebGL fallback.
- Procedural geometry only in v1; no downloaded 3D models.
- Maximum particle target: 1,200 desktop and 450 mobile.
- Canvas DPR capped at 1.5.
- Completion requires install, typecheck, unit/integration tests, and production build to pass.

---

### Task 1: Make `apps/web` executable and establish the test harness

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/test/setup.ts`
- Create: `apps/web/src/App.smoke.test.tsx`

**Interfaces:**
- Consumes: existing `AppRoutes` export from `apps/web/src/App.tsx`.
- Produces: `npm run test`, `npm run typecheck`, and `npm run build` commands for the web app.

- [ ] **Step 1: Add a failing smoke test**

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from './App';

test('renders the ATLAS enterprise root', () => {
  render(<MemoryRouter initialEntries={['/']}><AppRoutes /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: /ATLAS/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- --run src/App.smoke.test.tsx`

Expected: failure caused by unresolved imports/configuration, not a passing test.

- [ ] **Step 3: Add the Vite/TypeScript/test configuration and browser entrypoint**

`main.tsx` mounts `<BrowserRouter><AppRoutes /></BrowserRouter>` and imports `styles.css` once it exists.

- [ ] **Step 4: Re-run the smoke test**

Expected: remaining failure is specifically from missing domain/component imports, proving the harness is active.

- [ ] **Step 5: Commit**

Commit message: `build: scaffold executable ATLAS web app`

---

### Task 2: Restore Health domain contracts and deterministic demo data

**Files:**
- Create: `packages/health/types.ts`
- Create: `packages/health/evidence.ts`
- Create: `packages/health/neural-graph.ts`
- Create: `packages/health/reconstruction.ts`
- Create: `packages/health/curability.ts`
- Create: `data/research/seed.ts`
- Create: `apps/web/src/domain.health.test.ts`

**Interfaces:**
- `evidenceLabel(level: EvidenceLevel): string`
- `graphForDisease(diseaseId: string, nodes: GraphNode[], edges: GraphEdge[]): { nodes: GraphNode[]; edges: GraphEdge[] }`
- `validateGraph(nodes: GraphNode[], edges: GraphEdge[], evidence: EvidenceRecord[]): { valid: boolean; errors: string[] }`
- `calculateVulnerability(profile: VulnerabilityProfile): VulnerabilityResult`
- `curabilityDefinitions: Record<CurabilityLevel, string>`
- Seed exports required by `App.tsx`: `demoDataNotice`, `diseases`, `evidenceRecords`, `falsificationRecords`, `graphEdges`, `graphNodes`, `vulnerabilityProfiles`.

- [ ] **Step 1: Write failing domain tests**

```ts
import { validateGraph } from '../../../packages/health/neural-graph';
import { calculateVulnerability } from '../../../packages/health/reconstruction';
import { evidenceRecords, graphEdges, graphNodes, vulnerabilityProfiles } from '../../../data/research/seed';

test('demo graph has valid node/evidence references', () => {
  expect(validateGraph(graphNodes, graphEdges, evidenceRecords).valid).toBe(true);
});

test('vulnerability calculation is deterministic and bounded', () => {
  const result = calculateVulnerability(vulnerabilityProfiles.hiv);
  expect(result.reconstructionRisk).toBeGreaterThanOrEqual(0);
  expect(result.reconstructionRisk).toBeLessThanOrEqual(100);
  expect(result.formulaVersion).toBe('v1');
});
```

- [ ] **Step 2: Run domain tests and verify RED**

Expected: module-not-found failures for `packages/health` and `data/research`.

- [ ] **Step 3: Implement minimal typed domain helpers and deterministic seed records**

Use a transparent weighted vulnerability formula whose contribution weights sum to 1.0 and clamp the final result to 0–100. All seed records carry explicit demo/research semantics and no patient data.

- [ ] **Step 4: Re-run domain tests and verify GREEN**

- [ ] **Step 5: Commit**

Commit message: `feat: restore governed ATLAS Health domain foundation`

---

### Task 3: Restore shared application components required by existing routes

**Files:**
- Create: `apps/web/src/components/AtlasShell.tsx`
- Create: `apps/web/src/components/LabNav.tsx`
- Create: `apps/web/src/components/NeuralGraphPanel.tsx`
- Create: `apps/web/src/components/ResearchBadge.tsx`
- Create: `apps/web/src/components/components.test.tsx`

**Interfaces:**
- `AtlasShell({ children }: PropsWithChildren): JSX.Element`
- `LabNav(): JSX.Element`
- `NeuralGraphPanel({ nodes, edges, evidence }): JSX.Element`
- `ResearchBadge(): JSX.Element`

- [ ] **Step 1: Write failing component tests**

```tsx
test('shell exposes skip navigation and Health route', () => {
  render(<MemoryRouter><AtlasShell><div>content</div></AtlasShell></MemoryRouter>);
  expect(screen.getByRole('link', { name: /skip to content/i })).toHaveAttribute('href', '#atlas-main');
  expect(screen.getByRole('link', { name: /health/i })).toHaveAttribute('href', '/health');
});
```

Also assert LabNav has real route destinations and NeuralGraphPanel renders node labels without `href="#"`.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement minimal functional components**

`AtlasShell` owns semantic header/nav/main and `id="atlas-main"`. `LabNav` uses `NavLink`. `NeuralGraphPanel` renders an inspectable DOM graph summary rather than decorative fake metrics. `ResearchBadge` explicitly says research/demo.

- [ ] **Step 4: Verify GREEN and re-run App smoke test**

Expected: root app now renders without unresolved imports.

- [ ] **Step 5: Commit**

Commit message: `feat: restore ATLAS shared shell and health components`

---

### Task 4: Add spatial capability and reduced-motion behavior

**Files:**
- Create: `apps/web/src/spatial/useSpatialPreferences.ts`
- Create: `apps/web/src/spatial/useSpatialPreferences.test.tsx`

**Interfaces:**
- `supportsWebGL(): boolean`
- `useSpatialPreferences(): { reducedMotion: boolean; webglSupported: boolean }`

- [ ] **Step 1: Write failing tests**

Test that a mocked `matchMedia('(prefers-reduced-motion: reduce)')` returns `reducedMotion: true`, and a failed WebGL context returns `webglSupported: false`.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement the capability hook**

Keep detection synchronous and side-effect-light. Do not throw when canvas/WebGL APIs are unavailable in test/SSR-like environments.

- [ ] **Step 4: Verify GREEN**

- [ ] **Step 5: Commit**

Commit message: `feat: add spatial capability preferences`

---

### Task 5: Build the real Spatial Entry DOM experience and route behavior

**Files:**
- Create: `apps/web/src/spatial/SpatialEntry.tsx`
- Create: `apps/web/src/spatial/SpatialEntry.test.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- `SpatialEntry(): JSX.Element`
- Root `/` renders `SpatialEntry`.
- DOM action uses React Router to navigate to `/health`.

- [ ] **Step 1: Write failing route/fallback tests**

```tsx
test('Spatial Entry exposes the real ATLAS Health route without WebGL', async () => {
  render(<MemoryRouter initialEntries={['/']}><AppRoutes /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: /ATLAS Enterprise Suite/i })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('link', { name: /enter ATLAS Health/i }));
  expect(screen.getByRole('heading', { name: /ATLAS Health/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement accessible Spatial Entry and delegate root route to it**

The semantic layer contains the heading, short copy, environment label, and `/health` link regardless of WebGL state.

- [ ] **Step 4: Verify GREEN**

- [ ] **Step 5: Commit**

Commit message: `feat: add functional ATLAS spatial entry route`

---

### Task 6: Add the generated Three.js scene as progressive enhancement

**Files:**
- Create: `apps/web/src/spatial/AtlasSpatialScene.tsx`
- Create: `apps/web/src/spatial/AtlasGlobe.tsx`
- Create: `apps/web/src/spatial/StarField.tsx`
- Modify: `apps/web/src/spatial/SpatialEntry.tsx`
- Create: `apps/web/src/spatial/spatial-scene.test.tsx`

**Interfaces:**
- `AtlasSpatialScene({ reducedMotion }: { reducedMotion: boolean }): JSX.Element`
- `AtlasGlobe(): JSX.Element`
- `StarField({ count }: { count: number }): JSX.Element`

- [ ] **Step 1: Write failing enhancement tests**

Assert SpatialEntry omits the scene when WebGL is false or reduced motion is true, while keeping the DOM action. Assert requested particle count is clamped to the v1 limits.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement the Canvas scene**

Use procedural sphere/rings/points, `dpr={[1, 1.5]}`, subtle bounded pointer parallax, no route logic inside Canvas, and `aria-hidden="true"` on the visual layer container.

- [ ] **Step 4: Verify GREEN**

- [ ] **Step 5: Commit**

Commit message: `feat: add procedural ATLAS spatial scene`

---

### Task 7: Add ATLAS visual system and responsive states

**Files:**
- Create: `apps/web/src/styles.css`
- Modify: `apps/web/src/main.tsx`
- Create: `apps/web/src/styles.contract.test.ts`

**Interfaces:**
- Shared classes used by current `App.tsx` and new spatial components.

- [ ] **Step 1: Write a failing style contract test**

Read `styles.css` and assert the presence of focus-visible, reduced-motion, mobile breakpoint, `.spatial-entry`, `.atlas-shell`, `.module-grid`, and `.lab-shell` contracts.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement responsive dark ATLAS styling**

Ensure no horizontal overflow at mobile widths, visible focus rings, readable fallback content, and `@media (prefers-reduced-motion: reduce)` disables non-essential transitions.

- [ ] **Step 4: Verify GREEN**

- [ ] **Step 5: Commit**

Commit message: `feat: add responsive ATLAS spatial visual system`

---

### Task 8: Full route, build, and integrity verification

**Files:**
- Create: `apps/web/src/routes.integration.test.tsx`
- Modify only files required to fix verified failures.

**Interfaces:**
- Supported route chain: `/`, `/health`, `/health/research`, `/health/research/frontiers`, `/health/research/frontiers/disease-reconstruction`.

- [ ] **Step 1: Add integration tests for every supported route**

Each route must render its expected heading and must not render `Route not found`.

- [ ] **Step 2: Run all tests**

Run: `npm test -- --run`

Expected: all tests PASS.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`

Expected: exit 0.

- [ ] **Step 4: Run production build**

Run: `npm run build`

Expected: Vite production build exits 0.

- [ ] **Step 5: Scan for forbidden placeholders and secrets**

Run searches for `href="#"`, `console.log(`, `Coming Soon`, obvious secret/token patterns, and fake `live/connected` status copy. Any hit must be reviewed and removed unless demonstrably legitimate.

- [ ] **Step 6: Commit verification fixes**

Commit message: `test: verify ATLAS Spatial Entry v1 gates`

- [ ] **Step 7: Open a PR from `atlas/spatial-entry-v1` to `main` only after all local gates pass**

PR body must report exact test/typecheck/build results and explicitly state that deployment/production verification has not occurred unless separate deployment evidence is available.
