# ATLAS Native Command Surface Design

## Goal
Turn the existing ATLAS web application into the canonical in-product command surface for modules, approved visual blueprints, and the existing sovereign orchestrator without creating a parallel application.

## Canonical product boundary
- Product surface: `www.atlasenterprisesuite.com`.
- Preserve the existing React application, ATLAS Identity, organization/tenant context, RBAC, audit and execution infrastructure.
- Reuse existing Library blueprints before creating any new visual asset.
- Do not represent unverified integrations, metrics, runtime health, or provider connections as live.
- No merge to `main`, production deployment, provider spend, or irreversible infrastructure mutation in this implementation branch.

## Information architecture
The ATLAS shell becomes a role-aware navigation surface for Home, Business Launch, CRM & Sales, Finance, Accounting, Payroll, HR, Time & Attendance, Recruiting, Projects, Inventory, Purchasing, Vendors, POS, ATLAS Pay, Health OS, Hospitality, Ride OS, Creator Studio, Telecom, Insurance Hub, Parks Global, AutoWash, Venezuela, ATLAS Assistant, ATLAS Orchestrator, Blueprints, Knowledge Atlas, Voice, Connect, Drive, CleanScan 3D, Approval Center, Audit Trail, Security and Settings.

Navigation must distinguish implemented destinations from unavailable capabilities. A visible item must never route to a fake operational screen. Where a capability has no implementation yet, the shell may expose its catalog status without manufacturing operational state.

## Blueprints
Add `/blueprints` as an authenticated product route. It is a canonical catalog linking approved visual specifications to their corresponding ATLAS modules and implementation status.

The initial catalog reuses already-approved Library references including ATLAS Universe Enterprise Dashboard, Enterprise Suite Master, One Identity, Payroll, CRM, Inventory and Venezuela Command Center. Library assets are specifications, not screenshots pasted in place of functional software. The implementation stores stable blueprint metadata and asset provenance; it does not regenerate equivalent imagery.

Each blueprint record exposes title, domain, source/provenance, module route when implemented, and implementation status. `Open module` is enabled only for a real route. The blueprint viewer preserves the approved reference without silently altering its composition.

## Orchestrator
Add `/orchestrator` inside the authenticated ATLAS shell and connect it to the existing `apps/atlas-orchestrator` contracts rather than creating a second orchestrator.

The command surface contains four bounded areas:
1. Execution Engine — workflows, tasks, blockers and approvals.
2. Self-Healing Operations — incident intake, diagnosis, proposed remediation, verification and resolution evidence.
3. AI Council — provider-neutral agent roles behind the ATLAS intelligence/router boundary; provider state is shown only when verified.
4. System Health — orchestrator health/readiness and dependency state from real probes, with explicit unknown/unconfigured states.

The browser must not receive master provider credentials. High-risk, destructive, privilege-changing, financial, security-boundary, audit-disabling, or irreversible actions require governed approval. Safe automation remains bounded, observable, reversible and auditable.

## Neural execution flow
All executable module operations converge on the existing execution/governance boundary:

`Module Event -> Universal Execution Engine -> Orchestrator -> Intelligence Router -> Policy/Governance -> Action -> Evidence -> Audit -> Module`

No AI agent is root. Human authority, revocation and emergency controls remain outside agent self-modification authority.

## Shell behavior
Desktop uses persistent navigation; tablet/mobile uses a compact accessible menu. Active, focus, disabled/unavailable and loading states must be explicit. Navigation is keyboard accessible and compatible with screen readers. Existing module routes remain intact.

## Data and errors
- Tenant and identity context remain authoritative.
- Orchestrator health/readiness must fail closed to `unknown`, `unconfigured`, or `unavailable`; never fabricate `healthy`.
- Failed probes display actionable retry/error state without leaking secrets.
- Blueprint metadata may be static governed catalog data; operational status may not be fabricated.
- Incident/self-healing actions create evidence and audit records before being presented as resolved.

## Testing and acceptance
Use TDD for each implementation task. Minimum acceptance:
- shell navigation routes implemented destinations correctly and exposes catalog/unavailable state honestly;
- `/blueprints` renders the approved reusable catalog and only links real modules;
- `/orchestrator` is identity/tenant governed and consumes existing orchestrator contracts;
- health/readiness never reports an unverified live state;
- responsive desktop/tablet/mobile navigation is usable;
- keyboard/focus semantics are covered;
- existing Finance, Payroll, Health, Hospitality, Creator and execution routes do not regress;
- run `npm ci`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, and `npm run build` before any completion claim.

## Delivery boundary
Implementation occurs on `feat/atlas-native-command-surface`. Keep changes reviewable and test-driven. Do not merge or deploy until verification evidence is available and the user explicitly authorizes the irreversible step.