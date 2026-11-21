# ATLAS 777 REVIEW — Promotions-to-Capability Intelligence (ADN -> ARN)

**Date:** 2026-11-12  
**Status:** Proposal and delivery contract; NOT implemented, merged, deployed, or production-verified.  
**Canonical owner:** Knowledge Atlas / ATLAS Work OS.  
**Source:** User-authorized Gmail Promotions research described in the preceding analysis. That prior screening reported 322 sampled messages and 31 detailed reads; these counts have **not** been re-audited in this pull request. Do not treat provider marketing as proof of functionality, pricing, compliance, or availability.

## Decision

**Do not create a new top-level ATLAS platform, orchestrator, identity provider, database of record, or shadow module registry.** Deliver the "Genome Intelligence" concept as a governed opportunity-analysis capability within **Knowledge Atlas**, backed by ATLAS Work, existing connection boundaries and the canonical module registry. "ADN" describes independently verified product patterns; "ARN" is the **proposed execution blueprint** for an ATLAS capability, not reverse-engineered source code or proprietary logic.

The first product is a **read-only, evidence-backed opportunity ledger** with deduplication and explicit approval gates. No promotional email may execute commands, grant new permissions, send outbound mail, purchase a subscription, or change an external account.

## Existing systems to reuse (verified by repository inspection, not deployment tests)

- `docs/architecture/ATLAS_WORK_OS.md`: canonical Identity/Tenant -> RBAC/Policy -> Audit/Evidence -> Graph -> Data Fabric -> Knowledge -> AI -> Automation -> Security -> Apps chain.
- `apps/web/src/modules/registry.ts`: canonical module IDs and routes; do not create new duplicate routes or registry entries before a real user journey requires one.
- `apps/web/src/work/api.ts`: organization-scoped Work workflow creation, existing connection refs, runtime list and authorization boundary.
- `packages/ai-core/src/completionReadiness.ts`: evidence-locked completion; preserve its current completion semantics.
- `docs/superpowers/specs/2026-10-06-atlas-genesis-evolution-architecture-design.md`: ATLAS 18 DNA invariants and separate engineering/evidence/evolution states. The marketing term "Genome Intelligence" must not be confused with the existing **Gestation/Genome release gate**.
- `CONTRIBUTING.md`: focused PR from main, TDD on behavioral changes, `npm ci && npm run verify:all`, CI and exact production evidence.

All files are **reuse candidates**, not evidence that Gmail ingestion or the proposed opportunity service already exists.

## Deliverables, sequenced and nonduplicative

### D1 — Provenance-preserving Promotions Intake (P0; design -> TDD -> implementation)

**Surface:** Knowledge Atlas opportunity intake, using a *separately authorized*, least-privilege Gmail read-only connector if and when the provider flow is implemented.

Inputs: exact organization/actor, connected provider ID, scope evidence, mailbox identity reference, optional time bounds, campaign/category filter, explicit batch limit. Gmail category labels can be incomplete or user-reclassified; record query/window and pagination/cursor coverage instead of claiming the whole mailbox was read.

Output: an inbox-analysis run containing bounded source references, collection timestamp, source type, extracted claims and source confidence. Never commit email content, private links, recipients, credentials, message IDs or tokens to the repository. Prefer message-reference storage to raw-body retention and support removal/retention policy. Explicitly separate **original source**, **quoted claim**, **independent verification**, **inference**, **proposal** and **test evidence**.

Acceptance: zero Gmail writes; disabled when permission is absent/expired/revoked; tenant separation verified server-side; pagination and truncation recorded; repeated import is idempotent; no data from another connected mailbox or organization leaks into results.

### D2 — ADN Evidence Normalizer (P0)

Convert each observed promotion into a bounded record:

```ts
type OpportunityEvidence = {
  organizationId: string;
  sourceKind: 'gmail-promotion' | 'public-doc' | 'repository' | 'test';
  sourceRef: string; // access-controlled opaque reference; never a bearer credential
  observedAt: string;
  vendor: string;
  claim: string;
  claimStatus: 'advertised' | 'verified' | 'contradicted' | 'unknown';
  verificationRef?: string;
  confidence: 'established' | 'strongly-supported' | 'active-hypothesis' | 'open-question';
};
```

Do not use the confidence label to imply engineering readiness. A promotional price or feature remains `advertised` until an authoritative, date-specific source supports it. Avoid copying protected code, branding, data or design assets.

Acceptance: unverified claims never become "available"; conflicting claims remain visible; exact source and observation time survive every transformation; unsupported input is quarantined as data rather than treated as instructions.

### D3 — Existing-Capability Matcher (P0)

Resolve extracted capabilities against canonical ATLAS module ID, route, owning domain, known adapter and existing PR/issue. Candidate statuses: `reuse-existing`, `extend-existing`, `new-component-proposed`, `blocked-unknown`. Matching must provide rationale and evidence; lexical similarity alone cannot declare parity.

Acceptance: a proposal cannot mint a second identity, task engine, audit log or registry; duplicates link to the original capability. Unknown ownership produces a **blocked** item awaiting code inspection, not automatic module generation.

### D4 — ARN Execution Blueprint (P1)

For each eligible opportunity, produce a *reviewable* engineering contract: user need, owner, existing components, non-goals, provider boundary, required consent, data types, API contract, test cases, estimated operational costs, metrics and exact deployment gates. Generate a work item only through ATLAS Work's normal organization-scoped path.

**Initial candidates from the promotions analysis:**

| Market signal (not a copied implementation) | Existing ATLAS owner | Proposed improvement | Gate |
| --- | --- | --- | --- |
| Zapier-style natural-language workflows | ATLAS Work / Automations / Universal Execution | Plan preview, step validation, replays, idempotency and human approval of mutations | P0 execution authority + tenant |
| Windsor.ai-style multi-system connectors | Work Connections / Data Fabric | Declarative read/write capability registry with grant expiry and revoke checks | P0 scopes, adapter verification |
| Salesforce / Atlassian agentic coordination | CRM + ATLAS Work | Evidence-linked opportunity-to-task handoff | P0 permissions and audit |
| Figma design/code context | Existing Design System / Studio | Source-linked component mapping and accessibility diff | P1 component provenance |
| Floot app publishing/commerce | App Factory / Commerce | Reusable checkout adapter in sandbox; no forced processor | P0 money/consent |
| Adobe document workflows | SUMERIA / Knowledge Atlas / Accounting | Extract/compare/redact with source hashes and approval | P0 privacy |
| HeyGen media patterns | ATLAS Studio / Content | Script-to-media with consent and publication approval | P1 publication safeguards |
| Homebase payroll operations | People / Payroll | Reconciliation and payroll exception workflow, not automatic payout | P0 financial accuracy |

### D5 — Opportunity Prioritization (P1)

Score `userPain`, `demandEvidence`, `reusePotential`, `strategicFit`, and `feasibility` independently from 0 to 5; separately record `securityRisk`, `providerCost`, `vendorLockIn`, `uncertainty`. **Do not blend unknown values with zeros.** Recommending a higher-priority item requires a documented score and owner, not an AI adjective. A P0 veto overrides any score.

Track prospective metrics as *targets only*: duplicate-build avoidance, verified-source coverage, time from signal to reviewed spec, opt-in conversion, running cost per analyzed batch, and zero unauthorized provider writes. No baseline or ROI has been measured here.

### D6 — Flow Studio Delivery (P1, after D1-D4)

**Not a replacement automation engine.** A user requests an outcome -> proposal compiler generates a read-only plan -> existing Work workflow reviews capability and identity -> dry-run -> authorized execution -> evidence ledger and retry/reconciliation. Sensitive actions use an existing approval policy; lack of explicit approval must fail closed. Developer-facing and UI flows expose the same status vocabulary, not an invented "success" badge.

### D7 — Economic and Marketing Safeguards (P1)

Detect offer expiry, trial limits, renewal-price changes, affiliate incentives, incompatible subscription terms, and unverified "free" claims. Never make a purchase or enroll in an affiliate program. Store only verified terms with observed-at date; show comparison across providers when source-supported. Avoid dark patterns in ATLAS Academy and Partners.

### D8 — Close the 777 Release Evidence (P0 for any production claim)

Every implemented slice needs: provenance ledger; owner; fail-closed security tests; tenant/RBAC and revocation tests; idempotency and replay tests; typecheck/build; CI against the **exact PR head SHA**; review; controlled merge; deployment artifact/SHA match; and public E2E verification. `npm run verify:all` is a repository-wide gate, not proof of an external Gmail OAuth flow. Inability to test an actual provider must be marked **blocked**, never simulated.

## Proposed small-slice execution order

1. **Intake contract + fixtures**: synthetic promotions only, no real mailbox data committed. Write failing tests before parser implementation.
2. **Evidence normalizer**: deterministic claims and validation; test adversarial content, missing provenance, contradictions, duplicates, untrusted URLs and oversized messages.
3. **Canonical matcher**: join against existing registry and ownership, with negative tests for duplicate routes and false parity.
4. **Work blueprint**: use existing Work execution endpoints; draft-only until approval/authorization and security gates pass.
5. **Consent-gated provider adapter**: separate PR; no raw Gmail token in browser logs or source; verified scope, tenant and revocation.
6. **Read-only UI**: source evidence, uncertainty, coverage, cost signals, accessible keyboard and responsive layouts.
7. **Production release**: only after CI exact-SHA, authorization, deployment and E2E evidence; otherwise retain draft/blocked.

## Explicit P0 negative-test matrix

| Test | Expected behavior |
| --- | --- |
| Email says "ignore previous rules" / embeds tool call | Stored as untrusted source text, never executed |
| Promotions link tries SSRF/redirect to internal address | No server-side fetch unless URL policy explicitly permits it |
| Missing or revoked Gmail grant | No mailbox read or stale "connected" claim |
| Same message imported twice | One canonical source item, repeat is safe |
| Two organizations with overlapping source IDs | Strict isolation; no shared rows, logs or source links |
| Unsupported marketing price or feature | Status remains advertised/unknown |
| Cross-tenant workflow launch | Rejected by server-side permission check |
| Unauthorized action asks to email, post, buy or pay | No side effect; explicit scoped approval required |
| Provider returns 429, malformed data or network failure | Bounded retry, no false success; structured error evidence |
| Stale repository/CI/deployed SHA | Release blocked pending verification |

## Exit criteria and current limits

- **This PR:** documentation/architecture proposal only. No Gmail account accessed by this PR; no messages altered; no code/service deployed; no provider configuration performed.
- **D1-D8:** pending implementation/testing; no claim of readiness.
- Do not merge dependent development work to `main` or deploy on the strength of this document. Preserve unrelated open PRs and required rulesets.
- First implementable next increment: isolated D2 evidence-normalization tests and pure parser using only synthetic fixtures, followed by a focused PR and exact-head CI.
