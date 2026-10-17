# ATLAS Module Lifecycle Governance Design

Date: 2026-10-05
Status: proposed written specification

## Purpose

ATLAS needs one evidence-backed lifecycle truth for every product module and shared capability. The current readiness documentation is useful as historical audit evidence, but it becomes stale as modules advance. This design replaces manual status memory with a generated lifecycle matrix whose state is derived from canonical repository and production evidence.

The lifecycle contract is:

`SPEC | PLAN | TDD | IMPLEMENTED | PR | CI | SECURITY | MERGED | DEPLOYED | P0/P1 E2E | PROD VERIFIED | %`

No module may report 100% unless `PROD VERIFIED` is verified with current, attributable evidence.

## Goals

1. Build a single lifecycle status model shared by every ATLAS module.
2. Reuse the canonical ATLAS module registry as the inventory of product modules instead of maintaining a second module list.
3. Derive lifecycle stages from evidence wherever possible rather than manual claims.
4. Preserve ATLAS fail-closed behavior: missing, stale, contradictory, or unverifiable evidence never counts as complete.
5. Distinguish build completion from external/provider/hardware/regulatory readiness.
6. Support P0 Commercial Core, P1 ATLAS Platform, and P2 Expansion prioritization without allowing P2 work to mask unfinished P0 gates.
7. Produce machine-readable and human-readable lifecycle outputs that can later be surfaced in Release Control / Work Commander without creating another source of truth.

## Non-goals

- Rebuilding modules that already have canonical implementation evidence.
- Treating historical audit documents as live truth.
- Inferring production readiness from filenames, PR titles, or commit messages alone.
- Marking provider-, hardware-, regulatory-, or human-gated capabilities complete without corresponding evidence.
- Introducing a shadow deployment, security, module, or release registry.

## Canonical sources of truth

### Module inventory

The existing canonical ATLAS module registry remains authoritative for product/module identity, route ownership, navigation, and module presence. The lifecycle system consumes it; it does not duplicate it.

### Design and plan evidence

`docs/superpowers/specs/` is the canonical design/spec evidence location.

`docs/superpowers/plans/` is the canonical implementation-plan evidence location.

A matching file is necessary but not automatically sufficient: lifecycle evidence must resolve to the module identity and remain attributable to the current implementation lineage.

### Implementation and TDD evidence

Tests, implementation files, and governed package/module ownership provide `TDD` and `IMPLEMENTED` evidence. A module is not considered implemented merely because a route or placeholder exists.

### Pull request, CI, and security evidence

GitHub PR state and check results provide `PR`, `CI`, and `SECURITY` evidence. Required checks must be successful on the relevant head SHA. Unknown, skipped, cancelled, stale, or missing required checks fail closed.

### Merge evidence

`MERGED` requires canonical ancestry in `main`, not merely a closed pull request.

### Deployment evidence

`DEPLOYED` requires deployment evidence that binds the deployed artifact to the intended commit SHA or immutable build identifier. Existing exact-SHA production controls must be reused.

### E2E and production verification evidence

`P0/P1 E2E` requires successful route/workflow verification for the module's declared criticality class.

`PROD VERIFIED` requires current production evidence for the capability itself, including the relevant availability, authorization, tenant isolation, security, and provider-readiness assertions. Route reachability alone is insufficient when the module claims deeper capability.

## Lifecycle evidence states

Each stage is represented by an explicit state:

- `verified` — current evidence satisfies the stage.
- `partial` — meaningful evidence exists but the complete stage contract is not satisfied.
- `blocked` — an internal dependency or failing gate prevents completion.
- `external_gated` — completion depends on provider, hardware, regulatory, commercial, or human evidence outside the repository.
- `missing` — required evidence does not exist.
- `stale` — evidence exists but no longer satisfies freshness/current-release requirements.
- `not_applicable` — the stage is explicitly excluded by the module contract and does not reduce the score.

Unknown evidence is treated as `missing`, never as `verified`.

## Progress calculation

The percentage is computed only from stages applicable to the module.

- `verified` contributes 1.
- all other states contribute 0.
- `not_applicable` is excluded from the denominator.

`percent = floor(100 * verified_applicable_stages / applicable_stages)`

Additional invariant: if `PROD VERIFIED != verified`, displayed progress must be lower than 100 even if every other applicable stage is verified.

The UI/report may separately display `external_gated` so regulated or provider-dependent modules are not misrepresented as engineering failures.

## Priority classes

### P0 — Commercial Core

Capabilities required to sell and operate the commercial Enterprise Suite. P0 failures block a commercial-complete claim and may block release when the affected capability is in the release scope.

The initial P0 review set includes Accounting close/GL/reconciliation, POS, Projects/Work commercial workflows, Security/Settings closure, and any remaining Time/Recruiting/People depth required by the current commercial cut line.

AR, Inventory/Purchasing, CRM, Analytics, and People must be reclassified from the older missing/incomplete assumptions using current canonical evidence rather than rebuilt automatically.

### P1 — ATLAS Platform

Platform and strategic ecosystem capabilities that are important but should not hold Commercial V1 hostage when truthfully gated. This includes Knowledge Atlas, ATLAS Pay/Issuing, ATLAS Network/Wireless, Drive, CleanScan 3D, Insurance, Telecom/Telephony, and shared resilience capabilities.

ATLAS Pay and Wireless/Network currently have substantial canonical implementations; the lifecycle matrix must represent their remaining provider/regulatory/physical evidence gates instead of labeling them simply missing.

### P2 — Expansion

Parks, AutoWash, Venezuela/Latin Command, Device DNA, ATLAS OS expansion, and experimental verticals remain governed roadmap work unless separately promoted by approved commercial scope.

## Current-state correction policy

The September readiness matrix is retained as an audit snapshot. It must not be consumed as the live source for present module state.

The generated lifecycle matrix performs a fresh evidence reconciliation from current `main` and current production verification on each run. A status can move forward or backward as evidence changes.

Examples already visible in current history include:

- Accounts Receivable has a live governed workspace, API, route, lifecycle tests, and commercial integration work.
- Inventory/Purchasing has canonical registration, procure-to-pay flows, inventory movements, costing, and accounting contracts.
- People has a governed core, API, routes, permissions, readiness closure, and recruiting import work.
- Business Analytics has a canonical package, governed sources, RBAC, persistence, tests, and dedicated control center.
- CRM/HubSpot has provider-neutral contracts, OAuth/secret boundaries, production route gates, and production-hardening work.
- ATLAS Pay/Issuing has a provider-neutral governed control plane and production-route evidence work.
- Wireless has MVNO, owned-network, readiness, and physical commissioning gates while remaining truthful about external RF/carrier evidence.

These examples demonstrate why generated evidence must supersede manual missing/partial labels.

## Generated artifacts

Implementation should produce both:

1. a machine-readable lifecycle artifact (JSON) suitable for Release Control, CI, and future dashboards; and
2. a generated Markdown matrix for human review in `docs/audit/`.

Generated artifacts must identify:

- module id/name;
- priority class;
- every lifecycle stage and evidence state;
- concise evidence references;
- blocking reason when not verified;
- external gate when applicable;
- current commit/build identity;
- calculation timestamp;
- progress percentage.

The generated Markdown file is an output, not a manually edited source.

## CI and release integration

The lifecycle generator must be deterministic for repository-local evidence and explicitly annotate evidence that requires GitHub or production APIs.

CI must fail when:

- lifecycle schema validation fails;
- a canonical module cannot be classified;
- contradictory evidence claims the same stage both verified and blocked;
- a module is displayed at 100% without `PROD VERIFIED=verified`;
- a P0 release-scoped module regresses from verified to missing/blocked without an explicit governed exception;
- generated lifecycle artifacts are stale relative to their declared source SHA when the workflow requires checked-in output.

Production verification remains fail closed for P0 critical routes. P1 failures may be blocking or warning-only only when the owning module contract explicitly declares the policy.

## Security and governance

The lifecycle system reads metadata and evidence; it must not expose secrets, tokens, private provider credentials, customer data, or raw privileged logs.

Evidence references should identify checks, artifacts, routes, immutable SHAs, and verification records rather than embedding sensitive payloads.

Any manual override requires:

- authenticated actor identity;
- tenant/org scope when relevant;
- reason;
- expiration;
- audit record;
- explicit stage affected.

Manual overrides may explain status but may not fabricate `verified` production evidence.

## UI contract

If surfaced in ATLAS UI, the matrix must distinguish:

- verified engineering completion;
- internal blockers;
- external/provider/hardware/regulatory blockers;
- stale evidence;
- not-applicable stages.

The UI must never use a green/complete state for `partial`, `blocked`, `external_gated`, `missing`, or `stale`.

Drill-down should reveal evidence lineage from module -> stage -> evidence reference -> source SHA/run/deployment.

## Rollout

Phase 1 — lifecycle schema, module mapping, deterministic repository evidence, generated JSON/Markdown.

Phase 2 — GitHub PR/check/security evidence ingestion and exact-main merge ancestry.

Phase 3 — deployment, P0/P1 E2E, and production verification evidence integration.

Phase 4 — Release Control / Work Commander visualization and governed exceptions.

Each phase must preserve one canonical lifecycle model and must not create parallel status systems.

## Acceptance criteria

The design is ready for implementation planning when all of the following are agreed:

1. the canonical module registry remains the inventory source;
2. the lifecycle columns remain `SPEC | PLAN | TDD | IMPLEMENTED | PR | CI | SECURITY | MERGED | DEPLOYED | P0/P1 E2E | PROD VERIFIED | %`;
3. unknown/missing/stale evidence fails closed;
4. 100% is impossible without current `PROD VERIFIED` evidence;
5. the September readiness matrix becomes historical input only;
6. current evidence is recalculated rather than copied from old labels;
7. regulated/provider/hardware gates remain explicit and truthful;
8. machine-readable and human-readable outputs share the same computed model;
9. P0/P1/P2 prioritization is separate from completion percentage;
10. no implementation begins until the written spec is reviewed and an implementation plan is approved.
