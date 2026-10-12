# ATLAS Six-Dimensional Enterprise Operations Explorer

Date: 2026-10-12

Status: **simulation-only proposal**. Production readiness requires CI, review, merge, deployment, and exact-SHA verification.

## Reuse and scope

Enhances the existing `/advisory/enterprise-automation` route; reuses `calculateAutomationScenario` and its AP, AR, bank, GL close, People, inventory, purchasing and administration workload assumptions. No additional product shell, tenant store, identity system, automation runner or background worker is created.

"Six dimensions" is an operational decision metaphor; it does not assert that higher physical dimensions allow access to alternative futures.

1. Monthly work volume.
2. Human work time.
3. Monthly operating cost.
4. Recovered human capacity.
5. Projected RPA exception queue.
6. Human approval boundaries.

## Compared strategies

- Manual baseline: all work minutes are manual; no assumed platform fee.
- Human-assisted: existing modeled assisted touch time plus the user-entered monthly platform fee.
- Governed RPA pilot: assisted workload minus an adjustable time reduction applied only to selected lower-risk work, plus adjustable exception review hours, plus the same platform assumption.

Pilot-eligible categories: AR drafting/review, inventory work items, purchasing/operations intake, administration document intake. **Eligibility is only a modeling classification, never an execution permission.**

Restricted categories: AP, bank reconciliations, GL close and payroll/people. Their approval, accounting posting, disbursement, provider trust and tenant boundaries remain unchanged.

The preferred scenario minimizes *estimated* monthly labor plus platform expense. On a cost tie it selects the less autonomous path. No scenario can execute tasks, pay invoices, make payroll changes, move funds, or save business records.

## Assumptions and limitations

Default scenario parameters are **illustrative, not empirically observed**: 60% lower-risk coverage, 45% time reduction on assisted time, 4% review exception rate, and 8 minutes per exception. Values are editable in-browser and not persisted.

The results are NOT forecasts or validated cost savings. The RPA pilot does not incorporate incremental licenses, deployment costs, fixed staff redeployment constraints, business impacts or real data. The existing setup cost applies to the broader calculator but **not** the monthly comparison. No automated exception queue is modeled for manual or human-assisted paths, which display "Not modeled" rather than zero.

## Gates

P0 fail closed:

- No network calls or state-changing operations from `enterpriseSixDimensionModel.ts`.
- No bypass of identity, organization membership, RLS, RBAC, step-up MFA, audit or approval systems.
- Reject invalid rates and non-finite review minutes.
- Keep simulation results clearly separate from live measurements.
- Never present a simulation ranking as approval for executing finance/payroll operations.

P1 validations:

- Test no-volume, high-exception, invalid-rate and typical multi-company scenarios.
- Typecheck and build front end.
- Verify responsive / keyboard-accessible experience.
- Run global production verifier after merge; compare deployed SHA against merged SHA.
- Add source-based telemetry and actual-vs-simulated variance only after a separate backend security review.

## Workflows

Primary route: `/advisory/enterprise-automation#automation-six-dimension`

Launch policy: start with advisory planning. Any future transition to `/work` or `/automations` must use the existing authorized execution engine and approval policies; this feature currently initiates no job.
