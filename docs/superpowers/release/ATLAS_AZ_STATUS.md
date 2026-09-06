# ATLAS A-Z Release Status

Updated: 2026-09-06
Release branch: `release/atlas-a-z`
Master PR: #13
Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`

## Current phase

Multi-wave convergence on the A-Z release branch. Core + Accounting remains the surviving architecture baseline. Health Research, Automations, Site Review, Spatial, Telecom/MiFi, and a substantial governed People Operations slice are now present in the release tree. Revenue Operations and several platform/mobility domains remain future waves.

`main` has been reconciled back into `release/atlas-a-z` through a real two-parent merge commit. The release is no longer behind `main`; newer Humanity Atlas, ATLAS Manager, and Personal Voice architecture/plan documents are preserved alongside A-Z implementation work.

## Completed / integrated into the release tree

- Created isolated A-Z release branch and master draft PR #13.
- Established `atlasenterprisesuite/atlasenterprisesuite` as the operational canonical repository and synchronized canonical governance into `main` and `release/atlas-a-z`.
- Marked `winderaranguren-gif/Atlas-enterprise-suite` as legacy/historical and explicitly non-blocking.
- Reconciled the latest `main` history into A-Z without force replacement or loss of release work.
- Integrated ATLAS Manager architecture, Humanity Atlas foundations, and approved Personal Voice architecture/implementation plans as canonical documentation. These documents do not by themselves imply those product surfaces are implemented.
- Absorbed the richer Core + Accounting architecture while preserving production route/health configuration and newer non-conflicting work.
- Resolved the earlier React duplicate-runtime integration defect and obtained a successful Core + Accounting baseline before the later runner-allocation incident.
- Integrated Accounting domain and UI coverage for chart of accounts, journal entries, general ledger, AR, AP, bank/cash, reconciliation, assets, close, reports, governed writes, Supabase repositories/migrations, RBAC/tenant/audit contracts, and associated tests.
- Integrated governed Health Research code and tests: catalog, permissions, source-state, evidence, falsification, neural graph, reconstruction, curability guardrails, and Health routes.
- Integrated Automations core and unit guardrails.
- Integrated Site Review core and unit guardrails.
- Integrated Spatial entry/globe scene and route/preferences tests.
- Integrated Telecom/MiFi domain contracts, permission gates, responsive UI, validation, unavailable-adapter behavior, bridge protocol documentation, and tests. Real carrier/device control remains blocked/unverified and must not be represented as connected.
- Integrated People Operations foundation using the existing `employees` source of truth rather than creating a duplicate employee master.
- Integrated Time & Attendance domain calculations, organization/self-service reads, governed create/submit/approve/reject RPCs, audit evidence, responsive UI, and tests.
- Integrated deterministic Payroll calculation using integer-cent/scaled arithmetic, governed run/line RPCs, approval separation, audit evidence, truthful unconfigured tax/payment provider states, and tests.
- Hardened Payroll lifecycle so `locked` and `void` are terminal, and locking preserves the original approval actor/timestamp rather than replacing approval evidence.
- Integrated Compensation & Benefits reads, effective-dated compensation rules, deduction calculations, governed/audited RPC writes, overlap checks, responsive management UI, and truthful unconfigured benefits-provider state.
- Integrated Recruiting/Assessments reads, stage transitions, rejection/withdrawal reasons, governed assessment scoring/evidence, audit writes, responsive UI, and no automated hiring decision.
- Integrated Employee Self-Service as a read-only `payroll.self` surface that resolves the authenticated employee and re-filters own time, payroll, compensation, and deduction records in addition to RLS.
- Added dedicated ATLAS People CI covering People domain/write/repository/UI/route tests, truth-state scans, typecheck and build once a runner is actually allocated.
- Preserved production deployment workflow and `/healthz` assets without authorizing a partial A-Z deploy.

## People production boundary

People code and migrations are **implemented in the release branch but not yet production-verified**.

Current boundary:
- People migrations have not been applied to the production Supabase project from this A-Z wave.
- People routes are not claimed as production-verified.
- GitHub Actions has not executed the fresh People typecheck/tests/build because no runner is being assigned.
- External payroll filing, payment rails, benefits enrollment providers, and other provider-dependent capabilities remain explicitly unconfigured unless separately verified.

Do not collapse `implemented`, `migrated`, `tested`, `deployed`, and `verified` into one status.

## Current P0 infrastructure gate: GitHub Actions runner allocation

Issue: #22

Fresh A-Z workflow runs are currently failing before any workflow step executes. Reproductions show:

- `runs-on: ubuntu-latest`
- `runner_id: 0`
- empty runner name/group
- `steps: []`
- completion within seconds
- no application/test step beginning

The same failure reproduced on the dedicated ATLAS People CI after branch reconciliation. This is isolated as a GitHub Actions runner-allocation/account/infrastructure gate rather than an application test failure because `Set up job` never begins.

Do not change ATLAS application code solely to clear these red workflow statuses. Continue independent integration/review work. Once a runner is assigned and steps execute, treat any actual typecheck/test/build failure as a separate software defect and correct it normally.

## Verified historical control evidence

The same repository and Accounts Payable/Consensus workflows successfully executed on 2026-09-05 for integration commit `57b868276cc4c0ed6d967be6285dd53eb4ebf7c0`, including install, security audit, typecheck, unit tests, integration tests, and production build. This proves workflows were capable of normal execution before the current pre-runner failure mode.

## Release tree reality

Present now:
- Core governance / tenancy / RBAC / audit
- Accounting / Finance foundation
- Health Research foundation
- Automations core
- Site Review core
- Spatial entry
- Telecom/MiFi foundation and governed route
- People Operations: Time, Payroll, Compensation/Benefits, Recruiting/Assessments, Self-Service
- governed Supabase Accounting and People migrations
- shared React/Vite application shell
- production deployment workflow and health endpoint assets
- Humanity Atlas knowledge foundations
- ATLAS Manager architecture directive
- Personal Voice / Apple bridge approved architecture and implementation plans

Not yet first-class implementation domains:
- deeper Core HR employee-management CRUD and broader People administration surfaces beyond the current governed slice
- Revenue Operations / CRM / Sales / Purchasing / Inventory / POS / Projects
- remaining Platform Services such as Drive, implemented Knowledge UI, implemented Voice, Connect, Creator Studio, centralized Security/Settings surfaces
- remaining Mobility/Physical Ops domains such as Ride, GPS 4D, Parks, AutoWash, Insurance
- specialized financial rails such as ATLAS Pay with authorized providers
- real external Telecom carrier/device adapter

## Canonical and migration policy

- `atlasenterprisesuite/atlasenterprisesuite` is the current source of truth.
- `release/atlas-a-z` remains the integration axis.
- `main` remains production-stable until the final closure gate.
- The latest `main` history has been merged into A-Z; A-Z must be reconciled again whenever `main` advances materially.
- A future dedicated product repository `atlasenterprisesuite/atlas-enterprise-suite` is tracked in issue #21 but is non-blocking.
- Legacy repository access, if restored, is reconciled by comparison and selective auditable import; it never replaces newer canonical history by force.

## Next executable work

1. Continue independent A-Z integration/review on `release/atlas-a-z` while Actions is pre-runner blocked.
2. Keep People provider-dependent capabilities in truthful readiness states and do not apply production migrations until executable gates can run.
3. Continue approved domain plans only where they reuse current Core/RBAC/audit architecture and do not duplicate existing work.
4. Watch GitHub Actions; as soon as a runner is assigned and steps begin, inspect the real failures/successes, correct reversible defects, and re-run verification.
5. Require actual green typecheck, unit/integration tests, build and final release matrix before accepting the affected wave as verified.
6. Do not merge A-Z to `main` or deploy the release until the full final gate is green and production verification succeeds.
