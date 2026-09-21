# ATLAS Tax Professional Workspace — Product & Architecture Specification

Status: Phase 1 implementation in branch `feat/tax-professional-workspace`.

## Product objective

ATLAS Tax is a professional tax-preparation operating system, not a static collection of tax forms. The core workflow is:

Client / engagement → interview → source documents → normalized tax facts → form/schedule graph → calculations / worksheets → diagnostics → professional review → client authorization → e-file readiness → acknowledgment / reject handling → billing / archive.

The system must preserve traceability in both directions:
- source document field → normalized tax fact → destination form/line;
- form/line → calculation / source values / evidence that produced it.

No monitored law change, imported document, AI suggestion, draft-year form mapping, or unverified jurisdiction rule can silently become a filing value.

## Professional workspace surfaces

1. Firm & preparer administration
   - preparer profile, permissions, PTIN/firm metadata, office assignment, reviewer hierarchy;
   - EFIN/provider state is provider-backed and verification-gated, never fabricated;
   - role separation for data entry, preparer, reviewer, signer, transmitter, billing.

2. Client CRM & engagements
   - taxpayer/entity profile;
   - spouse/dependent/owner relationships;
   - prior-year returns, carryforwards, notices and amendments;
   - engagement letter, scope, pricing, assigned preparer/reviewer.

3. Return work queue
   - returns grouped by year, form family, preparer, office and status;
   - statuses: organizer, waiting-on-client, preparation, review, signature, ready-to-file, transmitted, accepted, rejected, amended, archived;
   - SLA/deadline flags and extension status.

4. Interview / organizer
   - adaptive interview driven by return type and known documents;
   - questions activate forms/schedules and request evidence;
   - contradictions create diagnostics instead of overwriting data.

5. Document intake
   - W-2, 1099 family, K-1/K-2/K-3, 1098 family, 1095-A, SSA-1099, brokerage statements, prior returns and business books;
   - image/PDF extraction adapters may propose values but each extracted value keeps confidence, source coordinates and review state;
   - duplicate-document detection and corrected-form handling.

6. Tax fact ledger
   - normalized, versioned tax facts independent of any single printed form;
   - example: `wages.w2.taxable`, `withholding.federal.w2`, `interest.taxable`, `partnership.capital_gain.long_term`;
   - every fact records tax year, jurisdiction, source, taxpayer/entity, revision and provenance.

7. Forms & Schedules graph
   - effective-dated federal/state/local form registry;
   - automatic activation/deactivation based on facts and interview answers;
   - graph dependencies and circular-calculation protection;
   - draft-year revisions remain review-gated.

8. Calculation engine
   - deterministic rule packs by tax year/jurisdiction;
   - worksheets, phaseouts, limitations, carryforwards, rounding and tax computation;
   - separate calculation results from display-line formatting;
   - golden fixtures and boundary tests for every supported tax year.

9. Personal-return preparation
   - 1040 / 1040-SR / 1040-X;
   - Schedules 1, 2, 3, A, B, C, D, E, F, H, J, R, SE and applicable forms;
   - dependents, filing status, credits, health, retirement, investments, self-employment and foreign reporting.

10. Business-return preparation
   - 1065, 1120-S, 1120, 1041 and exempt-organization families;
   - owners, basis, capital accounts, allocations, depreciation, book-to-tax, balance sheet and K-1 generation;
   - payroll/information-return linkage without duplicating source values.

11. State & local localization
   - residency / part-year / nonresident logic;
   - state/local source rules, apportionment, withholding and credits for taxes paid;
   - each state/locality has a separate versioned rule pack;
   - no national generalization of subnational rules.

12. International
   - foreign tax credit, earned income, foreign assets/entities, K-2/K-3, treaty positions and cross-border reporting;
   - treaty and foreign-entity logic versioned by effective date.

13. Due diligence
   - Form 8867 triggers and evidence workflow where applicable;
   - interview notes, documents relied upon, additional questions and preparer conclusions;
   - due diligence cannot be satisfied by software auto-checking a box.

14. Diagnostics
   - missing data;
   - duplicated/conflicting source documents;
   - basis / at-risk / passive loss limits;
   - unsupported election;
   - tax-year revision mismatch;
   - state/local jurisdiction mismatch;
   - source amount does not reconcile to printed line;
   - missing required attachment or signature authorization.

15. Professional review
   - source-to-line trace;
   - current vs prior-year comparison;
   - effective tax rate / refund / balance variance;
   - override report;
   - open diagnostics;
   - reviewer sign-off with timestamp and identity.

16. Client review & signatures
   - client-facing final return presentation;
   - refund/balance and election summary;
   - required e-file signature authorizations;
   - version lock after client authorization; later edits invalidate signature state.

17. E-file adapters
   - provider adapter boundary for IRS/state systems;
   - schema validation, attachments, signature authorization, preparer/provider authorization and transmission package;
   - filing remains fail-closed when provider state, authorization or schema verification is missing;
   - acknowledgments, reject codes and resubmission workflow.

18. Extensions / amended returns / notices
   - extension calculation and payment workflow;
   - 1040-X and entity amendments derived from original accepted snapshot;
   - notice/correspondence case linked to original return and tax facts.

19. Billing / collections
   - engagement pricing;
   - invoices / deposits / balances;
   - payment handoff to ATLAS Pay when authorized;
   - no filing decision may depend on fabricated payment state.

20. Archive / retention / audit
   - immutable accepted-return snapshot;
   - signed authorization and supporting evidence;
   - submission/acknowledgment history;
   - audit event stream for every change, override, review and transmission.

21. Tax law monitor integration
   - official-source monitor produces proposed TaxChangeEvents;
   - changes never modify live calculators automatically;
   - reviewer approves new rule pack, effective dates, forms, validation and regression fixtures before release.

22. Firm analytics
   - workload by preparer/reviewer;
   - return status, rejects, aging and deadlines;
   - revenue and collection status;
   - diagnostic / error trends;
   - no fabricated production metrics.

## Step-by-step return workflow

The canonical professional workflow is defined in `packages/tax-forms/src/professionalWorkflow.ts`.

For a Form 1040 return it moves through:
1. Engagement & preparer setup
2. Taxpayer identity
3. Household / dependents / filing status
4. Income documents
5. Business / rental / pass-through activity
6. Adjustments
7. Deductions
8. Credits & due diligence
9. International
10. Payments / withholding / estimates
11. State & local
12. Diagnostics
13. Professional review
14. Client review / consent
15. E-file readiness / transmission gate
16. Acknowledgment / billing / archive

Entity returns use the same control plane with individual-only steps removed and entity-specific books, owners and allocation work attached.

## Internal linking contract

Each captured value must support:
- `source_document_type`
- `source_document_id`
- `source_field`
- `tax_fact_key`
- `taxpayer_or_entity_id`
- `tax_year`
- `jurisdiction`
- `amount/value`
- `mapping_treatment`: direct / derived / informational / jurisdiction / review
- `destination_form`
- `destination_line_or_field`
- `rule_pack_version`
- `evidence_reference`
- `review_state`
- `override_state`
- `audit_actor/time`

A form line may aggregate many tax facts, and one source field may affect multiple calculations. The graph must therefore be many-to-many rather than hard-coded one-field/one-line copying.

## Filing boundary

ATLAS may prepare, calculate, validate and package a return. Actual transmission is a separate privileged action. It requires:
- authenticated authorized user;
- verified provider/EFIN or appropriate filing-provider context;
- current approved tax-year schema;
- zero blocking diagnostics;
- completed professional review;
- taxpayer/client authorization/signature where required;
- audit event recording the exact return snapshot being transmitted.

## Phase roadmap

Phase 1 — implemented foundation:
- Tax navigation;
- Forms & Schedules catalog;
- W-2 / 1099 / partnership K-1 mapping;
- professional 16-step workspace;
- filing/readiness gates.

Phase 2:
- persistent client/return schema;
- organizer/interview engine;
- tax fact ledger;
- 1098 / 1095-A / SSA-1099 / brokerage intake;
- return work queue and diagnostics persistence.

Phase 3:
- 1040 calculation and worksheets;
- carryforwards / prior-year import;
- Schedule A/C/D/E/F depth;
- credits/due-diligence workflows.

Phase 4:
- 1065 / 1120-S / 1120 / 1041 engines;
- basis/capital/depreciation/accounting integrations;
- K-1 generation.

Phase 5:
- state/local packs;
- international packs;
- extension / amendment / notice workflows.

Phase 6:
- certified/provider-backed e-file adapters;
- acknowledgments/reject handling;
- client signatures/portal;
- production verification and filing certification boundaries.

## Non-negotiable controls

- official/versioned tax sources;
- tenant isolation;
- encryption and least-privilege access;
- no raw taxpayer identifiers in ordinary logs;
- source-to-line provenance;
- immutable filed snapshots;
- explicit overrides;
- human review for ambiguous tax treatment;
- fail-closed e-file;
- no claim that a jurisdiction/form is supported for filing until that adapter/version is verified.
