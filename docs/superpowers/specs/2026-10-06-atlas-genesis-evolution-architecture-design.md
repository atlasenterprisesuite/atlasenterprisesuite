# ATLAS Genesis & Evolution Architecture

**Date:** 2026-10-06

## Purpose

ATLAS must evolve as one governed organism rather than as a collection of unrelated applications. This design turns the evolutionary logic expressed in *Enciclopedia del Universo y la Historia de Todo — Edición 2026* into a software-governance model for continuously auditing, repairing, integrating, and improving ATLAS without weakening truth, security, tenancy, or production evidence.

The source document is inspiration for the progression model, not a scientific claim that software literally evolves biologically. The engineering implementation remains deterministic, testable, reviewable, and governed.

## Existing ATLAS foundations to reuse

This design extends existing ATLAS architecture instead of creating a parallel system.

- `apps/web/src/modules/registry.ts` is the canonical module registry.
- `apps/web/src/modules/release/gestation.ts` already models Conception → Genome → Organogenesis → Circulation → Nervous System → Skeleton → Brain → Body → Senses → Viability → Labor → Birth.
- `packages/ai-core/src/completionReadiness.ts` already enforces evidence-locked completion.
- `docs/knowledge/humanity-atlas/README.md` already defines evidence, provenance, uncertainty, and cross-domain knowledge rules.
- `docs/governance/ATLAS_MASTER_AUTONOMOUS_EXECUTION_PROTOCOL.md` remains the binding execution contract.
- GitHub remains the canonical source and CI/review evidence system; Cloudflare remains the primary production verification boundary.

No new source of truth may duplicate any of these responsibilities.

## Design principle

The source encyclopedia reconstructs a chain of increasing organization:

`fields/energy → particles → atoms → stars → elements → planets → life → evolution → brains → culture → science → technology → AI`

ATLAS adopts an engineering analogue:

`principles → contracts → components → cores → modules → connected system → automation → knowledge → intelligence → self-correction → continuous evolution`

This sequence is a dependency and maturity model, not a marketing timeline.

## The ATLAS DNA

Every canonical ATLAS capability must inherit the same non-negotiable invariants. These invariants are ATLAS DNA:

1. Canonical source of truth.
2. Authentication and session integrity where required.
3. Organization/tenant isolation.
4. RBAC and least privilege.
5. Auditable state-changing operations.
6. Zero-trust treatment of external inputs and providers.
7. Provider neutrality where a provider is replaceable.
8. Fail-closed behavior for unavailable or unverified external capability.
9. Evidence before completion or production claims.
10. Idempotency and reconciliation for critical mutations and cross-module events.
11. Reversible or recoverable operational changes where feasible.
12. Explicit loading, empty, error, success, disabled, and unavailable states.
13. Responsive and accessible product behavior.
14. Observability for critical execution paths.
15. No simulated success, fake production metrics, or hidden placeholders.
16. Provenance and uncertainty labels for knowledge claims.
17. Security boundaries for secrets and sensitive data.
18. Versioned lineage for superseded contracts and capabilities.

A module may specialize its implementation but may not silently opt out of these invariants.

## Three independent state axes

ATLAS must stop compressing multiple meanings into a single status. Every audited object can carry three independent axes.

### 1. Engineering state

- `specified`
- `implemented`
- `integrated`
- `tested`
- `security-verified`
- `data-verified`
- `e2e-verified`
- `production-verified`

The highest state requires evidence for every prior state. The system must fail closed if evidence is absent.

### 2. Knowledge/evidence state

Adapted from the encyclopedia's certainty map:

- `established`
- `strongly-supported`
- `active-hypothesis`
- `open-question`

These labels describe the confidence of a knowledge claim, not software readiness.

### 3. Evolution state

- `operational-baseline`
- `active-evolution`
- `continuous-evolution`
- `superseded`
- `deprecated`
- `retired`

A production-verified module may still be in active or continuous evolution.

## Evolution Kernel

The Evolution Kernel is a shared control-plane capability, not a user-facing standalone application and not a replacement for Release Control, Knowledge Atlas, or Universal Execution.

It has six responsibilities:

### A. Inventory

Discover canonical ATLAS objects at multiple scales:

- package/workspace;
- service/function;
- schema/table/policy;
- route;
- component;
- workflow;
- module;
- provider adapter;
- CI/release gate.

The first implementation scope must begin with the canonical module registry and known release-control surfaces. Deeper static inventory can be added incrementally.

### B. DNA audit

Evaluate each object against applicable ATLAS DNA invariants and emit structured findings rather than prose-only diagnostics.

A finding must include:

- stable finding ID;
- target identity and type;
- invariant violated or unproven;
- severity `P0 | P1 | P2 | P3`;
- state `open | accepted-risk | remediated | superseded`;
- evidence references;
- recommended remediation;
- first-seen and last-verified timestamps where persistence exists.

Absence of evidence is not success.

### C. Dependency ecology

Model explicit relationships such as:

- module depends on module;
- route exposes module;
- component realizes workflow;
- workflow reads/writes canonical data owner;
- provider adapter supports capability;
- event triggers downstream consumer;
- evidence verifies release or task.

The graph must prevent accidental duplicate sources of truth and expose unsupported dependency chains.

### D. Evolution ledger

Record material changes to a capability:

`observation → hypothesis → proposed change → RED test → implementation → GREEN test → integration → CI → security → E2E → deploy → production verification → measured outcome → adopt/reject/refine`

The ledger references existing Git commits, PRs, workflow evidence, task evidence, and production verification rather than copying them into a shadow system.

### E. Frontier registry

Unknowns must be represented explicitly rather than invented away.

States:

- `known`
- `unknown`
- `hypothesis`
- `experiment`
- `contradiction`
- `resolved`
- `superseded`

This registry belongs primarily to Knowledge Atlas for knowledge questions and to Release/Execution governance for engineering unknowns. The Evolution Kernel only provides a common contract and cross-links.

### F. Convergence loop

The Kernel ranks audit findings by severity, blast radius, dependency centrality, and evidence gap. It never autonomously mutates production. Remediation proposals flow through the existing governed development and release process.

## Evolution after Birth

`/release/gestation` remains the pre-production maturity model. Birth is not the terminal state.

After Birth, ATLAS adopts a post-birth lifecycle:

1. `adaptation` — production feedback and operational correction;
2. `specialization` — module-specific capability growth without violating DNA;
3. `cooperation` — verified cross-module workflows;
4. `memory` — durable knowledge, evidence, lineage, and lessons learned;
5. `intelligence` — governed reasoning and automation over authorized context;
6. `self-correction` — contradictions and regressions cause new hypotheses and tests;
7. `continuous-evolution` — the stable baseline improves without losing verified history.

Gestation status and evolution status remain independent.

## Multicellular rule: no isolated organs

The encyclopedia's multicellularity analogy becomes a concrete architecture rule: ATLAS modules cooperate through canonical contracts and cannot create private duplicate foundations.

The audit must flag as architectural drift when a module introduces an unnecessary duplicate of:

- identity/session handling;
- tenant or organization model;
- permission model;
- customer/entity master data;
- payment/financial ledger;
- audit log;
- navigation registry;
- provider readiness model;
- evidence/completion contract;
- knowledge provenance store.

A legitimate domain-owned record is not duplication. The finding exists only when ownership or synchronization is ambiguous or conflicting.

## Selection pressure for changes

A change does not become part of the operational baseline merely because it compiles.

Applicable gates include:

- deterministic tests;
- type safety;
- security and tenancy checks;
- data ownership and migration safety;
- integration correctness;
- accessibility and responsive behavior;
- performance budgets where defined;
- provider truthfulness;
- observability;
- production verification against the exact release SHA;
- no unresolved P0 blocker.

The current evidence-locked completion gate remains authoritative for tasks. Evolution Kernel assessments can add reasons but cannot bypass that gate.

## Extinction, supersession, and fossils

ATLAS must be able to remove obsolete architecture safely.

Lifecycle:

`new → adapted → stable → superseded → deprecated → retired`

Retirement requires, as applicable:

- replacement or explicit removal decision;
- consumer/dependency inventory;
- migration path;
- rollback/recovery plan;
- removal of dead routes and controls;
- archived lineage to the previous implementation;
- verification that no canonical source still depends on the retired object.

Deprecated code must not silently remain forever as an invisible second system.

## Audit hierarchy: "cells and particles"

The phrase "every cell and particle" maps to six auditable layers:

### L0 — Principles and contracts

Governance, shared types, schemas, permissions, evidence contracts, API contracts.

### L1 — Primitives

Functions, hooks, utilities, components, adapters, policies, migrations.

### L2 — Cores

Shared engines such as identity, execution, knowledge, audit, events, AI orchestration, provider readiness.

### L3 — Modules

Finance, Business, People, Health, Ride, GPS, Studio, Connect, Device OS, and all other canonical registry entries.

### L4 — Organ systems

Cross-module journeys such as procure-to-pay, hire-to-payroll, lead-to-cash, source-to-tax, ride-to-settlement, content-to-publication, device-to-network, and research-to-knowledge.

### L5 — Organism

Whole-suite production integrity: navigation, identity, release, recovery, security, observability, and exact-SHA production truth.

Auditing proceeds bottom-up and top-down because local correctness does not prove system correctness and system health can hide local defects.

## Initial repository audit findings

Read-only inspection on 2026-10-06 shows a strong foundation and several gaps this architecture is intended to close.

### Existing strengths

- A canonical module registry already exists.
- Gestation already separates biological analogy from concrete ATLAS layers and uses fail-closed exit gates.
- Operational baseline and active evolution are already separated.
- Completion readiness requires test evidence, satisfied approval, and verified deployment.
- Knowledge Atlas already requires provenance, evidence strength, current/superseded/disputed/experimental labels, and last verification dates.
- Recent commits continue to strengthen evidence-locked completion and task readiness.

### Structural gaps

- There is no single typed ATLAS DNA contract consumed by registry, gestation, completion readiness, and audit surfaces.
- There is no canonical structured finding model covering all module audits.
- Gestation ends at Birth and does not yet model post-production evolution.
- Registry `evolution` is intentionally lightweight and cannot carry evidence, lineage, or remediation state.
- Cross-module dependency ecology is not expressed as a single canonical graph contract.
- Evidence certainty for knowledge and engineering readiness are conceptually compatible but not yet represented as explicitly separate reusable types.
- There is no repository-wide mechanism to prevent architectural drift from accumulating as duplicate foundations or dead fossils.

These gaps do not mean existing modules are defective; they mean evidence and evolution are not yet governed uniformly enough to prove the health of every layer.

## First implementation slice

The first implementation must be small enough to verify independently and valuable enough to become the foundation for the broader audit.

It will add:

1. a shared Evolution Kernel domain model;
2. typed ATLAS DNA invariants;
3. deterministic module-registry audit producing structured findings;
4. post-Birth evolution phases while preserving existing Gestation semantics;
5. unit tests proving fail-closed behavior and separation of engineering/evidence/evolution states;
6. an audit summary consumable by Release Control or a later Evolution UI without introducing a new source of truth.

It will not yet crawl arbitrary source code, mutate modules automatically, add a new database, or create a new user-facing top-level module.

## Subsequent subprojects

After the foundation is verified, the broader "every cell and particle" program decomposes into independently testable subprojects:

1. **Dependency Ecology Graph** — canonical dependency and ownership contracts.
2. **Static Architecture Auditor** — detect placeholders, duplicate foundations, route dead ends, missing state handling, and unsupported provider claims.
3. **Data & Security Auditor** — tenant/RBAC/RLS/audit/migration verification.
4. **Journey Auditor** — critical A-Z cross-module workflows and reconciliation.
5. **UX & Accessibility Auditor** — responsive states, keyboard/focus, semantics, empty/error/loading/success coverage.
6. **Provider & Network Auditor** — scopes, authorization, readiness, timeout/degradation, fail-closed external boundaries.
7. **Evolution Ledger & Lineage** — link PR/commit/test/deployment evidence and supersession relationships.
8. **Frontier Registry integration** — explicit unknown/hypothesis/experiment/contradiction handling.
9. **Evolution Control Surface** — visual drill-down only after the underlying contracts are stable.
10. **Continuous Convergence** — scheduled audit runs, regression detection, prioritized remediation queues, and exact-SHA production verification.

Each subproject must reuse existing architecture and must be separately testable and reversible.

## Repair policy

Audit findings are prioritized as follows:

- `P0`: security boundary breach, tenant isolation failure, data corruption/loss risk, false production success, or critical production unavailability.
- `P1`: broken critical workflow, provider truth violation, missing auditability for sensitive mutations, inaccessible critical operation, or unrecoverable integration defect.
- `P2`: degraded correctness, resilience, usability, observability, maintainability, or performance with a functioning workaround.
- `P3`: optimization, cleanup, consistency, or low-risk technical debt.

P0 findings block completion. P1 findings block the affected release unless explicitly governed by the existing release policy. P2/P3 findings enter the evolution backlog with evidence.

## Safety boundary

"Self-correction" does not mean unrestricted self-modifying production software.

ATLAS may automatically:

- inspect;
- classify;
- compare evidence;
- generate findings;
- propose remediation;
- write tests and code on a governed branch when authorized;
- run CI and verification;
- record evidence.

Production mutation still follows the existing release, authorization, security, spend, provider, and irreversible-action boundaries.

## Success criteria

The architecture is successful when:

1. every canonical module can be assessed against applicable ATLAS DNA invariants;
2. missing evidence produces an explicit gap rather than a green status;
3. engineering readiness, knowledge certainty, and evolution state cannot be confused;
4. Gestation remains backward-compatible while post-Birth evolution is represented explicitly;
5. audit findings are typed, deterministic, prioritizable, and testable;
6. existing canonical owners remain authoritative;
7. no new shadow database or parallel orchestrator is introduced;
8. the same contracts can later audit deeper primitives, cross-module journeys, providers, and production boundaries;
9. remediation passes normal TDD, CI, security, deployment, and exact-SHA production verification;
10. ATLAS continuously improves without erasing the evidence and lineage of how it changed.

## Non-goals

- Claiming ATLAS is biologically alive or conscious.
- Autonomous production mutation outside existing governance.
- Replacing Release Control, Knowledge Atlas, Universal Execution, or the module registry.
- Declaring every current module defective before evidence is collected.
- Treating "perfection" as a one-time terminal state. ATLAS uses continuous evidence-backed convergence instead.
