# ATLAS Module Visual Collection — Design Specification

Date: 2026-10-05
Status: Approved design, implementation not started
Scope: ATLAS Enterprise Suite visual module library

## 1. Problem

The current `/suite` experience reuses four generic WebP assets and rotates them across modules by array index. That creates repetition, weak semantic connection between image and capability, and inconsistent perceived quality. The current design assets are also too small to serve as a durable Retina/HiDPI source system.

ATLAS requires a production-grade visual identity in which every canonical module has a distinct, immediately recognizable cover while remaining part of one coherent product family.

## 2. Goal

Create the **ATLAS Visual Collection**: one unique master visual for every canonical module, grouped into domain families but mapped deterministically by `module.id` rather than by position. The system must preserve ATLAS brand cohesion, support responsive delivery, and enforce image-quality gates before production.

Success means:

- every canonical module has its own intentional cover;
- no module receives a generic rotated placeholder;
- each cover communicates the actual module function at first glance;
- visual families remain coherent across Finance, Business, Platform, Intelligence, Communications, People, Health, Creative, Mobility, Spatial, Hospitality, Protection, Entertainment, Operations and related domains;
- images remain sharp on 1× and 2× DPR displays across desktop, tablet and mobile;
- inaccessible, undersized, distorted or visibly degraded assets fail the release gate.

## 3. Design Direction

The collection should feel like a premium product editorial system rather than a dashboard decorated with stock imagery. The shared ATLAS visual DNA is:

- cinematic but functional composition;
- realistic or high-end architectural/technical rendering rather than generic abstract gradients;
- controlled depth, lighting and focal hierarchy;
- premium materials, restrained futuristic interfaces and integrated data surfaces;
- clean negative space for readable labels and status overlays;
- strong semantic storytelling tied to each module's job;
- no copied third-party interface language and no dependence on external brand marks.

The visual system must look intentionally art-directed as one collection, while each domain receives its own subject language.

## 4. Domain Families

Each module receives a unique image, but related modules share a family vocabulary.

### Intelligence
Assistant, Knowledge Atlas and Bible OS use cognition, knowledge structures, research surfaces and high-density information environments.

### Business
Business Suite, Revenue Operations, Advisory, CRM, Commerce and Analytics use executive environments, customer/revenue flows, market intelligence and operational command spaces.

### Finance
Finance, Accounting, ATLAS Pay and ATLAS Tax use financial control rooms, ledgers, capital flows, compliant payment infrastructure and structured document intelligence.

### Platform
Cloud, Work, Automations, Galaxy, Device OS, Release Control and Universal Execution use infrastructure, orchestration, control planes, computing fabric and system-state visualization.

### Communications
Connect and Telecom use resilient terrestrial/cellular/satellite communication infrastructure, network topology and governed connectivity.

### People
People, Payroll and Learning use workforce environments, learning systems and trustworthy human operations.

### Health / Protection
Health and Insurance use evidence-first biomedical, research, wellbeing and coverage imagery without implying unsupported medical outcomes.

### Creative
Studio, Site Review and Voice use cinematic production, editorial review, media creation and acoustic/conversational intelligence.

### Entertainment / Hospitality
Events, Frontier and Hospitality use premium venues, live production, immersive environments and service operations.

### Operations
Inventory & Purchasing uses warehouse, receiving, procurement and material-flow imagery.

### Mobility / Spatial
Ride, GPS 4D, Digital City and Aviation use connected mobility, live mapping, spatial twins, urban systems, routing and advanced aviation environments.

## 5. Module-to-Asset Contract

The visual assignment must stop depending on array index. Introduce a canonical mapping keyed by module ID, for example:

```ts
export type AtlasModuleVisual = {
  master: string;
  avif?: string;
  webp: string;
  srcSet?: string;
  sizes?: string;
  focalPoint?: string;
  alt: string;
  family: string;
};

export const MODULE_VISUALS: Record<AtlasModuleDefinition['id'], AtlasModuleVisual> = {
  // one explicit visual contract per canonical module
};
```

The exact implementation shape may vary if existing utilities provide a better fit, but the following invariants are mandatory:

1. Lookup is deterministic by `module.id`.
2. Every canonical module has exactly one configured cover contract.
3. Missing visual metadata is a test failure, not a runtime silent fallback.
4. A fallback may exist only for controlled error handling and must not mask incomplete production configuration.
5. Primary-system cards and A-Z module cards resolve from the same visual source of truth.

## 6. Asset Architecture

Use a dedicated hierarchy such as:

```text
apps/web/public/atlas/visuals/modules/<module-id>/
  master.webp
  cover-640.avif
  cover-1280.avif
  cover-1920.avif
  cover-640.webp
  cover-1280.webp
  cover-1920.webp
```

Equivalent naming is acceptable if it remains deterministic and testable.

Master sources must be at least 2× the largest intended rendered size for the relevant crop. Production derivatives should favor AVIF with WebP fallback where browser support or pipeline constraints require it.

The visual pipeline must preserve original aspect ratio. `object-fit: cover` may crop intentionally; it must never stretch the image. Module-level focal-point metadata should control important subjects when responsive crops differ.

## 7. Responsive Rendering

Covers must use `srcset`/`sizes` or an equivalent responsive-image mechanism. Desktop, tablet and mobile must receive appropriately sized assets rather than downloading one oversized source everywhere.

Required behaviors:

- Retina/HiDPI sharpness at 2× DPR;
- no upscaling beyond the validated source envelope;
- no layout shift caused by unknown image dimensions;
- lazy loading below the fold;
- eager/high-priority loading only where visually justified above the fold;
- async decoding where appropriate;
- readable text contrast independent of the underlying image.

The overlay system must be deliberate. A module image may never be darkened so aggressively that detail is lost simply to rescue text readability; use focal composition, localized gradients and contrast-aware treatment instead.

## 8. Accessibility

Decorative imagery may use empty alt text only when all meaning is already conveyed by the visible card label and description. If a visual communicates unique information, it requires concise semantic alt text.

Readiness, evolution and access state remain text-based; imagery must never become the sole carrier of operational state.

Reduced-motion settings must not degrade image legibility if parallax or hover depth is later added.

## 9. IMAGE QUALITY GATE

This is a permanent production requirement.

`IMAGE QUALITY GATE: PASS únicamente si no hay pixelación visible a 1×/2× DPR, deformación, compresión perceptible ni pérdida de detalle.`

Automated checks should verify at minimum:

- every canonical `module.id` has visual metadata;
- every configured asset path exists;
- minimum source dimensions are met;
- expected responsive variants exist;
- aspect-ratio metadata is valid;
- unsupported tiny placeholder files are rejected;
- duplicate source assignment across unrelated modules is detected unless explicitly allowed;
- production cards no longer use index-based image rotation.

Visual QA remains mandatory because automated checks cannot reliably detect all perceptual defects. Verification must include representative desktop and mobile screenshots at 1× and 2× DPR or equivalent browser-device emulation.

## 10. Migration Strategy

The four current generic `/atlas/design/*` covers stop serving as the production source for `/suite` once the new collection passes all gates. They should not be deleted blindly if other routes still reference them; first search the repository, migrate references intentionally, then remove only assets proven unused.

Migration order:

1. establish the module visual metadata contract and failing completeness tests;
2. add the new per-module asset set;
3. update Primary Systems to resolve by module identity;
4. update A-Z cards to resolve by module identity;
5. add responsive rendering and focal behavior;
6. enforce IMAGE QUALITY GATE tests;
7. verify visual quality across desktop/tablet/mobile;
8. remove obsolete `/suite` dependencies on the four generic covers;
9. delete only genuinely unused legacy assets after repository-wide reference verification.

## 11. Testing Strategy

Implementation must follow TDD.

Unit/contract tests should cover:

- registry-to-visual completeness;
- uniqueness rules;
- deterministic visual lookup;
- absence of index-based cover selection;
- expected responsive sources and sizes;
- focal metadata validation;
- legacy-cover independence for `/suite`.

Component tests should assert that primary and A-Z cards select the visual associated with the module ID and preserve readiness/evolution/access labels.

Build and production-readiness workflows remain fail-closed. No visual change may bypass existing route, security-header, health, accessibility or global production verification gates.

## 12. Non-Goals

This phase does not redesign module functionality, change canonical routes, alter readiness semantics, or invent new backend data sources. It also does not replace the ATLAS logo system unless a later approved design explicitly scopes that work.

## 13. Rollout and Verification

The implementation ships through a feature branch and PR. Before merge:

- TDD RED/GREEN evidence exists;
- unit/component/build/accessibility gates are green;
- visual screenshots are reviewed for representative module families;
- no current module lacks a visual;
- no existing product functionality is regressed.

After merge, the canonical ATLAS deployment workflow must verify production. The release is not complete until the production origin passes the existing fail-closed health/security/route contract and `/suite` visibly serves the new collection.

## 14. Acceptance Criteria

The design is accepted only when:

- all canonical modules have unique, semantically appropriate covers;
- the assignment is keyed by `module.id`;
- the same visual metadata source drives both Primary Systems and A-Z cards;
- images are sharp and artifact-free at required DPRs;
- responsive derivatives are implemented;
- no image is stretched or incorrectly cropped;
- status/readiness information remains truthful and accessible;
- legacy generic rotation is gone from `/suite`;
- automated image-quality checks pass;
- visual QA passes desktop and mobile;
- CI, deployment and production verification pass without bypass.
