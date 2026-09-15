# ATLAS Galaxy Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-safe `/galaxy` spatial navigation surface that derives ATLAS module state from the canonical registry and authenticated context, preserves all existing security boundaries, and never fabricates telemetry.

**Architecture:** Add a focused `apps/web/src/modules/galaxy` feature consisting of a pure graph/state model, an interactive React constellation, a route-level page, and feature CSS. Reuse `ATLAS_MODULES`, `AtlasShell`, `RequireAtlasIdentity`, React Router, and cached authenticated organization context; do not create a parallel router, provider, registry, or status source. Register `/galaxy` through the existing extension resolver so `App.tsx` continues to wrap it with the canonical shell.

**Tech Stack:** React 18.3.1, TypeScript 5.7.x, React Router DOM 7.18.3, Vitest 3.2.6, Testing Library 16.1.x, existing CSS pipeline, Supabase-backed ATLAS identity/RBAC boundaries, Cloudflare Access perimeter.

**Spec:** `docs/superpowers/specs/2026-09-15-atlas-galaxy-map-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`.
- Work on branch `feat/atlas-galaxy-map`.
- New product route is `/galaxy`.
- `/galaxy` must remain behind `RequireAtlasIdentity`.
- Cloudflare Access remains the outer application perimeter.
- Supabase Auth, RLS and RBAC remain authoritative for tenant and authorization state.
- Reuse `apps/web/src/modules/registry.ts`; do not create a second module registry.
- Do not introduce Tailwind or `lucide-react` for this feature.
- Do not add hard-coded production-looking metrics, approval counts, provider connectivity, uptime, liquidity, security-strength claims, or execution state.
- If a state cannot be verified, render a conservative `unverified`, `available`, `warning`, or `blocked` state according to the spec.
- Internal navigation must use React Router, not `window.location`.
- Interactive status must be communicated with visible text, not color alone.
- Filters must use native buttons and `aria-pressed`.
- SVG connection lines are decorative and hidden from assistive technology.
- `prefers-reduced-motion` must disable nonessential animation.
- Mobile must not require horizontal scrolling for primary interaction.
- No secrets, tokens, provider credentials, raw backend errors, or internal identifiers may be rendered.
- No merge or production deploy until exact-head verification is green and separately approved by the normal ATLAS release gate.

---

## File Structure

- `apps/web/src/modules/galaxy/galaxyModel.ts` — spatial definitions plus pure status/view resolution.
- `apps/web/src/modules/galaxy/AtlasGalaxyMap.tsx` — interactive filters, node rendering, connection lines, accessible state text and disabled behavior.
- `apps/web/src/modules/galaxy/AtlasGalaxyPage.tsx` — authenticated route composition and Router navigation.
- `apps/web/src/modules/galaxy/galaxy.css` — desktop/tablet constellation, mobile list fallback, focus states and reduced-motion handling.
- `apps/web/src/modules/registry.ts` — canonical `galaxy` module registration only.
- `apps/web/src/extensions/resolveAtlasExtension.tsx` — protected `/galaxy` route registration.
- `apps/web/src/main.tsx` — one stylesheet import for `galaxy.css`.
- `tests/unit/galaxy-model.test.ts` — pure state mapping, no-fabrication and route safety tests.
- `tests/unit/galaxy-map.test.tsx` — filters, accessible state, node interaction, disabled nodes and visible-edge behavior.
- `tests/integration/galaxy-routing.test.tsx` — shell navigation, identity guard, route integration and CRM destination preservation.

---

### Task 1: Build the truthful Galaxy graph model

**Files:**
- Create: `apps/web/src/modules/galaxy/galaxyModel.ts`
- Create: `tests/unit/galaxy-model.test.ts`

**Interfaces:**
- Consumes: `ATLAS_MODULES` and `AtlasModuleDefinition` from `apps/web/src/modules/registry.ts`.
- Produces:
  - `GalaxyCategory = 'core' | 'financial' | 'operations' | 'security'`
  - `GalaxyNodeStatus = 'active' | 'available' | 'blocked' | 'warning' | 'executing' | 'unverified'`
  - `GalaxyNodeDefinition`
  - `GalaxyNodeView`
  - `GALAXY_NODE_DEFINITIONS`
  - `buildGalaxyNodes(input: { modules?: readonly AtlasModuleDefinition[]; hasIdentity: boolean }): GalaxyNodeView[]`

- [ ] **Step 1: Write the failing model tests**

Create `tests/unit/galaxy-model.test.ts` with assertions for canonical route mapping, readiness mapping, identity blocking, missing-inventory behavior, and absence of fabricated telemetry:

```ts
import { describe, expect, it } from 'vitest';
import { ATLAS_MODULES } from '../../apps/web/src/modules/registry';
import {
  GALAXY_NODE_DEFINITIONS,
  buildGalaxyNodes
} from '../../apps/web/src/modules/galaxy/galaxyModel';

describe('ATLAS Galaxy model', () => {
  it('maps canonical module readiness to truthful visual states', () => {
    const nodes = buildGalaxyNodes({ modules: ATLAS_MODULES, hasIdentity: true });
    expect(nodes.find((node) => node.id === 'finance')?.status).toBe('active');
    expect(nodes.find((node) => node.id === 'crm')?.status).toBe('available');
    expect(nodes.find((node) => node.id === 'payroll')?.status).toBe('warning');
  });

  it('preserves canonical routes and leaves inventory non-navigable', () => {
    const nodes = buildGalaxyNodes({ modules: ATLAS_MODULES, hasIdentity: true });
    expect(nodes.find((node) => node.id === 'crm')?.route).toBe('/crm');
    expect(nodes.find((node) => node.id === 'accounting')?.route).toBe('/finance/accounting');
    expect(nodes.find((node) => node.id === 'inventory')?.route).toBeNull();
    expect(nodes.find((node) => node.id === 'inventory')?.status).toBe('unverified');
  });

  it('blocks authenticated destinations when identity is absent', () => {
    const nodes = buildGalaxyNodes({ modules: ATLAS_MODULES, hasIdentity: false });
    expect(nodes.find((node) => node.id === 'crm')?.status).toBe('blocked');
    expect(nodes.find((node) => node.id === 'payroll')?.status).toBe('blocked');
  });

  it('contains no fabricated production telemetry in spatial definitions', () => {
    const serialized = JSON.stringify(GALAXY_NODE_DEFINITIONS);
    for (const forbidden of ['99.99%', '$42.8M', '1,420', '256-bit', 'approvalCount']) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
```

- [ ] **Step 2: Run the model test and confirm RED**

Run:

```bash
npx vitest run tests/unit/galaxy-model.test.ts
```

Expected: FAIL because `apps/web/src/modules/galaxy/galaxyModel.ts` does not exist.

- [ ] **Step 3: Implement the minimal graph model**

Create `apps/web/src/modules/galaxy/galaxyModel.ts` using only canonical module metadata plus explicit verified route-only nodes:

```ts
import {
  ATLAS_MODULES,
  type AtlasModuleDefinition
} from '../registry';

export type GalaxyCategory = 'core' | 'financial' | 'operations' | 'security';
export type GalaxyNodeStatus = 'active' | 'available' | 'blocked' | 'warning' | 'executing' | 'unverified';

export type GalaxyNodeDefinition = {
  id: string;
  label: string;
  category: GalaxyCategory;
  coordinates: { x: number; y: number };
  dependencies: string[];
  moduleId?: string;
  route?: string;
};

export type GalaxyNodeView = GalaxyNodeDefinition & {
  route: string | null;
  status: GalaxyNodeStatus;
  statusLabel: string;
  navigable: boolean;
};

export const GALAXY_NODE_DEFINITIONS: readonly GalaxyNodeDefinition[] = [
  { id: 'core', label: 'ATLAS Core Intelligence', category: 'core', coordinates: { x: 50, y: 50 }, dependencies: ['finance', 'crm', 'security'], route: '/' },
  { id: 'finance', label: 'Capital Galaxy', category: 'financial', coordinates: { x: 30, y: 35 }, dependencies: ['accounting'], moduleId: 'finance' },
  { id: 'accounting', label: 'Ledger Constellation', category: 'financial', coordinates: { x: 15, y: 25 }, dependencies: [], route: '/finance/accounting' },
  { id: 'crm', label: 'Relationship Constellation', category: 'operations', coordinates: { x: 70, y: 35 }, dependencies: ['core'], moduleId: 'crm' },
  { id: 'security', label: 'Zero-Trust Shield Grid', category: 'security', coordinates: { x: 50, y: 20 }, dependencies: [], route: '/execution/manager/readiness' },
  { id: 'payroll', label: 'People Pay Network', category: 'operations', coordinates: { x: 75, y: 65 }, dependencies: ['finance'], moduleId: 'payroll' },
  { id: 'inventory', label: 'Supply Network', category: 'operations', coordinates: { x: 25, y: 70 }, dependencies: [] }
] as const;

function readinessStatus(module: AtlasModuleDefinition): Pick<GalaxyNodeView, 'status' | 'statusLabel'> {
  if (module.readiness === 'implemented') return { status: 'active', statusLabel: 'Implemented' };
  if (module.readiness === 'partial') return { status: 'warning', statusLabel: 'Partial' };
  return { status: 'available', statusLabel: 'External connection required' };
}

export function buildGalaxyNodes(input: {
  modules?: readonly AtlasModuleDefinition[];
  hasIdentity: boolean;
}): GalaxyNodeView[] {
  const modules = input.modules ?? ATLAS_MODULES;
  const byId = new Map(modules.map((module) => [module.id, module]));

  return GALAXY_NODE_DEFINITIONS.map((definition) => {
    const module = definition.moduleId ? byId.get(definition.moduleId) : undefined;
    const route = module?.route ?? definition.route ?? null;

    if (module) {
      if (module.requiresAuth && !input.hasIdentity) {
        return { ...definition, route, status: 'blocked', statusLabel: 'Identity required', navigable: false };
      }
      const resolved = readinessStatus(module);
      return { ...definition, route, ...resolved, navigable: Boolean(route) };
    }

    if (!route) {
      return { ...definition, route: null, status: 'unverified', statusLabel: 'Not registered', navigable: false };
    }

    return { ...definition, route, status: 'available', statusLabel: 'Available', navigable: true };
  });
}
```

Do not add runtime metrics, approval counts, provider connection state or synthetic execution state in this task.

- [ ] **Step 4: Run the model test and confirm GREEN**

Run:

```bash
npx vitest run tests/unit/galaxy-model.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add apps/web/src/modules/galaxy/galaxyModel.ts tests/unit/galaxy-model.test.ts
git commit -m "feat: add truthful ATLAS Galaxy graph model"
```

---

### Task 2: Build the accessible interactive constellation

**Files:**
- Create: `apps/web/src/modules/galaxy/AtlasGalaxyMap.tsx`
- Create: `tests/unit/galaxy-map.test.tsx`

**Interfaces:**
- Consumes: `GalaxyCategory`, `GalaxyNodeView` from `galaxyModel.ts`.
- Produces: `AtlasGalaxyMap({ nodes, onSelectNode }: { nodes: readonly GalaxyNodeView[]; onSelectNode: (node: GalaxyNodeView) => void })`.

- [ ] **Step 1: Write failing interaction tests**

Create `tests/unit/galaxy-map.test.tsx`:

```tsx
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AtlasGalaxyMap } from '../../apps/web/src/modules/galaxy/AtlasGalaxyMap';
import type { GalaxyNodeView } from '../../apps/web/src/modules/galaxy/galaxyModel';

const nodes: GalaxyNodeView[] = [
  { id: 'finance', label: 'Capital Galaxy', category: 'financial', coordinates: { x: 30, y: 35 }, dependencies: [], moduleId: 'finance', route: '/finance', status: 'active', statusLabel: 'Implemented', navigable: true },
  { id: 'crm', label: 'Relationship Constellation', category: 'operations', coordinates: { x: 70, y: 35 }, dependencies: ['finance'], moduleId: 'crm', route: '/crm', status: 'available', statusLabel: 'External connection required', navigable: true },
  { id: 'inventory', label: 'Supply Network', category: 'operations', coordinates: { x: 25, y: 70 }, dependencies: [], route: null, status: 'unverified', statusLabel: 'Not registered', navigable: false }
];

afterEach(cleanup);

describe('AtlasGalaxyMap', () => {
  it('exposes filters with aria-pressed and filters nodes plus edges', () => {
    render(<AtlasGalaxyMap nodes={nodes} onSelectNode={() => {}} />);
    const operations = screen.getByRole('button', { name: 'Operations' });
    expect(operations).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(operations);
    expect(operations).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: /Capital Galaxy/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Relationship Constellation/ })).toBeInTheDocument();
  });

  it('communicates status as text and disables unavailable nodes', () => {
    render(<AtlasGalaxyMap nodes={nodes} onSelectNode={() => {}} />);
    expect(screen.getByText('External connection required')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Supply Network/ })).toBeDisabled();
    expect(screen.getByText('Not registered')).toBeInTheDocument();
  });

  it('calls node selection only for navigable nodes', () => {
    const onSelectNode = vi.fn();
    render(<AtlasGalaxyMap nodes={nodes} onSelectNode={onSelectNode} />);
    fireEvent.click(screen.getByRole('button', { name: /Relationship Constellation/ }));
    expect(onSelectNode).toHaveBeenCalledWith(expect.objectContaining({ id: 'crm', route: '/crm' }));
  });
});
```

- [ ] **Step 2: Run the component test and confirm RED**

Run:

```bash
npx vitest run tests/unit/galaxy-map.test.tsx
```

Expected: FAIL because `AtlasGalaxyMap.tsx` does not exist.

- [ ] **Step 3: Implement the map component**

Create `apps/web/src/modules/galaxy/AtlasGalaxyMap.tsx` with these required behaviors:

```tsx
import { useMemo, useState } from 'react';
import type { GalaxyCategory, GalaxyNodeView } from './galaxyModel';

type GalaxyFilter = 'all' | GalaxyCategory;

const FILTERS: readonly { id: GalaxyFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'core', label: 'Core' },
  { id: 'financial', label: 'Financial' },
  { id: 'operations', label: 'Operations' },
  { id: 'security', label: 'Security' }
];

export function AtlasGalaxyMap({
  nodes,
  onSelectNode
}: {
  nodes: readonly GalaxyNodeView[];
  onSelectNode: (node: GalaxyNodeView) => void;
}) {
  const [filter, setFilter] = useState<GalaxyFilter>('all');
  const visibleNodes = useMemo(
    () => filter === 'all' ? nodes : nodes.filter((node) => node.category === filter),
    [filter, nodes]
  );
  const visibleIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  return (
    <section className="galaxy-map" aria-labelledby="galaxy-map-title">
      <header className="galaxy-toolbar">
        <div>
          <p className="eyebrow">ATLAS Platform</p>
          <h1 id="galaxy-map-title">ATLAS Galaxy Map</h1>
          <p>Spatial module navigation using verified ATLAS registry state.</p>
        </div>
        <div className="galaxy-filters" aria-label="Galaxy categories">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {visibleNodes.length === 0 ? (
        <div className="empty-state" role="status">No modules match this filter</div>
      ) : (
        <div className="galaxy-canvas">
          <svg className="galaxy-links" aria-hidden="true" focusable="false">
            {visibleNodes.flatMap((node) => node.dependencies.map((targetId) => {
              const target = byId.get(targetId);
              if (!target || !visibleIds.has(targetId)) return null;
              return <line key={`${node.id}-${targetId}`} x1={`${node.coordinates.x}%`} y1={`${node.coordinates.y}%`} x2={`${target.coordinates.x}%`} y2={`${target.coordinates.y}%`} />;
            }))}
          </svg>
          <div className="galaxy-nodes">
            {visibleNodes.map((node) => (
              <button
                key={node.id}
                type="button"
                className={`galaxy-node status-${node.status}`}
                style={{ '--galaxy-x': `${node.coordinates.x}%`, '--galaxy-y': `${node.coordinates.y}%` } as React.CSSProperties}
                disabled={!node.navigable}
                onClick={() => node.navigable && onSelectNode(node)}
                aria-label={`${node.label}. ${node.statusLabel}`}
              >
                <strong>{node.label}</strong>
                <span>{node.statusLabel}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
```

If TypeScript requires the `React.CSSProperties` namespace, import `type CSSProperties` from `react` and use `as CSSProperties`; do not change runtime behavior.

- [ ] **Step 4: Run the component tests and confirm GREEN**

Run:

```bash
npx vitest run tests/unit/galaxy-map.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add apps/web/src/modules/galaxy/AtlasGalaxyMap.tsx tests/unit/galaxy-map.test.tsx
git commit -m "feat: add accessible ATLAS Galaxy constellation"
```

---

### Task 3: Integrate `/galaxy` with identity, shell navigation and React Router

**Files:**
- Create: `apps/web/src/modules/galaxy/AtlasGalaxyPage.tsx`
- Modify: `apps/web/src/modules/registry.ts`
- Modify: `apps/web/src/extensions/resolveAtlasExtension.tsx`
- Create: `tests/integration/galaxy-routing.test.tsx`
- Modify: `tests/unit/module-registry.test.ts`

**Interfaces:**
- Consumes: `getCachedAtlasShellOrganization()` from `apps/web/src/lib/atlasSession.ts`, `AtlasGalaxyMap`, `buildGalaxyNodes`, React Router `useNavigate`.
- Produces: authenticated `/galaxy` route available through `ATLAS_NAV_ITEMS` as `Galaxy`.

- [ ] **Step 1: Add failing registry and routing assertions**

Extend `tests/unit/module-registry.test.ts` so the top-level module list includes `galaxy`:

```ts
for (const id of ['business', 'finance', 'crm', 'payroll', 'learning', 'health', 'studio', 'hospitality', 'ride', 'voice', 'galaxy']) {
  expect(source).toContain(`id: '${id}'`);
}
```

Create `tests/integration/galaxy-routing.test.tsx`:

```tsx
import React from 'react';
import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AtlasShell } from '../../apps/web/src/components/AtlasShell';
import { AtlasGalaxyPage } from '../../apps/web/src/modules/galaxy/AtlasGalaxyPage';

vi.mock('../../apps/web/src/lib/atlasSession', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/lib/atlasSession')>('../../apps/web/src/lib/atlasSession');
  return {
    ...actual,
    getCachedAtlasShellOrganization: () => ({ id: 'org-1', role: 'owner', name: 'ATLAS Test', legalName: null, active: true })
  };
});

const resolverSource = readFileSync('apps/web/src/extensions/resolveAtlasExtension.tsx', 'utf8');

afterEach(cleanup);

describe('ATLAS Galaxy routing', () => {
  it('adds Galaxy to canonical shell navigation', () => {
    render(<MemoryRouter initialEntries={['/galaxy']}><AtlasShell><div>Galaxy body</div></AtlasShell></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Galaxy' })).toHaveAttribute('href', '/galaxy');
  });

  it('mounts /galaxy behind the existing identity guard', () => {
    expect(resolverSource).toContain("pathname === '/galaxy'");
    expect(resolverSource).toContain('<RequireAtlasIdentity>');
    expect(resolverSource).toContain('<AtlasGalaxyPage />');
  });

  it('navigates the CRM constellation node to the canonical protected CRM route', () => {
    render(
      <MemoryRouter initialEntries={['/galaxy']}>
        <Routes>
          <Route path="/galaxy" element={<AtlasGalaxyPage />} />
          <Route path="/crm" element={<h1>CRM destination</h1>} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /Relationship Constellation/ }));
    expect(screen.getByRole('heading', { name: 'CRM destination' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run routing tests and confirm RED**

Run:

```bash
npx vitest run tests/unit/module-registry.test.ts tests/integration/galaxy-routing.test.tsx
```

Expected: FAIL because `galaxy` is not registered and `AtlasGalaxyPage.tsx` does not exist.

- [ ] **Step 3: Register the Galaxy module in the canonical registry**

Add this entry to `ATLAS_MODULES` in `apps/web/src/modules/registry.ts`:

```ts
{
  id: 'galaxy',
  title: 'ATLAS Galaxy',
  navLabel: 'Galaxy',
  area: 'Platform',
  route: '/galaxy',
  readiness: 'implemented',
  requiresAuth: true,
  description: 'Spatial navigation and module-state overview.',
  showInNavigation: true
},
```

Do not manually add a separate Galaxy item to `ATLAS_NAV_ITEMS`; the registry projection must continue to generate navigation.

- [ ] **Step 4: Implement the route page**

Create `apps/web/src/modules/galaxy/AtlasGalaxyPage.tsx`:

```tsx
import { useNavigate } from 'react-router-dom';
import { getCachedAtlasShellOrganization } from '../../lib/atlasSession';
import { AtlasGalaxyMap } from './AtlasGalaxyMap';
import { buildGalaxyNodes } from './galaxyModel';

export function AtlasGalaxyPage() {
  const navigate = useNavigate();
  const organization = getCachedAtlasShellOrganization();
  const nodes = buildGalaxyNodes({ hasIdentity: Boolean(organization) });

  return (
    <AtlasGalaxyMap
      nodes={nodes}
      onSelectNode={(node) => {
        if (node.navigable && node.route) navigate(node.route);
      }}
    />
  );
}
```

The page must not call provider APIs or invent runtime telemetry. This initial slice is registry/identity derived only.

- [ ] **Step 5: Register `/galaxy` through the extension resolver**

Update `apps/web/src/extensions/resolveAtlasExtension.tsx`:

```tsx
import { AtlasGalaxyPage } from '../modules/galaxy/AtlasGalaxyPage';
```

Add before the fallback:

```tsx
if (pathname === '/galaxy') {
  return (
    <RequireAtlasIdentity>
      <AtlasGalaxyPage />
    </RequireAtlasIdentity>
  );
}
```

Do not change the existing CRM branch or weaken its guard.

- [ ] **Step 6: Run routing tests and confirm GREEN**

Run:

```bash
npx vitest run tests/unit/module-registry.test.ts tests/integration/galaxy-routing.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

```bash
git add apps/web/src/modules/registry.ts apps/web/src/extensions/resolveAtlasExtension.tsx apps/web/src/modules/galaxy/AtlasGalaxyPage.tsx tests/unit/module-registry.test.ts tests/integration/galaxy-routing.test.tsx
git commit -m "feat: integrate ATLAS Galaxy route and navigation"
```

---

### Task 4: Add responsive production styling without new UI dependencies

**Files:**
- Create: `apps/web/src/modules/galaxy/galaxy.css`
- Modify: `apps/web/src/main.tsx`
- Modify: `tests/unit/galaxy-map.test.tsx`

**Interfaces:**
- Consumes: class names emitted by `AtlasGalaxyMap.tsx`.
- Produces: desktop/tablet spatial layout, mobile stacked layout, visible focus, text-based status styling and reduced-motion compliance.

- [ ] **Step 1: Add failing source-contract assertions for stylesheet and reduced motion**

Append to `tests/unit/galaxy-map.test.tsx`:

```ts
import { readFileSync } from 'node:fs';

it('ships responsive and reduced-motion Galaxy styling through the app entrypoint', () => {
  const css = readFileSync('apps/web/src/modules/galaxy/galaxy.css', 'utf8');
  const main = readFileSync('apps/web/src/main.tsx', 'utf8');
  expect(main).toContain("./modules/galaxy/galaxy.css");
  expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  expect(css).toContain('@media (max-width: 720px)');
  expect(css).toContain(':focus-visible');
});
```

- [ ] **Step 2: Run the component test and confirm RED**

Run:

```bash
npx vitest run tests/unit/galaxy-map.test.tsx
```

Expected: FAIL because `galaxy.css` does not exist and is not imported.

- [ ] **Step 3: Add the stylesheet**

Create `apps/web/src/modules/galaxy/galaxy.css` with the existing ATLAS dark-surface visual language and these required structural rules:

```css
.galaxy-map {
  position: relative;
  min-height: 700px;
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 24px;
  overflow: hidden;
  background: radial-gradient(circle at 50% 50%, rgba(0,102,255,.08), transparent 70%), #02050a;
}

.galaxy-toolbar {
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding: 24px;
  border-bottom: 1px solid rgba(255,255,255,.1);
}

.galaxy-filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.galaxy-filters button[aria-pressed="true"] { border-color: #00f0ff; }
.galaxy-filters button:focus-visible,
.galaxy-node:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }

.galaxy-canvas { position: relative; min-height: 560px; }
.galaxy-links { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.galaxy-links line { stroke: rgba(0,240,255,.24); stroke-width: 1.5; stroke-dasharray: 4 4; }
.galaxy-nodes { position: absolute; inset: 0; }
.galaxy-node {
  position: absolute;
  left: var(--galaxy-x);
  top: var(--galaxy-y);
  transform: translate(-50%, -50%);
  width: 150px;
  min-height: 112px;
}
.galaxy-node strong, .galaxy-node span { display: block; }
.galaxy-node.status-active { border-color: #00f0ff; }
.galaxy-node.status-warning { border-color: #ff7a00; }
.galaxy-node.status-blocked,
.galaxy-node.status-unverified { opacity: .68; }
.galaxy-node:disabled { cursor: not-allowed; }

@media (max-width: 960px) {
  .galaxy-node { width: 132px; min-height: 104px; }
}

@media (max-width: 720px) {
  .galaxy-map { min-height: auto; }
  .galaxy-toolbar { flex-direction: column; }
  .galaxy-canvas { min-height: auto; padding: 16px; }
  .galaxy-links { display: none; }
  .galaxy-nodes { position: static; display: grid; gap: 12px; }
  .galaxy-node {
    position: static;
    transform: none;
    width: 100%;
    min-height: 88px;
    text-align: left;
  }
}

@media (prefers-reduced-motion: reduce) {
  .galaxy-map *, .galaxy-map *::before, .galaxy-map *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
```

Use existing CSS variables where they already express the same ATLAS colors; do not introduce a new design-token system in this task.

- [ ] **Step 4: Import the stylesheet once in `main.tsx`**

Add:

```ts
import './modules/galaxy/galaxy.css';
```

Keep this with the other global feature stylesheet imports.

- [ ] **Step 5: Run Galaxy unit tests and confirm GREEN**

Run:

```bash
npx vitest run tests/unit/galaxy-model.test.ts tests/unit/galaxy-map.test.tsx tests/integration/galaxy-routing.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add apps/web/src/modules/galaxy/galaxy.css apps/web/src/main.tsx tests/unit/galaxy-map.test.tsx
git commit -m "style: add responsive ATLAS Galaxy presentation"
```

---

### Task 5: Harden truthfulness, accessibility and route regression coverage

**Files:**
- Modify: `tests/unit/galaxy-model.test.ts`
- Modify: `tests/unit/galaxy-map.test.tsx`
- Modify: `tests/integration/galaxy-routing.test.tsx`

**Interfaces:**
- Consumes: complete Galaxy feature from Tasks 1–4.
- Produces: regression gates protecting CRM route, no-fabrication rules, visible status semantics and disabled-node behavior.

- [ ] **Step 1: Add explicit forbidden-telemetry regression coverage**

Add a source-level check to `tests/unit/galaxy-model.test.ts`:

```ts
import { readFileSync } from 'node:fs';

it('does not ship fabricated live-looking Galaxy telemetry', () => {
  const files = [
    'apps/web/src/modules/galaxy/galaxyModel.ts',
    'apps/web/src/modules/galaxy/AtlasGalaxyMap.tsx',
    'apps/web/src/modules/galaxy/AtlasGalaxyPage.tsx'
  ];
  const source = files.map((file) => readFileSync(file, 'utf8')).join('\n');
  for (const forbidden of ['99.99% uptime', '$42.8M Liq.', '1,420 Active', 'Secured 256-bit', 'SPACE MAPPING PROTOCOL v2.6 ACTIVE']) {
    expect(source).not.toContain(forbidden);
  }
});
```

- [ ] **Step 2: Add accessibility regression checks**

Append to `tests/unit/galaxy-map.test.tsx`:

```tsx
it('keeps node status in the accessible name and never relies on color alone', () => {
  render(<AtlasGalaxyMap nodes={nodes} onSelectNode={() => {}} />);
  expect(screen.getByRole('button', { name: 'Capital Galaxy. Implemented' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Supply Network. Not registered' })).toBeDisabled();
});
```

- [ ] **Step 3: Add CRM and shell regression checks**

Append to `tests/integration/galaxy-routing.test.tsx`:

```ts
it('does not alter the CRM protected resolver branch', () => {
  expect(resolverSource).toContain("pathname === '/crm'");
  expect(resolverSource).toContain("pathname.startsWith('/crm/')");
  expect(resolverSource).toContain('<CrmRoutes />');
});
```

- [ ] **Step 4: Run focused Galaxy and CRM regression tests**

Run:

```bash
npx vitest run tests/unit/galaxy-model.test.ts tests/unit/galaxy-map.test.tsx tests/integration/galaxy-routing.test.tsx tests/unit/crm-routes.test.tsx tests/unit/module-registry.test.ts tests/integration/module-registry-navigation.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

```bash
git add tests/unit/galaxy-model.test.ts tests/unit/galaxy-map.test.tsx tests/integration/galaxy-routing.test.tsx
git commit -m "test: harden ATLAS Galaxy truth and routing contracts"
```

---

### Task 6: Run the exact feature and repository verification gates

**Files:**
- No product code should change unless verification exposes a real defect.
- If a defect is found, return to the task that owns the affected behavior, add/adjust the failing test first, then make the smallest implementation correction.

**Interfaces:**
- Consumes: branch HEAD after Tasks 1–5.
- Produces: evidence that Galaxy integrates without type, unit, integration, edge, Python or production-build regression.

- [ ] **Step 1: Run TypeScript**

```bash
npm run typecheck
```

Expected: exit code 0.

- [ ] **Step 2: Run unit tests**

```bash
npm run test:unit
```

Expected: exit code 0.

- [ ] **Step 3: Run integration tests**

```bash
npm run test:integration
```

Expected: exit code 0.

- [ ] **Step 4: Run production build**

```bash
npm run build
```

Expected: exit code 0 and Vite production bundle emitted successfully.

- [ ] **Step 5: Run the canonical repository gate**

```bash
npm run verify:all
```

Expected: dependency audit, TypeScript, unit tests, integration tests, Supabase Edge source verification, Python verification and production build all PASS.

- [ ] **Step 6: Inspect the exact branch HEAD**

```bash
git rev-parse HEAD
git status --short
```

Expected: a concrete HEAD SHA and a clean worktree.

- [ ] **Step 7: Commit only if verification required a corrective change**

If no correction was necessary, do not create an empty commit. If a verified correction was necessary, use a scoped message such as:

```bash
git add <affected-files>
git commit -m "fix: close ATLAS Galaxy verification regression"
```

- [ ] **Step 8: Re-run `npm run verify:all` on the new exact HEAD after any corrective commit**

Expected: PASS on the exact current branch SHA.

---

## Self-Review Checklist

- Spec coverage: model, route, registry, shell, filters, connections, mobile fallback, keyboard/focus, reduced motion, truthful state labels, CRM preservation, Cloudflare/Supabase boundary preservation and no-fabrication rules are all assigned to explicit tasks.
- Placeholder scan: no `TBD`, `TODO`, “implement later”, “add appropriate handling”, or undefined future interfaces remain in the plan.
- Type consistency: `GalaxyNodeView`, `GalaxyCategory`, `AtlasGalaxyMap`, `buildGalaxyNodes`, `AtlasGalaxyPage` and `/galaxy` names are consistent across tasks.
- Dependency discipline: no Tailwind, `lucide-react`, new router, new provider or second module registry is introduced.
- Release discipline: implementation ends at a green exact-head verification gate; merge/deploy remains a separate controlled action.
