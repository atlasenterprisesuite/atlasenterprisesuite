# ATLAS Health — AdventHealth Smart Health Ecosystem Design

Date: 2026-09-03
Status: Approved
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Reference: user-provided AdventHealth Smart Health Ecosystem concept image

## 1. Purpose

Build an ATLAS Health implementation milestone that uses the approved AdventHealth reference image as a visual and business-direction blueprint for a connected hospital ecosystem. The deliverable is not a static poster. It is a navigable ATLAS product surface composed of a proposal experience plus a governed operations workspace.

The implementation must preserve a futuristic command-center feel while remaining explicit about what is real, what is demo data, and what requires authorized integration.

## 2. Goals

1. Create a top-level ATLAS Health experience that presents a hospital smart-ecosystem value proposition.
2. Separate `Proposal Mode` from `Operations Mode` so commercial storytelling does not masquerade as live hospital telemetry.
3. Add complete navigation across the approved module portfolio.
4. Reuse the shared ATLAS Core shell and route architecture defined by the approved ATLAS Core + Accounting design.
5. Preserve and migrate the existing ATLAS Health Research & Innovation routes into the shared shell.
6. Keep every data claim governed: no fabricated live integrations, fake uptime, fake patient data, or implied FHIR/HL7 connectivity unless specifically configured.
7. Make the system testable module by module so each area can be validated independently.

## 3. Non-goals

1. No claim of production deployment to AdventHealth or another health system.
2. No storage or exposure of real PHI in this milestone.
3. No claim that AdventHealth endorses, uses, or has approved ATLAS.
4. No simulated `connected` state for external systems without credentials and working adapters.
5. No replacement of the existing research subsystem; this milestone extends ATLAS Health and preserves research functionality.
6. No diagnosis, treatment, or autonomous clinical-decision claims from demo analytics.

## 4. Product framing

The reference establishes two parallel product narratives:

- **Executive proposal narrative**: why ATLAS is useful for a health system.
- **Operational software narrative**: how modules, routes, data, permissions, and workflows actually behave.

ATLAS Health therefore exposes two primary workspaces plus the retained research workspace:

1. **AdventHealth Proposal Workspace**
   - Executive summary
   - Problems and opportunities
   - Solution architecture
   - Module portfolio
   - Integration posture
   - Security and compliance posture
   - Pilot roadmap
   - KPI framework
   - Contact / request next step

2. **ATLAS Health Operations Workspace**
   - Smart command center
   - Module directory
   - Module-specific dashboards and workflows
   - Shared status, permission, integration, and audit surfaces

3. **Research & Innovation Workspace**
   - Existing Health Frontiers / Disease Reconstruction Lab functionality
   - Future clinical-trial and research operations extensions

## 5. Ownership and integrations

### 5.1 Primary owner
- `ATLAS Health`

### 5.2 Shared ATLAS dependencies
- `ATLAS Core`
- `ATLAS Finance / Accounting`
- `ATLAS HR / Payroll`
- `ATLAS Voice`
- `ATLAS Security`
- `ATLAS Analytics`
- `ATLAS Connect`
- `ATLAS Drive / CleanScan 3D`

Health must consume shared shell, tenancy, RBAC, audit, validation, UI, and data-access contracts rather than creating parallel versions.

## 6. Repository architecture

Follow the approved Core architecture and expand Health into focused files rather than growing `apps/web/src/App.tsx`.

Target structure:

```text
apps/web/src/
  app/
    router/
    shell/
    providers/
  modules/
    health/
      HealthHome.tsx
      proposal/
      operations/
      research/
      shared/
packages/
  core/
  health/
    catalog/
    permissions/
    status/
    integrations/
data/
  demo/
    health/
  research/
tests/
  unit/
  integration/
  e2e/
```

The existing repository currently contains a monolithic `apps/web/src/App.tsx` that references Health research components and packages not yet present in the connected tree. Implementation must first establish a buildable shared foundation, following the Core implementation plan, before expanding Health.

## 7. Information architecture

### 7.1 Top-level Health routes
- `/health`
- `/health/proposal/adventhealth`
- `/health/operations`
- `/health/operations/command-center`
- `/health/operations/modules`
- `/health/research`

### 7.2 Proposal routes
- `/health/proposal/adventhealth`
- `/health/proposal/adventhealth/executive-summary`
- `/health/proposal/adventhealth/opportunities`
- `/health/proposal/adventhealth/solution`
- `/health/proposal/adventhealth/modules`
- `/health/proposal/adventhealth/integrations`
- `/health/proposal/adventhealth/security`
- `/health/proposal/adventhealth/pilot`
- `/health/proposal/adventhealth/kpis`
- `/health/proposal/adventhealth/contact`

### 7.3 Operations routes
- `/health/operations/command-center`
- `/health/operations/modules/enterprise-os`
- `/health/operations/modules/health-intelligence`
- `/health/operations/modules/patient-experience`
- `/health/operations/modules/clinical-operations`
- `/health/operations/modules/finance-revenue`
- `/health/operations/modules/hr-workforce`
- `/health/operations/modules/smart-care`
- `/health/operations/modules/pharmacy-4`
- `/health/operations/modules/supply-chain`
- `/health/operations/modules/ai-analytics`
- `/health/operations/modules/research-innovation`
- `/health/operations/modules/community-impact`
- `/health/operations/modules/voice-assistant`
- `/health/operations/modules/cleanscan-3d`
- `/health/operations/modules/smart-facilities`
- `/health/operations/modules/energy-sustainability`
- `/health/operations/modules/safety-security`
- `/health/operations/modules/public-health-watch`

### 7.4 Retained research routes
Keep supported existing research routes intact. `/health/operations/modules/research-innovation` acts as an operations-facing entry into the research workspace rather than duplicating research pages.

## 8. Health home

The Health landing page separates:
- Proposal
- Operations
- Research & Innovation

It must display environment status and cannot imply live clinical integration.

## 9. Proposal workspace

The proposal workspace is a polished, navigable business proposal, not a slide embedded in the product.

### Required sections
- Executive Summary
- Problems & Opportunities
- ATLAS Solution
- Module Portfolio
- Integrations
- Security & Governance
- Pilot Roadmap
- KPI Framework
- Contact / Request Pilot

Operational metrics shown in this workspace must either be sourced or explicitly labeled illustrative.

## 10. Smart Health Command Center

The command center translates the visual language of the reference into software.

### Layout
- Left telemetry rail
- Central health-system hero / operating context
- Right telemetry and alerts rail
- Module portfolio grid
- Environment/status banner
- Global search/filter controls where useful

### Data-state vocabulary
Every data source uses exactly one of:
- `demo`
- `configured`
- `live`
- `unavailable`

`live` is allowed only for an authenticated, working, authorized integration.

## 11. Shared module template

Every operations module uses a common template:
- Module header
- Status/source badge
- Summary cards derived from its active dataset
- Search/filter bar
- Tabs: `Overview`, `Workflows`, `Data`, `Permissions`, `Integrations`, `Audit`
- Data list or table
- Empty state
- Error state
- Permission-aware actions
- Integration-state panel
- Audit timeline

A module may omit a tab only when the domain truly has no such concept, not because implementation is incomplete.

## 12. Functional module definitions

### 12.1 Enterprise OS
Hospital-wide operations center: sites, service lines, command overview, operational alerts.

### 12.2 Health Intelligence
Governed clinical/operational intelligence views, trend analysis, explainable predictive indicators. No diagnosis claims.

### 12.3 Patient Experience
Patient journey, appointments, communications, intake checkpoints, service feedback, experience queues.

### 12.4 Clinical Operations
Units, beds, scheduling context, care areas, queues, throughput, operational resource visibility. No fabricated live census.

### 12.5 Finance & Revenue
Revenue-cycle and finance bridge: billing status, claims workflow, collections visibility, accounting integration points.

### 12.6 HR & Workforce
Staffing, roles, schedules, talent pipeline, payroll entry points, workforce alerts.

### 12.7 Smart Care
Remote-monitoring and telemedicine orchestration. Without device integrations, show configuration/empty state.

### 12.8 Pharmacy 4.0
Medication-management workspace, pharmacy inventory, dispensing checkpoints, alerts, governed medication data status.

### 12.9 Supply Chain
Purchasing, inventory, vendors, requisitions, critical-stock visibility.

### 12.10 AI & Analytics
Model catalog, governed insights, explainability, confidence labels, model/data provenance, safety notices.

### 12.11 Research & Innovation
Operations entry point into existing governed research functionality and future trial-management workspaces.

### 12.12 Community Impact
Population-health and outreach programs, community events, prevention programs, impact tracking.

### 12.13 Voice & Virtual Assistant
Voice command and multilingual assistant. Without a working voice runtime, show unavailable/configuration state.

### 12.14 CleanScan 3D
Facility scanning, asset capture, spatial documentation, digital-twin intake.

### 12.15 Smart Facilities
Facilities operations, assets, maintenance tickets, rooms, work orders.

### 12.16 Energy & Sustainability
Resource-consumption summaries, sustainability programs, target tracking.

### 12.17 Safety & Security
Access control, incidents, visitor/security events, logs. Sensitive actions require explicit permissions.

### 12.18 Public Health Watch
Epidemiological alerts, public-health bulletins, outbreak-watch signals. Public-health data must be sourced before being labeled current/live.

## 13. Shared components

Health-specific reusable UI should include:

- `HealthHome`
- `HealthModuleCard`
- `HealthStatusBadge`
- `HealthDataNotice`
- `HealthModulePage`
- `ProposalNav`
- `OperationsNav`
- `CommandCenterPanel`
- `MetricCard`
- `AlertList`
- `SearchFilterBar`
- `IntegrationStateCard`
- `PermissionMatrix`
- `AuditTimeline`

Generic components must use the shared Core UI package where appropriate.

## 14. Demo data strategy

All first-milestone operational data lives under `data/demo/health` and is clearly labeled demo.

Initial datasets:
- health system profile
- proposal sections
- module catalog
- command-center metrics
- alerts
- operational queues
- staffing snapshots
- pharmacy items
- supply-chain items
- facilities assets/work orders
- sustainability metrics
- community programs
- public-health demo bulletins

The command center and module summary cards must derive displayed counts and totals from these datasets instead of hard-coded decorative numbers.

## 15. Tenancy

Every organization-specific operational record must include:
- `tenant_id`
- `organization_id`

Demo adapters must still honor the active tenant/organization context. Future production adapters must enforce the same boundary server-side or in database policies.

## 16. RBAC

Health permission vocabulary:
- `health.read`
- `health.executive.read`
- `health.operations.read`
- `health.operations.write`
- `health.clinical.read`
- `health.patient_experience.read`
- `health.finance.read`
- `health.workforce.read`
- `health.pharmacy.read`
- `health.supply_chain.read`
- `health.facilities.read`
- `health.facilities.write`
- `health.security.read`
- `health.security.write`
- `health.research.read`
- `health.research.write`
- `health.integrations.admin`
- `audit.read`

UI checks do not replace backend authorization.

## 17. Audit

Sensitive actions use the shared Core audit event contract. Health audit metadata should include module and source-state context when relevant.

Examples:
- facilities work-order status change
- security incident update
- integration configuration change
- research evidence change
- permission-sensitive operational write

## 18. Integrations

Prepare adapter contracts for:
- FHIR
- HL7 v2
- EHR/clinical systems
- workforce/payroll
- finance/accounting
- pharmacy
- facilities/IoT
- voice
- maps/location when authorized
- public-health sources

No adapter is marked live until credentials, connectivity, authorization, and a health check pass.

## 19. Search, filters, navigation, and actions

- Search inputs must filter data.
- Filters must change visible results.
- Tabs must change content.
- Breadcrumbs must navigate.
- Module cards must route.
- No `href="#"`.
- No console-only buttons.
- Disabled controls must state the missing capability.
- Enabled mutations require persistence or an explicit demo adapter and must show success/error feedback.

## 20. Visual system

The reference establishes:
- deep blue / neon blue command-center aesthetic
- dark glass-like cards
- illuminated edges
- high information density with deliberate hierarchy
- health-campus / infrastructure visual cues

ATLAS branding remains primary. AdventHealth naming is proposal context only. ATLAS must not impersonate an official AdventHealth internal system.

## 21. Accessibility and responsive behavior

- Keyboard-operable navigation and controls
- Visible focus states
- Semantic labels for status and controls
- Tables become usable mobile views instead of horizontal dead zones
- Desktop, tablet, and mobile layouts
- Color is not the sole status indicator

## 22. States

Every data-dependent module must support:
- loading
- empty
- error
- disabled/unavailable
- success

Example copy:
- `No configured patient-experience data for this organization.`
- `FHIR connector is not configured.`
- `No facilities work orders found.`
- `Voice runtime unavailable.`

## 23. Testing strategy

### Unit
- data selectors
- module catalog
- source-state rules
- permission checks
- filters/search

### Integration
- routes
- proposal navigation
- command-center data derivation
- module tabs
- permission-aware controls
- research route preservation

### E2E
- Health home -> Proposal -> sections
- Health home -> Operations -> Command Center -> each module
- module search/filter flow
- disabled integration-state flow
- Research & Innovation handoff
- responsive navigation smoke test

## 24. Production gates

Before any production claim:
1. repository build succeeds
2. unit/integration/e2e tests pass
3. all Health routes resolve
4. existing Health research regression passes
5. no secrets are committed
6. no demo source is labeled live
7. authorization gates are verified
8. deployment workflow succeeds
9. production domain is reachable
10. `/health` and critical child routes are verified after deployment
11. environment/health endpoint confirms expected release when available

## 25. Delivery decomposition

Implementation order:

1. Complete/verify shared ATLAS Core foundation required by Health.
2. Migrate existing Health research routes into shared shell.
3. Add Health home and route tree.
4. Add AdventHealth Proposal Workspace.
5. Add Health command center and module catalog.
6. Add shared operations module template.
7. Implement 18 module workspaces using governed demo datasets.
8. Add permission, integration, and audit surfaces.
9. Add full responsive/accessibility behavior.
10. Run cross-module, research-regression, and release gates.

Each module must be independently testable so the user can validate one module at a time after the full build is complete.

## 26. Risks and mitigations

1. **Scope explosion**: use shared module template and focused domain datasets.
2. **False live-state impression**: enforce source-state type and labels in code/tests.
3. **Health/Core duplication**: Health consumes Core tenancy/RBAC/audit/UI contracts.
4. **Monolithic App.tsx**: route decomposition is a prerequisite, not optional cleanup.
5. **Missing connected-repo files**: establish buildable baseline before module expansion.
6. **Brand confusion**: proposal context is clearly labeled; ATLAS remains the product identity.

## 27. Recommendation

Proceed as an ATLAS Health expansion on top of the shared Core foundation. Build the proposal and command center first, then fan out through a shared module architecture so all 18 modules can be completed and tested consistently without inventing live hospital data.
