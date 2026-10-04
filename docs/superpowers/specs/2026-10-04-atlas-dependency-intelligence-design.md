# ATLAS Dependency Intelligence — Architecture & Change Impact Graph

Status: Design approved — written specification pending repository review  
Date: 2026-10-04  
Owner: ATLAS Manager / Release Control  
Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`

## 1. Purpose

ATLAS Dependency Intelligence gives ATLAS a machine-readable, evidence-aware map of how modules, routes, packages, backend functions, data stores, permissions, providers, workflows and tests depend on each other.

Its primary question is:

> If this file, contract, provider, route, schema, permission or runtime capability changes, what can be affected and what must be verified before the change is considered safe?

The system exists to reduce regression risk, prevent hidden coupling, select the correct validation scope, improve release decisions and make future ATLAS agents capable of reasoning about architecture from repository and runtime evidence instead of informal memory.

It must not become a second production-control plane or a competing source of truth.

## 2. Existing authorities that remain canonical

Dependency Intelligence extends existing ATLAS architecture and preserves the following authorities:

1. `apps/web/src/modules/registry.ts`
   - canonical web module identity, navigation route, product area and implementation classification;
   - not a production-verification authority.
2. `public.atlas_master_evidence_registry`
   - append-only provenance and evidence precedence for release/module claims;
   - remains the authority for whether a claim has current authenticated evidence.
3. ATLAS Manager
   - infrastructure state, deployment orchestration, provider normalization, repair, release verification and public-production evidence.
4. Release Control and deployment gates
   - execution authority for whether a release may advance.
5. Existing domain readiness contracts
   - provider/domain-specific readiness logic remains owned by the corresponding module or adapter.

Dependency Intelligence records relationships between those authorities. It does not replace them.

## 3. Design principles

### 3.1 Derived truth, not duplicated truth

The graph may index facts from canonical sources, but it must retain a provenance reference to the canonical source. If an authoritative source changes, the graph is regenerated or updated from that source.

Examples:

- module name and primary route come from `ATLAS_MODULES`;
- evidence state comes from Master Evidence Registry / release gates;
- provider readiness comes from the existing provider adapter or readiness endpoint;
- database-policy state comes from the current Supabase control-plane verification;
- public-production verification comes from ATLAS Manager.

### 3.2 Fail closed for uncertainty

Unknown dependencies are not treated as safe dependencies.

When a required relationship cannot be resolved, Dependency Intelligence returns an explicit `unknown` or `evidence_needed` state. High-risk unresolved dependencies may increase the required verification scope but must never fabricate a passing state.

### 3.3 No secrets in the graph

The graph may record secret names or required credential classes, for example `TELNYX_API_KEY`, but never secret values, bearer tokens, certificates, private keys, passwords, recovery codes or sensitive provider payloads.

### 3.4 Tenant and organization boundaries

Architecture metadata that is repository-global may be shared across organizations. Runtime/provider/data relationships that are organization-specific must preserve organization scope, RLS and RBAC.

A tenant must never infer another tenant's provider configuration, resources, identifiers or runtime evidence through the graph.

### 3.5 Explainability

Every impact decision must be explainable as a path:

`changed source -> dependency edge -> affected capability -> required gate`

The system must expose why a test, permission review, provider check or production verification was selected.

## 4. Scope

### 4.1 In scope for v1

- canonical ATLAS modules;
- web routes;
- workspace packages;
- Supabase Edge Functions;
- database tables/views/functions referenced by ATLAS code or migrations;
- RLS/policy relationships when discoverable from canonical migrations;
- RBAC permission identifiers;
- external provider adapters and readiness boundaries;
- GitHub workflows used for CI, security, build, deploy and production verification;
- test files and test suites;
- evidence requirements;
- runtime verification endpoints;
- direct and transitive impact analysis;
- P0/P1/P2 risk classification;
- required validation selection;
- machine-readable PR/release impact report.

### 4.2 Explicit non-goals for v1

- replacing GitHub dependency analysis;
- replacing Supabase schema metadata;
- replacing ATLAS Manager;
- building a new deployment mechanism;
- creating a general-purpose observability platform;
- importing personal/non-technical user data into the architecture graph;
- storing provider secrets;
- attempting perfect whole-program static analysis;
- automatically approving merges solely from a calculated risk score;
- implementing a distributed service mesh.

## 5. Architecture

```text
Canonical Sources
├── GitHub repository
│   ├── ATLAS_MODULES
│   ├── routes/components/packages
│   ├── Supabase functions/migrations
│   ├── permissions/providers
│   ├── tests
│   └── workflows
├── ATLAS Manager
│   ├── provider state
│   ├── runtime verification
│   └── release/deployment state
└── Master Evidence Registry
    └── authenticated provenance

          │
          ▼

ATLAS Dependency Intelligence
├── Source Extractors
├── Canonical Node Registry
├── Dependency Edge Registry
├── Graph Builder
├── Impact Engine
├── Verification Selector
└── Explainability / Evidence Resolver

          │
          ├──► PR / CI impact report
          ├──► Release Control gate input
          ├──► ATLAS Manager diagnostics
          ├──► ATLAS UI architecture explorer
          └──► future governed ATLAS agents
```

The implementation should be a shared ATLAS capability, not a standalone product stack.

## 6. Canonical graph model

### 6.1 Node categories

Each node has a stable `id`, `kind`, display metadata, provenance and optional organization/runtime scope.

Required v1 node kinds:

- `module`
- `route`
- `component`
- `package`
- `source_file`
- `edge_function`
- `database_object`
- `rls_policy`
- `permission`
- `provider`
- `provider_capability`
- `workflow`
- `test_suite`
- `runtime_endpoint`
- `evidence_requirement`
- `secret_requirement`

Potential later node kinds:

- `event`
- `api_contract`
- `metric`
- `data_classification`
- `cost_center`
- `infrastructure_resource`

### 6.2 Edge categories

Required v1 relationship kinds:

- `contains`
- `imports`
- `routes_to`
- `calls`
- `reads`
- `writes`
- `requires_permission`
- `requires_provider`
- `requires_capability`
- `requires_secret`
- `verified_by`
- `tested_by`
- `deployed_by`
- `depends_on`
- `supersedes`
- `evidence_for`

All edges must include a provenance class:

- `static_discovery`
- `declared_manifest`
- `migration_discovery`
- `runtime_observation`
- `evidence_registry`
- `operator_override`

Operator overrides must be audited and cannot silently contradict stronger authenticated runtime evidence.

## 7. Stable identifiers

Graph identifiers must remain stable across normal refactors where practical.

Examples:

- `module:connect`
- `route:/connect`
- `package:communication`
- `edge-function:atlas-telephony`
- `permission:connect.telephony.call`
- `provider:telnyx`
- `workflow:global-production-verify`
- `secret-requirement:TELNYX_API_KEY`

Source-file nodes use repository-relative paths.

Database object IDs must include schema, for example `database-object:public.atlas_releases`.

## 8. Discovery strategy

The graph is built by combining deterministic extraction with explicit manifests for relationships that static discovery cannot infer safely.

### 8.1 Deterministic extraction

Extractors should inspect:

- workspace package metadata;
- TypeScript/JavaScript imports;
- route registration;
- `ATLAS_MODULES`;
- Supabase function directories;
- SQL migrations;
- permission literals and permission registries;
- provider registries/adapters;
- workflow YAML;
- test imports and test naming/targets.

### 8.2 Explicit dependency manifests

Complex capabilities may declare a small colocated manifest when a relationship cannot be reliably derived.

Example conceptual shape:

```ts
export const dependencyManifest = {
  capability: 'telephony.call',
  module: 'connect',
  requires: {
    permissions: ['connect.telephony.call'],
    providers: ['telnyx'],
    evidence: ['provider_readiness', 'runtime_e2e']
  }
} as const;
```

Manifests are supplemental declarations, not permission or readiness authorities.

### 8.3 Drift detection

CI compares generated graph state with declared/canonical sources. Stale manifests, unresolved node references and orphaned relationships produce actionable findings.

P0 drift examples:

- manifest references a permission that does not exist;
- production-critical route references an unknown backend function;
- provider-backed action has no readiness boundary;
- sensitive action has no permission relationship.

## 9. Impact engine

The Impact Engine receives a change set and returns direct/transitive impact.

Inputs include:

- changed repository paths;
- changed database migrations;
- changed permission identifiers;
- changed provider contracts;
- changed API/event contracts when available;
- changed workflows.

Output example:

```json
{
  "risk": "medium",
  "direct": ["module:connect", "package:communication"],
  "transitive": ["module:voice", "provider:telnyx"],
  "requiredVerification": [
    "typecheck",
    "unit:communication",
    "rbac:connect",
    "provider-readiness:telnyx",
    "e2e:telephony",
    "production-route:/connect"
  ],
  "unresolved": [],
  "explanations": []
}
```

## 10. Risk classification

Risk is derived from impacted capabilities and unresolved relationships, not from line count alone.

### P0 / critical

Examples:

- authentication/session boundaries;
- organization/tenant isolation;
- RBAC or RLS;
- billing/payment/regulated flows;
- deployment/release verification;
- secret handling;
- destructive data migrations;
- production DNS/TLS/edge routing;
- provider actions with legal/regulatory consequences.

P0 impact requires the full relevant hard-gate set and cannot be downgraded by a low diff size.

### P1 / high-medium

Examples:

- shared package contracts;
- cross-module APIs;
- external provider adapters;
- background execution;
- shared navigation/routes;
- core data models.

### P2 / localized

Examples:

- isolated presentation changes;
- non-shared content updates;
- internal tests/doc changes with no runtime relationship.

A P2 classification does not bypass mandatory global release/security gates already required by ATLAS governance.

## 11. Verification selector

Dependency Intelligence selects additional focused tests and verification based on impact.

It does not remove repository-wide mandatory gates. Instead it answers which domain-specific checks must be added.

Examples:

- telephony provider contract changed -> communication unit tests + provider readiness + telephony E2E;
- RLS migration changed -> migration validation + tenant isolation tests + affected module integration tests;
- module route changed -> route smoke + navigation reachability + affected UI tests;
- Cloudflare production workflow changed -> release/deployment verification + exact-SHA public production check.

Every selected verification must include an explanation path.

## 12. Integration with Master Evidence Registry

Dependency Intelligence may request evidence but does not issue production-verification truth by itself.

For a required gate, it resolves current evidence through the existing evidence architecture and distinguishes:

- evidence exists and is current;
- evidence exists but is stale for the current SHA/environment;
- evidence exists for a different environment;
- evidence is missing;
- provider evidence is unavailable/unverified.

The graph stores references/relationships to evidence records, not copied claims presented as independent truth.

## 13. Integration with ATLAS Manager

ATLAS Manager consumes Dependency Intelligence for:

- blast-radius diagnostics;
- identifying the smallest safe repair/verification boundary;
- selecting affected runtime endpoints;
- determining which provider checks are relevant;
- displaying why a release is held;
- exposing affected modules/resources after an infrastructure failure.

Dependency Intelligence consumes normalized provider/runtime state from ATLAS Manager rather than talking directly to every provider from the browser.

## 14. PR and CI contract

For every pull request, the graph engine should be able to generate an impact report containing:

- changed nodes;
- directly affected capabilities;
- transitively affected capabilities;
- P0/P1/P2 classification;
- unresolved dependencies;
- mandatory focused verification;
- evidence still required;
- merge recommendation state.

Recommended machine states:

- `CLEAR`
- `CLEAR_WITH_WARNINGS`
- `HOLD_MISSING_VERIFICATION`
- `HOLD_UNKNOWN_DEPENDENCY`
- `BLOCKED_HARD_GATE_FAILURE`

These are advisory/control inputs. Actual merge/deploy authority remains with repository rules and ATLAS release gates.

## 15. UI surface

The first UI should live under the existing internal platform/release experience rather than adding a top-level product module.

Recommended route:

`/release/dependencies`

Core views:

1. Architecture Graph
   - module/capability-centric graph;
   - filter by module, provider, permission, risk, environment.
2. Change Impact
   - paste/select commit/PR/current change set;
   - direct/transitive impact;
   - required verification.
3. Dependency Detail
   - upstream/downstream relationships;
   - provenance for each relationship;
   - evidence/readiness references.
4. Drift & Unknowns
   - unresolved or stale relationships;
   - orphaned manifests;
   - unknown production-critical dependencies.

The UI must use existing ATLAS design tokens, shell, responsive patterns, accessibility contract and truthful-state policy.

## 16. Permissions

Suggested permission model:

- `architecture.read`
  - view repository-global graph metadata available to the active organization.
- `architecture.runtime.read`
  - view organization-scoped runtime/provider relationships and evidence references.
- `architecture.manage`
  - create/update explicit manifests or approved overrides through governed server-side workflows.
- `architecture.audit.read`
  - inspect provenance/drift/audit history.

Privileged modifications must be server-authoritative and audited.

## 17. Persistence

The v1 graph should be reproducible from canonical repository sources.

Recommended persistence pattern:

- deterministic generated graph artifact for repository-global topology;
- Supabase persistence for organization-scoped runtime associations, audited overrides, graph snapshots and analysis runs;
- no browser-authoritative writes.

If persistent graph tables are introduced, RLS must be enabled for organization-scoped rows and write access must be restricted to governed server-side functions.

Historical impact reports should retain the analyzed commit SHA so conclusions are not silently reused for later code.

## 18. Failure behavior

Dependency Intelligence must return partial truthful results when possible.

Examples:

- repository graph succeeds but provider runtime is unavailable -> static impact is returned; provider evidence marked unavailable;
- an extractor cannot parse one file -> graph build records unresolved source and increases risk where applicable;
- a manifest references a removed node -> drift finding; no silent edge deletion;
- evidence store unavailable -> impact still computed, verification state becomes `evidence_unavailable`.

A graph-generation failure must not make an unsafe change look safe.

## 19. Security and privacy

Required controls:

- no secret values;
- no private provider payload replication;
- organization-scoped runtime metadata protected by RLS/RBAC;
- audited privileged overrides;
- sanitized source references;
- no ingestion of personal health, legal, tax, employment, symbolic or unrelated user data into architecture topology;
- repository/source parsing treated as untrusted input for rendering;
- UI must escape labels and metadata.

## 20. Testing strategy

### Unit

- node ID normalization;
- edge normalization;
- risk classification;
- graph traversal;
- cycle-safe impact traversal;
- unknown dependency handling;
- verification selection;
- provenance precedence.

### Contract

- ATLAS module registry extraction;
- provider registry extraction;
- permission extraction;
- workflow extraction;
- Supabase function/migration extraction.

### Integration

- changed file -> affected module path;
- provider contract -> dependent modules -> required provider/E2E gates;
- RLS migration -> affected database consumers -> tenant-isolation verification;
- workflow change -> release-control impact.

### Security

- tenant isolation for runtime graph state;
- permission enforcement;
- secret-value rejection;
- malicious metadata rendering/escaping.

### E2E

- PR/change set produces deterministic impact report;
- `/release/dependencies` renders graph and impact details;
- evidence references resolve without fabricating status;
- unresolved P0 dependency produces a hold state;
- exact analyzed SHA is visible in report history.

## 21. Initial vertical slice

The first implementation slice should prove the architecture using one provider-backed capability with meaningful cross-module impact.

Recommended slice: ATLAS Telephony.

Target chain:

`source files -> package:communication -> module:connect -> telephony provider -> permission -> provider readiness -> tests -> production route/evidence`

This slice is preferred because the repository already has a telephony provider contract with explicit readiness semantics and Connect is externally gated. It exercises repository discovery, provider dependencies, RBAC, E2E verification and truthful external readiness without requiring a new provider architecture.

After the vertical slice passes, expand extractors to the rest of the repository.

## 22. Future extensions

These are intentionally deferred until the v1 graph is stable:

### API/Event Contract Guard

Version API/event schemas and identify breaking consumers before merge.

### Data Lineage and Privacy Classification

Track producer/transformer/consumer relationships for business data with sensitivity labels and retention constraints.

### FinOps / AI Cost Impact

Associate provider/resource dependencies with normalized cost/usage data and estimate which changes can alter operational spend.

### Disaster-Recovery Impact

Use the graph to select restoration drills and identify capabilities without verified recovery paths.

### Runtime Digital Twin

Run bounded failure simulations against the dependency graph without representing simulations as production evidence.

## 23. Acceptance criteria

The first production-capable version is accepted only when:

- existing ATLAS authorities remain canonical and are not duplicated;
- the graph can identify canonical modules from the existing registry;
- the graph can model source/package/module/provider/permission/test/evidence relationships;
- every relationship exposes provenance;
- impact traversal is deterministic and cycle-safe;
- unresolved dependencies are explicit;
- risk classification covers P0/P1/P2;
- a change set produces required focused verification with explanations;
- mandatory global gates remain intact;
- provider/readiness status is consumed from existing authoritative boundaries;
- evidence references remain SHA/environment aware;
- no secrets are stored or rendered;
- runtime data preserves tenant/RBAC boundaries;
- the telephony vertical slice works end-to-end;
- CI can emit a machine-readable impact report;
- `/release/dependencies` exposes the result without fake production state;
- tests, build, security gates and production verification required by the affected scope pass before completion is claimed.

## 24. Definition of success

ATLAS Dependency Intelligence succeeds when an engineer or governed ATLAS agent can ask:

- What depends on this?
- What can this change break?
- Which modules and providers are affected?
- Which permissions/data policies are in the blast radius?
- What tests and runtime checks are mandatory?
- Which required evidence is missing or stale?
- Why is the release held?

and receive a deterministic, provenance-backed answer tied to the exact repository/release boundary being analyzed.

The long-term objective is a living architectural map of ATLAS that makes the system safer to evolve as its module count, integrations and deployment surface continue to grow.
