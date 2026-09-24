# ATLAS Galaxy Map Design

Date: 2026-09-15
Status: Approved design, specification committed for review
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Branch: `feat/atlas-galaxy-map`
Owner: ATLAS Platform / Navigation

## Objective

Create a first-class spatial navigation surface for ATLAS Enterprise Suite that visualizes selected modules as an interconnected constellation while preserving the existing ATLAS shell, routing, authentication, RBAC, provider-truth, and production security boundaries.

The Galaxy Map is navigation and operational context, not a parallel application and not a source of truth. It must derive route/readiness state from existing ATLAS registries and authenticated context wherever possible.

## Product route

- New protected route: `/galaxy`
- Rendered inside the existing `AtlasShell`
- Protected by `RequireAtlasIdentity`
- Added to primary ATLAS navigation as `Galaxy`
- Must not bypass Cloudflare Access, Supabase Auth, tenant scope, RLS, or RBAC

## Architecture

The implementation lives under `apps/web/src/modules/galaxy` and reuses the existing module registry in `apps/web/src/modules/registry.ts`.

The Galaxy surface owns only spatial presentation metadata such as coordinates, visual category, and graph dependencies. Canonical module identity, route, readiness, authentication requirement, and product description remain owned by the existing ATLAS module registry.

The UI must use existing React/CSS conventions. Do not introduce Tailwind or `lucide-react` solely for this feature.

## Files and responsibilities

### `apps/web/src/modules/galaxy/galaxyModel.ts`

Owns the spatial graph configuration and pure state resolution logic.

Exports:

- `GalaxyCategory = 'core' | 'financial' | 'operations' | 'security'`
- `GalaxyNodeStatus = 'active' | 'available' | 'blocked' | 'warning' | 'executing' | 'unverified'`
- `GalaxyNodeDefinition`
- `GalaxyNodeView`
- `GALAXY_NODE_DEFINITIONS`
- `buildGalaxyNodes(input)`

`GALAXY_NODE_DEFINITIONS` may contain only spatial metadata and references to existing module IDs or verified routes. It must not contain fabricated business metrics.

### `apps/web/src/modules/galaxy/AtlasGalaxyMap.tsx`

Owns interactive rendering, filters, node selection, connection lines, accessibility behavior, and empty states.

### `apps/web/src/modules/galaxy/AtlasGalaxyPage.tsx`

Owns route-level composition. It resolves authenticated organization context, builds node views, and navigates through React Router.

### `apps/web/src/modules/galaxy/galaxy.css`

Owns responsive constellation layout, node states, filters, connection lines, reduced-motion behavior, and mobile adaptation.

## Node model

Initial visual nodes:

1. `core` — ATLAS Core Intelligence
2. `finance` — Capital Galaxy
3. `accounting` — Ledger Constellation
4. `crm` — Relationship Constellation
5. `security` — Zero-Trust Shield Grid
6. `payroll` — People Pay Network
7. `inventory` — Supply Network

Each node has:

- `id`
- `label`
- `category`
- `coordinates: { x: number; y: number }`
- `dependencies: string[]`
- `moduleId?: string`
- `route?: string`

Rules:

- `moduleId` references an existing `ATLAS_MODULES` entry when one exists.
- `route` is allowed only for a verified existing route that is not represented as a first-class module registry entry.
- If neither a module nor verified route exists, the node remains visible only as unavailable/unverified and is not navigable.
- Visual dependencies describe navigation/system relationships only; they do not imply runtime service dependency unless separately proven.

## Truthful status resolution

Status must be derived without fabricated telemetry.

### Registry-backed modules

Map `AtlasModuleReadiness` as follows:

- `implemented` -> `active`
- `partial` -> `warning`
- `external-gated` -> `available` unless a verified provider/authorization condition supplies a more specific state

### Route-only nodes

- Existing protected route verified in the current route graph -> `available` or `active` based on authenticated availability
- Missing route -> `unverified`

### Authentication / authorization

- A module that requires auth but has no resolved ATLAS identity -> `blocked`
- A route known to require privileges not held by the user -> `blocked`
- The Galaxy page itself requires identity, so normal authenticated rendering should have organization context

### Execution state

`executing` may be used only when a real execution/readiness source reports a currently running operation. No synthetic animation may imply execution.

## Metrics and badges

No hard-coded production-looking metrics are permitted.

Specifically prohibited unless sourced from real production data at render time:

- `99.99% uptime`
- `$42.8M Liq.`
- `1,420 Active`
- `Secured 256-bit`
- invented approval counts
- invented connected/live state

Allowed labels include truthful state descriptions such as:

- `Implemented`
- `Partial`
- `External connection required`
- `Identity required`
- `Not registered`
- `Provider not configured`
- `Configuration required`

Approval badges render only when a real existing ATLAS approvals/readiness source returns a count for the authenticated tenant. If no such source is integrated in this slice, approval badges are omitted.

## Initial routing map

- `core` -> `/`
- `finance` -> `/finance`
- `accounting` -> `/finance/accounting`
- `crm` -> `/crm`
- `security` -> `/execution/manager/readiness`
- `payroll` -> `/payroll`
- `inventory` -> not navigable until a canonical inventory route exists

The CRM node must preserve the existing protected flow:

`Cloudflare Access -> ATLAS browser identity -> RequireAtlasIdentity -> CRM route -> Supabase/RBAC/provider boundary`

The Galaxy feature must not make `/crm` public or alter its outer Access boundary.

## Filtering

Filters:

- All
- Core
- Financial
- Operations
- Security

Requirements:

- Implement as buttons with `aria-pressed`
- Keyboard focus visible
- Filtering affects nodes and connection lines consistently
- A connection line is rendered only when both endpoint nodes are currently visible
- Empty filtered results show an explicit empty state rather than a blank canvas

## Navigation behavior

- Navigable node uses React Router navigation
- Blocked/unverified node does not navigate
- Disabled node communicates why it cannot open
- Node selection must never use `window.location` for internal navigation
- Browser back/forward remains functional

## Accessibility

- All interactive nodes are native buttons or links with accessible names
- Status is exposed as text, not color alone
- Filter buttons use `aria-pressed`
- Keyboard navigation reaches every interactive node
- `prefers-reduced-motion` disables nonessential pulsing/spinning/bouncing effects
- Mobile layout must preserve readable labels and tap targets
- SVG connection lines are decorative and hidden from assistive technology

## Responsive behavior

Desktop:

- Spatial constellation with absolute-positioned nodes and SVG connections

Tablet:

- Same topology with scaled node dimensions and preserved labels

Mobile:

- Replace fragile absolute constellation positioning with a stacked/list spatial summary if viewport constraints make the graph unreadable
- Preserve categories, statuses, dependencies, and navigation
- Do not force horizontal scrolling for primary interaction

## Security

- `/galaxy` is protected with `RequireAtlasIdentity`
- Cloudflare Access remains the outer application perimeter
- Supabase RLS/RBAC remains authoritative for tenant data
- No secrets, tokens, provider credentials, internal IDs, or raw error payloads render in the node UI
- Galaxy status never upgrades a user's permissions
- A visual node being visible does not imply authorization to the destination module

## Error and loading states

Loading:

- Show a neutral `Resolving ATLAS module state` state while authenticated context is unresolved

Error:

- If module-state resolution fails, render nodes with conservative `unverified` state and a non-sensitive error summary
- Do not present stale or guessed production telemetry

Empty:

- If a filter has no visible nodes, render `No modules match this filter`

## Integration points

### `apps/web/src/modules/registry.ts`

Add a first-class `galaxy` module entry:

- id: `galaxy`
- title: `ATLAS Galaxy`
- navLabel: `Galaxy`
- area: `Platform`
- route: `/galaxy`
- readiness: `implemented` after tests pass
- requiresAuth: `true`
- description: spatial navigation and module-state overview
- showInNavigation: `true`

The Galaxy renderer must exclude the `galaxy` registry entry from its own constellation unless explicitly added later.

### `apps/web/src/extensions/resolveAtlasExtension.tsx`

Register `/galaxy` using the same extension pattern as CRM:

- wrap with `RequireAtlasIdentity`
- return `AtlasGalaxyPage`

`App.tsx` will continue wrapping resolved extensions with `AtlasShell`.

### `apps/web/src/main.tsx`

Import `galaxy.css` only. Do not restructure unrelated routing in this feature.

## Testing

### Unit tests

Create `tests/unit/galaxy-model.test.ts` covering:

- registry readiness -> node status mapping
- auth-required node becomes blocked without identity
- missing inventory route remains unverified/non-navigable
- no hard-coded fabricated metrics are emitted by the model
- connection visibility can be computed from filtered endpoints

Create `tests/unit/galaxy-map.test.tsx` covering:

- renders all initial node labels
- filter selection changes visible nodes
- `aria-pressed` state is correct
- blocked/unverified node cannot navigate
- CRM node navigates to `/crm`
- no fabricated metric strings render

### Integration tests

Create `tests/integration/galaxy-route.test.tsx` covering:

- `/galaxy` is registered
- identity gate is present
- authenticated Galaxy renders inside the ATLAS shell
- selecting CRM transitions to `/crm`
- back navigation returns to `/galaxy`

### Regression verification

Run:

1. `npm run typecheck`
2. `npm run test:unit`
3. `npm run test:integration`
4. `npm run build`
5. `npm run verify:all`

The feature is not complete unless the exact branch HEAD passes the repository verification contract.

## Production verification

After merge and deployment, verify:

1. `/galaxy` through an authenticated Cloudflare Access session
2. ATLAS identity resolves
3. Galaxy renders inside `AtlasShell`
4. CRM node opens `/crm`
5. CRM remains protected
6. Inventory remains visibly unavailable if no route exists
7. No fabricated business/security metric is shown
8. Desktop, tablet, and mobile behavior is usable
9. Anonymous access does not bypass the intended Access boundary

## Non-goals

This slice does not:

- create a new inventory subsystem
- create a new security control plane
- add a real-time telemetry backend
- fabricate approval queues
- change Cloudflare Access policy
- migrate ATLAS session storage
- add Tailwind
- add `lucide-react`
- redesign the ATLAS shell
- replace existing module routes

## Acceptance criteria

The design is complete when `/galaxy` is a protected, responsive, accessible ATLAS navigation surface that uses existing canonical module/routing state, navigates to real modules, clearly blocks unavailable nodes, preserves CRM and Cloudflare security boundaries, and contains no fabricated production metrics or connection claims.
