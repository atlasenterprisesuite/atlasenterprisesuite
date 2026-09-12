# ATLAS Payroll Core + Commercialization Design

Date: 2026-09-12
Status: Approved architecture, awaiting written-spec review before implementation
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Branch: `feat/atlas-payroll-core-commercial`
Owner module: `Payroll`
Secondary integrations: `HR`, `Time Tracking`, `Benefits`, `Accounting`, `ATLAS Pay`, `Settings`, `Security`, `Audit`, `ATLAS Assistant`

## 1. Objective

Build ATLAS Payroll as a first-party payroll operating module inside ATLAS Enterprise Suite using the approved product references as functional inspiration, without copying Gusto branding, text, assets, or trade dress.

The commercial model is intentionally asymmetric:

- The ATLAS internal/owner organization may use the software with a `0` ATLAS software fee.
- External customer organizations are billable.
- No customer price is hard-coded in this design because pricing has not yet been approved.
- External provider fees, taxes, insurance premiums, banking fees, filing fees, card/ACH fees, or regulated-service charges are separate pass-through or provider costs and must never be represented as free unless they are actually free.

This design must preserve the canonical ATLAS architecture, shared tenancy, RBAC, audit, authentication, and data boundaries already established by ATLAS Core.

## 2. Product Principles

- One canonical Payroll module, not parallel payroll applications.
- ATLAS identity only; no Gusto logo, wording, illustrations, or proprietary visual treatment.
- Internal use may be billing-exempt, but customer tenants must be commercially billable.
- Pricing and entitlements must be data-driven rather than embedded in UI constants.
- No fabricated payroll data, tax balances, bank connectivity, direct-deposit state, insurance status, or compliance state.
- Every visible action must map to a real route or backend operation.
- Every payroll-sensitive write must be authorized and audited.
- Every payroll record must be scoped to tenant and organization.
- Gross-to-net calculations must be deterministic and testable.
- Tax rules must be versioned by effective date.
- Regulatory content must be sourced from authoritative references and must not silently become stale.
- External integrations are adapters behind explicit connection states; unavailable providers show configuration or disconnected states.
- Production claims require evidence from tests, build, route verification, persistence, authorization, and deployment health.

## 3. User Experience Derived from the References

The supplied references reveal five primary product surfaces that ATLAS should implement as native workflows:

1. Payroll onboarding and package configuration.
2. Add-ons / capability selection.
3. Administrative-role permissions.
4. Employer setup and tax identity.
5. Contextual help and FAQ inside the workflow.

The ATLAS implementation will keep the useful workflow depth while changing the commercial framing and visual language.

## 4. Canonical Routes

Initial route tree:

```text
/payroll
/payroll/setup
/payroll/setup/company
/payroll/setup/admins
/payroll/setup/tax
/payroll/setup/bank
/payroll/setup/pay-schedule
/payroll/setup/workers
/payroll/setup/benefits
/payroll/setup/review
/payroll/runs
/payroll/runs/:runId
/payroll/people
/payroll/people/:personId
/payroll/contractors
/payroll/time
/payroll/pto
/payroll/taxes
/payroll/deductions
/payroll/benefits
/payroll/reports
/payroll/settings
/payroll/settings/permissions
/payroll/settings/billing
/payroll/help
```

Each setup step must support forward and backward navigation, persisted progress, validation, and resume-later behavior.

## 5. Payroll Home

The Payroll home must derive its content from actual payroll state.

Allowed dashboard areas:

- Next payroll date.
- Current payroll run status.
- Number of workers included in the next run.
- Missing onboarding items.
- Timecard exceptions.
- Pending approvals.
- Tax configuration warnings.
- Bank/disbursement configuration state.
- Recent payroll journal-posting state.

If no payroll dataset exists, render a setup state instead of decorative zeros.

## 6. Employer Onboarding

### 6.1 Company Identity

Required employer profile fields must support:

- Legal business name.
- DBA/trade name when applicable.
- Entity type.
- Federal EIN.
- Federal filing address.
- Mailing address.
- Work locations.
- State employer registration identifiers when required.
- Company signatory.
- Primary payroll contact.
- Payroll timezone.

The system must support multiple legal entities under one customer relationship while preserving separate tax identities, payroll ledgers, filings, and banking contexts where required.

### 6.2 Federal EIN

ATLAS must treat the EIN as a separate employer identity field from a user's SSN.

The help layer may explain high-level EIN concepts, but implementation must not present generic guidance as individualized tax advice.

The onboarding UI must include a link or reference to the official IRS employer-registration resource when registration is required.

Tax guidance content must be stored as governed help content with source URL, jurisdiction, effective date or reviewed date, and last-verified timestamp.

### 6.3 Company Addresses

Address types:

- Legal / federal filing address.
- Mailing address.
- Worksite address.
- State/local tax jurisdiction address.

Address records must include effective dates so historical payroll runs remain reproducible after an employer moves.

## 7. Administrative Roles and Permissions

ATLAS will not use one unrestricted `global admin` role as the only administrative model. It will provide a role/permission system layered on the shared ATLAS RBAC vocabulary.

Initial Payroll permission atoms:

- `payroll.read`
- `payroll.run.create`
- `payroll.run.approve`
- `payroll.run.process`
- `payroll.worker.manage`
- `payroll.contractor.manage`
- `payroll.compensation.read`
- `payroll.compensation.write`
- `payroll.tax.read`
- `payroll.tax.manage`
- `payroll.bank.read`
- `payroll.bank.manage`
- `payroll.benefits.read`
- `payroll.benefits.manage`
- `payroll.reports.read`
- `payroll.settings.manage`
- `payroll.billing.read`
- `payroll.billing.manage`
- `payroll.admin.manage`

Suggested roles:

- Organization Owner.
- Payroll Admin.
- Payroll Manager.
- HR Admin.
- Accountant / Controller.
- Payroll Approver.
- Read-only Auditor.

A regular Payroll Admin may be configured to perform operational payroll actions without receiving authority to add/remove top-level organization owners or grant permissions above their own authorization ceiling.

Permission elevation, banking changes, tax identity changes, company signatory changes, compensation changes, and payroll approval must emit audit events.

## 8. Workers and Contractors

### 8.1 Employees

Employee payroll profiles support:

- Employment status.
- Hire and termination dates.
- Work location.
- Compensation type.
- Hourly rate or salary.
- Pay frequency.
- Overtime eligibility configuration.
- Tax withholding elections.
- Pretax and post-tax deductions.
- Reimbursements.
- Garnishments when configured.
- Direct-deposit preferences when connected.
- PTO policy linkage.

### 8.2 Contractors

Contractors must remain distinguishable from employees in data model, payroll treatment, reporting, and tax-document workflow.

ATLAS must not silently classify a worker as a contractor merely because the employer selected a contractor payment workflow.

## 9. Time Tracking and PTO

Time Tracking is a first-party ATLAS capability rather than a paid ATLAS add-on for the internal tenant.

Core functions:

- Clock in/out or imported time entries.
- Manual entry with audit history.
- Regular hours.
- Overtime categories.
- Paid leave.
- Unpaid leave.
- Approval workflow.
- Payroll-lock state after a run reaches processing.
- Timecard exception detection.

PTO must support policy accrual, balances, approvals, and payroll effects without inventing balances when no policy exists.

## 10. Pay Schedule

Pay schedules must support at minimum:

- Weekly.
- Biweekly.
- Semimonthly.
- Monthly.

Schedule configuration includes:

- Pay frequency.
- Period start/end rules.
- Pay date.
- Weekend/holiday adjustment policy.
- Timecard cutoff.
- Approval deadline.
- Processing deadline.

Changing a schedule after payroll history exists must preserve historical schedule references and require explicit confirmation.

## 11. Gross-to-Net Payroll Engine

The Payroll Engine must be isolated from UI concerns and exposed through a deterministic domain interface.

Conceptual flow:

```text
Worker compensation
+ taxable earnings
+ non-taxable earnings
+ reimbursements
- pretax deductions
= taxable wage bases
- employee taxes
- post-tax deductions
- garnishments
= net pay
```

Employer-side liabilities are calculated separately from employee net pay.

Each calculation result must record:

- Rule version.
- Effective date.
- Inputs.
- Derived wage bases.
- Tax components.
- Deduction components.
- Employer liabilities.
- Net pay.
- Rounding decisions.
- Calculation checksum/version identifier.

Re-running the same immutable inputs under the same rule version must reproduce the same result.

## 12. Tax Rules and Compliance

Tax calculation and filing are separate capabilities.

Phase 1 may calculate and report payroll liabilities without claiming that ATLAS has filed or remitted taxes.

Any future filing/remittance provider must expose explicit statuses such as:

- Not configured.
- Configuration incomplete.
- Connected.
- Submission pending.
- Submitted.
- Accepted.
- Rejected.
- Payment pending.
- Paid.
- Failed.

No `filed`, `paid`, `compliant`, or `connected` state may be simulated.

Tax-rule data must be effective-dated and regression-tested against known examples before production use.

## 13. Bank Account and Disbursement

Employer bank configuration is a sensitive workflow.

The system must support:

- Account ownership metadata.
- Verification status.
- Connection provider metadata when applicable.
- Last verified timestamp.
- Funding account selection.
- Restricted display of account details.

ATLAS must not store raw bank credentials.

Initial disbursement paths may include:

- Manual payroll payment workflow.
- Bank export / ACH-compatible file workflow where legally and technically appropriate.
- Future authorized payment-provider adapters.

Direct deposit must not appear enabled until a real supported disbursement path is configured and verified.

## 14. Payroll Run Lifecycle

Canonical payroll run states:

```text
draft
-> review
-> awaiting_approval
-> approved
-> processing
-> processed
-> posted
```

Exceptional states:

```text
blocked
failed
cancelled
reversed
```

Each payroll run must capture:

- `id`
- `tenant_id`
- `organization_id`
- `legal_entity_id`
- `pay_schedule_id`
- `period_start`
- `period_end`
- `pay_date`
- `status`
- `worker_count`
- `gross_pay`
- `employee_tax_total`
- `employer_tax_total`
- `deduction_total`
- `net_pay_total`
- `rule_version`
- `created_by`
- `approved_by`
- `processed_at`
- `posted_at`
- `correlation_id`

## 15. Accounting Integration

A processed payroll run generates a balanced accounting posting contract rather than writing directly into arbitrary ledger tables.

Posting categories may include:

- Wage expense.
- Employer payroll tax expense.
- Benefits expense.
- Payroll tax liabilities.
- Benefits liabilities.
- Garnishment liabilities.
- Net payroll payable / cash clearing.

The Accounting module remains authoritative for General Ledger posting.

A run must show whether the journal is:

- Not generated.
- Generated.
- Awaiting posting approval.
- Posted.
- Posting failed.

## 16. Benefits and Insurance

Benefits/insurance is presented as a capability area, not as a false bundled promise.

Possible benefit categories:

- Health.
- Dental.
- Vision.
- Retirement.
- Life/disability.
- Workers' compensation.

If ATLAS does not yet have an authorized carrier/broker/provider integration, the UI must show a configuration state and may support internal deductions/admin records without claiming policy issuance or enrollment transmission.

External premiums and provider charges are separate from ATLAS software pricing.

## 17. Help Center and Contextual FAQ

The references show that contextual FAQ materially reduces onboarding friction. ATLAS should implement a reusable Help Drawer rather than copying Gusto FAQ text.

Initial Payroll help topics:

- Administrator permissions.
- Company addresses.
- Federal EIN.
- Federal filing address.
- Company bank account.
- Pay schedules.
- Employee versus contractor setup.
- Payroll approval.
- Tax filing state.
- Direct deposit configuration.

Each help article must include:

- Stable content ID.
- Title.
- Body.
- Module.
- Route/context tags.
- Jurisdiction when relevant.
- Source references when regulatory.
- Reviewed date.
- Last verified date.
- Owner.

ATLAS Assistant may surface these help entries contextually, but it must respect the same permission and tenant context as the active session.

## 18. Commercial Model

### 18.1 Internal ATLAS Organization

The internal owner organization uses a billing-exempt entitlement.

Suggested entitlement marker:

```text
billing_mode = internal_comp
```

Behavior:

- ATLAS software fee is `0` for that internal tenant.
- External provider charges remain visible and are not waived by this flag.
- The exemption is tenant-scoped, auditable, and not inferred from email address or client-side UI.

### 18.2 External Customer Organizations

External customer tenants are billable.

Suggested billing states:

```text
not_configured
trial
active
past_due
grace_period
suspended
cancelled
internal_comp
```

Billing model fields:

- `tenant_id`
- `organization_id`
- `billing_mode`
- `billing_status`
- `plan_id`
- `pricing_version`
- `billing_provider`
- `provider_customer_id`
- `provider_subscription_id`
- `current_period_start`
- `current_period_end`
- `grace_until`
- `created_at`
- `updated_at`

No public price is defined in this design. A separate commercialization/pricing decision will set base fees, per-worker fees, included capabilities, and optional paid services.

### 18.3 Entitlements

Feature access must be decided by explicit entitlements rather than by hiding navigation only.

Examples:

- `payroll.core`
- `payroll.time`
- `payroll.contractors`
- `payroll.benefits_admin`
- `payroll.tax_filing`
- `payroll.direct_deposit`
- `payroll.priority_support`
- `payroll.hr_resources`

For the internal tenant, approved first-party capabilities may be fully entitled without an ATLAS software charge.

For customer tenants, the entitlement service will later map plans to capabilities and pricing.

## 19. Add-ons

The Gusto reference exposes Money Plus, Priority Support, and HR Resources as add-ons. ATLAS should retain the concept of optional capability bundles while not copying those products.

Possible future ATLAS commercial add-ons:

- Payroll Tax Filing Service.
- Benefits Administration.
- Priority Support.
- Advanced HR Compliance Library.
- Advanced Workforce Analytics.
- International Payroll Connectors.
- ATLAS Pay payroll funding/disbursement features.

These remain capability placeholders until pricing, provider dependencies, and legal/compliance requirements are explicitly approved.

## 20. Data Model Boundaries

Payroll domain records must include both `tenant_id` and `organization_id` whenever they can vary across customer entities.

Core tables/entities will likely include:

- legal entities.
- employer tax profiles.
- company addresses.
- work locations.
- payroll admins / role bindings.
- workers.
- worker compensation records.
- contractor profiles.
- pay schedules.
- time entries.
- PTO policies and balances.
- deductions.
- tax elections.
- payroll runs.
- payroll run workers.
- payroll calculations.
- payroll liabilities.
- disbursement instructions.
- payroll journal contracts.
- billing accounts.
- billing subscriptions.
- entitlements.
- help content.
- audit events.

Historical records must not be destructively rewritten when a later configuration changes.

## 21. Security and Audit

Sensitive events include:

- Creating/removing administrators.
- Changing roles/permissions.
- Viewing or changing compensation.
- Changing tax identity.
- Changing bank account configuration.
- Changing company signatory.
- Approving payroll.
- Processing payroll.
- Reversing payroll.
- Posting payroll journal entries.
- Changing billing mode.
- Granting `internal_comp`.

Audit event contract follows ATLAS Core and must include actor, tenant, organization, entity, action, before/after state, timestamp, and correlation ID.

`internal_comp` must be restricted to a high-privilege platform/commercial permission and cannot be self-assigned by a normal customer administrator.

## 22. Responsive UI

The references were captured on mobile, so mobile parity is a first-class requirement.

Desktop:

- Persistent sidebar.
- Payroll setup workspace.
- Contextual help side panel.
- Dense tables where appropriate.

Tablet:

- Collapsible navigation.
- Responsive multi-column setup cards.

Mobile:

- Single-column setup flow.
- Sticky primary action where appropriate.
- Full-screen help drawer.
- Accessible accordion components.
- No horizontally clipped financial tables without a deliberate responsive strategy.

Required interaction states:

- active.
- hover where supported.
- focus-visible.
- selected.
- expanded/collapsed.
- loading.
- disabled.
- error.
- success.
- empty.
- permission denied.
- disconnected/integration unavailable.

## 23. Accessibility

Payroll setup and help UI must meet ATLAS accessibility standards:

- Semantic headings.
- Keyboard navigation.
- Screen-reader labels.
- Visible focus states.
- Accessible accordions.
- Error summaries linked to invalid fields.
- Text alternatives for meaningful graphics.
- No color-only status semantics.
- Sufficient target sizes on mobile.

## 24. Error Handling

Examples:

- Invalid EIN format -> block progression with field-level and summary error.
- Missing required work location -> setup incomplete.
- Unauthorized compensation access -> deny and audit access attempt where appropriate.
- Bank provider unavailable -> preserve entered non-secret metadata, show degraded state, and do not claim connection.
- Tax rule unavailable for jurisdiction/date -> block production calculation rather than estimate silently.
- Billing provider unavailable -> preserve commercial entitlement state locally only if authoritative architecture permits; do not claim payment succeeded.
- Accounting posting failure -> payroll remains processed but posting state becomes failed/pending remediation.

## 25. Testing Strategy

### Unit tests

- Payroll calculation primitives.
- Rounding.
- Pay schedule date generation.
- Effective-date selection.
- Permission evaluation.
- Billing entitlement evaluation.
- Internal-comp exemption behavior.
- Validation schemas.

### Integration tests

- Employer onboarding persistence.
- Admin permission boundaries.
- Time entry -> payroll input flow.
- Payroll run -> calculation -> approval flow.
- Payroll run -> accounting posting contract.
- Internal tenant billing exemption.
- External tenant billable-state enforcement.
- Contextual help resolution.

### End-to-end tests

- New employer completes setup.
- Employer adds first admin with constrained permissions.
- Employer configures EIN/address/pay schedule.
- Employer adds employee.
- Timecard is approved.
- Payroll is calculated and reviewed.
- Approver approves payroll.
- Processed payroll generates accounting posting contract.
- Internal ATLAS organization sees zero ATLAS software fee.
- Customer organization sees configured commercial/billing state rather than an internal exemption.
- Unauthorized user cannot view compensation, banking, or billing controls.

### Production gates

- No 404/500 on canonical Payroll routes.
- Build passes.
- Unit, integration, and E2E tests pass.
- Authorization verified server-side.
- Tenant isolation verified.
- Audit events verified.
- No secrets in client bundle or repository.
- No fabricated `connected`, `filed`, `paid`, or `compliant` states.
- Responsive verification on desktop/tablet/mobile.

## 26. Implementation Sequence

Recommended implementation order:

1. Payroll route shell and module navigation.
2. Payroll permission vocabulary and role bindings.
3. Employer/legal-entity setup.
4. Addresses and work locations.
5. EIN/tax profile setup.
6. Pay schedules.
7. Worker and compensation models.
8. Time Tracking and PTO inputs.
9. Deterministic payroll calculation engine.
10. Payroll run lifecycle and approvals.
11. Accounting posting contract.
12. Bank/disbursement adapter interface.
13. Benefits administration foundation.
14. Contextual Help Drawer and governed regulatory content.
15. Commercial billing/entitlement layer with `internal_comp` for the ATLAS internal tenant.
16. External customer billing-provider integration after explicit provider/pricing approval.
17. Full regression, security, accessibility, responsive, and production-readiness validation.

## 27. Explicit Non-Goals for the First Implementation Cycle

Unless separately approved, the first implementation cycle will not claim:

- Live payroll tax filing.
- Live tax remittance.
- Live insurance enrollment or policy issuance.
- Live direct deposit via a provider that has not been authorized and configured.
- Regulatory licensing that ATLAS does not hold.
- Customer pricing that has not been approved.
- Provider fees of `0` unless verified.

## 28. Success Criteria

This design is successful when ATLAS has a production-grade Payroll foundation that:

- Can onboard an employer and its payroll administrators.
- Preserves proper entity, address, tax, banking, and schedule structure.
- Supports worker compensation and time inputs.
- Produces deterministic payroll calculations.
- Uses approvals and audit trails for sensitive actions.
- Integrates cleanly with ATLAS Accounting.
- Provides contextual Payroll help.
- Gives the internal ATLAS organization a controlled `0` ATLAS software fee.
- Keeps external customer organizations commercially billable.
- Is ready for later approved pricing and billing-provider integration without redesigning the Payroll domain.
