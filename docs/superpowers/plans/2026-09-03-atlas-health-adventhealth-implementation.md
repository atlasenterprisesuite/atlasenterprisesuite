# ATLAS Health — AdventHealth Smart Health Ecosystem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the shared ATLAS application into a complete, testable ATLAS Health ecosystem with an AdventHealth proposal workspace, a governed Smart Health Command Center, 18 operational module workspaces, preserved research routes, RBAC/audit/integration states, and release gates that prevent demo data from being represented as live hospital data.

**Architecture:** Build Health on top of the shared ATLAS Core shell defined by the Core + Accounting plan. Use typed Health domain contracts, deterministic demo adapters, a data-driven module catalog, and one reusable `HealthModulePage` so every module gets consistent navigation, source-state labeling, search, filters, permissions, integrations, audit, empty/error/success behavior, and responsive UI without duplicating application shells.

**Tech Stack:** React, TypeScript, React Router, Vite, Vitest, Testing Library, Playwright, npm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-03-atlas-health-adventhealth-ecosystem-design.md`

## Global Constraints

- ATLAS branding remains primary; AdventHealth is proposal context only.
- Do not claim AdventHealth endorsement, deployment, or use.
- No real PHI is stored or exposed in this milestone.
- No fabricated production data, uptime, patient counts, clinical census, or false connected/live states.
- A data source may be `demo`, `configured`, `live`, or `unavailable`; `live` requires an authenticated working authorized integration.
- Health consumes shared ATLAS Core tenancy, RBAC, audit, validation, UI, and routing contracts.
- Every organization-specific Health record includes `tenantId` and `organizationId`.
- Every visible navigation item resolves to a real route or valid state.
- Search fields filter data, filters change visible results, tabs change content, and enabled actions perform real client-side or authorized persistence actions.
- No `href="#"`, console-only actions, or unexplained disabled controls.
- Existing Health Research & Innovation routes remain accessible.
- Desktop, tablet, and mobile layouts are required.
- Production claims require build, test, route, deployment, and post-deploy verification evidence.

---

## Prerequisite Gate

This plan assumes the shared foundation from `docs/superpowers/plans/2026-09-03-atlas-core-accounting-implementation.md` has completed at least its buildable-workspace, Core contracts, and shared-shell tasks.

Before Task 1, verify these files exist and compile:

- `package.json`
- `apps/web/src/app/router/AppRouter.tsx`
- `apps/web/src/app/shell/AtlasShell.tsx`
- `apps/web/src/app/providers/AtlasContext.tsx`
- `packages/core/src/tenancy.ts`
- `packages/core/src/rbac.ts`
- `packages/core/src/audit.ts`
- `apps/web/src/modules/health/HealthRoutes.tsx`

If they do not exist, execute the prerequisite Core plan first. Do not create a second Health-only shell.

---

## File Map

### Health domain package
- `packages/health/package.json`
- `packages/health/src/types.ts`
- `packages/health/src/sourceState.ts`
- `packages/health/src/permissions.ts`
- `packages/health/src/catalog.ts`
- `packages/health/src/selectors.ts`
- `packages/health/src/integrations.ts`
- `packages/health/src/demoActions.ts`
- `packages/health/src/index.ts`

### Governed demo data
- `data/demo/health/system.ts`
- `data/demo/health/commandCenter.ts`
- `data/demo/health/operations.ts`
- `data/demo/health/index.ts`

### Health routing and shared UI
- `apps/web/src/modules/health/HealthRoutes.tsx`
- `apps/web/src/modules/health/HealthHome.tsx`
- `apps/web/src/modules/health/HealthWorkspaceLanding.tsx`
- `apps/web/src/modules/health/shared/HealthStatusBadge.tsx`
- `apps/web/src/modules/health/shared/HealthDataNotice.tsx`
- `apps/web/src/modules/health/shared/HealthModuleCard.tsx`
- `apps/web/src/modules/health/shared/SearchFilterBar.tsx`
- `apps/web/src/modules/health/shared/IntegrationStateCard.tsx`
- `apps/web/src/modules/health/shared/PermissionMatrix.tsx`
- `apps/web/src/modules/health/shared/AuditTimeline.tsx`

### Proposal workspace
- `apps/web/src/modules/health/proposal/ProposalLayout.tsx`
- `apps/web/src/modules/health/proposal/ProposalNav.tsx`
- `apps/web/src/modules/health/proposal/proposalContent.ts`
- `apps/web/src/modules/health/proposal/ProposalSectionPage.tsx`

### Operations workspace
- `apps/web/src/modules/health/operations/OperationsLayout.tsx`
- `apps/web/src/modules/health/operations/OperationsNav.tsx`
- `apps/web/src/modules/health/operations/CommandCenterPage.tsx`
- `apps/web/src/modules/health/operations/ModuleDirectoryPage.tsx`
- `apps/web/src/modules/health/operations/HealthModulePage.tsx`
- `apps/web/src/modules/health/operations/moduleViews.tsx`

### Research bridge
- `apps/web/src/modules/health/research/ResearchRoutes.tsx`
- existing research components moved or adapted from the current Health implementation without changing governed research semantics

### Tests and release gates
- `tests/unit/health-source-state.test.ts`
- `tests/unit/health-catalog.test.ts`
- `tests/unit/health-selectors.test.ts`
- `tests/unit/health-permissions.test.ts`
- `tests/integration/health-routes.test.tsx`
- `tests/integration/health-proposal.test.tsx`
- `tests/integration/health-command-center.test.tsx`
- `tests/integration/health-modules.test.tsx`
- `tests/integration/health-research-regression.test.tsx`
- `tests/e2e/health.spec.ts`
- `.github/workflows/atlas-health-ci.yml`

---

### Task 1: Define Health source-state, module, permission, and integration contracts

**Files:** create `packages/health/package.json`, `types.ts`, `sourceState.ts`, `permissions.ts`, `integrations.ts`, `index.ts`; test `health-source-state.test.ts` and `health-permissions.test.ts`.

**Interfaces:** consumes Core tenancy/audit concepts; produces `HealthSourceState`, `HealthModuleId`, `HealthRecordBase`, `HealthPermission`, `HealthIntegration`, `canUseHealthPermission`, `isLiveSource`.

- [ ] **Step 1: Write failing governance tests**

```ts
import { describe, expect, it } from 'vitest';
import { canUseHealthPermission, isLiveSource } from '../../packages/health/src';

describe('Health governance contracts', () => {
  it('does not treat configured sources as live', () => {
    expect(isLiveSource('configured')).toBe(false);
    expect(isLiveSource('demo')).toBe(false);
    expect(isLiveSource('unavailable')).toBe(false);
    expect(isLiveSource('live')).toBe(true);
  });

  it('requires explicit Health permissions', () => {
    expect(canUseHealthPermission(['health.read'], 'health.facilities.write')).toBe(false);
    expect(canUseHealthPermission(['health.admin'], 'health.facilities.write')).toBe(true);
  });
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/unit/health-source-state.test.ts tests/unit/health-permissions.test.ts
```

Expected: FAIL because the Health package does not exist.

- [ ] **Step 3: Implement exact source-state and module types**

```ts
export type HealthSourceState = 'demo' | 'configured' | 'live' | 'unavailable';

export type HealthModuleId =
  | 'enterprise-os' | 'health-intelligence' | 'patient-experience' | 'clinical-operations'
  | 'finance-revenue' | 'hr-workforce' | 'smart-care' | 'pharmacy-4' | 'supply-chain'
  | 'ai-analytics' | 'research-innovation' | 'community-impact' | 'voice-assistant'
  | 'cleanscan-3d' | 'smart-facilities' | 'energy-sustainability' | 'safety-security'
  | 'public-health-watch';

export type HealthRecordBase = {
  id: string;
  tenantId: string;
  organizationId: string;
};
```

`sourceState.ts`:

```ts
import type { HealthSourceState } from './types';
export function isLiveSource(state: HealthSourceState) { return state === 'live'; }
```

- [ ] **Step 4: Implement permission vocabulary**

```ts
export type HealthPermission =
  | 'health.read' | 'health.executive.read' | 'health.operations.read' | 'health.operations.write'
  | 'health.clinical.read' | 'health.patient_experience.read' | 'health.finance.read'
  | 'health.workforce.read' | 'health.pharmacy.read' | 'health.supply_chain.read'
  | 'health.facilities.read' | 'health.facilities.write' | 'health.security.read'
  | 'health.security.write' | 'health.research.read' | 'health.research.write'
  | 'health.integrations.admin' | 'audit.read' | 'health.admin';

export function canUseHealthPermission(granted: readonly HealthPermission[], required: HealthPermission) {
  return granted.includes(required) || granted.includes('health.admin');
}
```

- [ ] **Step 5: Implement integration contract**

```ts
import type { HealthSourceState } from './types';
export type HealthIntegrationKind = 'fhir' | 'hl7v2' | 'ehr' | 'finance' | 'workforce' | 'pharmacy' | 'facilities-iot' | 'voice' | 'public-health';
export type HealthIntegration = {
  id: string;
  kind: HealthIntegrationKind;
  name: string;
  state: HealthSourceState;
  lastHealthCheckAt: string | null;
  authorized: boolean;
};
```

- [ ] **Step 6: Run tests/typecheck and commit**

```bash
npm test -- tests/unit/health-source-state.test.ts tests/unit/health-permissions.test.ts
npm run typecheck
git add packages/health tests/unit/health-source-state.test.ts tests/unit/health-permissions.test.ts
git commit -m "feat: add governed ATLAS Health domain contracts"
```

---

### Task 2: Create the 18-module catalog and governed demo datasets

**Files:** create `catalog.ts`, `selectors.ts`, all four `data/demo/health/*` files; modify Health index; test catalog/selectors.

**Interfaces:** produces `HealthModuleDefinition`, `healthModuleCatalog`, `HealthOperationalRecord`, `healthDemoData`, `filterHealthRecords`.

- [ ] **Step 1: Write failing catalog/selector tests**

```ts
expect(healthModuleCatalog).toHaveLength(18);
expect(new Set(healthModuleCatalog.map(item => item.id)).size).toBe(18);
for (const module of healthModuleCatalog) expect(module.route).toBe(`/health/operations/modules/${module.id}`);
expect(filterHealthRecords(records, 'MRI', 'open')).toHaveLength(1);
```

- [ ] **Step 2: Verify failure**

```bash
npm test -- tests/unit/health-catalog.test.ts tests/unit/health-selectors.test.ts
```

- [ ] **Step 3: Implement catalog with all approved modules**

```ts
import type { HealthModuleId } from './types';
import type { HealthPermission } from './permissions';

export type HealthModuleDefinition = { id: HealthModuleId; name: string; description: string; requiredPermission: HealthPermission; route: string };

const definitions: Omit<HealthModuleDefinition, 'route'>[] = [
  { id: 'enterprise-os', name: 'Enterprise OS', description: 'Hospital-wide sites, service lines and operational command.', requiredPermission: 'health.operations.read' },
  { id: 'health-intelligence', name: 'Health Intelligence', description: 'Governed operational and clinical intelligence views.', requiredPermission: 'health.clinical.read' },
  { id: 'patient-experience', name: 'Patient Experience', description: 'Journey, intake, communication and experience queues.', requiredPermission: 'health.patient_experience.read' },
  { id: 'clinical-operations', name: 'Clinical Operations', description: 'Care areas, queues, throughput and resource visibility.', requiredPermission: 'health.clinical.read' },
  { id: 'finance-revenue', name: 'Finance & Revenue', description: 'Revenue-cycle status and accounting integration points.', requiredPermission: 'health.finance.read' },
  { id: 'hr-workforce', name: 'HR & Workforce', description: 'Staffing, schedules, talent and payroll entry points.', requiredPermission: 'health.workforce.read' },
  { id: 'smart-care', name: 'Smart Care', description: 'Remote monitoring and telemedicine orchestration.', requiredPermission: 'health.operations.read' },
  { id: 'pharmacy-4', name: 'Pharmacy 4.0', description: 'Medication workflow, inventory and dispensing checkpoints.', requiredPermission: 'health.pharmacy.read' },
  { id: 'supply-chain', name: 'Supply Chain', description: 'Purchasing, inventory, vendors and requisitions.', requiredPermission: 'health.supply_chain.read' },
  { id: 'ai-analytics', name: 'AI & Analytics', description: 'Governed models, insights, explainability and confidence.', requiredPermission: 'health.operations.read' },
  { id: 'research-innovation', name: 'Research & Innovation', description: 'Governed research and Health Frontiers entry point.', requiredPermission: 'health.research.read' },
  { id: 'community-impact', name: 'Community Impact', description: 'Population-health, outreach and prevention programs.', requiredPermission: 'health.operations.read' },
  { id: 'voice-assistant', name: 'Voice & Virtual Assistant', description: 'Multilingual voice and assistant orchestration.', requiredPermission: 'health.operations.read' },
  { id: 'cleanscan-3d', name: 'CleanScan 3D', description: 'Facility scanning, spatial documentation and digital-twin intake.', requiredPermission: 'health.facilities.read' },
  { id: 'smart-facilities', name: 'Smart Facilities', description: 'Assets, rooms, maintenance and work orders.', requiredPermission: 'health.facilities.read' },
  { id: 'energy-sustainability', name: 'Energy & Sustainability', description: 'Resource use, targets and sustainability programs.', requiredPermission: 'health.facilities.read' },
  { id: 'safety-security', name: 'Safety & Security', description: 'Incidents, access events and security logs.', requiredPermission: 'health.security.read' },
  { id: 'public-health-watch', name: 'Public Health Watch', description: 'Governed public-health bulletins and epidemiological watch.', requiredPermission: 'health.operations.read' }
];
export const healthModuleCatalog = definitions.map(item => ({ ...item, route: `/health/operations/modules/${item.id}` }));
```

- [ ] **Step 4: Define operational record and governed system seed**

```ts
export type HealthOperationalRecord = {
  id: string;
  tenantId: string;
  organizationId: string;
  moduleId: HealthModuleId;
  title: string;
  status: 'open' | 'active' | 'closed' | 'unavailable';
  category: string;
  sourceState: HealthSourceState;
};

export const healthSystemProfile = {
  tenantId: 'atlas-demo', organizationId: 'health-demo-org',
  name: 'ATLAS Health Demo Organization', location: 'Orlando, FL', sourceState: 'demo' as const
};
```

Create at least one full scoped demo record for every non-research module. Required mutation IDs later in the plan are `facility-1` for Smart Facilities and `security-1` for Safety & Security. No record contains real patient identifiers.

- [ ] **Step 5: Implement selector**

```ts
export function filterHealthRecords<T extends { title: string; status: string }>(records: readonly T[], query: string, status: string) {
  const normalized = query.trim().toLowerCase();
  return records.filter(record => (normalized.length === 0 || record.title.toLowerCase().includes(normalized)) && (status === 'all' || record.status === status));
}
```

- [ ] **Step 6: Verify and commit**

```bash
npm test -- tests/unit/health-catalog.test.ts tests/unit/health-selectors.test.ts
npm run typecheck
git add packages/health data/demo/health tests/unit/health-catalog.test.ts tests/unit/health-selectors.test.ts
git commit -m "feat: add ATLAS Health module catalog and governed demo data"
```

---

### Task 3: Preserve Research & Innovation inside the shared Health route tree

**Files:** create/adapt `ResearchRoutes.tsx`; move/adapt legacy research components; modify `HealthRoutes.tsx`; test research regression.

- [ ] **Step 1: Write regression tests**

```tsx
test('preserves Health Frontiers route', async () => {
  render(<MemoryRouter initialEntries={['/health/research/frontiers']}><App /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'Health Frontiers' })).toBeInTheDocument();
});

test('operations research module enters governed research workspace', async () => {
  render(<MemoryRouter initialEntries={['/health/operations/modules/research-innovation']}><App /></MemoryRouter>);
  expect(await screen.findByText(/research/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify baseline failure**

```bash
npm test -- tests/integration/health-research-regression.test.tsx
```

- [ ] **Step 3: Create nested research router**

```tsx
export function ResearchRoutes() {
  return (
    <Routes>
      <Route index element={<ResearchHome />} />
      <Route path="frontiers" element={<FrontiersHome />} />
      <Route path="frontiers/disease-reconstruction/*" element={<DiseaseReconstructionRoutes />} />
      <Route path="*" element={<Navigate to="/health/research" replace />} />
    </Routes>
  );
}
```

Preserve evidence labels, falsification behavior, demo notices, and research-only reconstruction/curability disclaimers in meaning.

- [ ] **Step 4: Mount routes**

```tsx
<Route path="research/*" element={<ResearchRoutes />} />
<Route path="operations/modules/research-innovation" element={<Navigate to="/health/research" replace />} />
```

- [ ] **Step 5: Verify and commit**

```bash
npm test -- tests/integration/health-research-regression.test.tsx
npm test
npm run typecheck
git add apps/web/src/modules/health packages/health data/research tests/integration/health-research-regression.test.tsx
git commit -m "refactor: preserve Health research in shared ATLAS shell"
```

---

### Task 4: Build Health Home and complete route skeleton

**Files:** create `HealthHome.tsx`, `HealthWorkspaceLanding.tsx`, shared cards/badges/notices; modify `HealthRoutes.tsx` and styles; test routes.

- [ ] **Step 1: Write route tests for `/health`, proposal root, operations root, command center, and module directory.**

- [ ] **Step 2: Build HealthHome**

```tsx
export function HealthHome() {
  return (
    <section className="health-page health-stack">
      <header className="health-hero">
        <p className="eyebrow">ATLAS Health</p><h1>Smart Health Ecosystem</h1>
        <p>Proposal, operations, and governed research in one ATLAS workspace.</p>
        <HealthDataNotice state="demo" text="Operational data in this milestone is demonstration data unless a source is explicitly marked live." />
      </header>
      <div className="health-entry-grid">
        <HealthModuleCard title="Business Proposal" description="Explore the AdventHealth proposal workspace." to="/health/proposal/adventhealth" />
        <HealthModuleCard title="Health Operations" description="Open the Smart Health Command Center and module portfolio." to="/health/operations/command-center" />
        <HealthModuleCard title="Research & Innovation" description="Enter the governed Health Frontiers research workspace." to="/health/research" />
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Create working landing surface**

```tsx
export function HealthWorkspaceLanding({ title, description, primaryTo, primaryLabel }: { title: string; description: string; primaryTo: string; primaryLabel: string }) {
  return <section className="health-page health-stack"><p className="eyebrow">ATLAS Health</p><h1>{title}</h1><p>{description}</p><Link className="action-link" to={primaryTo}>{primaryLabel}</Link></section>;
}
```

Mount proposal and operations roots to useful landing pages with valid next links.

- [ ] **Step 4: Verify and commit**

```bash
npm test -- tests/integration/health-routes.test.tsx
npm run typecheck
git add apps/web/src/modules/health apps/web/src/styles.css tests/integration/health-routes.test.tsx
git commit -m "feat: add ATLAS Health home and route skeleton"
```

---

### Task 5: Implement the AdventHealth Proposal Workspace

**Files:** create proposal layout/nav/content/page; modify routes/styles; test proposal.

- [ ] **Step 1: Write navigation test that enters Executive Summary, clicks Pilot Roadmap, and confirms illustrative/demo labeling.**

- [ ] **Step 2: Create exact section model**

```ts
export type ProposalSectionId = 'executive-summary' | 'opportunities' | 'solution' | 'modules' | 'integrations' | 'security' | 'pilot' | 'kpis' | 'contact';
export const proposalSections = [
  { id: 'executive-summary', title: 'Executive Summary', body: 'ATLAS proposes a governed orchestration layer connecting operational, financial, workforce, facilities, research and patient-experience workflows without requiring a health system to discard every existing platform.' },
  { id: 'opportunities', title: 'Problems & Opportunities', body: 'Fragmented workflows, duplicated operational views, disconnected facility data and slow cross-department coordination create opportunities for a shared command layer.' },
  { id: 'solution', title: 'ATLAS Solution', body: 'A modular Smart Health Ecosystem with shared identity, permissions, audit, source-state governance and integration adapters.' },
  { id: 'modules', title: 'Module Portfolio', body: 'Eighteen connected ATLAS Health workspaces cover enterprise operations, clinical operations, finance, workforce, pharmacy, supply chain, facilities, security, research and public-health awareness.' },
  { id: 'integrations', title: 'Integrations', body: 'FHIR, HL7 v2, EHR, finance, workforce, pharmacy, facilities IoT, voice and public-health adapters are represented as contracts until an authorized live connection passes health checks.' },
  { id: 'security', title: 'Security & Governance', body: 'Tenant boundaries, RBAC, audit events, explicit source states and least-privilege integration administration govern every sensitive workflow.' },
  { id: 'pilot', title: 'Pilot Roadmap', body: 'Recommended pilot: Command Center + Patient Experience + Smart Facilities + Health Intelligence, followed by measured expansion into revenue, workforce, pharmacy and supply chain.' },
  { id: 'kpis', title: 'KPI Framework', body: 'Pilot KPIs should be baselined with authorized source data before targets are committed. Example categories include queue time, work-order cycle time, integration availability and operational response time.' },
  { id: 'contact', title: 'Request Pilot', body: 'This proposal workspace is an ATLAS concept environment and does not represent an AdventHealth deployment or endorsement.' }
] as const;
```

- [ ] **Step 3: Mount route-driven section pages**

```tsx
function ProposalSectionRoute() {
  const { sectionId } = useParams();
  const section = proposalSections.find(item => item.id === sectionId);
  if (!section) return <Navigate to="/health/proposal/adventhealth/executive-summary" replace />;
  return <ProposalSectionPage section={section} />;
}

<Route path="proposal/adventhealth" element={<ProposalLayout />}>
  <Route index element={<Navigate to="executive-summary" replace />} />
  <Route path=":sectionId" element={<ProposalSectionRoute />} />
</Route>
```

- [ ] **Step 4: Verify and commit**

```bash
npm test -- tests/integration/health-proposal.test.tsx
npm run typecheck
git add apps/web/src/modules/health/proposal apps/web/src/modules/health/HealthRoutes.tsx apps/web/src/styles.css tests/integration/health-proposal.test.tsx
git commit -m "feat: add AdventHealth ATLAS proposal workspace"
```

---

### Task 6: Build Smart Health Command Center and module directory

**Files:** create operations layout/nav/command center/directory; modify routes/styles; test command center.

- [ ] **Step 1: Write test requiring heading, exactly 18 module cards, `DEMO DATA`, and absence of copied image metrics `98%`.**

- [ ] **Step 2: Render derived metrics and all modules**

```tsx
<HealthDataNotice state="demo" text="DEMO DATA — values are derived from ATLAS demonstration datasets, not AdventHealth production systems." />
<div className="health-module-grid">
  {healthModuleCatalog.map(module => <div key={module.id} data-testid="health-module-card"><HealthModuleCard title={module.name} description={module.description} to={module.route} /></div>)}
</div>
```

- [ ] **Step 3: Implement module search**

```tsx
const [query, setQuery] = useState('');
const normalized = query.trim().toLowerCase();
const modules = healthModuleCatalog.filter(module => normalized.length === 0 || module.name.toLowerCase().includes(normalized) || module.description.toLowerCase().includes(normalized));
```

Render `No Health modules match this search.` when empty.

- [ ] **Step 4: Verify and commit**

```bash
npm test -- tests/integration/health-command-center.test.tsx
npm run typecheck
git add apps/web/src/modules/health/operations apps/web/src/modules/health/HealthRoutes.tsx apps/web/src/styles.css tests/integration/health-command-center.test.tsx
git commit -m "feat: add ATLAS Smart Health Command Center"
```

---

### Task 7: Implement reusable operational module page

**Files:** create `HealthModulePage.tsx`, `moduleViews.tsx`, search/filter, integration, permission, audit components; modify routes; test module interactions.

- [ ] **Step 1: Write interaction test that searches `MRI`, changes status filter, opens Integrations, then Permissions.**

- [ ] **Step 2: Define exact tab model and overview interface**

```ts
export type HealthModuleTab = 'overview' | 'workflows' | 'data' | 'permissions' | 'integrations' | 'audit';
export const healthModuleTabs = [
  { id: 'overview', label: 'Overview' }, { id: 'workflows', label: 'Workflows' }, { id: 'data', label: 'Data' },
  { id: 'permissions', label: 'Permissions' }, { id: 'integrations', label: 'Integrations' }, { id: 'audit', label: 'Audit' }
] as const;
export const moduleDomainLabels: Partial<Record<HealthModuleId, string>> = {};
```

- [ ] **Step 3: Implement search/filter state**

```tsx
const [query, setQuery] = useState('');
const [status, setStatus] = useState('all');
const [tab, setTab] = useState<HealthModuleTab>('overview');
const records = recordsForModule(healthDemoData.operations, moduleId, scope);
const filtered = filterHealthRecords(records, query, status);
if (!module) return <Navigate to="/health/operations/modules" replace />;
```

- [ ] **Step 4: Implement permission/integration/audit surfaces**

```tsx
export function PermissionMatrix({ permissions }: { permissions: readonly string[] }) { return <ul>{permissions.map(permission => <li key={permission}><code>{permission}</code></li>)}</ul>; }
export function IntegrationStateCard({ integration }: { integration: HealthIntegration }) { return <article><h3>{integration.name}</h3><HealthStatusBadge state={integration.state} /><p>{integration.authorized ? 'Authorized' : 'Not authorized'}</p><p>{integration.lastHealthCheckAt ?? 'No successful health check recorded'}</p></article>; }
export function AuditTimeline({ events }: { events: readonly AuditEvent[] }) { return events.length === 0 ? <p role="status">No audit events for this module and organization.</p> : <ol>{events.map(event => <li key={event.id}>{event.action} · {event.timestamp}</li>)}</ol>; }
```

- [ ] **Step 5: Verify and commit**

```bash
npm test -- tests/integration/health-modules.test.tsx
npm run typecheck
git add apps/web/src/modules/health/operations apps/web/src/modules/health/shared tests/integration/health-modules.test.tsx
git commit -m "feat: add reusable ATLAS Health module workspace"
```

---

### Task 8: Complete Enterprise OS, Health Intelligence, Patient Experience, and Clinical Operations

- [ ] **Step 1: Add demo records with titles:** `Orlando campus operational review`, `Throughput trend review`, `Discharge follow-up queue`, `Imaging coordination queue`; all scoped to `atlas-demo/health-demo-org` and `sourceState: 'demo'`.

- [ ] **Step 2: Add domain labels**

```ts
Object.assign(moduleDomainLabels, {
  'enterprise-os': 'Sites & service lines',
  'health-intelligence': 'Governed intelligence',
  'patient-experience': 'Experience queues',
  'clinical-operations': 'Operational throughput'
});
```

- [ ] **Step 3: Add integration tests for each route and heading, then run/commit**

```bash
npm test -- tests/integration/health-modules.test.tsx
git add data/demo/health/operations.ts apps/web/src/modules/health/operations/moduleViews.tsx tests/integration/health-modules.test.tsx
git commit -m "feat: complete core ATLAS Health operations modules"
```

---

### Task 9: Complete Finance & Revenue, HR & Workforce, Smart Care, Pharmacy 4.0, and Supply Chain

- [ ] **Step 1: Add demo records:** `Claim exception review`, `Night-shift staffing review`, `Remote monitoring setup review`, `Medication inventory reconciliation`, `Critical PPE stock flag`.

- [ ] **Step 2: Add labels**

```ts
Object.assign(moduleDomainLabels, {
  'finance-revenue': 'Revenue-cycle bridge', 'hr-workforce': 'Workforce coordination',
  'smart-care': 'Remote care orchestration', 'pharmacy-4': 'Medication workflow',
  'supply-chain': 'Critical stock visibility'
});
```

- [ ] **Step 3: Add bridge behavior:** Finance links to `/finance/accounting`; Smart Care uses an unavailable integration; HR displays `Shared HR route not configured in this release.` until the HR plan creates `/hr`.

- [ ] **Step 4: Test all five routes and commit**

```bash
npm test -- tests/integration/health-modules.test.tsx
git add data/demo/health/operations.ts apps/web/src/modules/health/operations/moduleViews.tsx tests/integration/health-modules.test.tsx
git commit -m "feat: complete Health finance workforce care pharmacy and supply modules"
```

---

### Task 10: Complete AI & Analytics, Community Impact, Voice, CleanScan 3D, Smart Facilities, Energy, Safety & Security, Public Health Watch

- [ ] **Step 1: Add demo records:** `Throughput forecasting model review`, `Community wellness outreach`, `Voice runtime configuration`, `North wing spatial capture`, `MRI cooling inspection` with id `facility-1`, `Cooling energy reduction target`, `Visitor access incident review` with id `security-1`, `Demo respiratory illness bulletin`.

- [ ] **Step 2: Add labels**

```ts
Object.assign(moduleDomainLabels, {
  'ai-analytics': 'Model governance', 'community-impact': 'Community programs', 'voice-assistant': 'Voice runtime',
  'cleanscan-3d': 'Spatial capture', 'smart-facilities': 'Facilities work orders',
  'energy-sustainability': 'Sustainability targets', 'safety-security': 'Security incidents',
  'public-health-watch': 'Public-health bulletins'
});
```

- [ ] **Step 3: Render exact notices:** `Demo model output — not clinical decision support.`, `Voice runtime unavailable.`, `Demo bulletin — not current public-health surveillance.`

- [ ] **Step 4: Test all eight routes and commit**

```bash
npm test -- tests/integration/health-modules.test.tsx
npm run typecheck
git add data/demo/health apps/web/src/modules/health/operations/moduleViews.tsx tests/integration/health-modules.test.tsx
git commit -m "feat: complete ATLAS Health intelligence facilities and safety modules"
```

---

### Task 11: Add permission-aware demo mutations, audit events, and live-state validation

**Files:** create `demoActions.ts`; modify integrations, index, module page, integration card, audit timeline; test permissions/modules.

- [ ] **Step 1: Write failing permission test for `facility-1` with read-only permission.**

- [ ] **Step 2: Implement demo action and audit sink**

```ts
import { InMemoryAuditSink } from '../../core/src';
import { healthDemoData } from '../../../data/demo/health';
export const healthAuditSink = new InMemoryAuditSink();
const mutableDemoRecords: HealthOperationalRecord[] = healthDemoData.operations.map(record => ({ ...record }));

export function updateDemoHealthRecordStatus(input: { recordId: string; nextStatus: HealthOperationalRecord['status']; granted: readonly HealthPermission[]; actorId: string }) {
  const record = mutableDemoRecords.find(item => item.id === input.recordId);
  if (!record) return { ok: false as const, error: 'record_not_found' as const };
  const required: HealthPermission = record.moduleId === 'safety-security' ? 'health.security.write' : 'health.facilities.write';
  if (!canUseHealthPermission(input.granted, required)) return { ok: false as const, error: 'permission_denied' as const };
  const before = { status: record.status };
  record.status = input.nextStatus;
  healthAuditSink.append({ id: crypto.randomUUID(), tenantId: record.tenantId, organizationId: record.organizationId, actorId: input.actorId, action: 'health.record.status.update', entityType: record.moduleId, entityId: record.id, before, after: { status: record.status }, timestamp: new Date().toISOString(), correlationId: crypto.randomUUID() });
  return { ok: true as const, record };
}
```

Enable status-change actions only for Smart Facilities and Safety & Security in this milestone.

- [ ] **Step 3: Validate live integration invariant**

```ts
export function validateIntegration(integration: HealthIntegration) {
  return integration.state !== 'live' || (integration.authorized && integration.lastHealthCheckAt !== null);
}
```

- [ ] **Step 4: Add UI feedback:** success `Status updated in demo adapter.`; denied `You do not have permission to perform this action.`

- [ ] **Step 5: Verify and commit**

```bash
npm test -- tests/unit/health-permissions.test.ts tests/integration/health-modules.test.tsx
npm run typecheck
git add packages/health apps/web/src/modules/health tests/unit/health-permissions.test.ts tests/integration/health-modules.test.tsx
git commit -m "feat: add governed Health demo actions audit and integration gates"
```

---

### Task 12: Finish responsive, accessible, loading, empty, error, disabled, and success states

- [ ] **Step 1: Add accessible tab assertion and Playwright mobile smoke test.**

- [ ] **Step 2: Implement semantic state components**

```tsx
export function LoadingState() { return <p role="status">Loading Health workspace…</p>; }
export function ErrorState({ message }: { message: string }) { return <p role="alert">{message}</p>; }
export function DisabledAction({ reason }: { reason: string }) { const id = useId(); return <span><button type="button" disabled aria-describedby={id}>Action unavailable</button><small id={id}>{reason}</small></span>; }
```

- [ ] **Step 3: Add responsive CSS**

```css
.health-module-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
@media (max-width: 1024px) { .health-module-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) { .health-module-grid { grid-template-columns: 1fr; } .command-center { padding: 1rem; } .health-tabs { overflow-x: auto; } }
.health-module-card:focus-visible, .health-tabs button:focus-visible, .health-nav a:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
```

- [ ] **Step 4: Verify and commit**

```bash
npm test -- tests/integration/health-modules.test.tsx
npm run test:e2e -- tests/e2e/health.spec.ts
git add apps/web/src/styles.css apps/web/src/modules/health tests/e2e/health.spec.ts tests/integration/health-modules.test.tsx
git commit -m "feat: finish Health responsive accessible application states"
```

---

### Task 13: Add Health CI and full release verification gates

- [ ] **Step 1: Add E2E route matrix for all 18 module IDs and false-live test requiring `DEMO DATA` and no rendered `LIVE` badge.**

- [ ] **Step 2: Create CI workflow**

```yaml
name: ATLAS Health CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  health-quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e -- tests/e2e/health.spec.ts
```

- [ ] **Step 3: Run all release gates**

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run test:e2e -- tests/e2e/health.spec.ts
git grep -n -E 'API_KEY|SECRET|TOKEN|password' -- ':!package-lock.json'
git grep -n -E '\bLIVE\b|98%|2,847|1,523|96%' -- apps packages data
```

Expected: tests/build PASS; no committed secret values; copied reference-image metrics absent; any `LIVE` text exists only in governance code/tests, not demo UI output.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/atlas-health-ci.yml tests/e2e/health.spec.ts apps/web/public/healthz.json
git commit -m "ci: gate ATLAS Health build tests and live-state integrity"
```

---

### Task 14: Production-readiness verification and user handoff

- [ ] **Step 1: Verify exact candidate commit**

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e -- tests/e2e/health.spec.ts
```

- [ ] **Step 2:** Require successful ATLAS Health CI on that exact SHA.
- [ ] **Step 3:** Run an authorized deployment workflow only after all gates pass. Never infer deployment from build success.
- [ ] **Step 4:** After deployment, verify `/health`, proposal executive summary, command center, Smart Facilities, and `/health/research` return the expected ATLAS application without 404/500.
- [ ] **Step 5:** Verify `/healthz` or equivalent release metadata if available; otherwise report that production gate as unverified.
- [ ] **Step 6:** Hand off module testing in this order: Enterprise OS; Health Intelligence; Patient Experience; Clinical Operations; Finance & Revenue; HR & Workforce; Smart Care; Pharmacy 4.0; Supply Chain; AI & Analytics; Research & Innovation; Community Impact; Voice & Virtual Assistant; CleanScan 3D; Smart Facilities; Energy & Sustainability; Safety & Security; Public Health Watch.

Do not label the release `100% functional` until automated verification and the requested user validation are complete.
