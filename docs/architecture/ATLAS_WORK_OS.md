# ATLAS Work OS

Date: 2026-10-01
Status: Implementation branch. Production status requires CI, merge, deployment and public verification.
Owner: ATLAS Platform / Work / Intelligence

## Purpose

ATLAS Work OS is the unified productivity fabric for ATLAS Enterprise Suite.

It does not create a second identity system, task engine, storage model, approval system, analytics silo or AI router. It composes existing canonical ATLAS modules over shared controls.

The platform contract is:

`Identity & Tenant -> RBAC / Policy -> Audit & Evidence -> ATLAS Graph -> Data Fabric -> Knowledge -> AI -> Automation -> Security -> Apps`

## Design principles

1. Reuse canonical ATLAS modules, routes, APIs and data models before creating a new surface.
2. Provider-dependent capability remains fail-closed until the provider is actually authorized and server-verified.
3. State-changing actions remain organization-scoped, permission-bound and auditable.
4. Implementation readiness is not the same thing as production verification.
5. Work that crosses domains flows through ATLAS Work, ATLAS AI and the shared data fabric instead of direct point-to-point duplication.
6. No UI may claim connected, approved, paid, signed, shipped, fulfilled or production-ready without evidence.

## Application families

### Work & Productivity

- Docs -> current Writing Desk.
- Sheets -> current Analytics workspace.
- Present -> current Smart Teleprompter and governed presentation workflow.
- Mail -> ATLAS Connect / external provider boundary.
- Calendar -> Work Connections / external provider boundary.
- Tasks -> ATLAS Work.
- Projects -> ATLAS Work active execution and templates.
- Forms -> dedicated builder not yet implemented; no fake route.
- Lists -> canonical domain data surfaced through Analytics.
- Notes -> Knowledge Atlas.
- Board -> dedicated collaborative board not yet implemented.
- Scheduling -> Work policies and automation.
- Drive -> canonical ATLAS Drive route not yet registered.
- Meetings -> ATLAS Connect / external provider boundary.
- Media / Design -> ATLAS Studio.

### Intelligence

- ATLAS Assistant.
- Productivity Pro.
- Knowledge Atlas.
- AI Universe.
- Voice.
- Universal route search.

### Automation & Execution

- ATLAS Work.
- ATLAS Automations.
- Universal Execution.
- Work Connections.
- Computer Operations.
- Runtime management.

### Data & Business Intelligence

- ATLAS Business Analytics.
- Finance / Accounting.
- Inventory / Procure-to-Pay.
- CRM.
- Commerce.

### Enterprise Operations

- Finance.
- Tax.
- Payroll.
- People.
- Advisory.
- Revenue.
- Hospitality.
- Ride.
- Health.

### Platform, Security & Governance

- Identity.
- Cloud.
- Device OS.
- Release Control.
- Accessibility.
- Galaxy.

## Route

`/work/os`

The route is mounted inside the existing identity-gated Work extension.

## Truth boundaries

Some cards intentionally remain gated. A gated card means the architecture location is defined but ATLAS does not have enough implementation or provider evidence to claim live capability.

The launcher does not infer:

- Microsoft Graph connectivity.
- Microsoft mailbox, calendar, SharePoint, OneDrive or Teams access.
- Google mailbox, calendar or Drive access.
- active CRM or commerce providers.
- live meeting providers.
- live ATLAS Drive storage.
- production readiness.

Those states must be established by their own authenticated server-side readiness checks.

## Microsoft 365 relationship

Microsoft 365 is a capability benchmark, not a hidden dependency. ATLAS Work OS can integrate approved external providers later, but the internal ATLAS product graph remains vendor-neutral and preserves its own tenant, authorization, audit and execution contracts.

## Production acceptance

Before production can be claimed:

1. Typecheck passes.
2. Unit and integration tests pass.
3. Build passes.
4. Existing release gates remain green.
5. The branch is merged into `main`.
6. The deployed production commit matches the merged commit.
7. Public production verification completes without a P0 failure.
