# ATLAS Payroll — Beyond ADP Sovereign Program Design

Date: 2026-10-04
Status: Approved-by-owner autonomous execution program
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Branch: `feat/payroll-beyond-adp-program`
Owner module: `Payroll`
Integrated modules: `People/HR`, `Time`, `Benefits`, `Accounting`, `Finance`, `Tax`, `ATLAS Pay`, `Analytics`, `Security`, `Audit`, `ATLAS Assistant`, `Automations`

## 1. Intent

Reach functional parity with mature payroll/HCM platforms such as ADP in the areas that matter for payroll operations, then exceed them by making payroll a first-party component of the ATLAS enterprise operating system instead of an isolated HCM product.

The target is not visual imitation. The target is a verifiable operating capability:

`Worker -> Time -> Earnings -> Tax Determination -> Payroll Approval -> Disbursement/Filing Adapter -> Accounting -> Cash/Analytics -> AI/Automation`

ATLAS must never represent a tax filing, remittance, bank connection, direct deposit, benefits enrollment, compliance state, or regulatory capability as completed unless authenticated evidence exists.

## 2. Existing Baseline

ATLAS already has a governed Payroll core with:

- tenant/organization-scoped payroll schedules, runs, and run lines;
- deterministic gross/net arithmetic for governed inputs;
- RBAC for payroll read/write/approve/self;
- RLS and server-side mutation functions;
- audit triggers;
- authenticated Payroll routes;
- worker/time integration;
- explicit fail-closed states for tax determination, filing, remittance, and direct deposit.

The present limitation is intentional: tax withholding is a governed input rather than an ATLAS calculation, and money movement/filing are not executed.

## 3. Competitive Envelope

ATLAS must close the mature-payroll capabilities below before claiming parity:

1. Versioned federal/state/local payroll tax determination.
2. Tax filing and remittance orchestration with authenticated provider evidence.
3. Direct deposit/paycard/check disbursement orchestration with authenticated provider evidence.
4. Garnishments and statutory deductions.
5. Year-end forms and reconciliation.
6. Employer liabilities and jurisdictional registrations/readiness.
7. Payroll variance detection and pre-submit audit.
8. Employee self-service payslip and tax-document access.
9. General-ledger posting and reconciliation.
10. Benefits deduction synchronization.
11. API/event integration for employees, time, PTO, and payroll inputs.
12. Multi-entity and, later, multi-country payroll governance.
13. Compliance evidence, rule provenance, effective dates, and reproducibility.
14. Enterprise-scale observability, idempotency, recovery, and audit.

ATLAS exceeds the traditional HCM boundary when the same governed transaction can flow natively into Accounting, Finance, Tax, Analytics, AI, Automations, CRM/Projects where authorized, and organization-wide audit without third-party synchronization as the primary path.

## 4. Architecture Decision

Use a **Sovereign Payroll Control Plane with regulated adapters**.

### 4.1 Native ATLAS responsibilities

ATLAS owns:

- payroll domain model and immutable snapshots;
- gross-to-net orchestration;
- tax rule registry and tax calculation contracts;
- rule provenance/effective dating;
- payroll readiness and exception engine;
- run approval/locking/reversal governance;
- employer/employee liability ledger;
- accounting posting contracts;
- payroll analytics and variance intelligence;
- audit, RBAC, tenancy, idempotency and evidence;
- provider-neutral filing/disbursement orchestration;
- employee/admin UX and API contracts.

### 4.2 Adapter responsibilities

External authorized providers may execute:

- tax filing/remittance;
- bank/ACH/direct-deposit settlement;
- paycards;
- benefits carrier transactions;
- jurisdiction-specific services where ATLAS is not yet authorized or certified.

Provider state must be normalized into ATLAS evidence states. The UI cannot derive `filed`, `paid`, `settled`, `accepted`, or `connected` from intent alone.

### 4.3 Future sovereign promotion

Any adapter capability may later be replaced by an ATLAS-owned regulated service without changing the domain contract. Promotion requires legal/operational authorization, certification where applicable, reconciliation controls, production evidence and rollback procedures.

## 5. Canonical Components

### 5.1 Payroll Rule Registry

Stores versioned rule packs by jurisdiction and effective period.

Required attributes:

- rule pack ID/version;
- country/state/local jurisdiction;
- authority/source URI;
- source publication/revision date;
- effective from/to;
- verified timestamp;
- checksum;
- status: `draft | verified | active | retired | blocked`;
- machine-readable parameters;
- human review evidence.

No rule pack may calculate production withholding unless status is `active` and the payroll pay date falls inside its effective window.

### 5.2 Tax Determination Engine

Pure/deterministic interface:

`TaxInputs + ActiveRulePack -> TaxDetermination`

Output captures taxable wage bases, employee taxes, employer taxes, jurisdiction, rule version, rounding, warnings, evidence checksum and reproducibility metadata.

The initial implementation may expose readiness and rule resolution before shipping production tax formulas. Unsupported jurisdictions fail closed instead of returning zero tax.

### 5.3 Payroll Readiness Engine

Before calculation/approval/process, evaluate:

- worker identity and active status;
- compensation;
- work/tax location;
- withholding elections where required;
- approved time/earnings;
- active rule coverage;
- deductions/garnishments;
- employer tax identity;
- funding/disbursement configuration;
- filing configuration;
- duplicate-run/idempotency risk;
- negative/abnormal net pay;
- material variance versus prior comparable runs.

Severity:

- `P0_BLOCKER`: processing prohibited;
- `P1_WARNING`: processing allowed only under policy;
- `INFO`: informational.

### 5.4 Execution Adapter Registry

Provider-neutral adapters advertise capabilities:

- `tax.calculate`
- `tax.file`
- `tax.remit`
- `payroll.disburse.ach`
- `payroll.disburse.paycard`
- `benefits.sync`
- `year_end.forms`

Each connection has tenant/org scope, provider identity, capability set, status, last verification, credentials reference (server-side only), environment and evidence metadata.

### 5.5 Evidence Ledger

Every external side effect records:

- intent ID/idempotency key;
- provider request reference;
- provider response reference;
- normalized state;
- amount and currency where applicable;
- submitted/accepted/settled/failed timestamps;
- immutable evidence payload hash;
- correlation ID;
- actor/service identity.

### 5.6 Payroll Intelligence

ATLAS Assistant/agents may:

- detect material payroll variances;
- explain gross-to-net changes;
- identify missing inputs;
- propose corrections;
- summarize liabilities/cash requirements;
- reconcile payroll to GL and funding evidence;
- forecast payroll cash needs.

AI is advisory unless an explicit approved automation policy grants action authority. High-risk actions remain governed by RBAC, approval and evidence gates.

## 6. Data Boundaries

New canonical tables should be additive to the existing payroll core:

- `payroll_rule_packs`
- `payroll_rule_pack_sources`
- `payroll_tax_determinations`
- `payroll_readiness_checks`
- `payroll_provider_connections`
- `payroll_execution_intents`
- `payroll_execution_evidence`
- `payroll_liabilities`
- `payroll_variance_findings`

All organization-varying records must be scoped by `org_id`; provider credentials are never stored as plaintext in these tables.

Historical payroll calculations reference immutable rule/version/evidence identifiers. Later rule changes cannot silently alter a prior payroll run.

## 7. State Machines

### Rule pack

`draft -> verified -> active -> retired`

Any integrity or provenance failure can move the pack to `blocked`.

### Execution intent

`draft -> ready -> submitted -> accepted -> settled`

Failure branches:

`blocked | rejected | failed | cancelled`

`settled` requires provider evidence. No client-side transition can manufacture it.

### Payroll run evolution

Retain the current run lifecycle during migration. Add a compatibility path toward:

`draft -> calculated -> awaiting_approval -> approved -> processing -> processed -> posted`

Exceptional states remain explicit and migration must preserve historical runs.

## 8. Security

- Server-side mutation only for payroll-sensitive writes.
- RLS on all new payroll tables.
- Existing ATLAS identity/organization permissions are authoritative.
- Separation of duties for preparation vs approval vs external execution.
- Step-up authentication can be required by policy for bank/tax/provider changes and high-value payroll execution.
- Secrets remain in approved secret stores/server-side runtimes.
- All privileged changes create audit records and correlation IDs.
- Provider webhooks require signature validation, replay protection and idempotency.

## 9. Accounting and Finance Advantage

A processed/settled payroll must produce reconciliable contracts for:

- wage expense;
- employer payroll tax expense;
- employee tax liabilities;
- employer tax liabilities;
- benefit/garnishment liabilities;
- payroll payable;
- cash/funding clearing.

The Accounting module remains authoritative for ledger posting. Finance consumes actual payroll obligations and settlement evidence for cash forecasting. This native flow is a primary ATLAS advantage over integration-first HCM architectures.

## 10. API and Event Model

Expose stable internal contracts/events rather than coupling modules to payroll tables directly.

Initial events:

- `payroll.run.created`
- `payroll.run.calculated`
- `payroll.run.approved`
- `payroll.run.blocked`
- `payroll.execution.submitted`
- `payroll.execution.accepted`
- `payroll.execution.settled`
- `payroll.execution.failed`
- `payroll.tax.rule.activated`
- `payroll.variance.detected`
- `payroll.journal.generated`
- `payroll.journal.posted`

Every event includes tenant/org/run/correlation identifiers and an evidence pointer when the event represents an external side effect.

## 11. Delivery Program

### Wave 1 — Control Plane Foundation

Deliver now:

1. Rule-pack registry schema and effective-date/provenance constraints.
2. Provider connection/capability registry.
3. Execution intent/evidence ledger.
4. Payroll readiness function that fails closed for unsupported tax/disbursement/filing capability.
5. UI/API readiness surface that replaces generic `Gated` text with evidence-driven capability states.
6. Integration tests proving tenant isolation, no fabricated provider state and evidence-only settlement.

Wave 1 does **not** claim automatic tax calculation, tax filing or money movement.

### Wave 2 — US Tax Determination

- federal withholding/FICA/FUTA rule packs sourced from authoritative publications;
- state/local framework;
- regression corpus and independent calculation verification;
- employee/employer liability calculation;
- withholding election snapshots;
- production activation only after rule verification gates pass.

### Wave 3 — Filing and Disbursement

- first authorized tax filing/remittance adapter;
- first authorized ACH/direct-deposit adapter;
- signed webhooks;
- idempotent execution;
- settlement/rejection reconciliation;
- failure recovery and reversal contracts.

### Wave 4 — Full HCM Payroll Parity

- garnishments;
- year-end W-2/1099 workflows;
- benefits synchronization;
- employee self-service statements;
- jurisdiction onboarding/readiness;
- advanced reports and payroll APIs.

### Wave 5 — Beyond ADP

- native payroll-to-ledger-to-cash reconciliation;
- AI variance resolution with evidence;
- cross-module automations;
- explainable cash forecast and labor-cost intelligence;
- multi-entity consolidated payroll command center;
- global adapter/rule-pack architecture;
- policy simulation/digital twin before payroll commit;
- continuous compliance drift detection.

## 12. Wave 1 Acceptance Criteria

Wave 1 is complete only when evidence proves:

1. New schema/migrations pass repository tests and deployment migration checks.
2. RLS prevents cross-organization reads/writes.
3. A provider connection cannot claim capability unless explicitly configured and verified.
4. An execution intent cannot reach `settled` without immutable provider evidence.
5. Payroll readiness returns a P0 blocker when required tax coverage, filing or disbursement capability is absent under a policy that requires it.
6. UI renders actual capability/readiness state from backend data; it does not substitute mocked success.
7. Existing Payroll core tests remain green.
8. CI is green on the PR.
9. Merge/deploy occurs through the canonical production workflow.
10. Production verification confirms the public app shell and authenticated payroll route remain healthy; regulated capabilities remain fail-closed unless real provider evidence exists.

## 13. Non-Claims

Until separately verified, ATLAS must not claim:

- certified tax filing coverage;
- remittance execution;
- direct-deposit settlement;
- a bank/provider connection;
- W-2/1099 filing;
- benefits carrier enrollment;
- global payroll compliance;
- regulatory certification.

The program is successful when those claims become evidence-backed capabilities one by one, not when labels are added to the UI.
