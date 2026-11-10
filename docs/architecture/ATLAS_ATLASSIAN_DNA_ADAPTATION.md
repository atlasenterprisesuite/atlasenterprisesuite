# ATLAS 777 REVIEW — Atlassian DNA: independent capability adaptation

Date: 2026-10-09
Owner: ATLAS Work OS / Platform
Scope: translate Atlassian public product **capabilities**, not its source code, trade dress, branding, private APIs, customer data or proprietary implementation. ATLAS owns its implementation.

## Truth boundary

A mapped capability is **not** a live capability. The first shipped code slice in this branch is a read-only Work board projection; all other rows remain reuse/audit targets. Passing local tests does not mean merged, deployed or production-verified. Release follows `ATLAS_MASTER_AUTONOMOUS_EXECUTION_PROTOCOL.md` with P0 fail-closed, P1 documented, exact-SHA checks.

## Complete cell-by-cell capability map

| Atlassian concept | ATLAS owning capability to inspect/reuse | Needed behavior / acceptance | Current evidence |
|---|---|---|---|
| Jira tasks, workflows, boards | ATLAS Work + Universal Execution; `apps/web/src/work`, `packages/execution` | Organization-scoped records, canonical state, task detail, filters; governed edits and approvals | Work API already exists. **This branch adds read-only board** at `/work/board`; no drag-and-drop state mutation |
| Jira projects, milestones, goals | Work templates, task protocol, Work Policies | Versioned projects/milestones linked to tasks, owners, budget and measured outcomes | Requires deeper audit; no new project store without owner discovery |
| Jira software lifecycle & Git integrations | GitHub, Release Control, ATLAS Manager | Link issue/task to branch, PR, commit, CI, deployment and exact SHA with source evidence | Canonical Git pipeline already exists; end-to-end bidirectional link not verified |
| Jira Service Management | Existing support/incident/operations surfaces | Authenticated intake, queues, SLAs, incidents, approvals and audit events | Gap; do not infer service-desk runtime |
| Confluence documentation | Knowledge Atlas, Writing Desk, ATLAS Drive boundary | Versioned pages, authorized collaboration, provenance, searchable revisions | Partial domain surfaces; governed page persistence and ACL to verify |
| Confluence knowledge search | Knowledge Atlas + authorized search services | Tenant-filtered indexing, permission recheck per result and source citation | Not established as cross-module production search |
| Teamwork Graph | Evolution Kernel dependency ecology + canonical registries | Directed, typed, provenance-backed links; scoped reads; no duplicate ledger | Design exists in `docs/superpowers/specs/2026-10-06-atlas-genesis-evolution-architecture-design.md`; executable graph needs proof |
| Rovo Search / Chat | Existing `atlas-copilot` AI Gateway and context engine | Context retrieval only from authorized sources; cite evidence; provider-readiness fail closed | Existing AI substrate; Rovo-equivalent production behavior unverified |
| Rovo agents | Agent registry + Work + approvals | Immutable agent versions, least-privilege tools, idempotent actions, audit, fail closed on unverified providers | Partial; agent-run E2E required |
| Atlassian Automation | Work Policies, Execution state machine & durable runtime | Trigger/event, condition, tenant authorization, retry, idempotency, recovery, evidence | Existing engine/policy primitives; event-driven cross-module coverage to verify |
| Forge / extensibility | Existing integrations, module registry and adapter contracts | Versioned SDK, declared permissions, per-tenant sandbox, quota, uninstall/revoke, marketplace vetting | Gap: do not create a second provider registry |
| Marketplace | Canonical ATLAS module catalog and integration registry | Install/permission disclosure, audit, lifecycle, billing and secure isolation | Future governed application ecosystem; not publicly available |
| Atlassian Guard / identity | ATLAS Identity, role policy, RLS, audit | MFA, SSO where authorized, RBAC, tenant-bound sessions and revocation | P0 policy; configuration and negative tests are required |
| Design System | AtlasShell + shared styles and accessibility | Reusable components, keyboard/focus, responsive behaviors and design tokens | Existing shell; audit visual consistency and A11y |
| Assets / incident observability | Cloud, Release Control, monitoring | Trace services/dependencies/incidents, alert routing, source-backed evidence | Provider telemetry readiness not inferred |
| Loom / async collaboration | Existing Studio / Connect / Voice | Video capture, permissioned sharing, transcript provenance and retention | Provider-dependent; no false recording or media state |
| Strategy / analytics / goals | Advisory, Analytics, Work | Portfolio goals, KPIs, attribution and explicit financial impact | Existing surfaces; no unverified metrics |
| Administrative operations | ATLAS Manager / Cloud / Security | Cross-app policy, organization admin, billing, usage and cost controls | Governed provider-boundary verification required |

## First implementation increment: Work Board (this branch)

### Data flow
`RequireAtlasIdentity → Work extension /work/board → listWorkflows() → getActiveAtlasOrganization() + authorizedAtlasFetch(atlas-execution) → server-side list_workflows → organization-filtered response → read-only column projection`

### Enforcement
- The canonical `listWorkflows` path already binds the request to the active organization and discards foreign-organization rows. Backend authentication, RBAC and RLS are authoritative; this frontend feature does not replace them.
- The board fails closed if its authorized list contains mixed/empty organizations, duplicate IDs or unknown statuses.
- Every known execution status has exactly one lane. A new status must update the mapping and tests before release.
- Search, module filter, empty and error states are real, not placeholders.
- Cards navigate to canonical `/execution/:workflowId`; no independent persistence or mutation operation exists.
- The board is not proof of server-side task-edit permissions, true drag-and-drop, notifications, incident SLAs, deep project hierarchy or Atlassian integrations.

### Verification
- `tests/unit/work-board.test.ts`: canonical status coverage, mapping, filters, organization mixing, duplication, unknown status and empty state.
- `tests/unit/atlas-work-os.test.ts`: routing, subnavigation and Work OS capability link.
- Must pass `npm run typecheck`, `npm test`, `npm run build`, protected PR CI and production exact-SHA/E2E before shipping.

## Dependency-ordered next work

1. P0: verify backend `atlas-execution` authorization/RLS against cross-tenant and permission-denied requests; verify existing incident/security blockers.
2. Add source-backed task/project association and mutation commands only through existing Execution audit/approval API.
3. Derive graph edges from canonical module, workflow, knowledge and Git evidence owners; no second graph-of-record.
4. Build knowledge/page revision + tenant-filtered search after a proven backend data owner.
5. Extend verified assistant context, durable automation and integrations through existing registries.
6. Evaluate service-desk SLAs, extensions/SDK, communications and portfolio analytics as separately tested modules.

Never install or copy Atlassian software, logos, private data or protected designs to implement this adaptation. Atlassian can later be a replaceable authorized connector rather than a runtime dependency.
