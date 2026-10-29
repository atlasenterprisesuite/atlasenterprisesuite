# ATLAS ONE — Digital Genome 777 (birth contract v0.1)

Status: DESIGN / ISOLATED. Not deployed. No cross-tenant data exchange.

## Objective
Connect specialized ATLAS modules through a shared, versioned contract system rather than duplicate security, CI and E2E gates. DNA = immutable pattern specification; RNA = explicit adaptation plan; organ = module implementation. These are software metaphors, not biological or autonomous agency claims.

## Genome contract
Each pattern MUST declare:
- `pattern_id`, `version`, `owner`, `schema_version`, `integrity_digest`
- `capability`, `inputs`, `outputs`, `dependencies`, `compatible_modules`
- `tenant_scope`, `required_permissions`, `data_classification`, `consent_policy`
- `negative_tests`, `rollback_plan`, `evidence_refs`

## Propagation gate
1. Capture an observed improvement with immutable provenance.
2. Identify affected modules via dependency graph; no global broadcast of private data.
3. Generate an adaptation proposal, not a live change.
4. Reject missing tenant binding, permissions, consent, evidence or compatibility.
5. Deduplicate shared tests by exact contract version and input digest; run domain-specific negative tests per affected module.
6. Run isolated CI at exact SHA; require E2E only for risk-bearing changes and only in certified environments.
7. Record signed approval and evidence; deployment requires a separate explicit authorization.
8. On revocation, authorization is checked at the point of protected action; event delivery is supplemental and cannot be the sole access-control barrier.

## Non-negotiable isolation
- No shared mutable customer memory across organizations.
- No privileged service-role propagation through a general event bus.
- No implicit promotion of a learned pattern.
- Fail closed on ambiguous tenant selection and stale membership.
- Health, payroll and financial data have distinct policy profiles.
- Every execution emits audit events with correlation ID, actor, tenant, policy version and exact code SHA; never log secrets.

## Pilot: AW Finance PR #946
Read-only mapping of the Advisory authorization contract into the genome registry. Do NOT import or merge PR #946; keep its P0 NO-GO until isolated PostgreSQL revocation E2E and exact-SHA evidence. This branch establishes only the reusable architecture contract.

## Acceptance gates for implementation
G1 schema validation and negative tests; G2 dependency graph correctness; G3 authorization and revocation; G4 idempotency and replay; G5 audit integrity; G6 cross-tenant isolation; G7 exact-SHA CI; G8 isolated E2E; G9 explicit release approval.
