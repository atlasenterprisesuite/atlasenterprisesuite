# ATLAS Family Care and Startup Validation — incorporation proposal

Date: 2026-10-06
Repository: atlasenterprisesuite/atlasenterprisesuite
Status: DESIGNED / proposal. No care service, payer connection, certification, claim submission or payment is operational because of this document.
Owner: Health OS for care operations; Business / Advisory for commercial validation.

## Outcome

Adapt two useful principles from Abby Care: coordinate an existing family-care workforce through one documented workflow, and validate a focused commercial offering before expanding it. ATLAS should test software for authorized home-care agencies as an initial customer segment. This is a business hypothesis, not demonstrated demand or a partnership.

The proposed offering connects intake, caregiver readiness, approved care activities, time evidence, agency review and financial reconciliation. It does not promise that every family member can be paid or that Medicaid will fund a particular case.

## Source evidence and limits

- https://www.abbycare.org/ — reviewed 2026-10-06: company describes caregiver training, employment/payroll coordination, clinical support and care documentation.
- https://www.abbycare.org/florida — reviewed 2026-10-06: company describes support for the Family Home Health Aide program.
- These are company descriptions, not authoritative eligibility rules. The Florida page contains geographically inconsistent county information; do not import its county list.
- The supplied Forbes screenshot reports a USD 225 million valuation. This valuation, revenue, age and state count were not independently verified and are not inputs to ATLAS projections.
- Do not reproduce Abby Care branding, photographs, claims of clinical outcomes or business metrics as ATLAS assets.
- No affiliation with Abby Care, Medicaid or any agency is established.

## Inspected ATLAS and reuse boundaries

| Evidence inspected | What it supports | What remains unverified |
| --- | --- | --- |
| AGENTS.md and docs/governance/ATLAS_MASTER_AUTONOMOUS_EXECUTION_PROTOCOL.md | Canonical main, Cloudflare delivery, Supabase direction, tenant isolation, RBAC, audit and truthful provider readiness | Runtime availability of care-related dependencies |
| apps/web/src/modules/business/BusinessEcosystemPage.tsx | Existing Business, Advisory, CRM, Finance, People, Payroll, Analytics and Learning links | Linked route persistence, permissions and production readiness |
| docs/superpowers/specs/2026-09-03-atlas-health-adventhealth-ecosystem-design.md (search excerpts) | Health operations architecture already designed | A design is not implemented clinical operations |
| docs/superpowers/plans/2026-09-03-atlas-health-adventhealth-implementation.md (search excerpts) | Health layout/navigation planned | Fetch of proposed OperationsNav.tsx returned 404; do not treat that path as present |
| docs/audit/2026-09-13-atlas-module-readiness-matrix.md (search excerpts) | Historical warnings for HR and Timecards; partial Payroll | Current readiness must be tested; this audit is not current proof |
| Code searches: caregiver, home-care | No dedicated caregiving implementation found in returned matches | Search coverage is limited; perform a checkout-wide search before adding equivalents |

Reuse the existing enterprise shell and module ownership. Do not create a new top-level app, payment orchestrator, identity store or parallel AI bus.

## Incorporations

### 1. Family Care inside Health OS

Proposed navigation: Health OS -> Operations -> Family Care.
Proposed route, not implemented: /health/operations/family-care.

- Intake with consent, minimal participant details, agency and program references.
- Caregiver readiness: identity reference, relationship, training evidence, certificate expiry and agency verification.
- Program evidence: jurisdiction, effective rule version, source URL, reviewer, payer authorization reference, approved dates and hours.
- Agency-approved care plan and assignments.
- Visit documentation with timestamps, tasks, exceptions and review history.
- Approved work export to existing Payroll/Finance contracts only after those contracts are verified.
- Separate work approval, payroll payable, claim preparation, payer remittance and bank settlement states.
- Family-facing progress and agency-facing exception queues.

No automated diagnosis, care prescription, clinical certification, payer eligibility decision or guarantee of reimbursement.

### 2. Startup validation inside Business / Advisory

Reuse existing Business Launch 360, CRM and Business Insights after inspecting their actual data contracts.

Each opportunity records:
- Problem, customer, payer/buyer distinction and present alternative.
- Interview or pilot evidence with date, consent and source.
- Offer, proposed pricing and delivery costs.
- Experiment, owner, measurable success criterion and decision date.
- Evidence-backed decision: continue, change or stop.

Initial hypothesis: authorized agencies will pay a software subscription for documentation and administration. Price and market size remain unknown until verified. Do not sell access to protected health information.

### 3. Financial and operational evidence

Metrics must be calculated from real records with explicit date windows:
- Days from intake to agency authorization.
- Verified caregivers / caregivers awaiting readiness review.
- Approved hours / documented hours; rejected hours and rejection reasons.
- Time spent on administration per approved case.
- Revenue actually earned, direct costs and contribution margin.
- Customer acquisition cost, retention and repeat use when sample and attribution are adequate.

Keep patient outcomes distinct from business metrics. Do not infer causality from an uncontrolled change.

Valuation remains separate from revenue, cash and profit. No valuation estimate is generated from module count.

## Data and permissions contract

Before adding tables, map existing tenant, person, document, task, learning, time-entry and finance schemas in a full checkout. Extend existing records where their semantics match. Proposed care-specific records: case, program evidence, caregiver assignment, care-plan version, visit and review event.

Every record includes tenant and appropriate agency ownership. Actor tenant/agency comes from the authenticated server context, never a client-supplied authority. Database policies and server permission checks enforce isolation.

Roles: family participant, assigned caregiver, agency coordinator, authorized clinical reviewer, finance reviewer and tenant administrator. Each role receives least-privilege access. Financial reviewers receive approved work references and minimum necessary data rather than unrestricted clinical notes.

- Training completion is distinct from externally recognized certification.
- Self-reported program information stays pending until an authorized agency verifies it.
- Changed rules, revoked authorization and expired certificates block new approval.
- Edits to submitted visits create audited revisions; approved entries are not silently overwritten.
- Reject overlapping visits, missing evidence and hours outside the authorization window.
- Idempotent approval/export prevents duplicate payable entries.
- No personal health data in GitHub, browser analytics, prompts, example fixtures or public logs.
- Determine applicable privacy obligations, consent, retention, provider agreements and deployment suitability before collecting real health information.

## Executable implementation sequence

1. Obtain canonical checkout; search all instructions and schemas; confirm actual Health routing, shared services, authentication, audit and tests. Record reuse decisions.
2. Add meaningful failing domain tests for readiness, authorization expiry, hours limits, overlap rejection, audited edits and export idempotency.
3. Implement deterministic care workflow rules. External readiness defaults to pending, with reasons.
4. Add tenant-scoped persistence and migration only after existing schema mapping. Test cross-tenant and cross-agency denial against the database.
5. Integrate responsive routes and navigation in the actual Health shell. Forms persist through authenticated APIs and present real empty/loading/error/success states.
6. Connect verified Learning/People references; keep certification confirmation separate.
7. Connect verified time approval and Finance/Payroll handoff. Do not submit payer claims or send money without configured and authorized adapters.
8. Extend existing Advisory/Business opportunity records and Insights for pilot evidence and computed metrics.
9. Run focused tests and root npm ci, npm run typecheck, npm test, npm run build. Add end-to-end intake -> evidence -> approval -> visit -> review -> export tests, including revoked readiness and denied access.
10. Open implementation PR to main, satisfy CI/review, merge through the canonical workflow and deploy to Cloudflare.
11. Verify exact deployed revision, affected routes, authentication, persistence and desktop/tablet/mobile behavior.

Proposed test cases are requirements; none have run as a result of this document.

## Launch and verification gates

Internal rules and synthetic test fixtures can be implemented independently of payer integration. Real patient intake requires verified privacy/security suitability and agency authority. Clinical care delivery, certification recognition, payer participation, authorized reimbursement and money movement remain external boundaries until evidence exists.

Production verification is fail-closed for P0:
- Public root: HTTP 200, expected app shell, TLS, HSTS and CSP.
- Existing canonical health endpoint: HTTP 200 with documented healthy JSON; discover actual path before assuming /health or /api/v1/health.
- New authenticated Family Care route: correct session behavior, no 404/500, authorized navigation and persistent actions.
- Unauthorized tenant/agency reads and writes denied.
- Any existing P0 ATLAS Network routes discovered from the repository's canonical verification matrix.

Record P1 warnings separately. A successful HTTP response alone does not prove workflow or deployment integrity.

## Evidence required before advancing lifecycle

DESIGNED: specification present.
IMPLEMENTATION/TDD: code and failing/passing test evidence present.
EN EVOLUCION: working partial functionality plus explicit verifiable remaining limits.
OPERATIVO: required baseline gates and production end-to-end evidence pass.
EVOLUCION CONTINUA: measured improvements after operational baseline.

This proposal introduces no runtime changes and must not increase an operational module counter.
