# ATLAS A-Z Release Status

Updated: 2026-09-06
Release branch: `release/atlas-a-z`
Master PR: #13
Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`

## Current phase

Multi-wave convergence on the A-Z release branch. Core + Accounting is the surviving architecture baseline; Health Research, Automations, Site Review, Spatial, and Telecom/MiFi foundations are already present in the release tree. People Operations and Revenue Operations have not yet been absorbed into the release tree.

## Completed / integrated into the release tree

- Created isolated A-Z release branch and master draft PR #13.
- Established `atlasenterprisesuite/atlasenterprisesuite` as the operational canonical repository and synchronized the canonical-governance manifest plus README into both `main` and `release/atlas-a-z`.
- Marked `winderaranguren-gif/Atlas-enterprise-suite` as legacy/historical and explicitly non-blocking.
- Absorbed the richer Core + Accounting architecture while preserving production route/health configuration and newer non-conflicting work.
- Resolved the earlier React 18/19 duplicate-runtime integration defect and obtained a successful Core + Accounting baseline before later release commits.
- Integrated Accounting domain and UI coverage for dashboard/accounting home, chart of accounts, journal entries, general ledger, AR, AP, bank/cash, reconciliation, assets, close, reports, governed writes, Supabase repositories/migrations, RBAC/tenant/audit contracts, and associated unit/integration tests.
- Integrated governed Health Research code and tests: catalog, permissions, source-state, evidence, falsification, neural graph, reconstruction, and curability guardrails, plus Health routes.
- Integrated Automations core and its unit guardrails.
- Integrated Site Review core and its unit guardrails.
- Integrated Spatial entry/globe scene and route/preferences tests.
- Integrated Telecom/MiFi domain contracts, validation, unavailable adapter behavior, bridge protocol documentation, and unit tests. Real carrier/device control remains unverified and must not be represented as connected.
- Preserved production deployment workflow and `/healthz` assets without authorizing a partial A-Z deploy.

## Current P0 infrastructure gate: GitHub Actions runner allocation

Issue: #22

Fresh A-Z workflow runs are currently failing before any workflow step executes. Reproductions show:

- `runs-on: ubuntu-latest`
- `runner_id: 0`
- empty runner name/group
- `steps: []`
- completion in about two seconds
- job log retrieval returning `BlobNotFound`

A manual re-run reproduced the same failure. This is isolated as a GitHub Actions runner-allocation/account/infrastructure gate rather than an application test failure because `Set up job` never begins.

Do not change ATLAS application code solely to clear these red workflow statuses. Continue all independent integration work and re-run CI once GitHub assigns a runner. When runners execute again, any real test/build failures must be debugged separately.

## Verified control evidence

The same repository and Accounts Payable/Consensus workflows successfully executed on 2026-09-05 for integration commit `57b868276cc4c0ed6d967be6285dd53eb4ebf7c0`, including install, security audit, typecheck, unit tests, integration tests, and production build. This proves the workflows were capable of executing normally before the current pre-runner failure mode.

## Release tree reality

Present now:
- Core governance
- Accounting / Finance foundation
- Health Research foundation
- Automations core
- Site Review core
- Spatial entry
- Telecom/MiFi foundation
- governed Supabase Accounting migrations
- shared React/Vite application shell
- production deployment workflow and health endpoint assets

Not yet present as first-class release domains:
- People Operations / HR / Payroll / Time / Recruiting
- Revenue Operations / CRM / Sales / Purchasing / Inventory / POS / Projects
- remaining Platform Services such as Drive, Knowledge, Voice, Connect, Creator Studio, centralized Security/Settings surfaces
- remaining Mobility/Physical Ops domains such as Ride, GPS 4D, Parks, AutoWash, Insurance
- specialized financial rails such as ATLAS Pay with authorized providers

## Canonical and migration policy

- `atlasenterprisesuite/atlasenterprisesuite` is the current source of truth.
- `release/atlas-a-z` remains the integration axis.
- `main` remains production-stable until the final closure gate.
- A future dedicated product repository `atlasenterprisesuite/atlas-enterprise-suite` is tracked in issue #21 but is non-blocking.
- Legacy repository access, if restored, is reconciled by comparison and selective auditable import; it never replaces newer canonical history by force.

## Next executable work

1. Keep A-Z work on `release/atlas-a-z`.
2. Reconcile the program map/checklists against this current tree so completed imports are not duplicated.
3. Continue existing approved domain plans that can be executed without provider credentials.
4. Keep provider/hardware/payment/clinical capabilities in truthful readiness states.
5. Re-run the full CI matrix once runner allocation works; require actual green tests/build before accepting the affected wave as verified.
6. Do not merge A-Z to `main` or deploy the release until the full final gate is green and production verification succeeds.
