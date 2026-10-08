# ATLAS Neural Fabric / DNA — Architectural Design

Date: 2026-10-08
Status: DRAFT — requires user review; NOT implementation or production certification
Repository: atlasenterprisesuite/atlasenterprisesuite
Branch: docs/atlas-neural-fabric-design-20261008

## 1. Intent and success

Unify existing ATLAS modules as independently governed capabilities sharing identity, tenant context, contracts, event delivery, approvals, evidence, observability, and AI routing. Reuse existing code and database assets. Do not treat navigation presence or a passing source-only test as production verification.

Success requires an inventory of existing capabilities and contracts, an integration graph with owners, per-module security and evidence gates, and a reproducible exact-SHA production verification path.

## 2. Confirmed repository context (read-only, 2026-10-08)

- README.md defines main as production-stable and GitHub → Supabase → Cloudflare as canonical.
- docs/architecture/ATLAS_MANAGER_SPEC.md describes existing control-plane assets, including approvals, integrations, runtime evidence, and append-only provenance. These are architecture statements, not independently verified live database resources.
- scripts/verify-neural-integrity.mjs defines six source integrity subsystems: roots, trunk, brain, nerves, bark, senses. Passing these static checks would not establish runtime health.
- package.json exposes verify:neural, verify:all, verify:production:global, typecheck, unit and integration tests.
- wrangler.jsonc configures atlas-enterprise-suite-web and local/chat realtime Durable Object bindings.

## 3. Architectural decision

Use a modular event-and-contract fabric on top of existing components; do not create a second authorization system, evidence ledger, or message bus unless an audited gap proves necessary. ATLAS Manager retains release/deployment authority; Neural Fabric coordinates runtime capabilities only.

Alternative A (chosen): modular event mesh with versioned contracts and governed subscribers — better isolation and evolution, but requires delivery semantics and schema governance.
Alternative B: central service bus — simpler topology but greater bottleneck/failure concentration.
Alternative C: direct module calls — lower initial overhead but unmanageable coupling and authorization drift at scale.

## 4. Boundaries and interfaces

- Identity and tenancy: trusted authenticated principal, tenant_id, role/permission context and request correlation; never trust client-supplied tenant identity.
- Registry: module_id, version, owner, contract versions, scopes, feature flags, dependency graph, readiness state.
- Contract fabric: typed commands and events; schema_version, event_id, causation_id, correlation_id, actor_id, tenant_id, occurred_at, sensitivity, retention_class, payload_hash, provenance reference.
- Orchestrator: receives permitted intent, evaluates policies, plans actions and routes to registered adapters.
- AI gateway: providers are replaceable; model output is untrusted proposal, not an authorization grant.
- Decision Compass: reflections and symbolic readings are reflection-only with no evidenceRefs; cannot transition to verified without independent evidence.
- Evidence and audit: append-only records with source SHA, actor, timestamp, validation result, and supersession semantics.
- Observability: traces, metrics, structured logs with redaction and per-tenant access control.

## 5. Execution lifecycle

signal → trusted context → authenticate → authorize → contract validation → policy/risk classification → approval (when required) → idempotent execution → evidence capture → postcondition verification → audit.

Cross-tenant events must be rejected; unauthenticated actions fail closed. A module cannot grant itself elevated permissions. No external provider is considered connected merely because an adapter or environment variable name exists.

Delivery uses at-least-once semantics with idempotency keys, bounded retries, dead-letter handling and replay authorization. Do not claim exactly-once execution across providers. Sensitive actions require explicit human approval and compensating/rollback plans.

## 6. Migration and compatibility

Phase 0: inventory module registry, existing bus, persistence, identity/RLS, approvals, evidence, and route protection; map owners and gaps.
Phase 1: verify Supabase atlas-core migration lineage, recovery procedure, service-role boundary, tenant policies and storage policies; no blind repair of production migrations.
Phase 2: introduce contract definitions and conformance tests behind feature flags, reusing existing runtime.
Phase 3: pilot one low-risk internal event end-to-end in staging, test tenant isolation, idempotency, retries, evidence and audit.
Phase 4: connect modules incrementally by risk and dependency; require approval for financial, medical, carrier, or external actions.
Phase 5: validate CI, deploy via governed PR, confirm exact-SHA Cloudflare release and authenticated public endpoints.

The atlas-core-v2 project is not authoritative without audited reconciliation and explicit cutover.

## 7. Verification and readiness

Readiness levels: DESIGNED, IMPLEMENTED, TESTED, INTEGRATED, DEPLOYED, VERIFIED, BLOCKED. VERIFIED requires:
1. reviewed source and linked SHA;
2. repeatable tests and CI logs;
3. tenant isolation, RBAC/RLS and negative tests;
4. end-to-end integration evidence;
5. deployment artifact SHA and provider confirmation;
6. runtime checks at public edge, including authorization and postconditions;
7. traceable evidence ledger entry and reviewer decision.

P0 failures block promotion. P1 issues are recorded with owners and mitigation; never downgrade a P0 to an advisory for convenience. Independent tasks continue when a provider is blocked.

## 8. Non-goals

No automatic declaration that all modules are complete. No universal unrestricted autonomous agent. No rewriting the existing monorepo, no silent provider cutover, no secrets in source, no automatic production migrations, and no spiritual/symbolic signal treated as operational proof.

## 9. First implementation-plan slice (NOT YET AUTHORIZED)

A. Inventory actual modules, registries and event contracts.
B. Produce a gap matrix and conformance test plan.
C. Identify a pilot with the least privilege and reversible effects.
D. Only after written-spec review: create a detailed implementation plan with tasks, tests, rollout and rollback steps.

## 10. Open review decisions

- Confirm the initial pilot module after inventory rather than guessing.
- Confirm any retention/compliance requirements by data classification and jurisdiction before storing sensitive payloads.
- Identify required approvals for irreversible financial, health, telecom and external operations.

Review gate: This document is a design proposal. It does not authorize implementation, deployment, migration, or certification.
