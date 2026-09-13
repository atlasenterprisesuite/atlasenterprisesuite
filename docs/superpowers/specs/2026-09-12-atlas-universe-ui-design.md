# ATLAS Universe UI — Technical Implementation Specification

Date: 2026-09-12
Status: Approved implementation specification
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Canonical branch: `main`
Implementation branch: `feat/atlas-universe-ui`

## Primary goal

Upgrade the existing ATLAS Enterprise Suite shell and module navigation into an interconnected cinematic **ATLAS Universe** experience while preserving the canonical repository, routes, business logic, authentication, Supabase tenancy, RBAC, audit, existing modules, and production behavior.

This is an implementation project, not a visual prototype.

## Source references

Treat the attached approved references as visual-product specifications:

A. futuristic ATLAS module blueprint;
B. blue/orange gravitational energy portal;
C. globally connected node network;
D. approved ATLAS Assistant/avatar direction.

Never place those screenshots directly into the interface as substitutes for software.

## Architecture principle

ATLAS remains one application ecosystem.

```text
ATLAS Universe
    ↓
ATLAS Core
    ↓
Identity + Organization + Permissions
    ↓
Global Shell
    ↓
Galaxy Navigation
    ↓
Module System
    ↓
Section
    ↓
Record
    ↓
Executable Action
    ↓
Audit / Evidence
```

## Shared shell

Create or evolve a shared shell containing:

- `GlobalHeader`
- `GlobalSidebar`
- `GalaxyNavigator`
- `AtlasCoreVisualization`
- `AtlasAssistantPanel`
- `GlobalSearch`
- `OrganizationSwitcher`
- `ApprovalIndicator`
- `NotificationCenter`
- `SystemStatus`
- `Breadcrumbs`
- `ModuleContext`

Do not duplicate any existing equivalent.

## Galaxy domain model

Represent modules through a data-driven registry.

```ts
export type AtlasUniverseModule = {
  id: string;
  name: string;
  route: string;
  category: string;
  description: string;
  icon: string;
  status: 'active' | 'available' | 'disabled' | 'restricted' | 'configuration_required';
  requiredPermissions: string[];
  featureFlag?: string;
  visualTheme: AtlasModuleVisualTheme;
};

export type AtlasModuleVisualTheme = {
  accent: string;
  secondaryAccent?: string;
  atmosphere:
    | 'capital'
    | 'ledger'
    | 'people'
    | 'health'
    | 'mobility'
    | 'relationships'
    | 'supply'
    | 'projects'
    | 'intelligence'
    | 'security'
    | 'payments'
    | 'knowledge'
    | 'media'
    | 'hospitality'
    | 'general';
};
```

Do not use this registry as an authorization source. Authorization remains authoritative in ATLAS RBAC/backend boundaries.

## Universe modules

The registry must map to existing routes or intentionally implemented canonical routes for:

- `atlas-os`
- `finance`
- `accounting`
- `payroll`
- `hr`
- `health`
- `ride`
- `crm`
- `sales`
- `inventory`
- `purchasing`
- `accounts-payable`
- `accounts-receivable`
- `tax`
- `pos`
- `projects`
- `analytics`
- `insurance`
- `telecom`
- `creator-studio`
- `learning`
- `security`
- `atlas-pay`
- `cleanscan-3d`
- `atlas-drive`
- `atlas-voice`
- `atlas-connect`
- `gps-4d`
- `hospitality`
- `venezuela`

Before creating a route, search for an equivalent existing route. Never duplicate modules.

## Home route

Home becomes the ATLAS Universe portal with these functional areas:

1. `AtlasCoreHero`
2. `GalaxyNavigator`
3. `GlobalSearch`
4. `AtlasAssistant`
5. `RecentWork`
6. `PendingApprovals`
7. `Favorites`
8. `ActiveOrganization`
9. `SystemSignals`

Data must come from real existing APIs/state. No invented KPI values.

## Galaxy Navigator

Desktop: interactive spatial constellation.

Tablet: reduced spatial visualization.

Mobile: orbit/list hybrid.

Required behaviors:

- keyboard navigation
- pointer navigation
- touch
- search
- filter by module category
- favorites
- recent modules
- permission restriction
- disabled/configuration state
- route navigation

Module visual state must never imply authorization.

## Assistant

ATLAS Assistant is persistent across the ecosystem.

Assistant context should receive, where authorized:

- current route
- active module
- organization
- user role
- permissions
- selected record
- current workflow

Assistant actions must pass through existing authorization/execution systems. No direct privileged mutations from visual UI state.

## Design tokens

Introduce centralized variables rather than hard-coded effects. Example categories:

- `--atlas-space-0`
- `--atlas-space-1`
- `--atlas-surface-glass`
- `--atlas-surface-glass-strong`
- `--atlas-border-glow`
- `--atlas-cyan`
- `--atlas-blue`
- `--atlas-energy`
- `--atlas-text-primary`
- `--atlas-text-secondary`
- `--atlas-radius-panel`
- `--atlas-glow-sm`
- `--atlas-glow-md`
- `--atlas-glow-lg`
- `--atlas-duration-fast`
- `--atlas-duration-normal`
- `--atlas-duration-orbit`

Respect the existing token system if equivalent tokens already exist.

## Visual effects

Approved:

- gradients
- SVG
- CSS effects
- canvas
- WebGL when justified
- GPU-friendly transforms

Avoid:

- large DOM particle fields
- continuous high-cost filters
- unbounded animations
- video backgrounds required for basic operation

Provide static/reduced-motion equivalents.

## Module template

Every module should support a shared conceptual frame:

- `ModuleHeader`
- `ModuleNavigation`
- `ModuleActions`
- `ModuleSearch`
- `ModuleFilters`
- `ModuleWorkspace`
- `ModuleInsights`
- `ModuleAssistantContext`
- `ModuleStatus`

Do not flatten module-specific capabilities. Preserve the more complete existing implementation.

## Data

Strict rules:

- real data -> render
- no data -> empty state
- provider missing -> configuration state
- permission missing -> restricted state
- backend failure -> error state
- loading -> loading state

Never fabricate data.

## Search

`GlobalSearch` must search actual known module metadata/routes and, where existing APIs permit, module records.

Separate:

- navigation search
- record search
- assistant natural-language command

Do not fake universal semantic search if no backend exists.

## Security

Preserve:

- Supabase Auth
- ATLAS Identity
- active organization membership
- RLS
- RBAC
- security audit
- approval boundaries

Frontend hiding is not authorization. Cross-tenant access must fail even if route parameters are manipulated.

## Identity

Integrate cleanly with the approved **ATLAS Identity Passkeys + ATLAS OS Identity Layer** design.

Do not implement facial recognition. Face ID/biometrics are device-authenticator mechanisms through passkeys/WebAuthn.

## Accessibility

WCAG-oriented implementation. Required:

- semantic markup
- keyboard access
- screen-reader names
- focus visible
- focus restoration
- reduced motion
- contrast
- no information conveyed by glow/color alone
- minimum practical touch targets

## Motion system

Motion states:

- idle
- hover
- focus
- selected
- navigation
- assistant-listening
- assistant-thinking
- executing
- approval-required
- success
- blocked
- error

Every animated state requires a reduced-motion fallback.

## Responsive targets

Desktop: full sidebar + galaxy + assistant.

Tablet: collapsible sidebar + simplified galaxy.

Mobile: compact header + module navigator + optional bottom navigation + assistant drawer.

Do not simply scale down desktop.

## Performance budget principle

The visual layer must remain secondary to application responsiveness.

- use lazy loading
- defer non-critical effects
- memoize expensive visual maps
- pause animation when hidden/offscreen
- avoid unnecessary re-render loops

## Test plan

Unit tests:

- module registry
- route mapping
- visual state mapping
- permission display state
- search
- responsive helper logic
- reduced-motion logic

Integration tests:

- home -> galaxy -> module
- module -> section -> record
- permission-restricted module
- organization change
- global search navigation
- assistant context update
- empty/error/loading states

Security regression tests:

- unauthenticated protected route
- inactive organization
- permission denied
- cross-tenant attempts

Accessibility checks:

- keyboard
- focus
- labels
- reduced motion

## Final validation

```bash
npm ci
npm run typecheck
npm test
npm run build
```

No completion claim without passing evidence.

## Implementation order

Phase A: shared visual tokens + Universe shell.

Phase B: Galaxy Navigator + registry.

Phase C: global search + Assistant contextual integration.

Phase D: migrate key modules: Finance, Accounting, Payroll, HR, Health, Ride.

Phase E: migrate remaining modules.

Phase F: responsive/accessibility/performance hardening.

Phase G: production verification.

## Git policy

- use isolated worktree/feature branch
- use TDD
- commit coherent increments
- independent spec review after each meaningful implementation task
- independent code-quality review after each task
- do not merge automatically
- do not deploy automatically
- do not spend provider credits without explicit authorization

## Definition of done

The feature is done only when ATLAS Enterprise Suite actually operates using the new interconnected Universe interface, all represented navigation/actions are functional or honestly unavailable, existing module functionality remains intact, tenancy/RBAC remain enforced, no fake data exists, responsive/accessibility requirements pass, and the canonical validation commands succeed.

The images are inspiration/specification.

**The product is the software.**
