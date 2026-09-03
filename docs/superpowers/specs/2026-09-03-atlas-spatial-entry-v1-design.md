# ATLAS Spatial Entry v1 — Design Specification

Date: 2026-09-03
Status: Proposed for implementation approval
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Branch: `atlas/spatial-entry-v1`

## 1. Objective

Build the first real spatial/cinematic entry experience for ATLAS Enterprise Suite without using a video as the interface and without replacing existing functional routes. The experience must be generated in-browser, responsive, progressively enhanced, and connected to real ATLAS navigation.

The first milestone is intentionally narrow: make the current web application executable, restore the missing shared/domain files required by the existing `App.tsx`, then replace the plain enterprise landing surface with a functional spatial entry that routes into the ATLAS Health flow already defined in that file.

## 2. Current Repository Reality

The current web foundation is incomplete. `apps/web/src/App.tsx` exists and defines the enterprise and ATLAS Health route hierarchy, but the repository branch does not contain the component files it imports. It also does not contain the referenced `packages/health/*` domain modules or `data/research/seed` source. `apps/web` lacks the normal executable package/configuration files as well.

Therefore Spatial Entry v1 must not begin by layering animation over a broken build. The implementation order is:

`Executable web base → missing domain contracts/data → missing shared components → stable routes → spatial entry → interaction → responsive/performance gates → tests`

## 3. Scope

Spatial Entry v1 includes:

- Executable React + TypeScript web application under `apps/web`.
- Existing route hierarchy preserved, including `/` and the Health routes already declared in `App.tsx`.
- Minimal domain modules needed by the current Health code restored under `packages/health`.
- Deterministic, clearly labeled research/demo seed data restored under `data/research` only to satisfy the existing governed Health UI. No fabricated production data.
- Reusable `AtlasShell` for top-level navigation and layout.
- Missing components required by the current `App.tsx` implemented instead of stubbed.
- A real WebGL spatial landing scene on `/`.
- ATLAS-branded globe/orbital-network centerpiece built with Three.js through React Three Fiber.
- Particle/star field generated in code, not a background video.
- Pointer/touch parallax with bounded movement.
- Cinematic text reveal using CSS/React state rather than a prerecorded asset.
- A real navigation action from the spatial entry to `/health`.
- Reduced-motion mode that removes camera/particle animation while preserving content and navigation.
- WebGL capability fallback that renders a fully functional non-WebGL landing view.
- Responsive layouts for desktop, tablet, and mobile.
- Unit/integration tests for domain rules, routing, fallback behavior, and accessibility-critical navigation.

Not included in v1:

- Fake links for ATLAS modules that do not yet have implemented routes.
- Fabricated production metrics or connection states.
- A full 3D dashboard for Accounting, Payroll, HR, CRM, Finance, Ride, Security, or other modules that are not present in this repository yet.
- Backend, authentication, billing, tenant persistence, or external integrations beyond what already exists.
- Shader-heavy post-processing, volumetric effects, or large 3D asset downloads unless profiling proves they are necessary.
- Claims that demo Health data represents live clinical or production data.

## 4. Architecture

### Web application

Keep the existing React/React Router direction rather than replacing it with a new framework. `apps/web` becomes a standard Vite + React + TypeScript application.

Primary runtime dependencies:

- `react`
- `react-dom`
- `react-router-dom`
- `three`
- `@react-three/fiber`
- `@react-three/drei`

Primary dev/test dependencies:

- `vite`
- `typescript`
- `vitest`
- `@testing-library/react`
- `@testing-library/jest-dom`
- `jsdom`

No animation framework is required in v1. CSS transitions, React state, and the render loop from React Three Fiber are sufficient for the first cinematic experience and keep the dependency surface small.

### Component and domain boundaries

`apps/web/src/main.tsx`
- Browser entrypoint.
- Mounts the router application.

`apps/web/src/App.tsx`
- Route ownership only.
- Existing Health route behavior stays intact.
- Enterprise home delegates visual rendering to a dedicated spatial entry component instead of accumulating 3D logic in `App.tsx`.

`apps/web/src/components/AtlasShell.tsx`
- Shared enterprise layout and top navigation.
- Provides stable navigation and skip-to-content behavior.

`apps/web/src/components/LabNav.tsx`
- Real route links for the Disease Reconstruction Lab.

`apps/web/src/components/NeuralGraphPanel.tsx`
- Functional graph visualization for the existing Health research path.
- Consumes the graph/evidence props already expected by `App.tsx`.

`apps/web/src/components/ResearchBadge.tsx`
- Explicit research/demo environment labeling.

`packages/health/types.ts`
- Shared evidence, graph, disease, falsification, vulnerability, and curability types required by the current Health UI.

`packages/health/evidence.ts`
- Evidence-level labeling and evidence-state helpers.

`packages/health/neural-graph.ts`
- Graph filtering and integrity validation used by the current Health pages.

`packages/health/reconstruction.ts`
- Transparent deterministic research-only vulnerability calculation used by the current UI.

`packages/health/curability.ts`
- Curability classification definitions and guardrails already referenced by the Health UI.

`data/research/seed.ts`
- Deterministic demo/research records with an explicit non-production notice. No patient-identifiable information and no live-state claims.

`apps/web/src/spatial/SpatialEntry.tsx`
- Accessible DOM content for the enterprise landing experience.
- Owns capability and reduced-motion decisions.
- Provides the real `/health` navigation action.

`apps/web/src/spatial/AtlasSpatialScene.tsx`
- React Three Fiber canvas and scene composition.
- Contains only visual/spatial behavior, no application routing logic.

`apps/web/src/spatial/AtlasGlobe.tsx`
- Procedural ATLAS globe/orbit object.

`apps/web/src/spatial/StarField.tsx`
- Deterministic procedural particle field with bounded particle count.

`apps/web/src/spatial/useSpatialPreferences.ts`
- Detects `prefers-reduced-motion` and WebGL support.
- Returns a small stable capability contract used by `SpatialEntry`.

`apps/web/src/styles.css`
- ATLAS dark blue/black visual system, responsive shell, fallback surface, focus states, and reduced-motion rules.

## 5. Spatial Experience

The landing flow is:

1. User opens `/`.
2. A dark ATLAS field appears immediately with readable DOM content.
3. If WebGL is supported and reduced motion is not requested, the spatial canvas initializes behind the DOM layer.
4. A generated globe/orbital structure slowly resolves into view.
5. The title `ATLAS ENTERPRISE SUITE` becomes visible through a restrained opacity/transform transition.
6. The live destination `ATLAS Health` is presented as a real action.
7. Activating the action routes to `/health` using React Router.
8. Back navigation returns to the spatial entry without reloading the application.

The 3D scene is enhancement, never the only way to understand or navigate the page.

## 6. Interaction Rules

- Pointer movement may change camera/group rotation only within small clamped limits.
- Touch movement must not hijack native scrolling.
- No interaction may require hover.
- No click target may exist only inside WebGL.
- The DOM `/health` action remains keyboard- and screen-reader-accessible.
- Canvas uses `aria-hidden="true"` because navigation semantics live in the DOM layer.
- `Escape` is not overloaded with a custom behavior in v1.

## 7. Health Data and Research Guardrails

The missing Health domain/data files are restored only so the routes already present in `App.tsx` can compile and run.

Rules:

- all seed records are deterministic demo/research content
- no patient-identifiable data
- no fabricated hospital, EHR, FHIR, pharmacy, lab, or production connection state
- evidence level and status remain explicit
- vulnerability scores remain transparent research-only outputs
- curability labels cannot be promoted to cure-level claims from hypothesis, preclinical evidence, or isolated case reports
- the UI must visibly identify the research/demo environment

## 8. Performance Rules

- No downloaded 3D models in v1.
- Procedural geometry only.
- Desktop particle target: at most 1,200 points.
- Mobile particle target: at most 450 points.
- Device pixel ratio for the canvas is capped at 1.5.
- Continuous animation is disabled when `prefers-reduced-motion: reduce` is active.
- If WebGL initialization fails, render the static ATLAS landing surface without blocking navigation.
- The app must remain usable before the 3D canvas finishes initializing.

## 9. Visual Direction

Use the approved ATLAS identity already established for the suite:

- black/deep-navy background
- metallic/technical hierarchy
- restrained cyan/blue illumination
- luminous globe/orbital network
- minimal headline copy
- glass-like navigation treatment where useful
- no redesign of the ATLAS logo
- no copied proprietary interface or branded visual asset from the reference video

The reference video supplies interaction and motion intent, not source code or proprietary artwork.

## 10. Data and Navigation Integrity

Spatial Entry v1 does not create fake module state. The only module call-to-action exposed as live is a route actually implemented in the repository milestone.

Navigation path to preserve and test:

`/ → /health → /health/research → /health/research/frontiers → /health/research/frontiers/disease-reconstruction`

Any future module nodes added to the spatial system must receive a real route and route-level tests before becoming interactive.

## 11. Accessibility and Fallbacks

Required behavior:

- semantic `main`, heading, navigation, and link/button elements
- visible keyboard focus
- skip-to-content support in the shared shell
- color contrast suitable for dark UI
- `prefers-reduced-motion` respected both in CSS and scene execution
- WebGL failure does not remove content or navigation
- canvas excluded from the accessibility tree
- mobile viewport does not require horizontal scrolling

## 12. Testing Gates

Before completion can be claimed:

- dependency install succeeds
- TypeScript typecheck passes
- Vite production build passes
- unit tests pass
- evidence/graph/reconstruction/curability domain tests pass
- route test confirms `/` renders Spatial Entry
- route test confirms the ATLAS Health action navigates to `/health`
- fallback test confirms content/action remain available when WebGL support is false
- reduced-motion test confirms animated scene is not required for navigation
- supported Health routes render without 404 behavior
- no unresolved imports remain in `App.tsx`
- no `href="#"`
- no console-only action buttons
- no secrets committed
- no fake production status

## 13. Production Gate

This branch is not production merely because the build passes. Production requires a successful merge into the intended release branch, an authorized deployment workflow, successful deployment evidence, and verification of the deployed URL. Until those gates are observed, the result must be described as repository implementation or staging/development only.

## 14. Acceptance Criteria

Spatial Entry v1 is accepted when a user can install and build the web application from the repository, open `/`, see a cinematic generated ATLAS landing experience on capable devices, use a fully functional static equivalent on reduced-motion/WebGL-limited devices, enter the real ATLAS Health module, navigate the declared Health research flow, and return without broken imports, fabricated live data, or placeholder navigation.
