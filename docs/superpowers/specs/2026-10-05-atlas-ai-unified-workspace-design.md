# ATLAS AI Unified Workspace — Design Specification

Date: 2026-10-05
Status: Proposed for implementation
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Owner: ATLAS Intelligence Platform / Studio / Work OS
Primary surfaces: `/assistant`, `/studio`, `/work`, `/projects`, `/research`, `/developer`

## 1. Purpose

Create one governed ATLAS AI workspace that combines the strongest product patterns of modern AI assistants without copying proprietary branding, layouts, code, pricing, or provider contracts.

The target navigation is:

`ATLAS Home → AI Chat → Work → Projects → Deep Research → Skills → Agents → Create → Canvas → Library → Notebooks → Pages → Apps/Plugins → Scheduled → Voice/Live → Vision → Developer`

The implementation must reuse current ATLAS Assistant, Studio, Creator, Work OS, provider readiness, asset library, governance, identity, audit, and deployment controls instead of creating parallel silos.

## 2. Existing ATLAS state to preserve

The repository already contains:

- canonical Assistant ownership at `/assistant`;
- authenticated Studio at `/studio`;
- ATLAS AI Universe under Studio;
- Image Lab, ATLAS Director, Music Lab, Voice & Agents, Writing Desk, Content Intelligence, Creator Library, and Provider Readiness;
- Work & Productivity surfaces;
- provider-neutral readiness and execution contracts;
- server-side provider secret boundaries;
- tenant, RBAC, stewardship/governance, immutable audit, cost policy, and fail-closed execution principles;
- production P0 verification and deployment gates.

This specification is additive. Existing working routes remain valid and become destinations in a single navigation registry.

## 3. Design approach

### Chosen approach: unified shell + route registry + capability registry

Build a shared `AtlasAIWorkspaceShell` around existing ATLAS surfaces. Navigation comes from one typed registry. Capabilities come from a separate registry that declares readiness, permissions, supported modes, execution class, and destination route.

Why this approach:

1. avoids rewriting existing products;
2. prevents duplicate sidebars and conflicting route maps;
3. lets Work, Studio, Assistant, mobile, desktop, and future spatial clients consume the same navigation contract;
4. preserves existing provider-neutral execution and audit boundaries;
5. supports gradual rollout by capability instead of an all-at-once replacement.

### Rejected approach A: create a new `/ai` monolith

Rejected because it would duplicate Assistant, Studio, Creator, and Work OS and create migration risk.

### Rejected approach B: keep every product isolated and only add cross-links

Rejected because it preserves fragmentation, inconsistent permission handling, and duplicated navigation logic.

## 4. Information architecture

### 4.1 Primary navigation

The primary ATLAS AI workspace exposes these ordered destinations:

1. **AI Chat** — canonical conversation and orchestration workspace.
2. **Work** — multi-step execution, artifacts, connected apps, and task completion.
3. **Projects** — persistent project context, files, instructions, sources, and collaboration.
4. **Deep Research** — research plans, sources, evidence, synthesis, and export.
5. **Skills** — reusable ATLAS-authored and organization-authorized capability instructions.
6. **Agents** — governed specialized agents, including voice/telephony agents where allowed.
7. **Create** — Image Lab, Director, Music, Voice, graphics, templates, and multimodal creation.
8. **Canvas** — interactive editable workspace for documents, code, layouts, and generated artifacts.
9. **Library** — user and organization assets, outputs, prompts, productions, provenance, and reusable resources.
10. **Notebooks** — persistent research/work notebooks with references, instructions, and analysis context.
11. **Pages** — lightweight publishable/editable knowledge or work pages.
12. **Apps / Plugins** — connected services, ATLAS extensions, and approved external capabilities.
13. **Scheduled** — recurring tasks and condition watches.
14. **Voice / Live** — real-time voice interactions and compatible multimodal sessions.
15. **Vision** — image, screen, spatial, and camera-assisted understanding where platform permissions allow.
16. **Developer** — development workspace, APIs, Codex-style software workflows, logs, and deployment controls.

### 4.2 Route strategy

Existing canonical routes are preferred. New aliases may exist only when they resolve to an existing canonical destination.

Proposed canonical/alias map:

- AI Chat → existing `/assistant`.
- Work → existing Work OS route(s), with a stable `/work` entry if not already canonical.
- Projects → `/projects` shell backed by existing project data/contracts when available.
- Deep Research → `/research`.
- Skills → `/skills`.
- Agents → `/agents` with links to existing `/studio/voice` and specialized governed agents.
- Create → existing `/studio/create`.
- Canvas → `/canvas` as an editable workspace that can host existing ATLAS document/code/artifact editors.
- Library → existing `/studio/library`, optionally aliased from `/library`.
- Notebooks → `/notebooks`.
- Pages → `/pages`.
- Apps/Plugins → `/apps`, integrating the current ATLAS extension/app registry.
- Scheduled → `/scheduled`.
- Voice/Live → existing `/studio/voice` or canonical voice surface.
- Vision → `/vision`, delegating to existing image/spatial/vision components.
- Developer → `/developer`, linking code, API, logs, provider readiness, deploy, and repository tooling.

Aliases must not introduce duplicate data stores or separate execution engines.

## 5. Navigation registry

Create one typed registry, for example:

`apps/web/src/ai-workspace/navigation.ts`

Each entry contains:

- stable `id`;
- display label;
- canonical route;
- optional aliases;
- icon token;
- capability group;
- minimum permission;
- optional feature/readiness gate;
- platform availability (`web`, `mobile`, `desktop`, `visionos`);
- visibility state;
- search keywords;
- optional child destinations.

No UI component may hardcode a second independent list of primary AI destinations.

## 6. Capability registry

Create or extend a provider-neutral capability registry that maps user outcomes to existing engines and routes.

A capability record must declare:

- `capabilityId`;
- modality/outcome;
- owning ATLAS module;
- destination route;
- execution class: `local`, `atlas-native`, `provider-backed`, `prompt-export-only`, or `planning-only`;
- readiness source;
- permission policy;
- cost policy class;
- audit requirement;
- persistence contract;
- supported platforms.

The registry must never infer that a provider is connected from client-side configuration alone.

## 7. Shared workspace shell

Introduce a reusable shell, for example:

`apps/web/src/ai-workspace/AtlasAIWorkspaceShell.tsx`

Responsibilities:

- render responsive navigation;
- expose active route and breadcrumb context;
- host global search/command entry;
- expose account/organization context;
- surface capability readiness truthfully;
- preserve current page content via nested routing/outlets;
- provide consistent loading, empty, error, offline, disabled, unauthorized, and unavailable states;
- expose contextual Assistant access without duplicating conversation ownership.

The shell must not own provider execution logic.

## 8. Responsive behavior

### Desktop

- persistent collapsible left navigation;
- main workspace;
- optional contextual right rail for history, sources, properties, or readiness;
- keyboard navigation and command palette.

### Tablet

- collapsible drawer;
- main workspace remains primary;
- contextual rail becomes modal/drawer.

### Mobile

- compact top bar;
- bottom navigation limited to the highest-frequency destinations;
- full destination list in drawer/search;
- no loss of capability compared with desktop except platform-specific Vision/Developer limitations.

### Spatial / future devices

Consume the same navigation registry and expose only destinations supported by the platform contract.

## 9. Permissions and governance

Every destination uses existing ATLAS Identity and organization scope.

Required rules:

1. hidden versus disabled state must be policy-driven, not arbitrary UI logic;
2. routes enforce authorization server-side or through existing protected boundaries;
3. provider secrets never reach browser-visible configuration;
4. paid/provider-backed execution remains subject to cost policy;
5. high-risk actions require existing approval/stewardship policy;
6. all significant execution records organization, actor, capability, policy decision, provider/engine when relevant, result state, and immutable evidence metadata;
7. cross-tenant data access is forbidden by default.

## 10. State model

Every primary destination must support these truthful states where relevant:

- `loading`;
- `ready`;
- `empty`;
- `offline`;
- `disabled_by_policy`;
- `unauthorized`;
- `provider_unavailable`;
- `configuration_required`;
- `quota_or_cost_blocked`;
- `error`;
- `degraded`.

The UI must not display “connected”, “ready”, “generated”, “saved”, “deployed”, or equivalent success language without evidence from the authoritative backend/runtime.

## 11. Search and command model

Provide one command/search surface that can locate:

- destinations;
- project workspaces;
- saved assets;
- notebooks/pages;
- approved apps/plugins;
- agents;
- skills;
- recent conversations;
- provider/model capabilities;
- developer/deployment surfaces when authorized.

Search results must honor tenant and RBAC boundaries before rendering.

## 12. Skills model

ATLAS Skills are reusable instruction/capability packages, not unrestricted arbitrary code.

Minimum contract:

- name and version;
- owner and organization scope;
- purpose;
- instructions;
- optional approved reference files;
- allowed tools/capabilities;
- permission requirements;
- audit metadata;
- lifecycle state (`draft`, `approved`, `deprecated`, `disabled`).

Organization-controlled skills require review/approval before broad availability.

## 13. Agents model

ATLAS Agents are governed actors using approved capabilities.

Each agent declares:

- identity;
- objective;
- allowed skills;
- allowed apps/plugins;
- data scopes;
- execution budget/cost policy;
- human/approval gates when required;
- channels such as text, voice, telephony, or scheduled execution;
- audit and evidence policy.

Agents cannot silently escalate permissions or provider access.

## 14. Projects, notebooks, and pages

These surfaces share a common context model rather than separate storage silos.

A context container may reference:

- organization;
- members/permissions;
- instructions;
- files/assets;
- conversations;
- research evidence;
- notebook sections;
- pages;
- tasks/automations;
- provenance and audit metadata.

Existing data models must be reused where possible before adding new schema.

## 15. Apps and plugins

ATLAS Apps/Plugins is a governed extension layer.

The UI must distinguish:

- installed and authorized;
- available but not connected;
- organization-approved;
- organization-blocked;
- connection expired/degraded;
- unsupported on the current platform.

Connection state comes from authoritative server/runtime checks.

## 16. Scheduled work

Scheduled execution uses one task model supporting:

- one-time tasks;
- recurring tasks;
- condition watches;
- event-driven triggers when a connected provider supports them.

Every scheduled task stores owner, tenant, schedule/condition, capability permissions, target apps, last run state, next eligible run, evidence, and failure state.

No background execution claim may be shown unless the scheduling backend confirms registration.

## 17. Voice, Live, and Vision

Voice/Live and Vision are modes over the same identity, permissions, conversation/context, app, and audit layers.

They must not create separate user profiles, separate provider credentials, or incompatible histories.

Camera, screen, microphone, or spatial input requires explicit platform permission and visible active-session state.

## 18. Developer workspace

Developer is the governed software-engineering surface for authorized users.

It may expose:

- code/repository context;
- issues/PRs;
- tests;
- logs;
- API explorer;
- provider readiness;
- environment/deployment status;
- release controls;
- production verification evidence.

It reuses ATLAS Deploy and existing release-control contracts rather than bypassing them.

## 19. Component boundaries

Expected new or consolidated components:

- `AtlasAIWorkspaceShell` — layout only;
- `AIWorkspaceNav` — registry-driven navigation;
- `AIWorkspaceCommandPalette` — authorized global search/actions;
- `CapabilityBadge` — evidence-derived availability/readiness;
- `WorkspaceContextSwitcher` — user/org/project context;
- `AIWorkspaceRouteGuard` — capability/permission gate wrapper;
- `AIWorkspaceMobileNav` — mobile representation of the same registry.

Existing domain pages remain responsible for their own execution, forms, data loading, and domain-specific state.

## 20. Data flow

1. authenticated user enters an AI workspace route;
2. shell resolves organization and actor context;
3. navigation registry filters destinations through permission/platform policy;
4. route guard validates access;
5. destination page loads its authoritative backend state;
6. capability/provider readiness is fetched from existing governed endpoints;
7. actions execute through existing domain APIs/adapters;
8. results are persisted through existing domain contracts;
9. audit/evidence metadata records policy and execution truth;
10. shell updates recent/history surfaces only after confirmed persistence.

## 21. Error handling

- permission failures → explicit unauthorized/forbidden state;
- provider not configured → configuration required, never fabricated readiness;
- provider outage → degraded/provider unavailable;
- failed persistence after provider success → generation/execution is not presented as fully saved;
- cost/quota block → explicit governed block state;
- network loss → offline state with no false success;
- unknown registry destination → safe 404/fallback, never implicit unrestricted routing.

## 22. Accessibility

Minimum requirements:

- keyboard-operable navigation;
- correct landmarks and active-route semantics;
- visible focus treatment;
- reduced-motion support;
- text equivalents for icons;
- screen-reader labels for readiness and state;
- mobile touch targets meeting existing ATLAS accessibility standards;
- color is never the sole indication of readiness/error state.

## 23. Testing strategy

Implementation must follow TDD.

Required test layers:

### Unit

- navigation registry ordering and uniqueness;
- alias resolution;
- permission/platform filtering;
- capability state mapping;
- command-palette result filtering;
- fail-closed provider state;
- responsive navigation rendering.

### Integration

- protected route access;
- shell + nested existing Studio/Assistant/Work routes;
- project/context switching;
- capability readiness from authoritative endpoints;
- app/plugin connection states;
- scheduled-task registration truth.

### End-to-end

- Desktop: navigate every enabled primary destination.
- Mobile: drawer/bottom-nav route coverage.
- Unauthorized user: restricted routes remain inaccessible.
- Degraded provider: UI reports unavailable/degraded and blocks execution.
- Existing `/assistant`, `/studio`, Creator Library, Provider Readiness, and Work surfaces remain functional.

### Production verification

P0:

- root app shell returns healthy response;
- authenticated AI workspace shell loads;
- `/assistant` and `/studio` remain reachable under their current protection model;
- no primary navigation destination resolves to a fake placeholder route;
- provider-backed actions fail closed without readiness;
- production security headers and health checks continue passing.

P1:

- every secondary AI destination route resolves;
- visual active states match route;
- responsive navigation works at desktop/tablet/mobile breakpoints;
- command search returns only authorized resources.

## 24. Migration and rollout

Wave 1 — foundation

- navigation registry;
- shared shell;
- map existing Assistant, Studio, Creator, Library, Voice, Provider Readiness, and Work surfaces;
- route and permission tests.

Wave 2 — unified productivity

- Projects;
- Deep Research entry;
- Skills;
- Agents;
- Canvas;
- Notebooks;
- Pages;
- Apps/Plugins.

Wave 3 — automation and multimodal

- Scheduled;
- Live/Voice convergence;
- Vision entry;
- unified recent/history and global search.

Wave 4 — developer convergence

- Developer workspace;
- repository/CI/deploy/release integrations;
- production verification dashboard.

Each wave may ship independently only when its P0 gates pass.

## 25. Non-goals

This specification does not:

- clone ChatGPT, Gemini, Copilot, or another vendor interface;
- replace ATLAS Assistant conversation ownership;
- replace Studio/Creator execution engines;
- introduce a second provider registry;
- grant broader permissions by navigation visibility;
- claim unsupported providers or models are integrated;
- create fake placeholder actions or `href="#"` navigation;
- bypass deployment, audit, identity, RBAC, or stewardship controls.

## 26. Acceptance criteria

The design is implementation-ready when all of the following are true:

1. one typed registry defines primary ATLAS AI navigation;
2. existing canonical ATLAS surfaces are reused rather than duplicated;
3. all routes are identity/RBAC governed;
4. capability/provider status is evidence-derived and fail-closed;
5. desktop/tablet/mobile navigation derives from the same registry;
6. existing Studio, Assistant, Work, Creator, Library, and Provider Readiness continue functioning;
7. no destination is a non-functional placeholder;
8. unit/integration/E2E tests cover route, permissions, readiness, and responsive behavior;
9. production P0 verification includes the unified AI workspace without weakening existing gates;
10. implementation is delivered incrementally through tested waves rather than a monolithic rewrite.

## 27. Recommended implementation order

1. typed navigation registry;
2. shared route guard and capability state contract;
3. shared shell and desktop/mobile navigation;
4. attach existing `/assistant`, `/studio`, Work OS, Library, Voice, and provider readiness;
5. add command/search surface;
6. add missing productivity destinations only after reuse analysis confirms no existing equivalent;
7. add automation/vision/developer destinations;
8. complete P0/P1 production verification matrix.
