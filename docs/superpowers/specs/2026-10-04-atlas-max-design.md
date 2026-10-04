# ATLAS MAX — Product & Architecture Design

Date: 2026-10-04
Status: Design approved; written specification awaiting review

## 1. Objective

ATLAS MAX is the highest-capability ATLAS service tier, inspired by the product principles visible in premium AI plans while remaining provider-neutral and native to ATLAS. It must combine high-capability intelligence, accelerated execution, persistent autonomous agents, expanded memory/knowledge, file capacity, priority execution, and early feature access without making unsupported availability or entitlement claims.

Success means a tenant can move through plan discovery → entitlement → governed execution → usage accounting → audit evidence, with every capability enforced server-side and every UI state derived from authenticated evidence.

## 2. Product tiers

Initial product taxonomy:

- ATLAS Core — essential intelligence and standard execution.
- ATLAS Pro — increased capacity, advanced models/tools, higher execution budgets.
- ATLAS MAX — maximum governed capacity, priority/accelerated execution, persistent Operators, expanded memory/storage policy, and advanced routing.

Plan names, prices, quotas, storage, model availability, speed classes, credits, and feature flags are configuration/data, not frontend constants. No tier may be presented as unlimited unless the billing/entitlement system explicitly supports that contract.

## 3. Architecture

Primary flow:

Client → Identity/Tenant → Entitlement Service → ATLAS Intelligence Router → Execution/Operator Runtime → Provider Adapters → Evidence/Usage Ledger → Audit/Observability

Supporting services:

1. Plan Catalog — versioned commercial capabilities and display metadata.
2. Entitlement Service — authoritative tenant/user capability decisions.
3. Intelligence Router — selects provider/model/speed/reasoning mode by capability, quality, latency, cost, privacy, availability, tenant policy, and task class.
4. ATLAS Operators — persistent goal-oriented agents with explicit permissions, schedules/triggers, checkpoints, and human-review boundaries.
5. Work/Execution Layer — long-running research, documents, code, workflows, and repository tasks.
6. Memory & Knowledge — scoped durable context with tenant isolation and retention controls.
7. File/Storage Policy — metered storage entitlement; object storage implementation remains replaceable.
8. Usage Governor — budgets, quotas, throttling, credit consumption, and reset windows.
9. Cost Guard — preflight estimates/limits and provider-aware cost controls.
10. Evidence Ledger — append-oriented evidence for entitlement, execution, consumption, and completion claims.
11. Audit/Observability — security and operational events with correlation IDs.

## 4. Provider neutrality

ATLAS MAX must not depend on one AI vendor. Provider adapters expose a normalized capability contract. The router may use OpenAI, Gemini, local models, or future approved providers only when configured and healthy.

Routing inputs include:

- required modality/tool capability;
- task risk/classification;
- tenant data policy;
- provider/model health;
- latency target;
- quality class;
- remaining tenant budget/quota;
- estimated cost;
- geographic/compliance constraints when configured.

Fallback must never silently reduce a security/privacy requirement. If no provider satisfies mandatory constraints, execution fails closed with a structured reason.

## 5. Speed classes

ATLAS exposes provider-neutral speed classes rather than vendor branding:

- Standard — normal priority and cost profile.
- Fast — lower latency when entitled and available.
- MAX — highest eligible priority/latency class under tenant policy.

A speed class is an orchestration request, not a guarantee. UI must show actual resolved provider/model/speed evidence after dispatch. Higher-speed execution can consume quota faster; Usage Governor and Cost Guard must evaluate it before dispatch.

## 6. ATLAS Operators

Operators are persistent agents, not background claims. Each Operator has:

- tenant and owner identity;
- goal and bounded scope;
- allowed tools/connectors;
- permission policy;
- budget/quota ceiling;
- trigger/schedule policy;
- execution state;
- checkpoints and evidence;
- pause/disable/revoke controls;
- audit trail.

States: draft, ready, running, waiting, paused, failed, completed, disabled. `running` requires runtime evidence. `completed` requires completion evidence. An Operator cannot infer permission from plan tier alone; RBAC and tool-specific authorization still apply.

## 7. Entitlements and billing boundary

Entitlements are evaluated server-side using tenant, user, plan version, subscription state, feature, quota state, and policy. The frontend consumes an entitlement decision and cannot self-upgrade.

Commercial checkout/provider integration is behind an adapter boundary. ATLAS must support subscription lifecycle events idempotently and preserve event evidence. No UI may display paid/active/approved based only on a redirect or client state.

## 8. Usage Governor and Cost Guard

Every metered execution emits normalized usage records. Records include tenant, actor, task, provider/model, speed class, metering units, timestamp, correlation ID, and evidence reference.

Before expensive execution, Cost Guard evaluates entitlement, remaining budget, configured ceiling, expected consumption class, and fallback options. Policy outcomes: allow, allow-with-cap, downgrade-speed, choose-alternate-provider, or deny. Financial limits and quota changes require authorized roles and audit events.

## 9. Data, tenancy, security

All MAX resources are tenant-scoped. Authorization is deny-by-default. Provider credentials are server-side secrets and never returned to clients. Sensitive actions require existing ATLAS RBAC/approval policy where applicable. Cross-tenant identifiers must not grant access. Audit events must identify tenant, actor, action, target, decision, and correlation ID.

Memory, files, Operators, usage, and evidence must support explicit retention/deletion policies. Provider adapters receive only the data required for the task under the applicable tenant policy.

## 10. UI/UX

Use ATLAS design tokens and responsive components. Plan selection may use the reference pattern of three immediately comparable tiers with MAX visually emphasized, but must not copy ChatGPT branding or proprietary visual assets.

Required surfaces:

- plan comparison;
- current entitlement/usage;
- speed selector where eligible;
- provider-neutral model/capability selector where allowed;
- Operator management;
- memory/storage usage;
- Cost Guard/budget controls for authorized roles;
- execution evidence and audit status.

Required component states: default, hover/focus, active, loading, empty, disabled, partial/degraded, and error. Accessibility includes keyboard operation, visible focus, semantic labels, reduced-motion compatibility, and responsive desktop/tablet/mobile layouts.

## 11. Evidence rules

ATLAS governance applies throughout: never show active, connected, approved, paid, running, completed, deployed, verified, or equivalent state without authenticated evidence.

Examples:

- MAX active → valid server-side entitlement.
- Operator running → runtime execution evidence.
- Provider available → current configured health/capability evidence.
- Storage quota → authoritative metering source.
- Payment complete → verified billing lifecycle event.
- Production verified → production verification gate evidence.

Unknown evidence produces unknown/pending/degraded state, never optimistic success.

## 12. Failure behavior

Fail closed for identity, tenant isolation, RBAC, entitlement, secret access, billing activation, and mandatory privacy/security routing constraints.

Provider outage: attempt only policy-compliant fallbacks; otherwise return a structured degraded/unavailable state.

Metering failure: do not lose usage silently. The execution policy must either reject new metered work or persist recoverable metering evidence according to the configured reliability strategy.

Operator failure: preserve checkpoint/evidence, expose retry eligibility, and never mark completed.

## 13. Testing and gates

Implementation follows TDD. Required coverage:

- unit tests for plan/entitlement/routing/governor decisions;
- tenant-isolation and RBAC tests;
- idempotent billing-event tests;
- provider fallback/fail-closed tests;
- Operator state-machine tests;
- metering/evidence tests;
- UI entitlement and degraded-state tests;
- accessibility/navigation checks;
- integration tests across entitlement → routing → usage → evidence;
- existing ATLAS typecheck, design verification, unit/integration, edge/neural/navigation, build and security gates;
- production P0 verification after deployment.

No implementation is considered production-complete until the deployed exact revision passes the applicable production verification gates.

## 14. Rollout

Phase 1 establishes contracts: catalog, entitlements, routing, usage/evidence, and MAX UI shell using existing ATLAS foundations.

Phase 2 enables governed provider adapters and speed classes.

Phase 3 enables Operators with bounded tools, checkpoints, budgets, and audit.

Phase 4 connects commercial billing/storage policies and expands capability based on verified infrastructure.

Feature flags permit staged tenant rollout and rollback without changing the commercial contract incorrectly.

## 15. Non-goals for initial implementation

- claiming unlimited compute/storage;
- cloning ChatGPT UI/branding;
- implementing a proprietary foundation model;
- purchasing external capacity automatically;
- exposing provider API keys client-side;
- allowing autonomous Operators unrestricted permissions;
- bypassing existing ATLAS security, CI, deployment, or evidence gates.

## 16. Acceptance criteria

The first production-capable ATLAS MAX increment is acceptable when:

1. plans and entitlements are server-authoritative and tenant-scoped;
2. MAX-only UI cannot be activated by client manipulation;
3. router decisions are provider-neutral, policy-controlled, and auditable;
4. speed requests pass Cost Guard/Usage Governor;
5. persistent Operators cannot exceed explicit tool/permission/budget boundaries;
6. usage and completion claims have evidence;
7. failure paths fail closed where security/entitlement requires it;
8. automated tests cover critical decision/state boundaries;
9. existing ATLAS verification gates pass;
10. the exact deployed revision passes production P0 verification before being reported as verified.
