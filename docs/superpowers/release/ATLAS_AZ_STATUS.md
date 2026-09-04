# ATLAS A-Z Release Status

Updated: 2026-09-04
Release branch: `release/atlas-a-z`
Master PR: #13

## Current phase

Wave 0/1: Core + Accounting convergence and arbitration baseline.

## Completed

- Created isolated A-Z release branch from production `main`.
- Added umbrella A-Z closure architecture and execution program.
- Opened master draft PR #13 to keep partial work out of production.
- Absorbed the verified PR #8 Core + Accounting tree as a traceable merge parent while preserving newer production workflows, `/healthz`, data, Health/MiFi plans, and A-Z program documents.
- Preserved the current Accounts Payable regression tests alongside the richer Accounting test suite.
- Identified a duplicate React runtime in the converged workspace: React/ReactDOM 18 at the root and React/ReactDOM 19 in `apps/web` caused invalid-hook failures in integration tests.
- Aligned the root test runner with React/ReactDOM 19 and regenerated the lockfile through the release lockfile-sync workflow.
- Verified the corrected dependency graph with a successful full Core + Accounting CI baseline, including typecheck, integration smoke tests, Core tests, Accounting/AR/AP/GL/Journal tests, real-data safety scan, and production build.
- Classified active parallel work for selective integration: Telecom MiFi (#14), Health Core/Operations (#12), Spatial + Health Research (#16), Disease Reconstruction (#6), Automations & Shortcuts (#7), Site Review (#5), and repository templates (#15). Branches that reimplement the legacy shell/router/Core will be ported selectively rather than merged wholesale.

## Active gate

Run the complete pull-request CI matrix against the synchronized release head. Accounts Payable CI must execute against the regenerated lockfile and the security audit must pass or be clearly identified as an external registry outage. No additional domain is accepted until this baseline is green.

## Arbitration policy

- `release/atlas-a-z` is the integration axis.
- Current A-Z Core, tenancy, RBAC, audit, routing, and Accounting implementations survive unless a candidate proves a strictly stronger compatible implementation.
- PR #8 is already absorbed and must not be merged again.
- PRs #12, #14, and #16 are selective-port sources because their shell/router changes overlap the surviving A-Z architecture.
- PRs #5 and #7 contain useful domain logic from an older JavaScript architecture and require adaptation before inclusion.
- PR #6 contributes governed Health research logic and tests, but not its legacy application root.
- PR #15 is non-runtime repository metadata and can be integrated independently after the baseline gate.

## Production policy

`main` remains unchanged until the complete A-Z release gate is green. No partial A-Z production deployment is authorized by this release program.
