# ATLAS A-Z Closure Design

Date: 2026-09-04
Status: Approved for continuous execution
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Release branch: `release/atlas-a-z`

## 1. Objective

Finish ATLAS Enterprise Suite as one governed application ecosystem without opening duplicate module trees or repeatedly deploying partial releases. All implementation is consolidated on `release/atlas-a-z`; `main` remains the production branch and receives the final release only after the complete closure gate passes.

The closure program preserves tested work already present in open feature branches, rejects stale or conflicting duplicates, and makes every module report its real readiness. A route may expose a configured, degraded, or integration-required state, but it must never present fabricated live data, fake provider connectivity, or dead controls as production behavior.

## 2. Definition of Done

ATLAS A-Z is releasable when all of the following are true:

1. One application shell, one routing graph, and one canonical module registry.
2. Core tenancy, organization scope, identity context, RBAC, audit, result/error, adapter-state, and module-readiness contracts are shared across domains.
3. Every visible module has a real route and at least one meaningful end-to-end workflow backed by typed domain logic or an explicitly governed adapter.
4. Controls that mutate state are permission-gated and produce deterministic state changes and audit events.
5. External services that are not authorized are shown as `not_configured` or `degraded`; ATLAS does not simulate an active bank, carrier, payment rail, clinical system, or provider.
6. Demo fixtures are coherent, tenant-scoped, clearly labeled, and never used to claim production connectivity.
7. Unit, integration, route, security, build, and critical E2E gates pass for the complete release branch.
8. No unresolved import, dead route, `href="#"`, fake metric, secret, placeholder action, or knowingly stale duplicate remains in the active graph.
9. Responsive navigation and primary workflows work at desktop, tablet, and mobile breakpoints.
10. Production deployment is performed from the final approved `main` SHA, followed by route and `/healthz` verification.

## 3. Release Strategy

- `main`: production-only final merge target during this closure cycle.
- `release/atlas-a-z`: integration branch for the complete suite.
- Existing PR branches: source material to be absorbed selectively after verification.
- Each wave uses TDD or an existing verified test suite before code is accepted into the release branch.
- No feature branch is merged merely because it exists; only the files/contracts that survive current-branch tests are retained.
- The final merge to `main` occurs after the complete release matrix is green.

## 4. Shared Architecture

### 4.1 Core

`packages/core` owns cross-suite contracts:

- tenant and organization scope
- actor/session identity context
- permission predicates
- audit events and sinks
- typed success/failure results
- adapter readiness: `ready | demo | degraded | not_configured | unavailable`
- module readiness metadata
- correlation IDs

Business packages may depend on Core. Business packages must not depend directly on one another unless the dependency is an explicit shared contract exposed through Core.

### 4.2 Web Application

`apps/web` contains one React/TypeScript application:

- `app/router`: canonical route tree
- `app/providers`: scope, identity, adapters, module registry
- `app/shell`: responsive ATLAS shell, module switcher, breadcrumbs and global states
- `modules/*`: domain UI only
- `shared/*`: reusable non-domain UI and utilities

`App.tsx` remains a thin application root.

### 4.3 Data and Integrations

Each domain exposes an interface/repository boundary. The active implementation may be:

- production adapter when credentials and backend policies are verified
- deterministic demo adapter for development/tests
- explicit `not_configured` adapter for unavailable external systems

The UI consumes the interface, not provider-specific SDK details.

## 5. Module Waves

### Wave 0: Repository convergence and Core

- reconcile open PRs and eliminate duplicate/stale implementations
- ATLAS shell, routing, Core tenancy/RBAC/audit/result contracts
- module registry and readiness states
- preserve Accounts Payable verified behavior

### Wave 1: Finance and Accounting

- Finance home
- Accounting dashboard
- General Ledger
- Chart of Accounts
- Journal Entries
- Accounts Receivable
- Accounts Payable
- Bank & Cash
- Reconciliation
- Fixed Assets
- Period Close
- Reports
- Audit Trail
- Accounting Settings

Existing `2026-09-03-atlas-core-accounting-design.md` remains the detailed Accounting contract.

### Wave 2: People Operations

- Payroll
- HR
- Time & Attendance / Timecards
- Recruiting
- Candidate Assessments
- English Assessment
- Compensation
- Benefits & Deductions, including supported retirement-plan configuration contracts
- Employee self-service

### Wave 3: Revenue and Operations

- CRM
- Sales
- Customers
- Vendors
- Purchasing
- Inventory
- POS
- Projects
- operational Analytics

### Wave 4: Platform Services

- ATLAS Automations & Shortcuts
- ATLAS Drive
- Knowledge Atlas
- ATLAS Voice
- ATLAS Connect
- Communications
- Creator Studio / Media / Stream / Music surfaces
- Sites / Site Review
- Security
- Settings
- global audit and observability

### Wave 5: Health

- ATLAS Health command center
- Patient OS
- Clinical Operations
- Hospital Operations
- Pharmacy
- Labs & Imaging
- Virtual Care
- Smart Room / Smart Care
- Health Intelligence
- Interoperability
- Research
- Community Impact
- disease evidence / reconstruction research surfaces

Clinical or disease-research output must preserve evidence grading, uncertainty, falsification, source traceability, and the rule that ATLAS does not label an intervention a cure without the defined evidence threshold.

### Wave 6: Mobility, Physical Operations and Connectivity

- Ride OS
- GPS 4D
- Parks Global
- AutoWash OS
- Insurance Hub
- Telecom
- MiFi Control
- supported device/network control surfaces

Hardware/provider actions require verified adapter capability. Unsupported carrier forwarding, device firmware mutation, remote telephony, or physical-device control remains explicitly unavailable rather than simulated.

### Wave 7: Financial rails and specialized surfaces

- ATLAS Pay
- payment-provider adapters
- Insurance workflow contracts
- Venezuela corporate/operations surface
- other approved specialized enterprise modules that exist in the canonical module registry

Regulated financial actions require an authorized external integration and may not be represented as executed by demo state.

### Wave 8: Closure, security and release

- complete route registry audit
- dead-control and fake-state scan
- dependency and secret scan
- tenancy/RBAC/audit regression suite
- accessibility and responsive smoke suite
- build and critical E2E suite
- final production workflow validation
- protect `main` with required status checks after the final release gate is established
- single final production merge/deploy and post-deploy verification

## 6. Canonical Navigation Families

The global module switcher is grouped by capability rather than historical chat names:

- Home / Command Center
- Finance
- People
- Revenue
- Operations
- Intelligence
- Communication
- Health
- Mobility
- Security
- Administration

Submodules remain directly addressable by stable routes. Historical aliases may redirect, but duplicate implementations are not maintained.

## 7. Permission Model

Permissions use `domain.capability` names. Initial families include:

- `core.read`, `core.admin`
- `accounting.read|write|post|close|admin`
- `audit.read`
- `payroll.read|write|approve|admin`
- `hr.read|write|admin`
- `crm.read|write|admin`
- `inventory.read|write|adjust|admin`
- `pos.read|write|devices.read|devices.manage|admin`
- `health.read|research.read|admin`
- `automation.read|write|execute|admin`
- `security.read|admin`

An administrator grant may imply domain permissions only through an explicit policy function, never UI assumptions.

## 8. Testing Contract

Every wave must include:

- unit tests for deterministic domain rules
- integration tests for repository scope and authorization
- route tests for active navigation
- build/typecheck
- security/dependency checks
- at least one critical end-to-end workflow for the wave

Cross-wave release tests additionally verify that navigating between domains preserves the same ATLAS shell, tenant context, and identity contract.

## 9. Error and Readiness States

Data-bearing pages support:

- loading
- empty
- ready
- demo
- validation error
- permission denied
- degraded
- not configured
- unavailable

A provider badge may say `Connected` only when a production adapter has a verified active connection.

## 10. Final Release Gate

The final SHA is releasable only when:

- all active CI jobs are green
- all module routes resolve
- the full module registry contains no `planned` entries presented as active
- all high-risk external actions are either verified or explicitly disabled/not configured
- `npm audit --audit-level=high` passes or an approved documented exception exists
- `npm run typecheck`, unit, integration, critical E2E and production build pass
- `/healthz` reports the final build as healthy after deployment
- production smoke checks verify Home, Finance/Accounting, People, Operations, Health, Mobility, Security and at least one route from every other active family

This document is the umbrella architecture. Existing domain specs remain authoritative for their detailed business rules when they do not conflict with this closure design.