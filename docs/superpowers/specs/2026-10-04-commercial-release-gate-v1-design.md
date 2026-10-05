# ATLAS Enterprise Suite — Commercial Release Gate v1

Date: 2026-10-04
Status: Design specification for review
Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`
Target branch: `docs/commercial-release-gate-v1`
Production origin: `https://www.atlasenterprisesuite.com`

## 1. Purpose

ATLAS has reached the point where technical capability alone is no longer a sufficient release criterion. The next product milestone is a governed commercial release that can be marketed, demonstrated, contracted, invoiced, provisioned, supported, renewed, and audited without overstating readiness.

Commercial Release Gate v1 adds one authoritative answer to the question:

> Is this ATLAS release sellable, to whom, under which product scope, and with what evidence?

The gate extends existing ATLAS fail-closed production verification. It does not create a second deployment system, a second product catalog, or a parallel source of truth.

## 2. Success criteria

A release is `SELLABLE` only when all P0 commercial gates pass for the exact production commit SHA and the exact commercial offer being evaluated.

Success requires all of the following:

1. production technical verification passes fail-closed;
2. the public commercial surface is reachable and truthful;
3. the modules included in the offer have explicit commercial states and evidence;
4. identity, tenant isolation, RBAC, audit, and required security controls are proven for the offered surface;
5. a customer can enter a real sales process through a working lead/demo path;
6. ATLAS has a contractable offer with pricing semantics, order terms, and billing/provisioning boundaries;
7. unsupported, regulated, experimental, or provider-dependent capabilities are excluded or labeled with a non-sellable state;
8. the release stores an evidence snapshot that can be audited later.

A passing software build or deployment alone MUST NOT produce `SELLABLE`.

## 3. Non-goals

Commercial Release Gate v1 does not require:

- every ATLAS module or vertical to be production-ready;
- self-service checkout before the first commercial customers;
- autonomous contract execution;
- real-money movement through ATLAS Pay;
- telecom/carrier, banking, insurance, clinical-health, tax-filing, or other regulated rails to be sellable before their own regulatory/provider gates pass;
- replacement of external payment, CRM, communications, cloud, or AI providers;
- migration of all authenticated product routes to a new hostname in this first slice.

The first commercial motion is sales-led. Self-service subscription checkout is a later release slice.

## 4. Commercial state model

Every customer-visible capability in a commercial offer MUST resolve to exactly one state.

### `SELLABLE`

The capability may be included in a signed customer order. Technical, security, support, and commercial evidence required by its policy are current.

### `PREVIEW`

The capability may be demonstrated to qualified prospects but MUST be excluded from contractual production commitments unless a specific negotiated pilot agreement says otherwise.

### `EXTERNAL_GATED`

The capability depends on provider credentials, carrier/network access, licensing, hardware, regulatory approval, human validation, or other evidence outside the normal software build. It MUST NOT be represented as live unless its external gate is verified.

### `INTERNAL_ONLY`

The capability is available to ATLAS operators or engineering but is not part of a customer offer.

### `NOT_FOR_SALE`

The capability is intentionally excluded from the current commercial catalog.

No default-to-sell behavior is permitted. Missing state or missing evidence resolves to `NOT_SELLABLE` at gate evaluation time.

## 5. Initial commercial-v1 candidate scope

The first commercial candidate is the enterprise business core, not the full ATLAS ecosystem.

Candidate modules:

- ATLAS Enterprise Core / tenant governance;
- Finance;
- Accounting;
- Accounts Payable;
- Accounts Receivable;
- CRM;
- Revenue / Sales operations;
- Inventory / Procure-to-Pay;
- HR / People foundation;
- Payroll foundation, only to the verified compliance depth available at release time;
- Analytics / reporting surfaces that pass their production gates;
- Work / governed execution surfaces needed to operate the suite.

The gate determines the final state of each candidate at release time. Inclusion in this list does not grant `SELLABLE` status.

The following families are explicitly non-blocking for Commercial v1 and remain separately gated unless evidence later promotes them:

- ATLAS Pay / regulated financial rails;
- carrier/MVNO/telephony ownership claims;
- clinical Health capabilities;
- tax filing/remittance claims;
- insurance rails;
- hardware-dependent Device DNA capabilities;
- experimental research, frontier, spatial, creator, mobility, or other vertical features not included in the signed order.

## 6. Architecture

Commercial Release Gate v1 extends the existing production truth chain:

`main commit -> CI -> deploy -> global production verification -> commercial release evaluation -> evidence snapshot -> SELLABLE | BLOCKED`

The gate has five authorities.

### 6.1 Product Catalog Authority

Owns the commercial status of modules/capabilities for a named release offer.

Required fields for each catalog entry:

- stable capability id;
- display name;
- commercial state;
- offer/tier membership;
- dependency list;
- evidence policy id;
- required production routes when applicable;
- provider/regulatory gate metadata when applicable;
- support class;
- effective version/date.

Catalog state is declarative. Browser state cannot promote a capability.

### 6.2 Commercial Surface Authority

Defines the public customer-facing routes required before ATLAS may be represented as commercially available.

P0 public routes for v1:

- `/`
- `/suite`
- `/pricing`
- `/request-demo`
- `/contact`
- `/terms`
- `/privacy`
- `/security`
- `/status`

Each route MUST:

- resolve successfully from the public internet without an ATLAS employee session;
- use HTTPS;
- present a production-safe page, not a placeholder;
- avoid unsupported claims;
- carry required security headers according to the global verifier policy;
- remain traceable to the exact release SHA where release identity is applicable.

`/terms` and `/privacy` content MUST have an explicit owner and effective date. The release gate verifies publication, versioning, and acceptance semantics where acceptance is required; it does not substitute for legal counsel.

### 6.3 Enterprise Readiness Authority

Validates the minimum enterprise trust boundary for modules marked `SELLABLE`.

P0 requirements:

- authenticated customer workspace exists;
- organization/tenant scoping is enforced;
- RBAC is server-authoritative;
- privileged mutations cannot be manufactured by client state;
- audit/evidence records exist for privileged operations;
- production health is green;
- HSTS and CSP requirements pass;
- secrets are server-side;
- provider readiness remains fail-closed;
- known P0 security findings are zero or are explicitly classified as release blockers;
- backup/restore policy exists and the release policy requires current evidence for the selected commercial tier;
- production deployment identity matches the evaluated release evidence.

MFA/passkey requirements are policy-driven by privilege class. Privileged administrative roles MUST meet the release's elevated-authentication policy before commercial release.

### 6.4 Revenue Readiness Authority

Commercial v1 uses a sales-led contract path:

`Lead -> Qualification -> Demo -> Proposal -> Negotiation -> Order/Contract -> Invoice/Payment -> Provisioning -> Onboarding -> Customer Success -> Renewal`

P0 requirements:

- a public lead/demo entrypoint works;
- lead records have an authoritative destination/workflow;
- at least one commercial plan/offer exists with machine-readable pricing semantics;
- billing frequency and currency are explicit;
- implementation/onboarding charges are separable from recurring subscription charges;
- discount authority is bounded by policy;
- order-form fields are defined;
- provisioning is not allowed before required commercial authorization/evidence;
- invoice/payment state is evidence-driven and cannot be asserted by the browser;
- refund/credit/cancellation semantics are defined before general availability.

A full self-service checkout is not a P0 requirement for v1.

### 6.5 Evidence Authority

The gate MUST emit an immutable or append-only release-evidence snapshot containing at minimum:

- evaluated commit SHA;
- production artifact/deployment identity;
- timestamp;
- gate version;
- commercial offer id/version;
- module state results;
- public-route results;
- enterprise-readiness results;
- revenue-readiness results;
- external-gate results;
- blockers/warnings;
- final decision;
- evidence digests/links rather than embedded secrets.

Evidence MUST be sufficient to explain why a release was considered sellable at a later date.

## 7. Release decision algorithm

Commercial Release Gate v1 is deterministic.

Pseudo-policy:

1. resolve the candidate offer and exact commit SHA;
2. require global production verification success for that SHA;
3. load the commercial catalog for the offer;
4. validate all P0 commercial public routes;
5. validate enterprise-readiness policy;
6. validate revenue-readiness policy;
7. evaluate each included capability against its evidence policy;
8. downgrade capabilities with missing evidence to non-sellable states;
9. fail the whole offer if a required capability is not sellable;
10. allow optional capabilities to remain `PREVIEW`, `EXTERNAL_GATED`, `INTERNAL_ONLY`, or `NOT_FOR_SALE` only when the offer does not contractually depend on them;
11. persist the complete result;
12. return `SELLABLE` only when every P0 condition is true.

Warnings MUST NOT override a failed P0 condition.

## 8. P0 and P1 classification

### P0 — release blocking

- production health unavailable/unhealthy;
- exact-SHA production identity not proven where required;
- required public commercial route missing or non-public;
- Terms/Privacy/Security surfaces absent for a general commercial release;
- tenant isolation/RBAC critical failure;
- known critical security failure;
- required customer module lacks required evidence;
- commercial offer has no authoritative price/order semantics;
- provisioning can occur without governed commercial authorization;
- browser/client can manufacture paid, subscribed, verified, settled, filed, connected, or equivalent authoritative state;
- regulated/provider-dependent capability is marketed as live without required evidence.

### P1 — warning / launch-readiness debt

- optional preview capability unavailable;
- non-critical documentation gaps;
- secondary marketing content unavailable;
- optional analytics/reporting degradation;
- non-blocking provider integration unavailable when it is not part of the signed offer;
- future self-service checkout not yet implemented.

P1 findings are recorded but do not convert a P0 failure to success.

## 9. Pricing and packaging contract

Commercial Release Gate v1 MUST support at least three offer shapes without hard-coding vendor-specific billing infrastructure:

- `ATLAS Business` — packaged small/mid-market offer;
- `ATLAS Enterprise` — advanced governance, multi-entity, integrations, and enterprise controls;
- `ATLAS Custom` — negotiated modules, implementation, integrations, and contractual terms.

The catalog stores pricing semantics rather than payment-provider implementation details.

Required pricing attributes:

- billing unit;
- billing period;
- base price or `negotiated` marker;
- included users/usage where applicable;
- overage policy where applicable;
- implementation fee semantics;
- minimum term where applicable;
- supported currency;
- discount policy id;
- tax-treatment responsibility marker;
- effective date/version.

No pricing page or sales UI may invent values not present in the authoritative catalog.

## 10. Negotiation guardrails

The commercial model MUST support machine-readable negotiation constraints so discounts and commitments do not silently exceed policy.

At minimum:

- list price/reference price;
- maximum salesperson discount without escalation;
- annual/multiyear discount policy;
- minimum annual contract value where applicable;
- implementation fee waiver policy;
- payment-term options;
- renewal/auto-renew semantics;
- SLA tier;
- support tier;
- liability/indemnity terms remain contract/legal authority and are never auto-invented by product code;
- ATLAS core IP ownership is never transferred by a normal customer order;
- custom-development ownership must be explicit in the governing agreement.

The gate verifies that a valid policy exists; it does not negotiate autonomously on behalf of the company.

## 11. Customer lifecycle contract

A commercially valid customer lifecycle is:

`lead -> qualified -> demo/pilot -> proposal -> negotiated -> contracted -> billing_authorized -> provisioned -> onboarding -> active -> renewal_due -> renewed | terminated`

State transitions that imply contractual or financial authority MUST be server-authoritative and evidence-backed.

A CRM opportunity marked `closed-won` is not, by itself, permission to provision production access unless the configured commercial authorization policy is satisfied.

## 12. Public site and protected workspace boundary

The long-term canonical topology is:

- `www.atlasenterprisesuite.com` — anonymous marketing, product, pricing, legal, request-demo/contact, security/trust, and status surfaces;
- authenticated workspace — protected ATLAS application surface under the canonical authenticated domain/routing model.

Commercial Release Gate v1 does not require a disruptive hostname migration of existing product routes. It DOES require that the anonymous commercial routes above are actually public and that protected customer data/workspace routes remain governed.

A later migration may move authenticated workspace routes to `app.atlasenterprisesuite.com` without changing the commercial evidence contract.

## 13. Security and privacy requirements

Commercial release MUST preserve ATLAS Zero Trust and fail-closed rules.

Required principles:

- least privilege;
- explicit tenant scope;
- RLS/RBAC where appropriate;
- no secrets in frontend/repository/evidence snapshots;
- provider credentials server-side only;
- no false-live provider status;
- no storage of unnecessary customer data;
- audit trail for privileged commercial/provisioning mutations;
- terms/privacy versions are identifiable;
- user/customer acceptance evidence is retained where contract flow requires acceptance;
- production security headers remain part of P0 verification.

## 14. Failure behavior

Commercial Release Gate v1 fails closed.

Examples:

- pricing catalog missing -> `BLOCKED`;
- `/privacy` returns placeholder or error -> `BLOCKED`;
- optional Telnyx preview unavailable but telephony is excluded from the order -> warning/non-sellable telephony state, not whole-suite failure;
- required CRM route or tenant policy fails -> `BLOCKED` for an offer that includes CRM;
- deployment succeeds but commercial evidence is stale or for another SHA -> `BLOCKED`;
- payment provider is unavailable before an invoiced enterprise order where manual/approved invoicing is allowed -> evaluate against the configured sales-led billing policy rather than requiring self-service checkout;
- capability has no explicit commercial state -> treat as not sellable.

## 15. Testing strategy

Implementation MUST use TDD and add tests before production logic.

Required test classes:

1. catalog schema/state tests;
2. deterministic release-decision unit tests;
3. false-positive tests proving missing evidence cannot produce `SELLABLE`;
4. public-route contract tests for pricing/demo/contact/terms/privacy/security/status;
5. integration tests with existing global production verification;
6. exact-SHA evidence tests;
7. tenant/RBAC/security blocker tests;
8. regulated/external-gate downgrade tests;
9. pricing source-of-truth tests preventing client-side invented prices;
10. lifecycle/provisioning authorization tests;
11. immutable/append-only evidence persistence tests;
12. production E2E commercial smoke verification.

The RED phase MUST prove that current main does not yet satisfy the new commercial contract before implementation turns the suite GREEN.

## 16. Production verification

The implementation SHOULD extend the existing global production verification architecture rather than replace it.

A commercial release run MUST verify at minimum:

- `https://www.atlasenterprisesuite.com/`;
- `/api/v1/health` with `status: "healthy"`;
- HSTS;
- CSP;
- all P0 commercial public routes;
- required commercial module routes for the selected offer;
- exact production release identity/evidence;
- final commercial gate result.

The default mode is `fail-closed`.

No release may be labeled commercially verified solely because Vercel, Cloudflare, Supabase, GitHub, or another provider reports a successful deployment.

## 17. Observability

Commercial readiness becomes an observable first-class state.

Minimum metrics/events:

- last commercial gate result;
- last successful commercial verification timestamp;
- evaluated SHA;
- offer/version;
- number of P0 blockers;
- number of P1 warnings;
- module-state distribution;
- public-route availability;
- lead/demo submission health;
- provisioning authorization failures;
- evidence freshness.

No customer PII or secrets belong in readiness telemetry.

## 18. Rollout

### Phase 1 — Gate foundation

- canonical catalog/evidence schemas;
- decision engine;
- integration with existing global verifier;
- CI RED/GREEN contract.

### Phase 2 — Public commercial surface

- pricing;
- request-demo/contact;
- terms;
- privacy;
- security/trust;
- production verification for all routes.

### Phase 3 — Sales-led revenue lifecycle

- authoritative offer catalog;
- lead routing;
- proposal/order semantics;
- commercial authorization;
- billing/invoice boundary;
- provisioning/onboarding state machine.

### Phase 4 — First customer readiness

- demo tenant/playbook;
- customer onboarding checklist;
- support/SLA policy;
- renewal lifecycle;
- first controlled production customer verification.

### Phase 5 — Self-service expansion

Only after the sales-led lifecycle is proven:

- signup/checkout;
- subscription automation;
- automatic tenant provisioning;
- dunning;
- self-service plan changes/cancellation subject to policy.

## 19. Acceptance criteria for this subsystem

Commercial Release Gate v1 is complete only when all of the following are evidenced:

- design and implementation live in canonical `main`;
- TDD RED evidence exists before implementation;
- CI passes;
- deployment succeeds;
- global production verification succeeds;
- all P0 commercial public routes are live;
- an authoritative commercial catalog exists;
- at least one offer evaluates deterministically;
- missing evidence demonstrably fails closed;
- non-core verticals do not block the enterprise-core offer when excluded;
- the evidence snapshot identifies the exact evaluated release;
- production E2E reports `SELLABLE` for a defined offer, or truthfully reports `BLOCKED` with explicit blockers.

Until the final E2E result is `SELLABLE`, ATLAS may continue demos/pilots under explicitly limited terms but MUST NOT claim general commercial readiness for the evaluated offer.

## 20. Implementation boundary

This spec authorizes planning for one subsystem only: Commercial Release Gate v1 and the minimum commercial surfaces/contracts required to evaluate it.

It does not authorize unrelated ATLAS module expansion, regulated-provider activation, automatic financial transactions, telecom carrier claims, or broad refactoring.

The implementation plan must preserve the existing canonical GitHub -> CI -> production -> fail-closed verification chain and reuse existing ATLAS catalog, tenancy, RBAC, audit, CRM, finance, billing, and deployment primitives wherever valid rather than creating duplicates.
